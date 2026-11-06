import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../utils/authErrors.js";
import { PageLoading, SetupNotice } from "../components/RouteGuards.jsx";

// Landing page for the link in the password-reset email (Supabase signs the user in with a recovery session).
export default function ResetPassword() {
  const { configured, user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!configured) return <SetupNotice />;
  if (loading) return <PageLoading />;
  if (!user) {
    return (
      <section className="container-x py-24">
        <h1 className="font-display text-3xl font-light">This reset link has expired</h1>
        <p className="mt-3 max-w-md text-ink-500">Request a new link and try again.</p>
        <Link to="/login?mode=forgot" className="btn-primary mt-8">Request a new link</Link>
      </section>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true); setError("");
    try {
      await updatePassword(password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  return (
    <section className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-light sm:text-4xl">Choose a new password</h1>
        <form onSubmit={submit} noValidate className="mt-10 space-y-5 rounded border border-sand-300 bg-white p-6 shadow-card sm:p-8">
          {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <div>
            <label className="field-label">New password</label>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Saving…" : "Save password"}</button>
        </form>
      </div>
    </section>
  );
}
