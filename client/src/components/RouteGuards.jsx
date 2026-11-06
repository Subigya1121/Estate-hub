import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import EmptyState from "./EmptyState.jsx";

export function PageLoading({ label = "Loading…" }) {
  return (
    <div className="container-x py-24" role="status">
      <div className="h-6 w-48 animate-pulse rounded bg-sand-200" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

// Shown for account pages when the Supabase environment variables are not set (demo mode).
export function SetupNotice() {
  return (
    <section className="container-x py-20 sm:py-28">
      <EmptyState
        title="Accounts aren't connected yet"
        text="EstateHub is running in demo mode with sample listings. Add your Supabase URL and publishable key to client/.env.local and restart the dev server to turn on sign-in and listing submissions."
        action={<Link to="/" className="btn-primary">Back to home</Link>}
      />
    </section>
  );
}

// UX guard only. Database policies are the real protection.
export function RequireAuth() {
  const { configured, user, loading } = useAuth();
  const location = useLocation();
  if (!configured) return <SetupNotice />;
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RequireReviewer() {
  const { configured, user, loading, isReviewer } = useAuth();
  const location = useLocation();
  if (!configured) return <SetupNotice />;
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isReviewer) {
    return (
      <section className="container-x py-20 sm:py-28">
        <EmptyState
          title="Reviewers only"
          text="This page is for EstateHub reviewers. If you think you should have access, ask an administrator."
          action={<Link to="/dashboard" className="btn-primary">Go to your dashboard</Link>}
        />
      </section>
    );
  }
  return <Outlet />;
}
