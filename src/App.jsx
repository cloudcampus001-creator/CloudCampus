/**
 * App.jsx
 * -------
 * Root component.
 *
 * FIXES:
 * 1. useStartupRedirect now reads the role from the Supabase JWT
 *    (session.user.user_metadata.role) instead of localStorage.
 *    This is what was causing the Vercel redirect-to-landing bug:
 *    - localStorage cc_session existed → redirected to /dashboard
 *    - ProtectedRoute checked Supabase JWT → JWT refresh failed on
 *      production because Supabase Site URL was localhost → no session
 *      → redirected back to /
 *    Now both hooks use the same source of truth (Supabase JWT).
 *
 * 2. useStartupRedirect waits for the Supabase session to resolve
 *    before attempting navigation, preventing the race condition.
 */
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router, Routes, Route, Navigate,
  useNavigate, useLocation,
} from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { Toaster } from '@/components/ui/toaster';
import { FullPageLoader } from '@/components/ui/loading-spinner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { touchActivity } from '@/lib/sessionPersistence';

// Pages
import LandingPage              from '@/pages/LandingPage';
import SchoolSelectionPage      from '@/pages/SchoolSelectionPage';
import RoleSelectionPage        from '@/pages/RoleSelectionPage';
import ParentLoginPage          from '@/pages/ParentLoginPage';
import TeacherLoginPage         from '@/pages/TeacherLoginPage';
import DisciplineMasterLoginPage from '@/pages/DisciplineMasterLoginPage';
import VicePrincipalLoginPage   from '@/pages/VicePrincipalLoginPage';
import AdministratorLoginPage   from '@/pages/AdministratorLoginPage';
import ParentDashboard          from '@/pages/ParentDashboard';
import TeacherDashboard         from '@/pages/TeacherDashboard';
import DisciplineDashboard      from '@/pages/DisciplineDashboard';
import VicePrincipalDashboard   from '@/pages/VicePrincipalDashboard';
import AdminDashboard           from '@/pages/AdminDashboard';
import AboutUsPage              from '@/pages/AboutUsPage';
import ContactUsPage            from '@/pages/ContactUsPage';
import CloudAIPage              from '@/pages/CloudAIPage';
import ProtectedRoute           from '@/components/ProtectedRoute';

const DASHBOARD_MAP = {
  'parent':         '/dashboard/parent',
  'teacher':        '/dashboard/teacher',
  'discipline':     '/dashboard/discipline',
  'vice_principal': '/dashboard/vice-principal',
  'vice-principal': '/dashboard/vice-principal',
  'administrator':  '/dashboard/administrator',
  'admin':          '/dashboard/administrator',
};

// -----------------------------------------------------------------------------
// Hook: startup redirect
// Waits for the Supabase session to resolve, then reads the role from
// the JWT user_metadata. This works identically on localhost and Vercel.
// -----------------------------------------------------------------------------
function useStartupRedirect() {
  const navigate        = useNavigate();
  const location        = useLocation();
  const { session, loading } = useAuth();

  useEffect(() => {
    // Wait until auth context has finished loading
    if (loading) return;

    // Already in a dashboard — nothing to do
    if (location.pathname.startsWith('/dashboard')) return;

    // No valid Supabase session — stay on current page
    if (!session) return;

    // Read role from the JWT (server-signed, cannot be forged)
    const role = session.user?.user_metadata?.role;
    if (!role) return;

    const target = DASHBOARD_MAP[role];
    if (target) {
      navigate(target, { replace: true });
    }
  }, [loading, session]); // re-runs when auth state resolves
}

// -----------------------------------------------------------------------------
// Hook: activity tracker (no-op now, kept for compatibility)
// -----------------------------------------------------------------------------
function useActivityTracker() {
  useEffect(() => {
    const events  = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    const handler = () => touchActivity();
    events.forEach(evt => window.addEventListener(evt, handler, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') touchActivity(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach(evt => window.removeEventListener(evt, handler));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

// -----------------------------------------------------------------------------
// AppContent — routing
// -----------------------------------------------------------------------------
const AppContent = () => {
  const { loading } = useAuth();
  const { t }       = useLanguage();
  const location    = useLocation();

  useStartupRedirect();
  useActivityTracker();

  if (loading) {
    return <FullPageLoader text={t('verifyingSession')} />;
  }

  const isDashboard = location.pathname.startsWith('/dashboard');
  const isLanding   = location.pathname === '/';

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30">

      {!isDashboard && !isLanding && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-top-4 duration-700 delay-300">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      )}

      <Routes>
        {/* ── Public ──────────────────────────────────────────── */}
        <Route path="/"              element={<LandingPage />} />
        <Route path="/select-school" element={<SchoolSelectionPage />} />
        <Route path="/about"         element={<AboutUsPage />} />
        <Route path="/contact"       element={<ContactUsPage />} />
        <Route path="/cloud-ai"      element={<CloudAIPage />} />

        <Route path="/role-selection/:schoolId"       element={<RoleSelectionPage />} />
        <Route path="/login/parent/:schoolId"         element={<ParentLoginPage />} />
        <Route path="/login/teacher/:schoolId"        element={<TeacherLoginPage />} />
        <Route path="/login/discipline/:schoolId"     element={<DisciplineMasterLoginPage />} />
        <Route path="/login/vice-principal/:schoolId" element={<VicePrincipalLoginPage />} />
        <Route path="/login/administrator/:schoolId"  element={<AdministratorLoginPage />} />

        {/* ── Protected dashboards ────────────────────────────── */}
        <Route path="/dashboard/parent/*"
          element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />

        <Route path="/dashboard/teacher/*"
          element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />

        <Route path="/dashboard/discipline/*"
          element={<ProtectedRoute role="discipline"><DisciplineDashboard /></ProtectedRoute>} />

        <Route path="/dashboard/vice-principal/*"
          element={<ProtectedRoute role="vice-principal"><VicePrincipalDashboard /></ProtectedRoute>} />

        <Route path="/dashboard/administrator/*"
          element={<ProtectedRoute role="administrator"><AdminDashboard /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </div>
  );
};

// -----------------------------------------------------------------------------
// Root
// -----------------------------------------------------------------------------
function App() {
  return (
    <AuthProvider>
      <Router>
        <Helmet>
          <title>CloudCampus — School Management System</title>
          <meta name="description" content="CloudCampus is a complete school management system for administrators, teachers, parents and staff. Manage timetables, marks, attendance, discipline and notifications in one platform." />
          <meta name="robots" content="index, follow" />
        </Helmet>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
