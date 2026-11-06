import { IMAGE_BUCKET, supabase } from "./supabase.js";
import { PUBLIC_COLUMNS, fetchImageRows, hydrate, signPaths } from "./propertyService.js";
import { MAX_IMAGES, toRow } from "../utils/listingValidation.js";

// Everything a signed-in customer or reviewer does to listings. All of it goes through the browser
// client, so every call is subject to Row Level Security and the database workflow triggers.

const OWNER_COLUMNS = `${PUBLIC_COLUMNS},rejection_reason,reviewed_at`;

// Turn database/storage errors into messages a person can act on.
export function explainError(error) {
  const msg = error?.message || "";
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (/at least one photo/i.test(msg)) return "Add at least one photo first.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "We couldn't reach the server. Check your connection and try again.";
  if (/exceeded the maximum allowed size|too large/i.test(msg)) return "One of the photos is larger than 5 MB.";
  if (/mime type|not supported/i.test(msg)) return "Only JPEG, PNG or WebP photos are allowed.";
  return msg || "Something went wrong. Please try again.";
}

const extOf = (file) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type] || "jpg";

// Upload files to <userId>/<propertyId>/<uuid>.<ext> and record them. Positions start at `startAt`.
async function uploadImages(userId, propertyId, files, takenPositions = []) {
  const free = Array.from({ length: MAX_IMAGES }, (_, i) => i).filter((i) => !takenPositions.includes(i));
  if (files.length > free.length) throw new Error(`You can have up to ${MAX_IMAGES} photos per listing.`);
  const uploaded = [];
  try {
    for (const [i, file] of files.entries()) {
      const path = `${userId}/${propertyId}/${crypto.randomUUID()}.${extOf(file)}`;
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push({ path, position: free[i] });
    }
    if (uploaded.length) {
      const { error } = await supabase.from("property_images").insert(uploaded.map((u) => ({ property_id: propertyId, path: u.path, position: u.position })));
      if (error) throw error;
    }
  } catch (error) {
    // don't leave orphaned files behind
    if (uploaded.length) await supabase.storage.from(IMAGE_BUCKET).remove(uploaded.map((u) => u.path));
    throw error;
  }
}

// Create a listing: save as draft, upload photos, then (optionally) submit for review.
// If anything after the first step fails, the draft is kept and the error carries listingId.
export async function createListing(userId, values, files, { submit }) {
  const { data, error } = await supabase.from("properties").insert({ ...toRow(values), status: "draft" }).select("id").single();
  if (error) throw error;
  const id = data.id;
  try {
    await uploadImages(userId, id, files);
    if (submit) {
      const r = await supabase.from("properties").update({ status: "pending_review" }).eq("id", id);
      if (r.error) throw r.error;
    }
  } catch (err) {
    err.listingId = id;
    throw err;
  }
  return { id, status: submit ? "pending_review" : "draft" };
}

export async function updateListing(userId, id, values, { newFiles = [], removed = [], keptPositions = [], submit = false, currentStatus }) {
  const { error } = await supabase.from("properties").update(toRow(values)).eq("id", id);
  if (error) throw error;
  if (removed.length) {
    const del = await supabase.from("property_images").delete().in("id", removed.map((r) => r.id));
    if (del.error) throw del.error;
    const paths = removed.map((r) => r.path).filter(Boolean);
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths); // best effort
  }
  await uploadImages(userId, id, newFiles, keptPositions);
  if (submit && ["draft", "rejected"].includes(currentStatus)) {
    const r = await supabase.from("properties").update({ status: "pending_review" }).eq("id", id);
    if (r.error) throw r.error;
  }
}

export async function setListingStatus(id, status) {
  const { error } = await supabase.from("properties").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setAvailability(id, availability) {
  const { error } = await supabase.from("properties").update({ availability }).eq("id", id);
  if (error) throw error;
}

export async function deleteListing(id) {
  // remember the photo files first: the image records disappear with the listing
  const paths = (await fetchImageRows([id])).map((i) => i.path).filter(Boolean);
  const { data, error } = await supabase.from("properties").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("This listing can't be deleted. Archive or withdraw it first.");
  if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths); // best effort
}

// The signed-in user's own listings (the owner_id filter matters because reviewers can read everything)
export async function getMyListings(userId) {
  const { data, error } = await supabase.from("properties").select(OWNER_COLUMNS).eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return hydrate(data, { firstOnly: true });
}

// One listing for the edit form, with image rows so photos can be removed
export async function getListingForEdit(userId, id) {
  const { data, error } = await supabase.from("properties").select(`${OWNER_COLUMNS},owner_id`).eq("id", id).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const imgs = (await fetchImageRows([id])).sort((a, b) => a.position - b.position);
  const urls = await signPaths(imgs.map((i) => i.path));
  return { row: data, images: imgs.map((i) => ({ id: i.id, path: i.path, position: i.position, url: i.external_url || urls[i.path] })) };
}

// ---------- reviewers ----------
export async function getReviewQueue(status) {
  let q = supabase.from("properties").select(OWNER_COLUMNS).order("created_at", { ascending: true });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q.limit(100);
  if (error) throw error;
  return hydrate(data);
}

export async function reviewListing(id, decision, { reason = "", featured = false } = {}) {
  const patch = decision === "approve" ? { status: "published", featured } : { status: "rejected", rejection_reason: reason.trim() };
  const { data, error } = await supabase.from("properties").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("This listing could not be updated. It may have changed. Refresh and try again.");
}
