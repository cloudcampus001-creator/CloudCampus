/**
 * App.jsx
 * -------
 * Root component.
 *
 * Key behaviours:
 * 1. On every app boot, if a valid (non-expired) session exists in
 *    localStorage, the user is automatically sent to their dashboard
 *    — no login needed.  This is what makes "remember me" work in
 *    the APK/WebView environment.
 *
 * 2. A global activity tracker resets the 5-day inactivity timer on
 *    every click, keypress, or touch.
 *
 * ROUTING CHANGE (landing page):
 *    /               → LandingPage        (new marketing landing page)
 *    /select-school  → SchoolSelectionPage (school + role picker)
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
import { touchActivity, getSession } from '@/lib/sessionPersistence';

// Pages
import LandingPage              from '@/pages/LandingPage';           // ← NEW
import SchoolSelectionPage       from '@/pages/SchoolSelectionPage';
import RoleSelectionPage         from '@/pages/RoleSelectionPage';
import ParentLoginPage           from '@/pages/ParentLoginPage';
import TeacherLoginPage          from '@/pages/TeacherLoginPage';
import DisciplineMasterLoginPage from '@/pages/DisciplineMasterLoginPage';
import VicePrincipalLoginPage    from '@/pages/VicePrincipalLoginPage';
import AdministratorLoginPage    from '@/pages/AdministratorLoginPage';
import ParentDashboard           from '@/pages/ParentDashboard';
import TeacherDashboard          from '@/pages/TeacherDashboard';
import DisciplineDashboard       from '@/pages/DisciplineDashboard';
import VicePrincipalDashboard    from '@/pages/VicePrincipalDashboard';
import AdminDashboard            from '@/pages/AdminDashboard';
import AboutUsPage               from '@/pages/AboutUsPage';
import ContactUsPage             from '@/pages/ContactUsPage';
import CloudAIPage               from '@/pages/CloudAIPage';
import ProtectedRoute            from '@/components/ProtectedRoute';

// Dashboard route map
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
// Fires once on mount. Reads sessionPersistence directly — NOT Supabase auth —
// because CloudCampus logins query the DB directly and never call
// supabase.auth.signInWithPassword(). Supabase's isAuthenticated is therefore
// always false, so we must check our own session store to auto-login.
// -----------------------------------------------------------------------------
function useStartupRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Already in a dashboard — nothing to do
    if (location.pathname.startsWith('/dashboard')) return;

    const session = getSession(); // returns null if missing or expired (>5 days)
    if (!session) return;

    const target = DASHBOARD_MAP[session.userRole];
    if (target) {
      console.log(`[CloudCampus] Resuming session for "${session.userRole}" → ${target}`);
      navigate(target, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only
}

// -----------------------------------------------------------------------------
// Hook: activity tracker
// Resets the 5-day inactivity timer on any user interaction.
// -----------------------------------------------------------------------------
function useActivityTracker() {
  useEffect(() => {
    const events  = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    const handler = () => touchActivity();

    events.forEach(evt =>
      window.addEventListener(evt, handler, { passive: true })
    );

    // Fires when the user switches back to the app from another app / tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') touchActivity();
    };
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
        <Route path="/"              element={<LandingPage />} />          {/* ← landing page */}
        <Route path="/select-school" element={<SchoolSelectionPage />} />  {/* ← school picker */}
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
          <title>CloudCampus - Modern School Management</title>
          <meta name="description" content="CloudCampus: The future of school administration" />
        </Helmet>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
