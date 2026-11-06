import PropertyCard from "./PropertyCard.jsx";

function SkeletonCard() {
  return (
    <div aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse rounded bg-sand-200" />
      <div className="mt-5 h-3 w-1/3 animate-pulse rounded bg-sand-200" />
      <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-sand-200" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-sand-200" />
    </div>
  );
}

export default function PropertyGrid({ properties, loading = false }) {
  return (
    <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {loading
        ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
        : properties.map((p) => <PropertyCard key={p.id} property={p} />)}
    </div>
  );
}
