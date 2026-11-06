const trim = (n) => Number(n.toFixed(2)).toString();
export const SQFT_PER_AANA = 342.25;
export const sqftFromAana = (aana) => Math.round(aana * SQFT_PER_AANA);

// Total price in Nepali units: Rs. 1.85 Crore, Rs. 45 Lakh
export function formatNpr(amount) {
  if (amount >= 10000000) return `Rs. ${trim(amount / 10000000)} Crore`;
  if (amount >= 100000) return `Rs. ${trim(amount / 100000)} Lakh`;
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

// priceUnit: "total" | "month" | "aana"
export function formatPrice(property) {
  if (property.priceUnit === "month") return `Rs. ${property.price.toLocaleString("en-IN")}/month`;
  if (property.priceUnit === "aana") return `${formatNpr(property.price)} per Aana`;
  return formatNpr(property.price);
}

// Comparable total price (land is stored per aana)
export const totalPrice = (p) => (p.priceUnit === "aana" ? p.price * p.landArea : p.price);

export function formatLocation(property) {
  return property.location === property.city ? `${property.location}, Nepal` : `${property.location}, ${property.city}`;
}

// Short area label for cards: land area in aana when known, otherwise built-up sq ft
export function formatArea(property) {
  return property.landArea ? `${property.landArea} Aana` : `${property.area.toLocaleString("en-IN")} sq ft`;
}
