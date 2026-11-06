import { createClient } from "@supabase/supabase-js";

// Browser-safe configuration only: the project URL and the *publishable* (anon) key.
// Row Level Security in the database is what protects the data, not the secrecy of this key.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function isPrivilegedKey(k) {
  if (!k) return false;
  if (k.startsWith("sb_secret_")) return true;
  try {
    // legacy JWT-style keys: refuse the service_role key
    const payload = JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

if (isPrivilegedKey(key)) {
  throw new Error("A secret/service-role key was found in VITE_SUPABASE_PUBLISHABLE_KEY. Use the publishable key; never put secret keys in browser code.");
}

// When the env vars are missing the app runs in demo mode with the built-in sample listings.
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
export const IMAGE_BUCKET = "property-images";
