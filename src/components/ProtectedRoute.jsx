/**
 * ProtectedRoute.jsx
 * ------------------
 * Guards dashboard routes. The role comes from the server-signed JWT claim
 * `app_metadata.role`, never from localStorage or user-editable metadata.
 *
 * Race-condition handling: right after login, supabase.auth.setSession() has
 * stored the tokens but the React auth context may not have processed the
 * SIGNED_IN event yet. If the context reports no session, we ask the Supabase
 * client directly before deciding to redirect, so users never see a bounce.
 */
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/customSupabaseClient';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { ROLE_HOME, getSessionRole, normalizeRole } from '@/lib/roles';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, loading, session } = useAuth();
  const { t } = useLanguage();

  const [checking, setChecking]           = useState(true);
  const [directSession, setDirectSession] = useState(null);

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session: live } }) => {
      if (cancelled) return;
      setDirectSession(live ?? null);
      setChecking(false);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, loading]);

  if (loading || checking) {
    return <FullPageLoader text={t('verifyingSession')} />;
  }

  const activeSession = session ?? directSession;
  if (!activeSession) return <Navigate to="/" replace />;

  const userRole = getSessionRole(activeSession);
  if (!userRole) return <Navigate to="/" replace />;

  // Signed in, but this area belongs to another role: send them to their own
  // dashboard rather than leaking which routes exist.
  if (role && userRole !== normalizeRole(role)) {
    return <Navigate to={ROLE_HOME[userRole]} replace />;
  }

  return children;
};

export default ProtectedRoute;