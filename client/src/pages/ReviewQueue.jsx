import { useState } from "react";
import { Link } from "react-router-dom";
import { REVIEW_STATUS_LABEL } from "../data/site.js";
import useAsync from "../hooks/useAsync.js";
import { explainError, getReviewQueue, reviewListing } from "../services/listingService.js";
import { formatArea, formatLocation, formatPrice } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";
import { SelectField } from "../components/FormFields.jsx";
import PropertyImage from "../components/PropertyImage.jsx";

const FILTERS = [
  { value: "pending_review", label: "Waiting for review" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "Everything" },
];

function ReviewCard({ listing: l, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [featured, setFeatured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const act = async (decision) => {
    if (decision === "reject" && reason.trim().length < 10) return setError("Tell the owner what to fix (at least 10 characters).");
    setBusy(true); setError("");
    try {
      await reviewListing(l.id, decision, { reason, featured });
      onDone(decision === "approve" ? `“${l.title}” was approved and is now live.` : `“${l.title}” was sent back with your note.`);
    } catch (err) {
      setError(explainError(err));
      setBusy(false);
    }
  };

  return (
    <li className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="h-36 w-full shrink-0 overflow-hidden rounded bg-sand-200 sm:w-56"><PropertyImage property={l} width={600} /></div>
        <div className="min-w-0 flex-1">
          <p className="caption">{REVIEW_STATUS_LABEL[l.reviewStatus]} · submitted {new Date(l.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          <h2 className="mt-2 font-display text-xl font-normal">{l.title}</h2>
          <p className="mt-1 text-sm text-ink-500">{formatLocation(l)} · {formatPrice(l)} · {formatArea(l)}</p>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-700">{l.description}</p>
          <p className="mt-3 text-xs text-ink-500">
            Contact: {l.agent.name}{l.agent.phone ? ` · ${l.agent.phone}` : ""}{l.agent.email ? ` · ${l.agent.email}` : ""} · {l.images.length} photo{l.images.length === 1 ? "" : "s"}
          </p>
          <Link to={`/properties/${l.id}`} className="mt-3 inline-block text-sm font-medium text-ink-900 underline decoration-sand-400 underline-offset-4 hover:text-bronze-600">Open full preview</Link>

          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

          {l.reviewStatus === "pending_review" && (
            rejecting ? (
              <div className="mt-5 space-y-3">
                <label className="field-label">Note to the owner (shown on their dashboard)</label>
                <textarea className="field resize-none" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <div className="flex gap-3">
                  <button type="button" disabled={busy} onClick={() => act("reject")} className="btn-primary">{busy ? "Sending…" : "Send back to owner"}</button>
                  <button type="button" disabled={busy} onClick={() => setRejecting(false)} className="btn-outline">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button type="button" disabled={busy} onClick={() => act("approve")} className="btn-primary">{busy ? "Approving…" : "Approve"}</button>
                <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="btn-outline">Reject</button>
                <label className="flex items-center gap-2 text-sm text-ink-500">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-ink-900" /> Feature on homepage
                </label>
              </div>
            )
          )}
        </div>
      </div>
    </li>
  );
}

export default function ReviewQueue() {
  const [status, setStatus] = useState("pending_review");
  const [message, setMessage] = useState("");
  const { data: listings, error, loading, reload } = useAsync(() => getReviewQueue(status), status, { keepPrevious: false });

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-12 sm:py-16">
          <h1 className="font-display text-4xl font-light sm:text-5xl">Review listings</h1>
          <p className="mt-4 max-w-xl text-ink-500">Approve listings that are accurate and complete. Send the rest back with a note.</p>
        </div>
      </section>
      <section className="container-x py-10 sm:py-14">
        <div className="w-full sm:w-64"><SelectField label="Show" value={status} onChange={(v) => { setStatus(v); setMessage(""); }} options={FILTERS} /></div>
        {message && <p role="status" className="mt-6 rounded border border-sand-300 bg-sand-100 px-5 py-4 text-sm text-ink-700">{message}</p>}

        <div className="mt-8">
          {error ? (
            <EmptyState title="We couldn't load the listings" text={explainError(error)} action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />
          ) : loading ? (
            <div aria-busy="true" className="space-y-4"><p className="sr-only">Loading…</p>{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded bg-sand-200" />)}</div>
          ) : listings.length === 0 ? (
            <EmptyState title="Nothing here." text={status === "pending_review" ? "No listings are waiting for review right now." : "No listings match this filter."} />
          ) : (
            <ul className="divide-y divide-sand-200 rounded border border-sand-300 bg-white">
              {listings.map((l) => <ReviewCard key={l.id} listing={l} onDone={(text) => { setMessage(text); reload(); }} />)}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
