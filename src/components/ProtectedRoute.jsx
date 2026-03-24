/**
 * ProtectedRoute.jsx
 * ------------------
 * Guards dashboard routes using a cryptographically signed Supabase JWT.
 *
 * RACE-CONDITION FIX:
 * When a login page calls navigate() immediately after supabase.auth.setSession(),
 * the React auth context (SupabaseAuthContext) may not have processed the
 * SIGNED_IN event yet — so isAuthenticated is still false on the first render.
 *
 * Old behaviour: immediately bounce to "/" → user sees landing page flash.
 * New behaviour: if the context says "no session", do a direct supabase.auth.getSession()
 * check as a fallback before deciding to redirect. The tokens are already stored
 * in the Supabase client by the time navigate() fires, so getSession() returns
 * the live session even when the React context hasn't caught up yet.
 */
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { FullPageLoader } from '@/components/ui/loading-spinner';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, loading, session } = useAuth();

  // Start in "checking" mode so we never render a bounce on the first frame.
  const [checking, setChecking]         = useState(true);
  const [directSession, setDirectSession] = useState(null);

  useEffect(() => {
    // Wait for the auth context to finish its own initialisation first.
    if (loading) return;

    if (isAuthenticated) {
      // Context already has a session — no fallback check needed.
      setChecking(false);
      return;
    }

    // Context says no session, but the login page may have called
    // supabase.auth.setSession() a moment ago and React hasn't re-rendered yet.
    // Ask Supabase directly — it reads from its internal token store, which
    // setSession() already updated synchronously.
    supabase.auth.getSession().then(({ data: { session: liveSession } }) => {
      setDirectSession(liveSession ?? null);
      setChecking(false);
    });
  }, [isAuthenticated, loading]);

  // Still waiting — show a spinner instead of bouncing.
  if (loading || checking) {
    return <FullPageLoader text="Verifying session…" />;
  }

  // Prefer the context session; fall back to the direct check.
  const activeSession = session ?? directSession;

  // No session at all → go to landing page.
  if (!activeSession) {
    return <Navigate to="/" replace />;
  }

  // Role comes from JWT user_metadata — server-signed, cannot be forged.
  const userRole = activeSession?.user?.user_metadata?.role;

  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (role && userRole !== role) {
    // Authenticated but wrong role — redirect to root rather than leaking route info.
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
