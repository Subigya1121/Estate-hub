import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { explainSendError, submitVisitRequest } from "../services/messagingService.js";
import { UUID_RE } from "../services/propertyService.js";
import { todayLocal, validateVisit } from "../utils/formValidation.js";

const TIMES = [["morning", "Morning (9am to 12pm)"], ["afternoon", "Afternoon (12pm to 4pm)"], ["evening", "Evening (4pm to 6pm)"]];

function Field({ label, error, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Saves a real row in `visit_requests`. This is a request only: nothing is booked until the owner follows up.
export default function VisitRequestForm({ property }) {
  const { configured, user, profile } = useAuth();
  const [typed, setTyped] = useState({});
  const v = { name: profile?.full_name || "", email: user?.email || "", phone: profile?.phone || "", date: "", time: "morning", message: "", ...typed };
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", error: "" });
  const set = (k) => (e) => setTyped((p) => ({ ...p, [k]: e.target.value }));

  if (!configured || !UUID_RE.test(property.id)) {
    return <p className="rounded border border-sand-300 bg-sand-50 p-4 text-sm text-ink-500">This is a sample listing, so visits can't be requested. Visit requests on real listings are saved to EstateHub.</p>;
  }

  if (state.status === "success") {
    return (
      <div role="status" className="rounded border border-sand-300 bg-sand-50 p-5">
        <p className="font-display text-lg">Visit request submitted successfully.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">Your request was saved. It is not a confirmed booking: the property's contact will review it and get in touch to agree a time.</p>
        <button type="button" onClick={() => setState({ status: "idle", error: "" })} className="link-line mt-4">Request another time</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (state.status === "submitting") return;
    const found = validateVisit(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    setState({ status: "submitting", error: "" });
    try {
      await submitVisitRequest(property.id, v);
      setState({ status: "success", error: "" });
    } catch (err) {
      setState({ status: "error", error: explainSendError(err, "visit requests") });
    }
  };

  const busy = state.status === "submitting";
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {state.status === "error" && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      <Field label="Name" error={errors.name}><input className="field" value={v.name} onChange={set("name")} autoComplete="name" /></Field>
      <Field label="Email" error={errors.email}><input className="field" type="email" value={v.email} onChange={set("email")} autoComplete="email" /></Field>
      <Field label="Phone" error={errors.phone}><input className="field" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred date" error={errors.date}><input className="field" type="date" min={todayLocal()} value={v.date} onChange={set("date")} /></Field>
        <Field label="Preferred time" error={errors.time}>
          <select className="field" value={v.time} onChange={set("time")}>{TIMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </Field>
      </div>
      <Field label="Note (optional)" error={errors.message}><textarea className="field resize-none" rows={3} maxLength={1000} value={v.message} onChange={set("message")} /></Field>
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Sending…" : "Request a Visit"}</button>
    </form>
  );
}
