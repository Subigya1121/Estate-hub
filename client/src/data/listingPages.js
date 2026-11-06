import { AREA_BANDS, LAND_AREA_BANDS, PROPERTY_TYPES } from "./site.js";

const typesExcept = (...values) => PROPERTY_TYPES.filter((t) => !values.includes(t.value));

// One config per browse page. `fixed` filters can't be changed by the visitor;
// `filters` lists which controls the page shows.
export const LISTING_PAGES = {
  buy: {
    key: "buy",
    title: "Properties for Sale",
    lead: "Homes, apartments, land and commercial properties across Kathmandu Valley.",
    fixed: { purpose: "sale" },
    filters: ["location", "type", "price", "bedrooms", "bathrooms", "area"],
    types: PROPERTY_TYPES,
    areaBands: AREA_BANDS,
  },
  rent: {
    key: "rent",
    title: "Properties for Rent",
    lead: "Apartments, houses and commercial spaces available to rent by the month.",
    fixed: { purpose: "rent" },
    filters: ["location", "type", "price", "bedrooms", "bathrooms", "area"],
    types: typesExcept("land"),
    areaBands: AREA_BANDS,
  },
  land: {
    key: "land",
    title: "Land for Sale",
    lead: "Residential plots priced per aana, with road access and ownership details.",
    fixed: { type: "land", purpose: "sale" },
    filters: ["location", "price", "area"],
    types: [],
    areaBands: LAND_AREA_BANDS,
  },
  commercial: {
    key: "commercial",
    title: "Commercial Properties",
    lead: "Offices, shops, buildings, restaurant spaces and commercial land.",
    fixed: { type: "commercial" },
    filters: ["location", "purpose", "category", "price", "area"],
    types: [],
    areaBands: AREA_BANDS,
  },
  all: {
    key: "all",
    title: "All Properties",
    lead: "Browse every current listing, then narrow it down with the filters.",
    fixed: {},
    filters: ["purpose", "location", "type", "price", "bedrooms", "bathrooms", "area"],
    types: PROPERTY_TYPES,
    areaBands: AREA_BANDS,
  },
};
