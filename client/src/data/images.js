// All photography is resolved here, so swapping to Supabase Storage later is a one-file change.
//
// Resolution order for a listing photo:
//   property.images[0] is a full URL: demo data uses Unsplash; database listings use signed Storage URLs.
// Demo photos are hotlinked from Unsplash (free under the Unsplash License).

const unsplash = (id, width = 1400) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`;

const PHOTO_IDS = {
  hero: "1600596542815-ffad4c1539a9",
  trust: "1613490493576-7fde63acd811",
  family: "1580587771525-78b9dba3b914",
  villa: "1613977257363-707ba9348227",
  brick: "1564013799919-ab600027ffc6",
  modernHouse: "1600585154340-be6161a56a0c",
  apartmentInterior: "1522708323590-d24dbb6b0267",
  livingRoom: "1502672260266-1c1ef2d93688",
  apartmentBlock: "1545324418-cc1a3fa10c00",
  land: "1500382017468-9049fed747ef",
  landHills: "1472214103451-9374bd1c798e",
  bedroom: "1505693416388-ac5ce068fe85",
  shop: "1441986300917-64674bd600d8",
  office: "1497366216548-37526070297c",
  tower: "1486406146926-c627a92ad1ab",
  luxuryHouse: "1512917774080-9991f1c4c750",
  kitchen: "1556909114-f6e7ad7d3136",
  interior: "1600607687939-ce8a6c25118c",
  restaurant: "1517248135467-4c7edcad34c4",
  townhouse: "1568605114967-8130f3a36994",
};

// Full-size URL for a named demo photo
export const photo = (key, width = 1600) => unsplash(PHOTO_IDS[key], width);

// Re-size an Unsplash URL; any other URL (e.g. Supabase Storage) is returned unchanged
export const sized = (url, width) => (url && url.includes("images.unsplash.com") ? url.replace(/w=\d+/, `w=${width}`) : url);

// property.images is an array of URLs. Replace with Supabase Storage URLs when the backend arrives.
// Returns null when a listing has no photo, so the UI shows a neutral block rather than a stock image.
export const getPropertyImage = (property, width = 1400) => sized(property?.images?.[0], width) || null;

export const SITE_IMAGES = {
  hero: unsplash(PHOTO_IDS.hero, 2000),
  trust: unsplash(PHOTO_IDS.trust, 1400),
  categories: {
    homes: unsplash(PHOTO_IDS.luxuryHouse, 1400),
    apartments: unsplash(PHOTO_IDS.apartmentBlock, 1200),
    land: unsplash(PHOTO_IDS.landHills, 1200),
    rentals: unsplash(PHOTO_IDS.livingRoom, 1200),
    commercial: unsplash(PHOTO_IDS.tower, 1200),
  },
};
