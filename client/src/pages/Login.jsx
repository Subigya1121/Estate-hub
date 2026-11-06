import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../utils/authErrors.js";
import { PageLoading, SetupNotice } from "../components/RouteGuards.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, error, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// One page for sign in, sign up and "forgot password": /login, /login?mode=signup, /login?mode=forgot
export default function Login() {
  const { configured, user, loading, signIn, signUp, resendConfirmation, requestPasswordReset } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = ["signup", "forgot"].includes(params.get("mode")) ? params.get("mode") : "signin";

  const [v, setV] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);

  const from = location.state?.from || "/dashboard";
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));
  const switchMode = (next) => {
    setParams(next === "signin" ? {} : { mode: next }, { replace: true, state: location.state });
    setErrors({}); setFormError(""); setNotice(""); setCanResend(false);
  };

  if (!configured) return <SetupNotice />;
  if (loading) return <PageLoading />;
  if (user) return <Navigate to={from} replace />;

  const validate = () => {
    const next = {};
    if (mode === "signup" && v.fullName.trim().length < 2) next.fullName = "Please enter your name.";
    if (!EMAIL_RE.test(v.email.trim())) next.email = "Please enter a valid email address.";
    if (mode !== "forgot") {
      if (!v.password) next.password = "Please enter your password.";
      else if (mode === "signup" && v.password.length < 8) next.password = "Use at least 8 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(""); setNotice(""); setCanResend(false);
    if (!validate()) return;
    setBusy(true);
    const email = v.email.trim();
    try {
      if (mode === "signin") {
        await signIn({ email, password: v.password });
        navigate(from, { replace: true });
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUp({ email, password: v.password, fullName: v.fullName.trim() });
        if (needsConfirmation) {
          setNotice("Check your email to confirm your address, then sign in. The link can take a minute to arrive.");
          setCanResend(true);
        } else {
          navigate(from, { replace: true });
        }
      } else {
        await requestPasswordReset(email);
        setNotice("If an account exists for that email, a reset link is on its way.");
      }
    } catch (err) {
      setFormError(friendlyAuthError(err));
      if (err?.code === "email_not_confirmed") setCanResend(true);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await resendConfirmation(v.email.trim());
      setNotice("We've sent the confirmation email again.");
    } catch (err) {
      setFormError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    signin: { title: "Welcome back", lead: "Sign in to manage your listings.", button: "Sign in" },
    signup: { title: "Create your account", lead: "List your property and track its review.", button: "Create account" },
    forgot: { title: "Reset your password", lead: "Enter your email and we'll send you a reset link.", button: "Send reset link" },
  }[mode];

  return (
    <section className="container-x py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-light sm:text-4xl">{copy.title}</h1>
        <p className="mt-3 text-ink-500">{copy.lead}</p>

        <form onSubmit={submit} noValidate className="mt-10 space-y-5 rounded border border-sand-300 bg-white p-6 shadow-card sm:p-8">
          {formError && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{formError}</p>}
          {notice && <p role="status" className="rounded border border-sand-300 bg-sand-50 px-4 py-3 text-sm text-ink-700">{notice}</p>}

          {mode === "signup" && (
            <Field label="Full name" error={errors.fullName}><input className="field" value={v.fullName} onChange={set("fullName")} autoComplete="name" /></Field>
          )}
          <Field label="Email" error={errors.email}><input className="field" type="email" value={v.email} onChange={set("email")} autoComplete="email" /></Field>
          {mode !== "forgot" && (
            <Field label="Password" error={errors.password}>
              <input className="field" type="password" value={v.password} onChange={set("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </Field>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Please wait…" : copy.button}</button>
          {canResend && <button type="button" onClick={resend} disabled={busy} className="link-line">Resend confirmation email</button>}
        </form>

        <div className="mt-6 space-y-2 text-sm text-ink-500">
          {mode === "signin" && (
            <>
              <p>New to EstateHub? <button type="button" onClick={() => switchMode("signup")} className="font-medium text-ink-900 underline underline-offset-4 hover:text-bronze-600">Create an account</button></p>
              <p><button type="button" onClick={() => switchMode("forgot")} className="underline underline-offset-4 hover:text-bronze-600">Forgot your password?</button></p>
            </>
          )}
          {mode !== "signin" && (
            <p>Already have an account? <button type="button" onClick={() => switchMode("signin")} className="font-medium text-ink-900 underline underline-offset-4 hover:text-bronze-600">Sign in</button></p>
          )}
          <p><Link to="/" className="underline underline-offset-4 hover:text-bronze-600">Back to home</Link></p>
        </div>
      </div>
    </section>
  );
}
