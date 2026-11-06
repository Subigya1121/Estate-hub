import { supabase } from "./supabase.js";

// Inquiries, visit requests and contact messages. Each call resolves only after the database has
// confirmed the insert, so the UI can safely show "success" afterwards.
// sender_id and status are never sent from the browser: the database fills them in.

const clean = (s) => (s && s.trim() ? s.trim() : null);

export async function submitInquiry(propertyId, v) {
  const { error } = await supabase.from("inquiries").insert({
    property_id: propertyId,
    name: v.name.trim(),
    email: v.email.trim(),
    phone: clean(v.phone),
    message: v.message.trim(),
  });
  if (error) throw error;
}

export async function submitVisitRequest(propertyId, v) {
  const { error } = await supabase.from("visit_requests").insert({
    property_id: propertyId,
    name: v.name.trim(),
    email: v.email.trim(),
    phone: v.phone.trim(),
    preferred_date: v.date,
    preferred_time: v.time,
    message: clean(v.message),
  });
  if (error) throw error;
}

export async function submitContactMessage(v) {
  const { error } = await supabase.from("contact_messages").insert({
    name: v.name.trim(),
    email: v.email.trim(),
    phone: clean(v.phone),
    message: v.message.trim(),
  });
  if (error) throw error;
}

// Message shown when a send fails. `what` is the plural thing being sent, e.g. "inquiries".
export function explainSendError(error, what) {
  const msg = error?.message || "";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "We couldn't reach the server. Check your connection and try again.";
  if (/row-level security|permission denied/i.test(msg)) {
    return what
      ? `This property isn't accepting ${what} right now. It may have been sold, rented or taken down.`
      : "We couldn't send your message right now. Please try again.";
  }
  if (/check constraint|violates/i.test(msg)) return "Some details look invalid. Please check the form and try again.";
  return "Something went wrong. Please try again.";
}

// ---------- listing owner's inbox ----------
const INBOX_PROPERTY = "properties!inner(id,title,owner_id)";

export async function getInbox(userId) {
  const [inq, vis] = await Promise.all([
    supabase.from("inquiries").select(`id,name,email,phone,message,status,created_at,${INBOX_PROPERTY}`).eq("properties.owner_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("visit_requests").select(`id,name,email,phone,preferred_date,preferred_time,message,status,created_at,${INBOX_PROPERTY}`).eq("properties.owner_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);
  if (inq.error) throw inq.error;
  if (vis.error) throw vis.error;
  return { inquiries: inq.data, visits: vis.data };
}

export async function setInquiryStatus(id, status) {
  const { data, error } = await supabase.from("inquiries").update({ status }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not update this inquiry.");
}

export async function setVisitStatus(id, status) {
  const { data, error } = await supabase.from("visit_requests").update({ status }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Could not update this visit request.");
}
