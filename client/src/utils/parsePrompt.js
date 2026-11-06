import { LOCATIONS, PROPERTY_TYPES, TYPE_LABEL } from "../data/site.js";

const TYPE_WORDS = {
  house: /\b(house|home|villa|bungalow)\b/i,
  apartment: /\b(apartment|flat|bhk|room|hostel)\b/i,
  land: /\b(land|plot)\b/i,
  commercial: /\b(commercial|shop|showroom|office)\b/i,
};

const UNITS = { crore: 10000000, cr: 10000000, lakh: 100000, lac: 100000, thousand: 1000, k: 1000 };

// A deliberately simple, rule-based stand-in for the AI service (added in a later stage).
export function parsePrompt(text) {
  const filters = {};

  for (const { value: type } of PROPERTY_TYPES) {
    if (TYPE_WORDS[type].test(text)) {
      filters.type = type;
      break;
    }
  }

  const FEATURE_WORDS = { Parking: /\bparking\b/i, Garden: /\bgarden\b/i, Balcony: /\bbalcony\b/i, Solar: /\bsolar\b/i };
  const feature = Object.keys(FEATURE_WORDS).find((k) => FEATURE_WORDS[k].test(text));
  if (feature) filters.amenity = feature;

  const location = LOCATIONS.find((l) => new RegExp(`\\b${l}\\b`, "i").test(text));
  if (location) filters.location = location;

  const beds = text.match(/(\d+)[\s-]*(?:bed|bhk|bedroom)/i);
  if (beds) filters.bedrooms = beds[1];

  const budget = text.match(
    /(?:under|below|less than|within|upto|up to|max|budget(?: of)?)\s*(?:around|about|approx\.?|roughly)?\s*(?:rs\.?|npr)?\s*([\d,]+(?:\.\d+)?)\s*(crore|cr|lakh|lac|thousand|k)?/i,
  );
  if (budget) {
    const value = Number(budget[1].replace(/,/g, ""));
    filters.maxPrice = String(Math.round(value * (UNITS[(budget[2] || "").toLowerCase()] || 1)));
  }

  if (/\b(rent|monthly|per month|\/month)\b/i.test(text)) filters.purpose = "rent";
  else if (/\b(buy|purchase|for sale)\b/i.test(text) || filters.type === "land") filters.purpose = "sale";
  else if (filters.maxPrice && Number(filters.maxPrice) >= 1000000) filters.purpose = "sale";

  return filters;
}

export function describeFilters(filters) {
  const parts = [];
  if (filters.purpose) parts.push(filters.purpose === "rent" ? "For rent" : "For sale");
  if (filters.type) parts.push(TYPE_LABEL[filters.type]);
  if (filters.bedrooms) parts.push(`${filters.bedrooms}+ bedrooms`);
  if (filters.location) parts.push(filters.location);
  if (filters.amenity) parts.push(`With ${filters.amenity.toLowerCase()}`);
  if (filters.maxPrice) parts.push(`Up to Rs. ${Number(filters.maxPrice).toLocaleString("en-IN")}`);
  return parts;
}
