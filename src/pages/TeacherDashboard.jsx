
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Activity, GraduationCap, Upload, MessageSquare, LogOut, Menu, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoDropdown } from '@/components/LogoDropdown';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useDeviceNotifications } from '@/hooks/useDeviceNotifications';
import ProfileSheet from '@/components/ProfileSheet';

import TeacherHomePage         from '@/pages/teacher/TeacherHomePage';
import ActivityPage            from '@/pages/teacher/ActivityPage';
import MarksPage               from '@/pages/teacher/MarksPage';
import PublishPage             from '@/pages/teacher/PublishPage';
import TeacherChatPage         from '@/pages/teacher/TeacherChatPage';
import TeacherNotificationsPage from '@/pages/teacher/TeacherNotificationsPage';
import TeacherYearClosedPage    from '@/pages/teacher/TeacherYearClosedPage';
import { useYearStatus }         from '@/hooks/useYearStatus';

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'T';

const ACCENT = {
  from: 'from-emerald-500', to: 'to-teal-400',
  glow: 'shadow-emerald-500/40', text: 'text-emerald-400',
  ring: 'ring-emerald-500/30', mobileActive: 'bg-emerald-500/15',
  iconGlow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]',
  gradFrom: '#10b981', gradTo: '#2dd4bf',
};

const UnreadDot = ({ count }) => {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border border-background shadow-lg shadow-red-500/50 leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
};

const TeacherDashboard = () => {
  const { yearStatus, loading: yearLoading } = useYearStatus();
  const yearIsClosed = yearStatus?.status === 'closed';
  const location    = useLocation();
  const navigate    = useNavigate();
  const { signOut } = useAuth();
  const { t }       = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [unreadCount, setUnreadCount]     = useState(0);

  useDeviceNotifications();

  const userName  = localStorage.getItem('userName')  || 'Teacher';
  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  /* ── unread count (school-wide + teacher-targeted) ─── */
  const syncUnread = useCallback(async () => {
    if (!schoolId) return;
    const key    = `notif_read_at_teacher_${schoolId}_${teacherId}`;
    const readAt = localStorage.getItem(key) || '1970-01-01';
    const { data } = await supabase
      .from('notifications').select('id, target_type, target_id')
      .eq('school_id', parseInt(schoolId)).gt('created_at', readAt);
    if (!data) return;
    const count = data.filter(n =>
      n.target_type === 'school' ||
      (n.target_type === 'teacher' && String(n.target_id) === String(teacherId))
    ).length;
    setUnreadCount(count);
  }, [schoolId, teacherId]);

  useEffect(() => { syncUnread(); }, [syncUnread]);

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`badge_teacher_${schoolId}_${teacherId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        () => syncUnread()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, teacherId, syncUnread]);

  useEffect(() => {
    if (location.pathname.includes('/notifications')) {
      const key = `notif_read_at_teacher_${schoolId}_${teacherId}`;
      localStorage.setItem(key, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [location.pathname, schoolId, teacherId]);

  const handleSignOut = async () => { await signOut(); localStorage.clear(); navigate('/'); };
  const isActive = (p) =>
    p === '/dashboard/teacher' ? location.pathname === p : location.pathname.startsWith(p);

  /* ── 5 nav tabs ─────────────────────────────────────── */
  const navItems = [
    { icon: Home,          label: t('overview'),     path: '/dashboard/teacher',          shortLabel: t('overview')    },
    { icon: Activity,      label: t('liveActivity'), path: '/dashboard/teacher/activity', shortLabel: 'Activity'       },
    { icon: GraduationCap, label: t('marks'),        path: '/dashboard/teacher/marks',    shortLabel: t('marks')       },
    { icon: Upload,        label: t('publish'),      path: '/dashboard/teacher/publish',  shortLabel: t('publish')     },
    { icon: MessageSquare, label: t('chat'),         path: '/dashboard/teacher/chat',     shortLabel: t('chat')        },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-emerald-500 selection:text-white">

      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 272 : 72 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col border-r border-white/10 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 shadow-2xl overflow-visible"
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between h-[72px] shrink-0">
          <AnimatePresence>{isSidebarOpen && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <LogoDropdown>
                <div className={`flex items-center gap-2 font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}>
                  <Cloud className="text-emerald-500 h-6 w-6" />
                  <span>Cloud<span className="text-foreground">Campus</span></span>
                </div>
              </LogoDropdown>
            </motion.div>
          )}</AnimatePresence>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(o => !o)}
            className="text-muted-foreground hover:text-emerald-400 shrink-0 hover:bg-emerald-500/10 rounded-xl">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav */}
        <div className="px-3 py-2 flex-1 overflow-y-auto overflow-x-visible">
          {isSidebarOpen && (
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-3 px-2">{t('menu')}</p>
          )}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="relative group block">
                  <div className={cn(
                    'flex items-center rounded-xl transition-all duration-200 relative overflow-visible',
                    isSidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center',
                    active
                      ? `bg-gradient-to-r ${ACCENT.from} ${ACCENT.to} text-white shadow-lg ${ACCENT.glow}`
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-white/60" />}
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-all',
                      isSidebarOpen ? 'mr-3' : 'mx-auto',
                      active && 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                    )} />
                    {isSidebarOpen && <span className="font-medium text-sm leading-none">{item.label}</span>}
                    {!isSidebarOpen && (
                      <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 text-xs font-semibold bg-card/95 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-[9999] shadow-xl backdrop-blur-md translate-x-1 group-hover:translate-x-0">
                        {item.label}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
          <div className={cn('flex items-center gap-2', !isSidebarOpen && 'flex-col')}>
            <ThemeToggle /><LanguageSwitcher />
            {isSidebarOpen ? (
              <button onClick={() => setProfileOpen(true)}
                className={`ml-auto flex items-center gap-2.5 ring-1 ${ACCENT.ring} rounded-xl px-2.5 py-1.5 hover:bg-white/5 transition-all active:scale-95`}>
                <div className={`h-7 w-7 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {getInitials(userName)}
                </div>
                <div className="text-sm overflow-hidden text-left">
                  <p className="font-semibold leading-none truncate max-w-[90px]">{userName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t('role_teacher')}</p>
                </div>
              </button>
            ) : (
              <button onClick={() => setProfileOpen(true)}
                className={`h-9 w-9 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 active:scale-95`}>
                {getInitials(userName)}
              </button>
            )}
          </div>
          <Button onClick={handleSignOut}
            className={cn('w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl',
              isSidebarOpen ? 'justify-start' : 'justify-center px-2')}>
            <LogOut className={cn('h-4 w-4', isSidebarOpen && 'mr-2')} />
            {isSidebarOpen && <span className="text-sm">{t('logout')}</span>}
          </Button>
        </div>
      </motion.aside>

      {/* ── Mobile Header ───────────────────────────────── */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <LogoDropdown>
          <div className={`flex items-center gap-2 font-bold text-base bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}>
            <Cloud className="text-emerald-500 h-5 w-5" />
            <span>CloudCampus</span>
          </div>
        </LogoDropdown>
        <div className="flex items-center gap-2">
          <LanguageSwitcher /><ThemeToggle />
          <button onClick={() => setProfileOpen(true)}
            className="relative">
            <div className={`h-8 w-8 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold`}>
              {getInitials(userName)}
            </div>
            <UnreadDot count={unreadCount} />
          </button>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-y-auto h-[calc(100vh-56px)] md:h-screen scroll-smooth">
        {!yearLoading && yearIsClosed ? (
          <TeacherYearClosedPage closedYear={yearStatus.year} />
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"              element={<TeacherHomePage unreadCount={unreadCount} />} />
              <Route path="/activity"      element={<ActivityPage />} />
              <Route path="/marks"         element={<MarksPage />} />
              <Route path="/publish"       element={<PublishPage />} />
              <Route path="/chat"          element={<TeacherChatPage />} />
              <Route path="/notifications" element={<TeacherNotificationsPage />} />
            </Routes>
          </AnimatePresence>
        )}
      </main>

      {/* ── Mobile Nav — 5 tabs ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
        <div className="bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="flex items-stretch px-1 py-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="flex-1 min-w-0">
                  <div className={cn(
                    'flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 gap-0.5',
                    active ? ACCENT.mobileActive : 'hover:bg-white/5'
                  )}>
                    <item.icon className={cn('h-[18px] w-[18px] transition-all duration-300',
                      active ? `${ACCENT.text} ${ACCENT.iconGlow} scale-110` : 'text-muted-foreground'
                    )} />
                    <span className={cn('text-[9px] font-semibold leading-none truncate w-full text-center',
                      active ? ACCENT.text : 'text-muted-foreground'
                    )}>{item.shortLabel}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── iOS Profile Sheet ───────────────────────────── */}
      <ProfileSheet
        open={profileOpen} onClose={() => setProfileOpen(false)}
        userName={userName} roleLabel={t('role_teacher')}
        accentFrom={ACCENT.from} accentTo={ACCENT.to}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default TeacherDashboard;
