import { totalPrice } from "./format.js";

export const PUBLIC_STATUSES = ["available", "pending"];

const parseBand = (band) => {
  if (!band) return [null, null];
  const [min, max] = band.split("-");
  return [min === "" ? null : Number(min), max === "" || max === undefined ? null : Number(max)];
};

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  "price-asc": (a, b) => totalPrice(a) - totalPrice(b),
  "price-desc": (a, b) => totalPrice(b) - totalPrice(a),
};

// Filters: purpose (sale|rent), type, category, location, price ("min-max"), minPrice, maxPrice,
// bedrooms, bathrooms, area ("min-max" in sq ft), amenity, sort.
// Only publicly visible listings (available/pending) are ever returned.
export function filterProperties(list, filters = {}) {
  const f = filters;
  let [pMin, pMax] = parseBand(f.price);
  if (f.minPrice) pMin = Number(f.minPrice);
  if (f.maxPrice) pMax = Number(f.maxPrice);
  const [aMin, aMax] = parseBand(f.area);

  const result = list.filter((p) => {
    if (!PUBLIC_STATUSES.includes(p.status)) return false;
    if (f.purpose && p.listingType !== f.purpose) return false;
    if (f.type && p.propertyType !== f.type) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.location && p.location !== f.location && p.city !== f.location) return false;
    if (f.amenity && !p.amenities.includes(f.amenity)) return false;
    const price = totalPrice(p);
    if (pMin !== null && price < pMin) return false;
    if (pMax !== null && price >= pMax) return false;
    if (f.bedrooms && p.bedrooms < Number(f.bedrooms)) return false;
    if (f.bathrooms && p.bathrooms < Number(f.bathrooms)) return false;
    if (aMin !== null && p.area < aMin) return false;
    if (aMax !== null && p.area >= aMax) return false;
    return true;
  });

  return result.sort(SORTERS[f.sort] || SORTERS.newest);
}
