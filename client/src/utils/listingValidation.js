import { AMENITY_OPTIONS, LOCATION_META } from "../data/site.js";
import { sqftFromAana } from "./format.js";

export const MAX_IMAGES = 12;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMPTY_LISTING = {
  title: "", listingType: "sale", propertyType: "house", category: "", price: "", priceUnit: "total",
  location: "", otherLocation: "", otherCity: "", bedrooms: "", bathrooms: "", areaSqft: "", landArea: "",
  roadAccess: "", description: "", amenities: [], contactName: "", contactPhone: "", contactEmail: "",
};

const toNum = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// Returns { fieldName: "message" }. Saving a draft needs the basics the database requires;
// submitting for review also needs the details reviewers need to judge the listing.
export function validateListing(v, { submit, imageCount }) {
  const e = {};
  const title = v.title.trim();
  if (title.length < 5 || title.length > 120) e.title = "Title must be 5 to 120 characters.";

  const price = toNum(v.price);
  if (price === null || !Number.isFinite(price) || price <= 0) e.price = "Enter a price greater than zero.";

  if (v.location === "") e.location = "Choose a location.";
  if (v.location === "other") {
    if (v.otherLocation.trim().length < 2) e.otherLocation = "Enter the area name.";
    if (v.otherCity.trim().length < 2) e.otherCity = "Enter the city.";
  }

  if (v.contactName.trim().length < 2) e.contactName = "Enter a contact name.";
  const phone = v.contactPhone.trim();
  const email = v.contactEmail.trim();
  if (!phone && !email) e.contactPhone = "Add a phone number or an email so buyers can reach you.";
  if (phone && !/^[+\d][\d\s-]{6,}$/.test(phone)) e.contactPhone = "Enter a valid phone number.";
  if (email && !EMAIL_RE.test(email)) e.contactEmail = "Enter a valid email address.";

  for (const [key, label] of [["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"]]) {
    const n = toNum(v[key]);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 50)) e[key] = `${label} must be a whole number from 0 to 50.`;
  }
  const area = toNum(v.areaSqft);
  if (area !== null && !(area > 0)) e.areaSqft = "Area must be greater than zero.";
  const land = toNum(v.landArea);
  if (land !== null && !(land > 0)) e.landArea = "Land area must be greater than zero.";
  if (v.description.length > 4000) e.description = "Description is too long (4000 characters maximum).";

  if (submit) {
    if (v.description.trim().length < 30) e.description = "Describe the property in at least 30 characters.";
    const hasArea = (area !== null && area > 0) || (land !== null && land > 0);
    if (!hasArea) e.areaSqft = "Enter the area (sq ft), or the land area in aana.";
    if (["house", "apartment"].includes(v.propertyType)) {
      if (toNum(v.bedrooms) === null) e.bedrooms = "Enter the number of bedrooms.";
      if (toNum(v.bathrooms) === null) e.bathrooms = "Enter the number of bathrooms.";
    }
    if (imageCount < 1) e.images = "Add at least one photo.";
  }
  if (imageCount > MAX_IMAGES) e.images = `You can add up to ${MAX_IMAGES} photos.`;
  return e;
}

// Check a chosen file before upload (the bucket enforces the same limits again on the server).
export function checkImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG or WebP images are allowed.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: images must be 5 MB or smaller.`;
  return null;
}

// Form values -> database columns. owner_id is deliberately absent: the database fills it from the signed-in user.
export function toRow(v) {
  const other = v.location === "other";
  const meta = LOCATION_META[v.location];
  const land = toNum(v.landArea);
  let area = toNum(v.areaSqft);
  if (area === null && land !== null) area = sqftFromAana(land);
  const price = Number(v.price);
  const rent = v.listingType === "rent";
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    listing_type: v.listingType,
    property_type: v.propertyType,
    category: v.category || null,
    price_npr: price,
    price_unit: rent ? "month" : v.priceUnit === "aana" && v.propertyType === "land" ? "aana" : "total",
    location: other ? v.otherLocation.trim() : v.location,
    city: other ? v.otherCity.trim() : meta.city,
    district: other ? v.otherCity.trim() : meta.district,
    bedrooms: ["house", "apartment"].includes(v.propertyType) || v.bedrooms !== "" ? toNum(v.bedrooms) : null,
    bathrooms: toNum(v.bathrooms),
    area_sqft: area,
    land_area_aana: land,
    road_access: v.roadAccess.trim() || null,
    amenities: v.amenities.filter((a) => AMENITY_OPTIONS.includes(a)),
    contact_name: v.contactName.trim(),
    contact_phone: v.contactPhone.trim() || null,
    contact_email: v.contactEmail.trim() || null,
  };
}

// Database row -> form values (for editing)
export function fromRow(r) {
  const known = Object.keys(LOCATION_META).includes(r.location);
  return {
    title: r.title, listingType: r.listing_type, propertyType: r.property_type, category: r.category || "",
    price: String(Number(r.price_npr)), priceUnit: r.price_unit === "aana" ? "aana" : "total",
    location: known ? r.location : "other", otherLocation: known ? "" : r.location, otherCity: known ? "" : r.city,
    bedrooms: r.bedrooms ?? "", bathrooms: r.bathrooms ?? "", areaSqft: r.area_sqft ? String(Number(r.area_sqft)) : "",
    landArea: r.land_area_aana ? String(Number(r.land_area_aana)) : "", roadAccess: r.road_access || "",
    description: r.description || "", amenities: r.amenities || [],
    contactName: r.contact_name, contactPhone: r.contact_phone || "", contactEmail: r.contact_email || "",
  };
}
