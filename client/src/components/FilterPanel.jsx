import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { COMMERCIAL_CATEGORIES, COUNT_OPTIONS, LISTING_LABEL, LOCATIONS, PRICE_BANDS } from "../data/site.js";
import { SelectField } from "./FormFields.jsx";

// Controlled by URL query params: `values` is the current params, `onChange(key, value)` updates them.
export default function FilterPanel({ scope, values, onChange, onClear, activeCount }) {
  const [open, setOpen] = useState(false);
  const purpose = scope.fixed.purpose || values.purpose || "";
  const priceBands = PRICE_BANDS[purpose] || [];

  const controls = {
    purpose: (
      <SelectField key="purpose" label="Buy or rent" value={values.purpose || ""} onChange={(v) => onChange("purpose", v)}
        options={Object.entries(LISTING_LABEL).map(([value, label]) => ({ value, label }))} placeholder="Sale and rent" />
    ),
    location: <SelectField key="location" label="Location" value={values.location || ""} onChange={(v) => onChange("location", v)} options={LOCATIONS} placeholder="Any location" />,
    type: <SelectField key="type" label="Property type" value={values.type || ""} onChange={(v) => onChange("type", v)} options={scope.types} placeholder="Any type" />,
    category: <SelectField key="category" label="Category" value={values.category || ""} onChange={(v) => onChange("category", v)} options={COMMERCIAL_CATEGORIES} placeholder="Any category" />,
    price: (
      <SelectField key="price" label={purpose === "rent" ? "Monthly rent" : "Price"} value={purpose ? values.price || "" : ""} onChange={(v) => onChange("price", v)}
        options={priceBands} placeholder={purpose ? "Any price" : "Choose sale or rent first"} disabled={!purpose} />
    ),
    bedrooms: <SelectField key="bedrooms" label="Bedrooms" value={values.bedrooms || ""} onChange={(v) => onChange("bedrooms", v)} options={COUNT_OPTIONS} placeholder="Any" />,
    bathrooms: <SelectField key="bathrooms" label="Bathrooms" value={values.bathrooms || ""} onChange={(v) => onChange("bathrooms", v)} options={COUNT_OPTIONS} placeholder="Any" />,
    area: <SelectField key="area" label="Area" value={values.area || ""} onChange={(v) => onChange("area", v)} options={scope.areaBands} placeholder="Any size" />,
  };

  return (
    <section aria-label="Filters" className="rounded border border-sand-300 bg-white">
      <div className="flex items-center justify-between px-5 py-4 lg:hidden">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="filter-fields" className="flex items-center gap-2.5 text-sm font-medium text-ink-900">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
          Filters{activeCount > 0 && <span className="text-bronze-600">({activeCount})</span>}
        </button>
        {activeCount > 0 && <button type="button" onClick={onClear} className="text-sm text-ink-500 underline underline-offset-4 hover:text-bronze-600">Clear filters</button>}
      </div>

      <div id="filter-fields" className={`${open ? "block" : "hidden"} border-t border-sand-200 p-5 lg:block lg:border-t-0 lg:p-6`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {scope.filters.map((key) => controls[key])}
        </div>
        {activeCount > 0 && (
          <div className="mt-5 hidden border-t border-sand-200 pt-4 lg:block">
            <button type="button" onClick={onClear} className="text-sm text-ink-500 underline underline-offset-4 hover:text-bronze-600">Clear Filters</button>
          </div>
        )}
      </div>
    </section>
  );
}
