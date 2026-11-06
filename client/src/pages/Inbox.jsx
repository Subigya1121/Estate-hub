import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useAsync from "../hooks/useAsync.js";
import { getInbox, setInquiryStatus, setVisitStatus } from "../services/messagingService.js";
import EmptyState from "../components/EmptyState.jsx";

const INQUIRY_STATUSES = [["new", "New"], ["contacted", "Contacted"], ["closed", "Closed"]];
const VISIT_STATUSES = [["requested", "Requested"], ["confirmed", "Confirmed"], ["declined", "Declined"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const TIME_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Row({ item, statuses, onStatus, busy, extra }) {
  return (
    <li className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="caption">{fmt(item.created_at)}</p>
          <h3 className="mt-2 font-display text-lg font-normal">{item.name}</h3>
          <p className="mt-1 text-sm text-ink-500">
            About <Link to={`/properties/${item.properties.id}`} className="text-ink-900 underline decoration-sand-400 underline-offset-4 hover:text-bronze-600">{item.properties.title}</Link>
          </p>
          <p className="mt-2 text-sm text-ink-700">
            <a href={`mailto:${item.email}`} className="hover:text-bronze-600">{item.email}</a>
            {item.phone && <> · <a href={`tel:${item.phone.replace(/\s/g, "")}`} className="hover:text-bronze-600">{item.phone}</a></>}
          </p>
          {extra}
          {item.message && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">{item.message}</p>}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink-500">
          Status
          <select value={item.status} disabled={busy} onChange={(e) => onStatus(item.id, e.target.value)} className="rounded border border-sand-300 bg-white px-2 py-1.5 text-sm text-ink-900">
            {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
    </li>
  );
}

export default function Inbox() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => getInbox(user.id), user.id);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState({ type: "ok", text: "" });

  const change = (fn) => async (id, status) => {
    setBusyId(id);
    setMessage({ type: "ok", text: "" });
    try {
      await fn(id, status);
      setMessage({ type: "ok", text: "Status updated." });
      reload();
    } catch {
      setMessage({ type: "error", text: "We couldn't update that. Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between sm:py-16">
          <div>
            <h1 className="font-display text-4xl font-light sm:text-5xl">Inquiries</h1>
            <p className="mt-4 max-w-xl text-ink-500">Messages and visit requests about your listings. EstateHub doesn't email you about these yet, so check back here.</p>
          </div>
          <Link to="/dashboard" className="btn-outline self-start sm:self-auto">Back to your listings</Link>
        </div>
      </section>

      <section className="container-x space-y-14 py-10 sm:py-14">
        {message.text && <p role={message.type === "error" ? "alert" : "status"} className={`rounded border px-5 py-4 text-sm ${message.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sand-300 bg-sand-100 text-ink-700"}`}>{message.text}</p>}

        {error ? (
          <EmptyState title="We couldn't load your inbox" text="Please check your connection and try again." action={<button type="button" onClick={reload} className="btn-primary">Try again</button>} />
        ) : loading ? (
          <div aria-busy="true" className="space-y-4"><p className="sr-only">Loading inquiries…</p>{[0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded bg-sand-200" />)}</div>
        ) : (
          <>
            <div>
              <h2 className="font-display text-2xl font-light">Inquiries ({data.inquiries.length})</h2>
              <div className="mt-6">
                {data.inquiries.length === 0 ? (
                  <EmptyState title="No inquiries yet." text="When someone sends an inquiry about one of your published listings, it will appear here." />
                ) : (
                  <ul className="divide-y divide-sand-200 rounded border border-sand-300 bg-white">
                    {data.inquiries.map((i) => <Row key={i.id} item={i} statuses={INQUIRY_STATUSES} busy={busyId === i.id} onStatus={change(setInquiryStatus)} />)}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <h2 className="font-display text-2xl font-light">Visit requests ({data.visits.length})</h2>
              <div className="mt-6">
                {data.visits.length === 0 ? (
                  <EmptyState title="No visit requests yet." text="Visit requests are requests only. Contact the visitor to agree a time." />
                ) : (
                  <ul className="divide-y divide-sand-200 rounded border border-sand-300 bg-white">
                    {data.visits.map((v) => (
                      <Row key={v.id} item={v} statuses={VISIT_STATUSES} busy={busyId === v.id} onStatus={change(setVisitStatus)}
                        extra={<p className="mt-2 text-sm font-medium text-ink-900">Wants to visit on {new Date(`${v.preferred_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, {TIME_LABEL[v.preferred_time]?.toLowerCase()}</p>} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
