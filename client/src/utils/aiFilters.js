import { TYPE_LABEL } from "../data/site.js";
import { formatNpr, formatPrice, totalPrice } from "./format.js";

// Helpers that connect the AI service's structured filters to the existing search.
// The AI only ever produces filters. Results always come from the existing listProperties() query,
// so only published listings can appear, and the reasons shown for each match are computed here
// from the listing's real fields, never written by the AI.

const KEYS = ["purpose", "type", "category", "location", "amenity", "minPrice", "maxPrice", "bedrooms", "bathrooms", "sort"];

export function filtersToParams(filters) {
  const params = new URLSearchParams();
  for (const k of KEYS) {
    const v = filters?.[k];
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  return params;
}

// Pick the existing page that best fits the filters (the page's own fixed filters can't conflict).
export function pathForFilters(f = {}) {
  if (f.type === "land" && f.purpose !== "rent") return "/land";
  if (f.type === "commercial") return "/commercial";
  if (f.purpose === "rent" && f.type !== "land") return "/rent";
  if (f.purpose === "sale" && f.type !== "land") return "/buy";
  return "/properties";
}

const money = (n, rent) => (rent ? `Rs. ${Number(n).toLocaleString("en-IN")}/month` : formatNpr(Number(n)));

export function describeFilterTags(f = {}) {
  const rent = f.purpose === "rent";
  const tags = [];
  if (f.purpose) tags.push(rent ? "For rent" : "For sale");
  if (f.type) tags.push(TYPE_LABEL[f.type] || f.type);
  if (f.category) tags.push(f.category);
  if (f.bedrooms) tags.push(`${f.bedrooms}+ bedrooms`);
  if (f.bathrooms) tags.push(`${f.bathrooms}+ bathrooms`);
  if (f.location) tags.push(f.location);
  if (f.amenity) tags.push(`With ${String(f.amenity).toLowerCase()}`);
  if (f.minPrice) tags.push(`From ${money(f.minPrice, rent)}`);
  if (f.maxPrice) tags.push(`Up to ${money(f.maxPrice, rent)}`);
  return tags;
}

// Why a listing matches, from its own data. Each reason is only added if it is actually true.
export function explainMatch(p, f = {}) {
  const reasons = [];
  if (f.purpose && p.listingType === (f.purpose === "rent" ? "rent" : "sale")) reasons.push(p.listingType === "rent" ? "For rent" : "For sale");
  if (f.type && p.propertyType === f.type) reasons.push(p.category && f.category && p.category === f.category ? `${TYPE_LABEL[p.propertyType]}, ${p.category}` : TYPE_LABEL[p.propertyType]);
  if (f.location && [p.location, p.city, p.district].some((value) => String(value || "").trim().toLocaleLowerCase() === String(f.location).trim().toLocaleLowerCase())) reasons.push(`In ${f.location}`);
  if (f.bedrooms && p.bedrooms >= Number(f.bedrooms)) reasons.push(`${p.bedrooms} ${p.bedrooms === 1 ? "bedroom" : "bedrooms"} (you asked for ${f.bedrooms}+)`);
  if (f.bathrooms && p.bathrooms >= Number(f.bathrooms)) reasons.push(`${p.bathrooms} ${p.bathrooms === 1 ? "bathroom" : "bathrooms"} (you asked for ${f.bathrooms}+)`);
  const total = totalPrice(p);
  const rent = p.listingType === "rent";
  if (f.maxPrice && total <= Number(f.maxPrice)) reasons.push(`${formatPrice(p)}, within your budget of up to ${money(f.maxPrice, rent)}`);
  else if (f.minPrice && total >= Number(f.minPrice)) reasons.push(`${formatPrice(p)}, above your minimum of ${money(f.minPrice, rent)}`);
  if (f.amenity && p.amenities?.includes(f.amenity)) reasons.push(`Includes ${String(f.amenity).toLowerCase()}`);
  return reasons.length ? reasons : ["Matches your search"];
}
