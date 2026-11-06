import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { REVIEW_STATUS_LABEL, STATUS_LABEL } from "../data/site.js";
import { useAuth } from "../context/AuthContext.jsx";
import useAsync from "../hooks/useAsync.js";
import { deleteListing, explainError, getMyListings, setAvailability, setListingStatus } from "../services/listingService.js";
import { formatLocation, formatPrice } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";
import PropertyImage from "../components/PropertyImage.jsx";

const linkBtn = "text-sm font-medium text-ink-900 underline decoration-sand-400 underline-offset-4 transition-colors hover:text-bronze-600 hover:decoration-bronze-500 disabled:opacity-50";

function Stat({ label, value }) {
  return (
    <div className="px-6 py-5">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-light">{value}</dd>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: listings, error, loading, reload } = useAsync(() => getMyListings(user.id), user.id);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: "ok", text: location.state?.notice || "" });

  const run = async (id, action, success) => {
    setBusyId(id);
    setMessage({ type: "ok", text: "" });
    try {
      await action();
      setMessage({ type: "ok", text: success });
      reload();
    } catch (err) {
      setMessage({ type: "error", text: explainError(err) });
    } finally {
      setBusyId(null);
    }
  };

  const counts = (s) => (listings || []).filter((l) => l.reviewStatus === s).length;

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-16">
          <div>
            <h1 className="font-display text-4xl font-light sm:text-5xl">Your listings</h1>
            <p className="mt-4 max-w-xl text-ink-500">Manage the properties you've listed. Only you can see drafts and listings in review.</p>
          </div>
          <div className="flex flex-wrap gap-3 self-start sm:self-auto">
            <Link to="/dashboard/inquiries" className="btn-outline">Inquiries</Link>
            <Link to="/list-property" className="btn-primary">List a property</Link>
          </div>
        </div>
      </section>

      <section className="container-x py-10 sm:py-14">
        {message.text && (
          <p role={message.type === "error" ? "alert" : "status"} className={`mb-8 rounded border px-5 py-4 text-sm ${message.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sand-300 bg-sand-100 text-ink-700"}`}>
            {message.text}
          </p>
        )}

        {error && <EmptyState title="We couldn't load your listings" text={explainError(error)} action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />}

        {!error && (
          <>
            <dl className="grid grid-cols-2 divide-sand-200 rounded border border-sand-300 bg-white sm:grid-cols-4 sm:divide-x">
              <Stat label="Total listings" value={loading ? "–" : listings.length} />
              <Stat label="Published" value={loading ? "–" : counts("published")} />
              <Stat label="In review" value={loading ? "–" : counts("pending_review")} />
              <Stat label="Drafts" value={loading ? "–" : counts("draft")} />
            </dl>

            <div className="mt-10">
              {loading ? (
                <div aria-busy="true" className="space-y-4"><p className="sr-only">Loading your listings…</p>{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded bg-sand-200" />)}</div>
              ) : listings.length === 0 ? (
                <EmptyState title="You haven't listed a property yet." text="Add your first listing. It only takes a few minutes." action={<Link to="/list-property" className="btn-primary">List a property</Link>} />
              ) : (
                <ul className="divide-y divide-sand-200 rounded border border-sand-300 bg-white">
                  {listings.map((l) => {
                    const busy = busyId === l.id;
                    const s = l.reviewStatus;
                    return (
                      <li key={l.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
                        <div className="h-24 w-full shrink-0 overflow-hidden rounded bg-sand-200 sm:w-36"><PropertyImage property={l} width={500} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <h2 className="font-display text-xl font-normal">{l.title}</h2>
                            <span className="caption text-bronze-600">{REVIEW_STATUS_LABEL[s]}</span>
                          </div>
                          <p className="mt-1 text-sm text-ink-500">{formatLocation(l)}</p>
                          <p className="mt-2 text-[15px] font-medium">{formatPrice(l)}</p>
                          {s === "rejected" && l.rejectionReason && <p className="mt-3 text-sm text-ink-700"><strong className="font-medium">Reviewer note:</strong> {l.rejectionReason}</p>}
                          {s === "pending_review" && <p className="mt-3 text-sm text-ink-500">A reviewer will check this listing soon. It isn't visible to visitors yet.</p>}

                          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                            {s !== "archived" && <Link to={`/dashboard/listings/${l.id}/edit`} className={linkBtn}>{s === "rejected" ? "Edit and resubmit" : "Edit"}</Link>}
                            {["published", "pending_review"].includes(s) && <Link to={`/properties/${l.id}`} className={linkBtn}>{s === "published" ? "View live" : "Preview"}</Link>}
                            {s === "pending_review" && <button type="button" disabled={busy} className={linkBtn} onClick={() => run(l.id, () => setListingStatus(l.id, "draft"), "Submission withdrawn. It's now a draft.")}>Withdraw</button>}
                            {s === "published" && (
                              <label className="flex items-center gap-2 text-sm text-ink-500">
                                Availability
                                <select value={l.status} disabled={busy} onChange={(e) => run(l.id, () => setAvailability(l.id, e.target.value), "Availability updated.")} className="rounded border border-sand-300 bg-white px-2 py-1 text-sm text-ink-900">
                                  {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                              </label>
                            )}
                            {["published", "rejected", "draft"].includes(s) && <button type="button" disabled={busy} className={linkBtn} onClick={() => window.confirm("Archive this listing? It will be hidden from visitors.") && run(l.id, () => setListingStatus(l.id, "archived"), "Listing archived.")}>Archive</button>}
                            {s === "archived" && <button type="button" disabled={busy} className={linkBtn} onClick={() => run(l.id, () => setListingStatus(l.id, "draft"), "Restored as a draft.")}>Restore as draft</button>}
                            {["draft", "rejected", "archived"].includes(s) && <button type="button" disabled={busy} className="text-sm font-medium text-red-700 underline underline-offset-4 disabled:opacity-50" onClick={() => window.confirm("Delete this listing permanently? This can't be undone.") && run(l.id, () => deleteListing(l.id, l.imagePaths), "Listing deleted.")}>Delete</button>}
                            {busy && <span className="text-sm text-ink-400">Working…</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
