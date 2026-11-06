import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart } from "lucide-react";
import { REVIEW_STATUS_LABEL, STATUS_LABEL } from "../data/site.js";
import { getProperty, getSimilar } from "../services/propertyService.js";
import useAsync from "../hooks/useAsync.js";
import { useFavorites } from "../context/FavoritesContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import PropertyActions from "../components/PropertyActions.jsx";
import PropertyCard from "../components/PropertyCard.jsx";
import PropertyGallery from "../components/PropertyGallery.jsx";
import PropertyInfo, { PropertyHeader } from "../components/PropertyInfo.jsx";
import PropertyMap from "../components/PropertyMap.jsx";

function Skeleton() {
  return (
    <div className="container-x py-10" aria-busy="true">
      <p className="sr-only">Loading property…</p>
      <div className="aspect-[16/10] max-h-[560px] w-full animate-pulse rounded bg-sand-200" />
      <div className="mt-8 h-8 w-1/2 animate-pulse rounded bg-sand-200" />
      <div className="mt-4 h-4 w-1/3 animate-pulse rounded bg-sand-200" />
    </div>
  );
}

function NotFound() {
  return (
    <section className="container-x py-20 sm:py-28">
      <EmptyState
        title="Property Not Found"
        text="This property may have been removed, or the link may be incorrect."
        action={<Link to="/properties" className="btn-primary">Back to Properties</Link>}
      />
    </section>
  );
}

export default function PropertyDetails() {
  const { id } = useParams();
  // key={id} on the route remounts this page for each property, so tab state resets
  const { data: property, loading, error, reload } = useAsync(() => getProperty(id), id);
  const { data: similarData } = useAsync(() => (property ? getSimilar(property) : Promise.resolve([])), property?.id || "none");
  const { isFavorite, toggle } = useFavorites();
  const [tab, setTab] = useState("inquiry");
  const actionsRef = useRef(null);

  if (loading) return <Skeleton />;
  if (error) {
    return (
      <section className="container-x py-20 sm:py-28">
        <EmptyState title="We couldn't load this property" text="Please check your connection and try again." action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />
      </section>
    );
  }
  if (!property) return <NotFound />;

  const unavailable = property.status === "sold" || property.status === "rented";
  const similar = similarData || [];
  const notPublic = property.reviewStatus && property.reviewStatus !== "published";
  const saved = isFavorite(property.id);
  const section = property.listingType === "rent" ? { label: "Rent", to: "/rent" } : { label: "Buy", to: "/buy" };

  const jump = (next) => {
    setTab(next);
    actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="container-x pt-8">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-400">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link to="/" className="hover:text-ink-900">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link to={section.to} className="hover:text-ink-900">{section.label}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink-700">{property.title}</li>
          </ol>
        </nav>
      </div>

      <div className="container-x pb-20 pt-6 sm:pb-24">
        {notPublic && (
          <div role="status" className="mb-6 rounded border border-sand-300 bg-sand-100 px-5 py-4 text-sm text-ink-700">
            <strong className="font-medium">This listing isn't public.</strong> You can see it because you own it or review listings. Its status is “{REVIEW_STATUS_LABEL[property.reviewStatus]}”.
          </div>
        )}
        {unavailable && (
          <div role="status" className="mb-6 rounded border border-sand-300 bg-sand-100 px-5 py-4 text-sm text-ink-700">
            <strong className="font-medium">This property is no longer available.</strong> It is marked as {STATUS_LABEL[property.status].toLowerCase()}. You may like the similar properties below.
          </div>
        )}

        <PropertyGallery key={property.id} images={property.images} title={property.title} />

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
          <div className="space-y-14">
            <div>
              <PropertyHeader property={property} />
              <div className="mt-6 flex flex-wrap gap-3">
                {!unavailable && (
                  <>
                    <button type="button" onClick={() => jump("contact")} className="btn-primary">Contact Agent</button>
                    <button type="button" onClick={() => jump("visit")} className="btn-outline">Schedule a Visit</button>
                  </>
                )}
                <button type="button" onClick={() => toggle(property.id)} aria-pressed={saved} className="btn-outline">
                  <Heart className={`h-4 w-4 ${saved ? "fill-red-700 text-red-700" : ""}`} strokeWidth={1.5} />
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>

            <PropertyInfo property={property} />

            <section aria-labelledby="map-heading">
              <h2 id="map-heading" className="mb-5 font-display text-2xl font-light">Location</h2>
              <PropertyMap property={property} />
            </section>
          </div>

          <aside ref={actionsRef} className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
            {unavailable ? (
              <div className="rounded border border-sand-300 bg-white p-6">
                <p className="font-display text-xl">Property unavailable</p>
                <p className="mt-2 text-sm text-ink-500">Enquiries are closed for this listing.</p>
                <Link to={section.to} className="btn-primary mt-6 w-full">Browse {section.label === "Rent" ? "rentals" : "properties for sale"}</Link>
              </div>
            ) : (
              <PropertyActions property={property} tab={tab} onTabChange={setTab} />
            )}
          </aside>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="border-t border-sand-200 bg-sand-100" aria-labelledby="similar-heading">
          <div className="container-x py-16 sm:py-20">
            <h2 id="similar-heading" className="section-title">Similar Properties</h2>
            <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((p) => <PropertyCard key={p.id} property={p} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
