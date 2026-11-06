// Center links (main browsing) and right-hand links
export const NAV_PRIMARY = [
  { label: "Buy", to: "/buy" },
  { label: "Rent", to: "/rent" },
  { label: "Land", to: "/land" },
  { label: "Commercial", to: "/commercial" },
];

export const NAV_SECONDARY = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Login", to: "/login" },
];

export const LOCATIONS = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Bhaisepati", "Budhanilkantha",
  "Tokha", "Kirtipur", "Maharajgunj", "Imadol", "Sanepa",
];

// Approximate centre of each area, used for the "approximate location" map
export const LOCATION_COORDS = {
  Kathmandu: [27.7172, 85.324], Lalitpur: [27.6588, 85.3247], Bhaktapur: [27.671, 85.4298],
  Bhaisepati: [27.6406, 85.304], Budhanilkantha: [27.7783, 85.3626], Tokha: [27.7733, 85.33],
  Kirtipur: [27.6783, 85.2783], Maharajgunj: [27.737, 85.33], Imadol: [27.6523, 85.3503], Sanepa: [27.683, 85.301],
};

// City and district for each selectable area (used by the listing form)
export const LOCATION_META = {
  Kathmandu: { city: "Kathmandu", district: "Kathmandu" }, Lalitpur: { city: "Lalitpur", district: "Lalitpur" },
  Bhaktapur: { city: "Bhaktapur", district: "Bhaktapur" }, Bhaisepati: { city: "Lalitpur", district: "Lalitpur" },
  Budhanilkantha: { city: "Kathmandu", district: "Kathmandu" }, Tokha: { city: "Kathmandu", district: "Kathmandu" },
  Kirtipur: { city: "Kathmandu", district: "Kathmandu" }, Maharajgunj: { city: "Kathmandu", district: "Kathmandu" },
  Imadol: { city: "Lalitpur", district: "Lalitpur" }, Sanepa: { city: "Lalitpur", district: "Lalitpur" },
};

export const AMENITY_OPTIONS = [
  "Parking", "Water Supply", "Solar", "Garden", "Security", "Balcony", "Internet", "Electricity", "Road Access",
];

export const LAND_CATEGORIES = ["Residential", "Agricultural"];

export const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "land", label: "Land" },
  { value: "commercial", label: "Commercial" },
];
export const TYPE_LABEL = Object.fromEntries(PROPERTY_TYPES.map((t) => [t.value, t.label]));

export const COMMERCIAL_CATEGORIES = ["Office", "Shop", "Building", "Restaurant space", "Commercial land"];

export const LISTING_LABEL = { sale: "For sale", rent: "For rent" };
export const STATUS_LABEL = { available: "Available", pending: "Pending", sold: "Sold", rented: "Rented" };
// Moderation status of a submitted listing
export const REVIEW_STATUS_LABEL = { draft: "Draft", pending_review: "In review", published: "Published", rejected: "Needs changes", archived: "Archived" };

// Values are "min-max" (either side may be empty)
export const PRICE_BANDS = {
  sale: [
    { value: "-5000000", label: "Under Rs. 50 Lakh" },
    { value: "5000000-10000000", label: "Rs. 50 Lakh – 1 Crore" },
    { value: "10000000-20000000", label: "Rs. 1 – 2 Crore" },
    { value: "20000000-", label: "Rs. 2 Crore and above" },
  ],
  rent: [
    { value: "-15000", label: "Under Rs. 15,000" },
    { value: "15000-30000", label: "Rs. 15,000 – 30,000" },
    { value: "30000-60000", label: "Rs. 30,000 – 60,000" },
    { value: "60000-", label: "Rs. 60,000 and above" },
  ],
};

// Area bands are in sq ft (1 aana = 342.25 sq ft)
export const AREA_BANDS = [
  { value: "-1000", label: "Under 1,000 sq ft" },
  { value: "1000-2000", label: "1,000 – 2,000 sq ft" },
  { value: "2000-4000", label: "2,000 – 4,000 sq ft" },
  { value: "4000-", label: "4,000 sq ft and above" },
];
export const LAND_AREA_BANDS = [
  { value: "-1027", label: "Under 3 Aana" },
  { value: "1027-2054", label: "3 – 6 Aana" },
  { value: "2054-3423", label: "6 – 10 Aana" },
  { value: "3423-", label: "10 Aana and above" },
];

export const COUNT_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}+` }));

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export const AI_SUGGESTIONS = [
  "I need a house under 2 crore.",
  "Find me a room near college.",
  "I want land around Kathmandu.",
];

export const CONCIERGE_EXAMPLE =
  "I'm looking for a quiet 3-bedroom home in Kathmandu with parking and a budget around Rs. 2 crore.";

export const CONTACT = {
  email: "hello@estatehub.com.np",
  phone: "+977 1 5000000",
  location: "Kathmandu, Nepal",
};
