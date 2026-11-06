import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import { LOCATIONS, PRICE_BANDS, PROPERTY_TYPES } from "../data/site.js";

function Cell({ label, children }) {
  return (
    <label className="relative block cursor-pointer px-5 py-3.5 transition-colors focus-within:bg-sand-50 hover:bg-sand-50">
      <span className="block text-xs text-ink-400">{label}</span>
      <span className="relative mt-0.5 block">{children}</span>
      <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" strokeWidth={1.5} />
    </label>
  );
}

const selectClass = "w-full cursor-pointer appearance-none bg-transparent pr-6 text-[15px] font-medium text-ink-900 focus:outline-none";

export default function SearchBar() {
  const navigate = useNavigate();
  const [f, setF] = useState({ purpose: "sale", location: "", type: "", price: "" });
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }));
  const setPurpose = (purpose) => setF((prev) => ({ ...prev, purpose, price: "" }));

  const submit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (f.location) params.set("location", f.location);
    if (f.type) params.set("type", f.type);
    if (f.price) params.set("price", f.price);
    const qs = params.toString();
    navigate(`${f.purpose === "rent" ? "/rent" : "/buy"}${qs ? `?${qs}` : ""}`);
  };

  return (
    <form onSubmit={submit} aria-label="Search properties" className="mx-auto max-w-5xl rounded border border-sand-300 bg-white shadow-search">
      <div className="grid divide-y divide-sand-200 lg:grid-cols-[auto_1fr_1fr_1fr_auto] lg:divide-x lg:divide-y-0">
        <div role="radiogroup" aria-label="Purpose" className="flex items-center gap-6 px-6 py-4">
          {[
            { value: "sale", label: "Buy" },
            { value: "rent", label: "Rent" },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={f.purpose === o.value}
              onClick={() => setPurpose(o.value)}
              className={`border-b py-1 text-[15px] font-medium transition-colors ${f.purpose === o.value ? "border-bronze-500 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-900"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Cell label="Location">
          <select value={f.location} onChange={set("location")} className={selectClass}>
            <option value="">Any location</option>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Cell>

        <Cell label="Property type">
          <select value={f.type} onChange={set("type")} className={selectClass}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Cell>

        <Cell label="Price range">
          <select value={f.price} onChange={set("price")} className={selectClass}>
            <option value="">Any price</option>
            {PRICE_BANDS[f.purpose].map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Cell>

        <button type="submit" className="flex items-center justify-center gap-2.5 rounded-b bg-ink-900 px-8 py-4 text-sm font-medium tracking-wide text-sand-50 transition-colors hover:bg-ink-700 lg:rounded-b-none lg:rounded-r">
          <Search className="h-4 w-4" strokeWidth={1.75} />
          Search
        </button>
      </div>
    </form>
  );
}
