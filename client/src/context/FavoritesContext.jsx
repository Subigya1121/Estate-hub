import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase.js";
import { UUID_RE } from "../services/propertyService.js";
import { useAuth } from "./AuthContext.jsx";

const FavoritesContext = createContext(null);
const STORAGE_KEY = "estatehub:favorites";
const NONE = [];

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Signed out: favorites live in this browser only (localStorage).
// Signed in (with Supabase): favorites are stored in the database for that account, and any
// favorites saved in this browser while signed out are merged in once at sign-in.
export function FavoritesProvider({ children }) {
  const { user, configured } = useAuth();
  const userId = user?.id ?? null;
  const remote = configured && userId;
  const [localIds, setLocalIds] = useState(loadLocal);
  const [remoteState, setRemoteState] = useState({ userId: null, ids: [] });

  useEffect(() => {
    if (remote) return; // never write a signed-in user's favorites into shared browser storage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localIds));
    } catch {
      /* storage unavailable */
    }
  }, [localIds, remote]);

  useEffect(() => {
    if (!remote) return undefined;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("favorites").select("property_id");
      if (error || cancelled) return;
      const have = new Set(data.map((r) => r.property_id));
      const toMerge = loadLocal().filter((id) => UUID_RE.test(id) && !have.has(id));
      if (toMerge.length) {
        const { error: mergeError } = await supabase.from("favorites").insert(toMerge.map((property_id) => ({ property_id })));
        if (!mergeError) toMerge.forEach((id) => have.add(id));
      }
      if (!cancelled) setRemoteState({ userId, ids: [...have] });
    })();
    return () => {
      cancelled = true;
    };
  }, [remote, userId]);

  const ids = remote ? (remoteState.userId === userId ? remoteState.ids : NONE) : localIds;

  const toggle = useCallback(
    async (id) => {
      if (!remote) {
        setLocalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        return;
      }
      if (!UUID_RE.test(id)) return;
      const adding = !ids.includes(id);
      const apply = (list) => setRemoteState({ userId, ids: list });
      apply(adding ? [...ids, id] : ids.filter((x) => x !== id)); // optimistic
      const { error } = adding
        ? await supabase.from("favorites").insert({ property_id: id })
        : await supabase.from("favorites").delete().eq("property_id", id);
      if (error) apply(ids); // roll back
    },
    [remote, ids, userId],
  );

  const value = useMemo(() => ({ ids, toggle, isFavorite: (id) => ids.includes(id) }), [ids, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
