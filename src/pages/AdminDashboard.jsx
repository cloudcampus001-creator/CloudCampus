import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, LogOut, Menu, Cloud, CalendarClock, MessageSquare, School, BookMarked, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoDropdown } from '@/components/LogoDropdown';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useDeviceNotifications } from '@/hooks/useDeviceNotifications';
import ProfileSheet from '@/components/ProfileSheet';
import AdminHome from '@/pages/admin/AdminHome';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminTimetablePage from '@/pages/admin/AdminTimetablePage';
import AdminChatPage from '@/pages/admin/AdminChatPage';
import AdminClassesPage from '@/pages/admin/AdminClassesPage';
import AdminSubjectsLibraryPage from '@/pages/admin/AdminSubjectsLibraryPage';
import AdminSchoolSettingsPage  from '@/pages/admin/AdminSchoolSettingsPage';
import AdminReportTemplatePage from '@/pages/admin/AdminReportTemplatePage';

const getInitials = (name = '') => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'A';
const ACCENT = { from: 'from-indigo-500', to: 'to-violet-500', glow: 'shadow-indigo-500/40', text: 'text-indigo-400', ring: 'ring-indigo-500/30', mobileActive: 'bg-indigo-500/15', iconGlow: 'drop-shadow-[0_0_8px_rgba(99,102,241,0.9)]' };

const AdminDashboard = () => {
  const location = useLocation(); const navigate = useNavigate(); const { signOut } = useAuth(); const { t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [profileOpen, setProfileOpen] = React.useState(false);
  useDeviceNotifications();
  const userName = localStorage.getItem('userName') || t('administratorLabel');
  const navItems = [
    { icon: Home,         label: t('overview'),       path: '/dashboard/administrator',              shortLabel: t('adminShortHome') },
    { icon: Users,        label: t('users'),           path: '/dashboard/administrator/users',        shortLabel: t('adminShortUsers') },
    { icon: School,       label: t('adminClasses'),    path: '/dashboard/administrator/classes',      shortLabel: t('adminShortClasses') },
    { icon: BookMarked,   label: t('adminSubjects'),   path: '/dashboard/administrator/subjects',     shortLabel: t('adminShortSubjects') },
    { icon: CalendarClock,label: t('timetables'),      path: '/dashboard/administrator/timetables',   shortLabel: t('adminShortTime') },
    { icon: MapPin,       label: t('schoolSettings') || 'School Settings', path: '/dashboard/administrator/school', shortLabel: 'Location' },
    { icon: FileText,     label: t('reportTemplateNav') || 'Report Template',  path: '/dashboard/administrator/report-template', shortLabel: t('reportTemplateNav') ? t('reportTemplateNav').slice(0,8) : 'Template' },
    { icon: MessageSquare,label: t('systemChat'),      path: '/dashboard/administrator/chat',         shortLabel: t('adminShortChat') },
  ];
  const handleSignOut = async () => { await signOut(); localStorage.clear(); navigate('/'); };
  const isActive = (p) => p === '/dashboard/administrator' ? location.pathname === p : location.pathname.startsWith(p);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-indigo-500 selection:text-white">
      <motion.aside initial={false} animate={{ width: isSidebarOpen ? 272 : 72 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col border-r border-white/10 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 shadow-2xl overflow-visible">
        <div className="p-5 flex items-center justify-between h-[72px] shrink-0">
          <AnimatePresence>{isSidebarOpen && (<motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            <LogoDropdown><div className={`flex items-center gap-2 font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}><Cloud className="text-indigo-500 h-6 w-6" /><span>Cloud<span className="text-foreground">Campus</span></span></div></LogoDropdown>
          </motion.div>)}</AnimatePresence>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(o => !o)} className="text-muted-foreground hover:text-indigo-400 shrink-0 hover:bg-indigo-500/10 rounded-xl"><Menu className="h-5 w-5" /></Button>
        </div>
        <div className="px-3 py-2 flex-1 overflow-y-auto overflow-x-visible">
          {isSidebarOpen && <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em] mb-3 px-2">{t('menu')}</p>}
          <nav className="space-y-1">{navItems.map((item) => { const active = isActive(item.path); return (
            <Link key={item.path} to={item.path} className="relative group block">
              <div className={cn('flex items-center rounded-xl transition-all duration-200 relative overflow-visible', isSidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center', active ? `bg-gradient-to-r ${ACCENT.from} ${ACCENT.to} text-white shadow-lg ${ACCENT.glow}` : 'text-muted-foreground hover:text-foreground hover:bg-white/5')}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-white/60" />}
                <item.icon className={cn('h-[18px] w-[18px] shrink-0 transition-all', isSidebarOpen ? 'mr-3' : 'mx-auto', active && 'drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]')} />
                {isSidebarOpen && <span className="font-medium text-sm leading-none">{item.label}</span>}
                {!isSidebarOpen && <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 text-xs font-semibold bg-card/95 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-[9999] shadow-xl backdrop-blur-md translate-x-1 group-hover:translate-x-0">{item.label}</span>}
              </div>
            </Link>
          ); })}</nav>
        </div>
        <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
          <div className={cn('flex items-center gap-2', !isSidebarOpen && 'flex-col')}>
            <ThemeToggle /><LanguageSwitcher />
            {isSidebarOpen ? (
              <button onClick={() => setProfileOpen(true)} className={`ml-auto flex items-center gap-2.5 ring-1 ${ACCENT.ring} rounded-xl px-2.5 py-1.5 hover:bg-white/5 transition-all active:scale-95`}>
                <div className={`h-7 w-7 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{getInitials(userName)}</div>
                <div className="text-sm overflow-hidden text-left"><p className="font-semibold leading-none truncate max-w-[90px]">{userName}</p><p className="text-[10px] text-muted-foreground mt-0.5">{t('administratorLabel')}</p></div>
              </button>
            ) : (
              <button onClick={() => setProfileOpen(true)} className={`h-9 w-9 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity active:scale-95`}>{getInitials(userName)}</button>
            )}
          </div>
          <Button onClick={handleSignOut} className={cn('w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl', isSidebarOpen ? 'justify-start' : 'justify-center px-2')}><LogOut className={cn('h-4 w-4', isSidebarOpen && 'mr-2')} />{isSidebarOpen && <span className="text-sm">{t('logout')}</span>}</Button>
        </div>
      </motion.aside>

      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b border-white/10 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <LogoDropdown><div className={`flex items-center gap-2 font-bold text-base bg-clip-text text-transparent bg-gradient-to-r ${ACCENT.from} ${ACCENT.to}`}><Cloud className="text-indigo-500 h-5 w-5" /><span>CloudCampus</span></div></LogoDropdown>
        <div className="flex items-center gap-1.5"><LanguageSwitcher /><ThemeToggle />
          <button onClick={() => setProfileOpen(true)} className={`h-8 w-8 rounded-full bg-gradient-to-tr ${ACCENT.from} ${ACCENT.to} flex items-center justify-center text-white text-xs font-bold`}>{getInitials(userName)}</button>
        </div>
      </div>

      <main className="flex-1 p-4 md:p-8 pb-28 md:pb-8 overflow-y-auto h-[calc(100vh-56px)] md:h-screen scroll-smooth">
        <Routes>
          <Route path="/"           element={<AdminHome />} />
          <Route path="/users"      element={<AdminUsersPage />} />
          <Route path="/classes"    element={<AdminClassesPage />} />
          <Route path="/timetables" element={<AdminTimetablePage />} />
          <Route path="/subjects"   element={<AdminSubjectsLibraryPage />} />
          <Route path="/school"           element={<AdminSchoolSettingsPage />} />
          <Route path="/report-template"  element={<AdminReportTemplatePage />} />
          <Route path="/chat"       element={<AdminChatPage />} />
          <Route path="*"           element={<AdminHome />} />
        </Routes>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
        <div className="bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="flex items-stretch px-1 py-1">{navItems.map((item) => { const active = isActive(item.path); return (
            <Link key={item.path} to={item.path} className="flex-1 min-w-0">
              <div className={cn('flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 gap-0.5', active ? ACCENT.mobileActive : 'hover:bg-white/5')}>
                <item.icon className={cn('h-[18px] w-[18px] transition-all duration-300', active ? `${ACCENT.text} ${ACCENT.iconGlow} scale-110` : 'text-muted-foreground')} />
                <span className={cn('text-[9px] font-semibold leading-none truncate w-full text-center', active ? ACCENT.text : 'text-muted-foreground')}>{item.shortLabel}</span>
              </div>
            </Link>
          ); })}</div>
        </div>
      </nav>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} userName={userName} roleLabel={t('administratorLabel')} accentFrom={ACCENT.from} accentTo={ACCENT.to} onSignOut={handleSignOut} />
    </div>
  );
};
export default AdminDashboard;
