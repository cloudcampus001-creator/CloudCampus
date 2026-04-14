
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FileText, Shield, BookOpen, MessageSquare, LogOut, Menu, Cloud } from 'lucide-react';
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

import OverviewPage            from '@/pages/parent/OverviewPage';
import DocsPage                from '@/pages/parent/DocsPage';
import DisciplinePage          from '@/pages/parent/DisciplinePage';
import LibraryPage             from '@/pages/parent/LibraryPage';
import ChatPage                from '@/pages/parent/ChatPage';
import ParentNotificationsPage from '@/pages/parent/ParentNotificationsPage';
import ParentYearEndPage       from '@/pages/parent/ParentYearEndPage';
import { useYearStatus }        from '@/hooks/useYearStatus';

const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'P';

const ACCENT = {
  from: 'from-blue-500', to: 'to-cyan-400',
  glow: 'shadow-blue-500/40', text: 'text-blue-400',
  ring: 'ring-blue-500/30', mobileActive: 'bg-blue-500/15',
  iconGlow: 'drop-shadow-[0_0_8px_rgba(59,130,246,0.9)]',
};

/* ── small unread dot for sidebar icon ────────────────── */
const UnreadDot = ({ count }) => {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border border-background shadow-lg shadow-red-500/50 leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
};

const ParentDashboard = () => {
  const { yearStatus, loading: yearLoading } = useYearStatus();
  const yearIsClosed = yearStatus?.status === 'closed';
  const location    = useLocation();
  const navigate    = useNavigate();
  const { signOut } = useAuth();
  const { t }       = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen]     = useState(false);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [studentClassName, setStudentClassName] = useState('');

  useDeviceNotifications();

  const userName         = localStorage.getItem('userName')         || '';
  const studentName      = localStorage.getItem('studentName')      || 'Student';
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');
  const studentMatricule = localStorage.getItem('studentMatricule');

  /* ── Fetch class name ──────────────────────────────── */
  useEffect(() => {
    if (!classId) return;
    supabase.from('classes').select('name').eq('id', parseInt(classId)).single()
      .then(({ data }) => { if (data?.name) setStudentClassName(data.name); });
  }, [classId]);

  /* ── Unread count ──────────────────────────────────── */
  const syncUnread = useCallback(async () => {
    if (!schoolId) return;
    const key    = `notif_read_at_${schoolId}_${studentMatricule}`;
    const readAt = localStorage.getItem(key) || '1970-01-01';
    const { data } = await supabase
      .from('notifications').select('id, target_type, target_id')
      .eq('school_id', parseInt(schoolId)).gt('created_at', readAt);
    if (!data) return;
    const count = data.filter(n =>
      n.target_type === 'school' ||
      (n.target_type === 'class'  && String(n.target_id) === String(classId)) ||
      (n.target_type === 'parent' && String(n.target_id) === String(studentMatricule))
    ).length;
    setUnreadCount(count);
  }, [schoolId, classId, studentMatricule]);

  useEffect(() => { syncUnread(); }, [syncUnread]);

  /* ── Realtime badge ────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`badge_${schoolId}_${studentMatricule}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `school_id=eq.${parseInt(schoolId)}` },
        () => syncUnread()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, studentMatricule, syncUnread]);

  /* ── Clear badge when on notifications page ───────── */
  useEffect(() => {
    if (location.pathname.includes('/notifications')) {
      const key = `notif_read_at_${schoolId}_${studentMatricule}`;
      localStorage.setItem(key, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [location.pathname, schoolId, studentMatricule]);

  const handleSignOut = async () => { await signOut(); localStorage.clear(); navigate('/'); };
  const isActive = (p) =>
    p === '/dashboard/parent' ? location.pathname === p : location.pathname.startsWith(p);

  /* ── 5 nav tabs — no notifications in nav ──────────── */
  const navItems = [
    { icon: Home,          label: t('overview'),   path: '/dashboard/parent',            shortLabel: t('overview')   },
    { icon: FileText,      label: t('documents'),  path: '/dashboard/parent/docs',       shortLabel: t('documents')  },
    { icon: Shield,        label: t('discipline'), path: '/dashboard/parent/discipline', shortLabel: t('discipline') },
    { icon: BookOpen,      label: t('library'),    path: '/dashboard/parent/library',    shortLabel: t('library')    },
    { icon: MessageSquare, label: t('chat'),       path: '/dashboard/parent/chat',       shortLabel: t('chat')       },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-blue-500 selection:text-white">

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
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <LogoDropdown>
                <div className={`flex items-center gap-2 font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}>
                  <Cloud className="text-blue-500 h-6 w-6" />
                  <span>Cloud<span className="text-foreground">Campus</span></span>
                </div>
              </LogoDropdown>
            </motion.div>
          )}</AnimatePresence>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(o => !o)}
            className="text-muted-foreground hover:text-blue-400 shrink-0 hover:bg-blue-500/10 rounded-xl">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav items */}
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
                    <span className="relative shrink-0">
                      <item.icon className={cn('h-[18px] w-[18px] transition-all',
                        isSidebarOpen ? 'mr-3' : 'mx-auto',
                        active && 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]'
                      )} />
                    </span>
                    {isSidebarOpen && (
                      <span className="font-medium text-sm leading-none flex-1">{item.label}</span>
                    )}
                    {!isSidebarOpen && (
                      <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 text-xs font-semibold bg-card/95 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[9999] shadow-xl backdrop-blur-md translate-x-1 group-hover:translate-x-0">
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
                  {getInitials(studentName)}
                </div>
                <div className="text-sm overflow-hidden text-left">
                  <p className="font-semibold leading-none truncate max-w-[90px]">{studentName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[90px]">{studentClassName || t('role_parent')}</p>
                </div>
              </button>
            ) : (
              <button onClick={() => setProfileOpen(true)}
                className={`h-9 w-9 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 active:scale-95`}>
                {getInitials(studentName)}
              </button>
            )}
          </div>
          <Button onClick={handleSignOut}
            className={cn('w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all',
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
            <Cloud className="text-blue-500 h-5 w-5" />
            <span>CloudCampus</span>
          </div>
        </LogoDropdown>
        <div className="flex items-center gap-2">
          <LanguageSwitcher /><ThemeToggle />
          <button onClick={() => setProfileOpen(true)}
            className={`relative h-8 w-8 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold`}>
            {getInitials(studentName)}
            <UnreadDot count={unreadCount} />
          </button>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-y-auto h-[calc(100vh-56px)] md:h-screen scroll-smooth">
        {!yearLoading && yearIsClosed ? (
          <ParentYearEndPage closedYear={yearStatus.year} />
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"              element={<OverviewPage unreadCount={unreadCount} />} />
              <Route path="/docs"          element={<DocsPage />} />
              <Route path="/discipline"    element={<DisciplinePage />} />
              <Route path="/library"       element={<LibraryPage />} />
              <Route path="/chat"          element={<ChatPage />} />
              <Route path="/notifications" element={<ParentNotificationsPage />} />
            </Routes>
          </AnimatePresence>
        )}
      </main>

      {/* ── Mobile Floating Nav — 5 tabs ────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
        <div className="bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="flex items-stretch px-1 py-1">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="flex-1 min-w-0">
                  <div className={cn(
                    'flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 gap-0.5',
                    active ? ACCENT.mobileActive : 'hover:bg-white/5'
                  )}>
                    <span className="relative">
                      <item.icon className={cn('h-[18px] w-[18px] transition-all duration-300',
                        active ? `${ACCENT.text} ${ACCENT.iconGlow} scale-110` : 'text-muted-foreground'
                      )} />
                    </span>
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
        userName={userName} roleLabel={t('role_parent')}
        accentFrom={ACCENT.from} accentTo={ACCENT.to}
        onSignOut={handleSignOut}
        isParent studentName={studentName} studentClass={studentClassName}
      />
    </div>
  );
};

export default ParentDashboard;
