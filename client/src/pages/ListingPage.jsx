import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SORT_OPTIONS } from "../data/site.js";
import { PAGE_SIZE, listProperties } from "../services/propertyService.js";
import useAsync from "../hooks/useAsync.js";
import FilterPanel from "../components/FilterPanel.jsx";
import AiSearchBox from "../components/AiSearchBox.jsx";
import PropertyGrid from "../components/PropertyGrid.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SelectField } from "../components/FormFields.jsx";

// Shared by /buy, /rent, /land, /commercial and /properties. Filter state lives in the URL query string.
// Results come from the database (or the demo data) and are loaded PAGE_SIZE at a time.
export default function ListingPage({ scope }) {
  const [params, setParams] = useSearchParams();
  const values = useMemo(() => Object.fromEntries(params), [params]);
  const filters = useMemo(() => ({ ...values, ...scope.fixed }), [values, scope]);
  const filterKey = JSON.stringify(filters);

  const [pageState, setPageState] = useState({ key: "", pages: 1 });
  const pages = pageState.key === filterKey ? pageState.pages : 1;

  const { data, loading, error, reload } = useAsync(
    () => listProperties(filters, { limit: pages * PAGE_SIZE }),
    `${filterKey}|${pages}`,
    { keepPrevious: true },
  );
  const results = data?.items ?? [];
  const total = data?.total ?? 0;
  const activeCount = scope.filters.filter((k) => values[k]).length;

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "purpose") next.delete("price"); // price bands differ between sale and rent
    setParams(next, { replace: true });
  };
  const clear = () => {
    const next = new URLSearchParams();
    if (values.sort) next.set("sort", values.sort);
    setParams(next, { replace: true });
  };

  const firstLoad = loading && !data;
  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-14 sm:py-20">
          <h1 className="font-display text-4xl font-light text-ink-900 sm:text-5xl">{scope.title}</h1>
          <p className="mt-4 max-w-xl text-ink-500">{scope.lead}</p>
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        <AiSearchBox />
        <FilterPanel scope={scope} values={values} onChange={update} onClear={clear} activeCount={activeCount} />

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-ink-500" aria-live="polite">
            {firstLoad ? "Loading properties…" : error ? "" : `${total} ${total === 1 ? "property" : "properties"}`}
          </p>
          <div className="w-full sm:w-56">
            <SelectField label="Sort by" value={values.sort || "newest"} onChange={(v) => update("sort", v === "newest" ? "" : v)} options={SORT_OPTIONS} />
          </div>
        </div>

        <div className="mt-8">
          {error ? (
            <EmptyState title="We couldn't load properties." text="Please check your connection and try again." action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />
          ) : firstLoad ? (
            <PropertyGrid properties={[]} loading />
          ) : results.length > 0 ? (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <PropertyGrid properties={results} />
              {results.length < total && (
                <div className="mt-14 text-center">
                  <button type="button" disabled={loading} onClick={() => setPageState({ key: filterKey, pages: pages + 1 })} className="btn-outline">
                    {loading ? "Loading…" : `Show more (${total - results.length} remaining)`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No properties found."
              text="Try adjusting your filters or search criteria."
              action={activeCount > 0 ? <button type="button" onClick={clear} className="btn-primary">Clear Filters</button> : <Link to="/properties" className="btn-primary">Browse all properties</Link>}
            />
          )}
        </div>
      </section>
    </>
  );
}
