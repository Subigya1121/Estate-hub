// Turn Supabase auth errors into messages a visitor can act on.
export function friendlyAuthError(error) {
  const code = error?.code || "";
  const msg = (error?.message || "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "That email and password don't match. Please try again.";
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) return "Please confirm your email address first. Check your inbox for the confirmation link.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "An account with this email already exists. Try signing in instead.";
  if (code === "weak_password") return "That password is too weak. Use at least 8 characters.";
  if (code.includes("rate_limit") || msg.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "We couldn't reach the server. Check your connection and try again.";
  return error?.message || "Something went wrong. Please try again.";
}

