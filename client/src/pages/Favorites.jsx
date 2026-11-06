import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import useAsync from "../hooks/useAsync.js";
import { getPropertiesByIds } from "../services/propertyService.js";
import EmptyState from "../components/EmptyState.jsx";
import PropertyGrid from "../components/PropertyGrid.jsx";

// Saved properties. Signed in: stored on the account. Signed out: stored in this browser.
export default function Favorites() {
  const { ids } = useFavorites();
  const { user } = useAuth();
  const key = ids.join(",");
  const { data, loading, error, reload } = useAsync(() => getPropertiesByIds(ids), key, { keepPrevious: true });
  const items = data ?? [];
  const firstLoad = loading && !data && ids.length > 0;

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-14 sm:py-20">
          <h1 className="font-display text-4xl font-light text-ink-900 sm:text-5xl">Favorites</h1>
          <p className="mt-4 max-w-xl text-ink-500">
            {user ? "Properties you've saved to your account." : "Properties you've saved on this device. Sign in to keep them with your account."}
          </p>
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        {error ? (
          <EmptyState title="We couldn't load your favorites." text="Please check your connection and try again." action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />
        ) : firstLoad ? (
          <PropertyGrid properties={[]} loading />
        ) : items.length > 0 ? (
          <>
            <p className="mb-8 text-sm text-ink-500" aria-live="polite">{items.length} saved {items.length === 1 ? "property" : "properties"}</p>
            <PropertyGrid properties={items} />
          </>
        ) : (
          <EmptyState
            title="No saved properties yet."
            text="Tap the heart on any listing to save it here."
            action={<div className="flex flex-wrap justify-center gap-3"><Link to="/buy" className="btn-primary">Browse properties for sale</Link><Link to="/rent" className="btn-outline">Browse rentals</Link></div>}
          />
        )}
      </section>
    </>
  );
}
