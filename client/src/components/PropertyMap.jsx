import { LOCATION_COORDS } from "../data/site.js";

// Approximate-area map (OpenStreetMap embed). Exact address is shared with the agent on inquiry.
export default function PropertyMap({ property }) {
  const [lat, lng] = LOCATION_COORDS[property.location] || LOCATION_COORDS[property.city] || LOCATION_COORDS.Kathmandu;
  const d = 0.012;
  const bbox = [lng - d, lat - d * 0.7, lng + d, lat + d * 0.7].join("%2C");
  return (
    <div>
      <div className="overflow-hidden rounded border border-sand-300 bg-sand-200">
        <iframe
          title={`Map of ${property.location}`}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`}
          loading="lazy"
          className="block h-72 w-full border-0 sm:h-80"
        />
      </div>
      <p className="mt-3 text-xs text-ink-400">Approximate location, {property.location}. The exact address is shared when you contact the agent.</p>
    </div>
  );
}
