import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, Menu, X } from "lucide-react";
import { NAV_PRIMARY, NAV_SECONDARY } from "../data/site.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../context/FavoritesContext.jsx";
import Logo from "./Logo.jsx";

function useIsActive() {
  const { pathname } = useLocation();
  return (to) => pathname === to;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const isActive = useIsActive();
  const { user, isReviewer, signOut } = useAuth();
  const { ids: savedIds } = useFavorites();
  const close = () => setOpen(false);
  // signed out: About, Contact, Login. signed in: About, Contact, Dashboard (+ Review for reviewers)
  const secondary = user
    ? [...NAV_SECONDARY.filter((l) => l.label !== "Login"), { label: "Dashboard", to: "/dashboard" }, ...(isReviewer ? [{ label: "Review", to: "/review" }] : [])]
    : NAV_SECONDARY;
  const logOut = async () => {
    close();
    await signOut();
  };

  const linkClass = (to) =>
    `relative whitespace-nowrap py-1.5 text-sm tracking-wide transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-bronze-500 after:transition-transform ${
      isActive(to) ? "text-ink-900 after:scale-x-100" : "text-ink-500 after:scale-x-0 hover:text-ink-900 hover:after:scale-x-100"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-sand-200 bg-sand-50/95 backdrop-blur">
      <div className={`container-x grid h-[72px] grid-cols-[1fr_auto] items-center gap-6 ${user ? "xl:grid-cols-[auto_1fr_auto]" : "xl:grid-cols-[1fr_auto_1fr]"}`}>
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-10 xl:flex xl:justify-self-center">
          {NAV_PRIMARY.map((l) => (
            <Link key={l.label} to={l.to} className={linkClass(l.to)}>{l.label}</Link>
          ))}
        </nav>

        <div className={`hidden items-center justify-end xl:flex ${user ? "gap-6" : "gap-8"}`}>
          {secondary.map((l) => (
            <Link key={l.label} to={l.to} className={linkClass(l.to)}>{l.label}</Link>
          ))}
          {user && <button type="button" onClick={logOut} className="whitespace-nowrap py-1.5 text-sm tracking-wide text-ink-500 transition-colors hover:text-ink-900">Log out</button>}
          <Link to="/favorites" aria-label={`Favorites${savedIds.length ? ` (${savedIds.length} saved)` : ""}`} title="Favorites" className={`relative -mx-1 grid h-9 w-9 place-items-center transition-colors ${isActive("/favorites") ? "text-bronze-600" : "text-ink-500 hover:text-ink-900"}`}>
            <Heart className={`h-[18px] w-[18px] ${savedIds.length ? "fill-bronze-500 text-bronze-500" : ""}`} strokeWidth={1.5} />
          </Link>
          <Link to="/list-property" className="btn-primary whitespace-nowrap px-5 py-2.5">List Property</Link>
        </div>

        <button
          type="button"
          className="-mr-2 grid h-10 w-10 place-items-center justify-self-end text-ink-900 xl:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" strokeWidth={1.5} /> : <Menu className="h-6 w-6" strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-sand-200 bg-sand-50 xl:hidden">
          <nav aria-label="Mobile" className="container-x py-4" onClick={(e) => e.target.closest("a") && close()}>
            <ul className="divide-y divide-sand-200">
              {[...NAV_PRIMARY, ...secondary, { label: "Favorites", to: "/favorites" }].map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className={`block py-4 font-display text-xl font-light ${isActive(l.to) ? "text-bronze-600" : "text-ink-900"}`}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            {user && <button type="button" onClick={logOut} className="block w-full border-t border-sand-200 py-4 text-left font-display text-xl font-light text-ink-500">Log out</button>}
            <Link to="/list-property" className="btn-primary mt-4 w-full py-3.5">List Property</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
