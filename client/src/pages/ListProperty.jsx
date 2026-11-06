import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useAsync from "../hooks/useAsync.js";
import { createListing, explainError, getListingForEdit, updateListing } from "../services/listingService.js";
import { EMPTY_LISTING, fromRow } from "../utils/listingValidation.js";
import EmptyState from "../components/EmptyState.jsx";
import PropertyForm from "../components/PropertyForm.jsx";
import { PageLoading } from "../components/RouteGuards.jsx";

// /list-property (new) and /dashboard/listings/:id/edit (edit). Both require sign-in (see App.jsx).
export default function ListProperty({ mode = "new" }) {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const edit = mode === "edit";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState(null);

  const { data: loaded, loading, error: loadError } = useAsync(
    () => (edit ? getListingForEdit(user.id, id) : Promise.resolve(null)),
    `${mode}:${id}:${user.id}`,
  );

  if (edit && loading) return <PageLoading label="Loading listing…" />;
  if (edit && (loadError || !loaded)) {
    return (
      <section className="container-x py-20">
        <EmptyState title={loadError ? "We couldn't load this listing" : "Listing not found"} text={loadError ? explainError(loadError) : "It may have been deleted, or it belongs to another account."} action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>} />
      </section>
    );
  }

  const initial = edit
    ? fromRow(loaded.row)
    : { ...EMPTY_LISTING, contactName: profile?.full_name || user.user_metadata?.full_name || "", contactPhone: profile?.phone || "", contactEmail: user.email || "" };
  const status = edit ? loaded.row.status : undefined;

  const handleSubmit = async ({ values, newFiles, removed, keptPositions, submit }) => {
    setBusy(true); setError(""); setPartial(null);
    try {
      if (edit) {
        await updateListing(user.id, id, values, { newFiles, removed, keptPositions, submit, currentStatus: status });
        const sent = submit && ["draft", "rejected"].includes(status);
        navigate("/dashboard", { state: { notice: sent ? "Your listing was submitted for review." : status === "published" ? "Changes saved. Your listing is back in review and hidden until it's approved again." : "Changes saved." } });
      } else {
        const result = await createListing(user.id, values, newFiles, { submit });
        navigate("/dashboard", { state: { notice: result.status === "pending_review" ? "Thank you! Your listing was submitted and will appear once a reviewer approves it." : "Draft saved. Only you can see it." } });
      }
    } catch (err) {
      if (err.listingId) setPartial({ id: err.listingId, message: explainError(err) });
      else setError(explainError(err));
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <section className="border-b border-sand-200">
        <div className="container-x py-12 sm:py-16">
          <h1 className="font-display text-4xl font-light sm:text-5xl">{edit ? "Edit listing" : "List your property"}</h1>
          <p className="mt-4 max-w-xl text-ink-500">{edit ? "Update the details below." : "Tell us about your property. A reviewer checks every listing before it goes live."}</p>
        </div>
      </section>
      <section className="container-x py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          {status === "rejected" && loaded.row.rejection_reason && (
            <div role="status" className="mb-8 rounded border border-sand-300 bg-sand-100 px-5 py-4 text-sm text-ink-700">
              <strong className="font-medium">A reviewer asked for changes:</strong> {loaded.row.rejection_reason}
            </div>
          )}
          {error && <p role="alert" className="mb-8 rounded border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">{error}</p>}
          {partial && (
            <p role="alert" className="mb-8 rounded border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              Your details were saved as a draft, but something went wrong: {partial.message}{" "}
              <Link to={`/dashboard/listings/${partial.id}/edit`} className="font-medium underline">Open the draft to finish</Link>
            </p>
          )}
          <PropertyForm initial={initial} existingImages={edit ? loaded.images : []} status={status} busy={busy} onSubmit={handleSubmit} />
        </div>
      </section>
    </>
  );
}
