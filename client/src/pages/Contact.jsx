import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { explainSendError, submitContactMessage } from "../services/messagingService.js";
import { validateContact } from "../utils/formValidation.js";

function Field({ label, error, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Saves a row in `contact_messages`. "Message sent successfully." is shown only after the database confirms it.
export default function Contact() {
  const { configured, user, profile } = useAuth();
  const [typed, setTyped] = useState({});
  const v = { name: profile?.full_name || "", email: user?.email || "", phone: profile?.phone || "", message: "", ...typed };
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", error: "" });
  const set = (k) => (e) => setTyped((p) => ({ ...p, [k]: e.target.value }));
  const busy = state.status === "submitting";

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validateContact(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    setState({ status: "submitting", error: "" });
    try {
      await submitContactMessage(v);
      setTyped((p) => ({ ...p, message: "" }));
      setState({ status: "success", error: "" });
    } catch (err) {
      setState({ status: "error", error: explainSendError(err) });
    }
  };

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-16 sm:py-24">
          <h1 className="font-display text-4xl font-light sm:text-5xl">Contact</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500">Have a question about a property, or about listing with EstateHub? Send us a message.</p>
        </div>
      </section>

      <section className="container-x py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          {!configured ? (
            <p className="rounded border border-sand-300 bg-sand-50 p-5 text-sm text-ink-500">The contact form saves messages to the EstateHub database, which isn't connected in this demo build.</p>
          ) : state.status === "success" ? (
            <div role="status" className="rounded border border-sand-300 bg-white p-6">
              <p className="font-display text-xl">Message sent successfully.</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">We've received it and will reply using the details you gave. We don't send an automatic confirmation email.</p>
              <button type="button" onClick={() => setState({ status: "idle", error: "" })} className="link-line mt-5">Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-5 rounded border border-sand-300 bg-white p-6 shadow-card sm:p-8">
              {state.status === "error" && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
              <Field label="Name" error={errors.name}><input className="field" value={v.name} onChange={set("name")} autoComplete="name" /></Field>
              <Field label="Email" error={errors.email}><input className="field" type="email" value={v.email} onChange={set("email")} autoComplete="email" /></Field>
              <Field label="Phone (optional)" error={errors.phone}><input className="field" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" /></Field>
              <Field label="Message" error={errors.message}><textarea className="field resize-y" rows={6} maxLength={4000} value={v.message} onChange={set("message")} /></Field>
              <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Sending…" : "Send message"}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
