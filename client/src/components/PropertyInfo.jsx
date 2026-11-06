import { Check } from "lucide-react";
import { LISTING_LABEL, STATUS_LABEL, TYPE_LABEL } from "../data/site.js";
import { formatLocation, formatPrice } from "../utils/format.js";

function Fact({ label, value }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export function PropertyHeader({ property }) {
  return (
    <header>
      <p className="caption flex items-center gap-3">
        {property.category && property.propertyType === "commercial" ? property.category : TYPE_LABEL[property.propertyType]}
        <span aria-hidden="true" className="h-3 w-px bg-sand-400" />
        <span className="text-bronze-600">{LISTING_LABEL[property.listingType]}</span>
      </p>
      <h1 className="mt-3 font-display text-3xl font-light leading-tight text-ink-900 sm:text-4xl">{property.title}</h1>
      <p className="mt-2 text-ink-500">{formatLocation(property)}</p>
      <p className="mt-5 font-display text-3xl font-normal text-ink-900">{formatPrice(property)}</p>
    </header>
  );
}

export default function PropertyInfo({ property: p }) {
  const facts = [
    ["Listing", LISTING_LABEL[p.listingType]],
    ["Type", p.category && p.propertyType === "commercial" ? p.category : TYPE_LABEL[p.propertyType]],
    p.bedrooms > 0 && ["Bedrooms", p.bedrooms],
    p.bathrooms > 0 && ["Bathrooms", p.bathrooms],
    ["Area", `${p.area.toLocaleString("en-IN")} sq ft`],
    p.landArea && ["Land area", `${p.landArea} Aana`],
    p.roadAccess && ["Road access", p.roadAccess],
    ["Status", STATUS_LABEL[p.status]],
  ].filter(Boolean);

  return (
    <div className="space-y-14">
      <dl className="grid grid-cols-2 divide-sand-200 rounded border border-sand-300 bg-white [&>div]:border-b [&>div]:border-sand-200 sm:grid-cols-4">
        {facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
      </dl>

      <section aria-labelledby="desc-heading">
        <h2 id="desc-heading" className="font-display text-2xl font-light">About this property</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-700">{p.description}</p>
      </section>

      <section aria-labelledby="amen-heading">
        <h2 id="amen-heading" className="font-display text-2xl font-light">Amenities</h2>
        <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {p.amenities.map((a) => (
            <li key={a} className="flex items-center gap-3 border-b border-sand-200 pb-3 text-sm text-ink-700">
              <Check className="h-4 w-4 text-bronze-500" strokeWidth={1.75} />
              {a}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
