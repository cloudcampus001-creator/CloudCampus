/**
 * ProtectedRoute.jsx
 * ------------------
 * Guards dashboard routes.
 * Now validates the full session (including the 5-day inactivity window)
 * instead of just checking whether a localStorage key exists.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { isSessionAlive, getSession } from '@/lib/sessionPersistence';

const ProtectedRoute = ({ children, role }) => {
  // ── 1. Is there a living, non-expired session? ────────────────────────────
  if (!isSessionAlive()) {
    // Session missing or expired — send to landing page
    return <Navigate to="/" replace />;
  }

  // ── 2. Does the session role match what this route requires? ──────────────
  const session = getSession();
  const userRole = session?.userRole;

  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  if (role && userRole !== role) {
    // Wrong role — redirect to the root rather than leaking route info
    return <Navigate to="/" replace />;
  }

  // ── 3. All good — render the protected content ───────────────────────────
  return children;
};

export default ProtectedRoute;
