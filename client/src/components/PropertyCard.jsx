import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import PropertyImage from "./PropertyImage.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import { formatArea, formatLocation, formatPrice } from "../utils/format.js";

const CAPTION = { house: "Residence", apartment: "Apartment", land: "Land", commercial: "Commercial" };

const IMAGE_SHAPE = {
  default: "aspect-[4/3]",
  feature: "aspect-[4/3] lg:aspect-square",
  compact: "aspect-[16/10] lg:aspect-[16/9]",
};
const TITLE_SIZE = { default: "text-xl", feature: "text-2xl sm:text-3xl", compact: "text-xl" };

// variant: "default" (listing grid, with key facts) | "feature" (large) | "compact" (stacked beside feature)
export default function PropertyCard({ property, variant = "default" }) {
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(property.id);
  const isRent = property.listingType === "rent";
  const hasRooms = property.bedrooms > 0;
  const href = `/properties/${property.id}`;

  const facts = [
    hasRooms && `${property.bedrooms} bed`,
    hasRooms && `${property.bathrooms} bath`,
    formatArea(property),
    property.propertyType === "land" && property.roadAccess,
  ].filter(Boolean);

  return (
    <article className="group">
      <div className={`relative overflow-hidden rounded bg-sand-200 ${IMAGE_SHAPE[variant]}`}>
        <Link to={href} aria-label={`View ${property.title}`} className="block h-full">
          <div className="h-full transition-transform duration-700 ease-out group-hover:scale-[1.03]">
            <PropertyImage property={property} width={variant === "feature" ? 1400 : 900} />
          </div>
        </Link>
        <button
          type="button"
          onClick={() => toggle(property.id)}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${property.title} from favorites` : `Save ${property.title} to favorites`}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-700 transition-colors hover:text-red-700"
        >
          <Heart className={`h-[17px] w-[17px] ${saved ? "fill-red-700 text-red-700" : ""}`} strokeWidth={1.5} />
        </button>
      </div>

      <div className="pt-5">
        <p className="caption flex items-center gap-3">
          {property.category && property.propertyType === "commercial" ? property.category : CAPTION[property.propertyType]}
          <span aria-hidden="true" className="h-3 w-px bg-sand-400" />
          <span className="text-bronze-600">{isRent ? "For rent" : "For sale"}{property.status === "pending" && <span className="text-ink-400"> (pending)</span>}</span>
        </p>
        <h3 className={`mt-2.5 font-normal leading-snug text-ink-900 ${TITLE_SIZE[variant]}`}>
          <Link to={href} className="transition-colors hover:text-bronze-600">{property.title}</Link>
        </h3>
        <p className="mt-1 text-sm text-ink-500">{formatLocation(property)}</p>
        <p className="mt-3 text-base font-medium text-ink-900">{formatPrice(property)}</p>
        {variant === "default" && (
          <p className="mt-4 border-t border-sand-200 pt-4 text-sm text-ink-500">{facts.join("  ·  ")}</p>
        )}
      </div>
    </article>
  );
}
