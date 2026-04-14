
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, BookOpen, BookMarked, GraduationCap, MessageSquare,
  LogOut, Menu, Cloud,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoDropdown } from '@/components/LogoDropdown';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeviceNotifications } from '@/hooks/useDeviceNotifications';
import ProfileSheet from '@/components/ProfileSheet';

import VPHome                from '@/pages/vice_principal/VPHome';
import VPLogbookPage         from '@/pages/vice_principal/VPLogbookPage';
import VPMarksPage           from '@/pages/vice_principal/VPMarksPage';
import VPChatPage            from '@/pages/vice_principal/VPChatPage';
import AttributeSubjectsPage from '@/pages/vice_principal/AttributeSubjectsPage';
import VPNotifyPage          from '@/pages/vice_principal/VPNotifyPage';
import VPNotificationsPage   from '@/pages/vice_principal/VPNotificationsPage';
import VPYearClosedPage        from '@/pages/vice_principal/VPYearClosedPage';
import { useYearStatus }        from '@/hooks/useYearStatus';

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'VP';

const ACCENT = {
  from: 'from-purple-500', to: 'to-pink-500',
  glow: 'shadow-purple-500/40', text: 'text-purple-400',
  ring: 'ring-purple-500/30', mobileActive: 'bg-purple-500/15',
  iconGlow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]',
};

const UnreadDot = ({ count }) => {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center border border-background shadow-lg shadow-red-500/50 leading-none">
      {count > 9 ? '9+' : count}
    </span>
  );
};

const VicePrincipalDashboard = () => {
  const { yearStatus, loading: yearLoading } = useYearStatus();
  const yearIsClosed = yearStatus?.status === 'closed';
  const location    = useLocation();
  const navigate    = useNavigate();
  const { signOut } = useAuth();
  const { t }       = useLanguage();

  const [isSidebarOpen,   setIsSidebarOpen]   = useState(true);
  const [profileOpen,     setProfileOpen]     = useState(false);
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [managedClasses,  setManagedClasses]  = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);

  useDeviceNotifications();

  const userName = localStorage.getItem('userName') || 'Vice Principal';
  const userId   = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  /* ── classes ──────────────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    supabase.from('classes').select('id, name').eq('vp_id', userId).then(({ data }) => {
      if (data?.length) {
        setManagedClasses(data);
        const stored = localStorage.getItem('vpSelectedClass');
        const valid  = stored && data.find(c => c.id.toString() === stored);
        const chosen = valid ? stored : data[0].id.toString();
        setSelectedClassId(chosen);
        localStorage.setItem('vpSelectedClass', chosen);
      }
    });
  }, [userId]);

  const handleClassChange = (val) => {
    setSelectedClassId(val);
    localStorage.setItem('vpSelectedClass', val);
  };

  /* ── unread badge ─────────────────────────────── */
  const syncUnread = useCallback(async () => {
    if (!schoolId) return;
    const key    = `notif_read_at_vp_${schoolId}_${userId}`;
    const readAt = localStorage.getItem(key) || '1970-01-01';
    const { data } = await supabase.from('notifications')
      .select('id, target_type, target_id')
      .eq('school_id', parseInt(schoolId)).gt('created_at', readAt);
    if (!data) return;
    const count = data.filter(n =>
      n.target_type === 'school' ||
      (n.target_type === 'vice_principal' && String(n.target_id) === String(userId))
    ).length;
    setUnreadCount(count);
  }, [schoolId, userId]);

  useEffect(() => { syncUnread(); }, [syncUnread]);

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`badge_vp_${schoolId}_${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        () => syncUnread()
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, userId, syncUnread]);

  useEffect(() => {
    if (location.pathname.includes('/notifications')) {
      const key = `notif_read_at_vp_${schoolId}_${userId}`;
      localStorage.setItem(key, new Date().toISOString());
      setUnreadCount(0);
    }
  }, [location.pathname, schoolId, userId]);

  const handleSignOut = async () => { await signOut(); localStorage.clear(); navigate('/'); };
  const isActive = (p) =>
    p === '/dashboard/vice-principal' ? location.pathname === p : location.pathname.startsWith(p);

  const isChatPage = location.pathname.includes('/chat');

  /* ── 5 nav tabs ─────────────────────────────────── */
  const navItems = [
    { icon: Home,          label: t('overview'),          path: '/dashboard/vice-principal'                   },
    { icon: BookOpen,      label: t('logbookReview'),     path: '/dashboard/vice-principal/logbooks'          },
    { icon: BookMarked,    label: t('attributeSubjects'), path: '/dashboard/vice-principal/attribute-subjects'},
    { icon: GraduationCap, label: t('marksheetReview'),  path: '/dashboard/vice-principal/marks'             },
    { icon: MessageSquare, label: t('chat'),              path: '/dashboard/vice-principal/chat'              },
  ];

  const ClassPicker = ({ compact = false }) => managedClasses.length > 0 ? (
    <Select value={selectedClassId} onValueChange={handleClassChange}>
      <SelectTrigger className={cn(
        'bg-white/5 border-white/10 focus:border-purple-500/50 rounded-xl text-sm',
        compact ? 'h-8 w-36' : 'h-9 w-full'
      )}>
        <SelectValue placeholder={t('selectClass')} />
      </SelectTrigger>
      <SelectContent>
        {managedClasses.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  ) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-purple-500 selection:text-white">

      {/* ── Desktop Sidebar ──────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 272 : 72 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col border-r border-white/10 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 shadow-2xl overflow-visible"
      >
        <div className="p-5 flex items-center justify-between h-[72px] shrink-0">
          <AnimatePresence>{isSidebarOpen && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <LogoDropdown>
                <div className={`flex items-center gap-2 font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}>
                  <Cloud className="text-purple-500 h-6 w-6" />
                  <span>Cloud<span className="text-foreground">Campus</span></span>
                </div>
              </LogoDropdown>
            </motion.div>
          )}</AnimatePresence>
          <button onClick={() => setIsSidebarOpen(o => !o)}
            className="p-2 rounded-xl text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-all shrink-0">
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Class picker */}
        {isSidebarOpen && (
          <div className="px-4 pb-3 shrink-0">
            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-2 px-1">{t('dashboardContext')}</p>
            <ClassPicker />
          </div>
        )}

        {/* Nav links */}
        <div className="px-3 py-1 flex-1 overflow-y-auto overflow-x-visible">
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

        {/* Sidebar footer */}
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
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t('role_vp')}</p>
                </div>
              </button>
            ) : (
              <button onClick={() => setProfileOpen(true)}
                className={`h-9 w-9 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 active:scale-95`}>
                {getInitials(userName)}
              </button>
            )}
          </div>
          <button onClick={handleSignOut}
            className={cn('w-full flex items-center gap-2 py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-sm font-medium',
              !isSidebarOpen && 'justify-center px-0')}>
            <LogOut className="h-4 w-4 shrink-0" />
            {isSidebarOpen && t('logout')}
          </button>
        </div>
      </motion.aside>

      {/* ── Mobile Header ───────────────────────────── */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 bg-card/80 backdrop-blur-xl sticky top-0 z-50 gap-2">
        <LogoDropdown>
          <div className={`flex items-center gap-1.5 font-bold text-sm bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}>
            <Cloud className="text-purple-500 h-4 w-4 shrink-0" />
            <span>CloudCampus</span>
          </div>
        </LogoDropdown>
        {!isChatPage && <ClassPicker compact />}
        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageSwitcher /><ThemeToggle />
          <button onClick={() => setProfileOpen(true)} className="relative">
            <div className={`h-8 w-8 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold`}>
              {getInitials(userName)}
            </div>
            <UnreadDot count={unreadCount} />
          </button>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-y-auto h-[calc(100vh-56px)] md:h-screen scroll-smooth">
        {!yearLoading && yearIsClosed ? (
          <VPYearClosedPage closedYear={yearStatus.year} />
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/"                   element={<VPHome            selectedClass={selectedClassId} unreadCount={unreadCount} />} />
              <Route path="/logbooks"           element={<VPLogbookPage     selectedClass={selectedClassId} />} />
              <Route path="/attribute-subjects" element={<AttributeSubjectsPage selectedClass={selectedClassId} />} />
              <Route path="/marks"              element={<VPMarksPage       selectedClass={selectedClassId} />} />
              <Route path="/chat"               element={<VPChatPage        selectedClass={selectedClassId} />} />
              <Route path="/notify"             element={<VPNotifyPage      selectedClass={selectedClassId} />} />
              <Route path="/notifications"      element={<VPNotificationsPage />} />
            </Routes>
          </AnimatePresence>
        )}
      </main>

      {/* ── Mobile Nav ──────────────────────────────── */}
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
                    )}>{item.label.split(' ')[0]}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <ProfileSheet
        open={profileOpen} onClose={() => setProfileOpen(false)}
        userName={userName} roleLabel={t('role_vp')}
        accentFrom={ACCENT.from} accentTo={ACCENT.to}
        onSignOut={handleSignOut}
      />
    </div>
  );
};

export default VicePrincipalDashboard;
