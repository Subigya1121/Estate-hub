import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { explainSendError, submitInquiry } from "../services/messagingService.js";
import { UUID_RE } from "../services/propertyService.js";
import { validateInquiry } from "../utils/formValidation.js";

function Field({ label, error, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Saves a real row in the `inquiries` table. States: idle -> submitting -> success | error.
export default function InquiryForm({ property }) {
  const { configured, user, profile } = useAuth();
  // Only what the person typed is stored; until they type, fields fall back to their account details
  // (which can finish loading after this form first renders).
  const [typed, setTyped] = useState({});
  const v = { name: profile?.full_name || "", email: user?.email || "", phone: profile?.phone || "", message: "", ...typed };
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", error: "" });
  const set = (k) => (e) => setTyped((p) => ({ ...p, [k]: e.target.value }));

  if (!configured || !UUID_RE.test(property.id)) {
    return <p className="rounded border border-sand-300 bg-sand-50 p-4 text-sm text-ink-500">This is a sample listing, so it can't receive inquiries. Inquiries on real listings are saved to EstateHub.</p>;
  }

  if (state.status === "success") {
    return (
      <div role="status" className="rounded border border-sand-300 bg-sand-50 p-5">
        <p className="font-display text-lg">Inquiry submitted successfully.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">Your message was saved and is now visible to the property's contact on their EstateHub dashboard. No email is sent automatically, so a reply may take a little while.</p>
        <button type="button" onClick={() => { setTyped((p) => ({ ...p, message: "" })); setState({ status: "idle", error: "" }); }} className="link-line mt-4">Send another inquiry</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (state.status === "submitting") return;
    const found = validateInquiry(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    setState({ status: "submitting", error: "" });
    try {
      await submitInquiry(property.id, v);
      setState({ status: "success", error: "" });
    } catch (err) {
      setState({ status: "error", error: explainSendError(err, "inquiries") });
    }
  };

  const busy = state.status === "submitting";
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {state.status === "error" && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      <Field label="Name" error={errors.name}><input className="field" value={v.name} onChange={set("name")} autoComplete="name" /></Field>
      <Field label="Email" error={errors.email}><input className="field" type="email" value={v.email} onChange={set("email")} autoComplete="email" /></Field>
      <Field label="Phone (optional)" error={errors.phone}><input className="field" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" /></Field>
      <Field label="Message" error={errors.message}>
        <textarea className="field resize-none" rows={4} maxLength={2000} value={v.message} onChange={set("message")} placeholder={`I'm interested in ${property.title}. Is it still available?`} />
      </Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Sending…" : "Send Inquiry"}</button>
    </form>
  );
}
