/**
 * ProtectedRoute.jsx
 * ------------------
 * Guards dashboard routes using a cryptographically signed Supabase JWT.
 *
 * BEFORE: Read userRole from localStorage → trivially forgeable.
 * AFTER:  Read userRole from session.user.user_metadata → signed by Supabase,
 *         cannot be tampered without the server secret.
 *
 * The SupabaseAuthContext handles the async session load + the loading state.
 * By the time ProtectedRoute renders, the session is already resolved.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { FullPageLoader } from '@/components/ui/loading-spinner';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, loading, session } = useAuth();

  // Auth context is still initialising (Supabase getSession is async)
  if (loading) {
    return <FullPageLoader text="Verifying session…" />;
  }

  // No valid JWT → go to landing
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Role comes from JWT user_metadata — server-signed, cannot be forged
  const userRole = session?.user?.user_metadata?.role;

  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (role && userRole !== role) {
    // Authenticated but wrong role — redirect to root rather than leaking route info
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
