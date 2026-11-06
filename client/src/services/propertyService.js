import { IMAGE_BUCKET, isSupabaseConfigured, supabase } from "./supabase.js";
import { AMENITY_OPTIONS, COMMERCIAL_CATEGORIES, LAND_CATEGORIES, LOCATIONS } from "../data/site.js";
import { PROPERTIES as DEMO } from "../data/properties.js";
import { PUBLIC_STATUSES, filterProperties } from "../utils/filterProperties.js";
import { totalPrice } from "../utils/format.js";

// One access point for property data used by every public page.
//   - Supabase configured  -> reads published listings from the database
//   - not configured       -> reads the built-in demo listings (data/properties.js)
// Both return the same shape, so the pages don't care which one is active.

export const PAGE_SIZE = 12;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Columns safe for visitors. We list columns explicitly because visitors have no access to owner_id or review details.
export const PUBLIC_COLUMNS =
  "id,title,description,listing_type,property_type,category,price_npr,price_unit,location,city,district,bedrooms,bathrooms," +
  "area_sqft,land_area_aana,road_access,amenities,contact_name,contact_phone,contact_email,status,availability,featured,created_at";
export const IMAGE_COLUMNS = "id,property_id,path,external_url,position";

// ---------- image URLs (private bucket -> short-lived signed URLs) ----------
const SIGNED_URL_TTL = 3600;
const signedCache = new Map(); // path -> { url, expires }

export async function signPaths(paths) {
  const wanted = [...new Set(paths.filter(Boolean))];
  const now = Date.now();
  const missing = wanted.filter((p) => !(signedCache.get(p)?.expires > now));
  if (missing.length) {
    const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);
    if (error) throw error;
    for (const item of data) {
      if (item.signedUrl) signedCache.set(item.path, { url: item.signedUrl, expires: now + (SIGNED_URL_TTL - 300) * 1000 });
    }
  }
  return Object.fromEntries(wanted.map((p) => [p, signedCache.get(p)?.url]));
}

// Convert a database row (snake_case) into the shape the UI components already use.
export function toProperty(row, urls = {}) {
  const images = [...(row.property_images || [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.external_url || urls[i.path])
    .filter(Boolean);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    listingType: row.listing_type,
    propertyType: row.property_type,
    category: row.category || undefined,
    roadAccess: row.road_access || undefined,
    price: Number(row.price_npr),
    priceUnit: row.price_unit,
    location: row.location,
    city: row.city,
    district: row.district,
    bedrooms: row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    area: Number(row.area_sqft ?? 0),
    landArea: row.land_area_aana ? Number(row.land_area_aana) : null,
    amenities: row.amenities || [],
    images,
    featured: row.featured,
    status: row.availability,          // marketplace availability: available | pending | sold | rented
    reviewStatus: row.status,          // moderation status: draft | pending_review | published | ...
    rejectionReason: row.rejection_reason || undefined,
    agent: { id: row.id, name: row.contact_name, role: "Listing contact", phone: row.contact_phone, email: row.contact_email },
    createdAt: row.created_at,
  };
}

// Photos are loaded in a second request (not embedded in the properties query), which keeps the
// properties query simple and independent of how the database relationship is described.
export async function fetchImageRows(propertyIds) {
  if (!propertyIds.length) return [];
  const { data, error } = await supabase.from("property_images").select(IMAGE_COLUMNS).in("property_id", propertyIds).order("position", { ascending: true });
  if (error) throw error;
  return data;
}

// Attach photos, sign their URLs and convert rows to the shape the UI uses.
// `firstOnly` is for list pages (one photo per card).
export async function hydrate(rows, { firstOnly = false } = {}) {
  const imageRows = await fetchImageRows(rows.map((r) => r.id));
  const byProperty = new Map();
  for (const img of imageRows) byProperty.set(img.property_id, [...(byProperty.get(img.property_id) || []), img]);
  const trimmed = rows.map((r) => {
    const imgs = (byProperty.get(r.id) || []).sort((a, b) => a.position - b.position);
    return { ...r, property_images: firstOnly ? imgs.slice(0, 1) : imgs };
  });
  const urls = await signPaths(trimmed.flatMap((r) => r.property_images.map((i) => i.path)));
  return trimmed.map((r) => toProperty(r, urls));
}

// ---------- filters -> PostgREST query ----------
const parseBand = (band) => {
  if (!band) return [null, null];
  const [min, max] = band.split("-");
  return [min ? Number(min) : null, max ? Number(max) : null];
};
const num = (v) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

function applyFilters(query, f) {
  // Only whitelisted values are placed inside filter strings, so URL parameters cannot alter the query.
  query = query.eq("status", "published").in("availability", PUBLIC_STATUSES);
  if (f.purpose === "sale" || f.purpose === "rent") query = query.eq("listing_type", f.purpose);
  if (["house", "apartment", "land", "commercial"].includes(f.type)) query = query.eq("property_type", f.type);
  if ([...COMMERCIAL_CATEGORIES, ...LAND_CATEGORIES].includes(f.category)) query = query.eq("category", f.category);
  if (LOCATIONS.includes(f.location)) query = query.or(`location.eq.${f.location},city.eq.${f.location}`);
  if (AMENITY_OPTIONS.includes(f.amenity)) query = query.contains("amenities", [f.amenity]);

  let [pMin, pMax] = parseBand(f.price);
  if (num(f.minPrice) !== null) pMin = num(f.minPrice);
  if (num(f.maxPrice) !== null) pMax = num(f.maxPrice);
  if (pMin !== null) query = query.gte("total_price_npr", pMin);
  if (pMax !== null) query = query.lt("total_price_npr", pMax);

  if (num(f.bedrooms) !== null) query = query.gte("bedrooms", num(f.bedrooms));
  if (num(f.bathrooms) !== null) query = query.gte("bathrooms", num(f.bathrooms));
  const [aMin, aMax] = parseBand(f.area);
  if (aMin !== null) query = query.gte("area_sqft", aMin);
  if (aMax !== null) query = query.lt("area_sqft", aMax);
  return query;
}

function applySort(query, sort) {
  if (sort === "price-asc") query = query.order("total_price_npr", { ascending: true });
  else if (sort === "price-desc") query = query.order("total_price_npr", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  return query.order("id");
}

// ---------- demo backend ----------
const demoDelay = (value, ms = 300) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const demoPublic = () => DEMO.filter((p) => PUBLIC_STATUSES.includes(p.status));

const demo = {
  async list(filters, limit) {
    const all = filterProperties(DEMO, filters);
    return demoDelay({ items: all.slice(0, limit), total: all.length });
  },
  get: async (id) => demoDelay(DEMO.find((p) => p.id === id) || null),
  featured: async (n) => DEMO.filter((p) => p.featured && p.status === "available").slice(0, n),
  async counts() {
    const rows = demoPublic();
    return {
      house: rows.filter((p) => p.propertyType === "house").length,
      apartment: rows.filter((p) => p.propertyType === "apartment").length,
      land: rows.filter((p) => p.propertyType === "land").length,
      commercial: rows.filter((p) => p.propertyType === "commercial").length,
      rent: rows.filter((p) => p.listingType === "rent").length,
    };
  },
  similarPool: async (property) => DEMO.filter((p) => p.id !== property.id && p.status === "available"),
  byIds: async (ids) => DEMO.filter((p) => ids.includes(p.id) && PUBLIC_STATUSES.includes(p.status)),
};

// ---------- Supabase backend ----------
const remote = {
  async list(filters, limit) {
    let q = supabase.from("properties").select(PUBLIC_COLUMNS, { count: "exact" });
    q = applySort(applyFilters(q, filters), filters.sort).range(0, limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { items: await hydrate(data, { firstOnly: true }), total: count ?? data.length };
  },
  async get(id) {
    if (!UUID_RE.test(id)) return null; // not a database id, so it can't exist
    const { data, error } = await supabase.from("properties").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? (await hydrate([data]))[0] : null;
  },
  async featured(n) {
    const base = () => supabase.from("properties").select(PUBLIC_COLUMNS).eq("status", "published").eq("availability", "available");
    let { data, error } = await base().eq("featured", true).order("created_at", { ascending: false }).limit(n);
    if (error) throw error;
    if (data.length < n) {
      // Not enough flagged listings yet: top up with the newest published ones.
      const have = new Set(data.map((r) => r.id));
      const extra = await base().order("created_at", { ascending: false }).limit(n + data.length);
      if (extra.error) throw extra.error;
      data = [...data, ...extra.data.filter((r) => !have.has(r.id))].slice(0, n);
    }
    return hydrate(data, { firstOnly: true });
  },
  async counts() {
    const { data, error } = await supabase.from("properties").select("property_type,listing_type").eq("status", "published").in("availability", PUBLIC_STATUSES).limit(2000);
    if (error) throw error;
    const c = { house: 0, apartment: 0, land: 0, commercial: 0, rent: 0 };
    for (const r of data) {
      c[r.property_type] += 1;
      if (r.listing_type === "rent") c.rent += 1;
    }
    return c;
  },
  async byIds(ids) {
    const valid = ids.filter((id) => UUID_RE.test(id));
    if (!valid.length) return [];
    const { data, error } = await supabase.from("properties").select(PUBLIC_COLUMNS)
      .eq("status", "published").in("availability", PUBLIC_STATUSES).in("id", valid).limit(100);
    if (error) throw error;
    return hydrate(data, { firstOnly: true });
  },
  async similarPool(property) {
    const { data, error } = await supabase.from("properties").select(PUBLIC_COLUMNS).eq("status", "published").eq("availability", "available")
      .eq("property_type", property.propertyType).eq("listing_type", property.listingType).neq("id", property.id)
      .order("created_at", { ascending: false }).limit(12);
    if (error) throw error;
    return hydrate(data, { firstOnly: true });
  },
};

const backend = isSupabaseConfigured ? remote : demo;

// ---------- public API ----------
// listProperties(filters, { limit }) -> { items, total }
export const listProperties = (filters = {}, { limit = PAGE_SIZE } = {}) => backend.list(filters, limit);
export const getProperty = (id) => backend.get(id);
export const getFeatured = (limit = 3) => backend.featured(limit);
export const getCategoryCounts = () => backend.counts();
// Published listings for a list of ids (used by the Favorites page), newest first
export const getPropertiesByIds = async (ids) => (await backend.byIds(ids)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Simple relevance score: same listing type, property type, city and a similar price
export async function getSimilar(property, limit = 3) {
  const pool = await backend.similarPool(property);
  const price = totalPrice(property) || 1;
  return pool
    .map((p) => {
      let score = 0;
      if (p.listingType === property.listingType) score += 3;
      if (p.propertyType === property.propertyType) score += 3;
      if (p.city === property.city) score += 2;
      const ratio = totalPrice(p) / price;
      if (ratio > 0.6 && ratio < 1.4) score += 2;
      return { p, score };
    })
    .filter((x) => x.score >= 5)
    .sort((a, b) => b.score - a.score || new Date(b.p.createdAt) - new Date(a.p.createdAt))
    .slice(0, limit)
    .map((x) => x.p);
}
