import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../services/supabase.js";

const AuthContext = createContext(null);

// Route guards built on this are for user experience only. Real access control is enforced by
// Row Level Security in the database, and never by anything the browser decides.
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [account, setAccount] = useState({ userId: null, profile: null, isReviewer: false });

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(
      ({ data }) => {
        setSession(data.session);
        setLoading(false);
      },
      () => setLoading(false), // e.g. offline: treat as signed out instead of hanging
    );
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // Load profile and reviewer flag from the database (RLS limits both queries to the signed-in user).
  useEffect(() => {
    if (!supabase || !userId) return undefined;
    let cancelled = false;
    Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
      supabase.from("reviewers").select("user_id").eq("user_id", userId).maybeSingle(),
    ]).then(
      ([p, r]) => {
        if (!cancelled) setAccount({ userId, profile: p.data ?? null, isReviewer: Boolean(r.data) });
      },
      () => {
        if (!cancelled) setAccount({ userId, profile: null, isReviewer: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const accountReady = !userId || account.userId === userId;

  const signUp = useCallback(async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw error;
    // Supabase hides whether an address is already registered: an empty identities list means it was.
    if (data.user && data.user.identities?.length === 0) {
      const e = new Error("already registered");
      e.code = "user_already_exists";
      throw e;
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/login` } });
    if (error) throw error;
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      user,
      session,
      loading: loading || !accountReady,
      profile: account.userId === userId ? account.profile : null,
      isReviewer: account.userId === userId && account.isReviewer,
      signUp, signIn, signOut, resendConfirmation, requestPasswordReset, updatePassword,
    }),
    [user, session, loading, accountReady, account, userId, signUp, signIn, signOut, resendConfirmation, requestPasswordReset, updatePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
