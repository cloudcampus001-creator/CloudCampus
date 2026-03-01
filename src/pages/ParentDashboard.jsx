import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, FileText, Shield, BookOpen, MessageSquare, LogOut, Menu, User, Cloud, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoDropdown } from '@/components/LogoDropdown';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Import sub-pages
import OverviewPage from '@/pages/parent/OverviewPage';
import DocsPage from '@/pages/parent/DocsPage';
import DisciplinePage from '@/pages/parent/DisciplinePage';
import LibraryPage from '@/pages/parent/LibraryPage';
import ChatPage from '@/pages/parent/ChatPage';
import ParentNotificationsPage from '@/pages/parent/ParentNotificationsPage';
import { useDeviceNotifications } from '@/hooks/useDeviceNotifications';

const ParentDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Invisible — requests push permission + signals device on new notifications
  useDeviceNotifications();
  
  const studentName = localStorage.getItem('studentName') || 'Student';

  const navItems = [
    { icon: Home, label: t('overview'), path: '/dashboard/parent' },
    { icon: Bell, label: t('notify'), path: '/dashboard/parent/notifications' },
    { icon: FileText, label: t('documents'), path: '/dashboard/parent/docs' },
    { icon: Shield, label: t('discipline'), path: '/dashboard/parent/discipline' },
    { icon: BookOpen, label: t('library'), path: '/dashboard/parent/library' },
    { icon: MessageSquare, label: t('chat'), path: '/dashboard/parent/chat' },
  ];

  const handleSignOut = async () => {
    await signOut();
    localStorage.clear();
    navigate('/');
  };

  const isPathActive = (path) => {
    if (path === '/dashboard/parent' && location.pathname === '/dashboard/parent') return true;
    if (path !== '/dashboard/parent' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    // Override CSS Variables for Blue Theme in this subtree
    <div 
      className="min-h-screen bg-background flex flex-col md:flex-row font-sans selection:bg-blue-500 selection:text-white"
      style={{
        '--primary': '221 83% 53%',       // Blue 600
        '--primary-foreground': '210 40% 98%',
        '--ring': '221 83% 53%',
      }}
    >
      {/* Desktop Sidebar - Glassmorphism */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className={cn(
          "hidden md:flex flex-col border-r border-white/10 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 shadow-2xl",
        )}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
             >
               <LogoDropdown>
                 {/* Updated to Blue theme gradient */}
                 <div className="flex items-center gap-2 font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
                   <Cloud className="text-blue-600 h-6 w-6" />
                   <span>Cloud<span className="text-foreground">Campus</span></span>
                 </div>
               </LogoDropdown>
             </motion.div>
          )}
          {/* Updated hover text color */}
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-muted-foreground hover:text-blue-600">
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <div className="px-4 py-2">
            {isSidebarOpen && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">{t('parentMenu')}</p>}
            <nav className="space-y-2">
            {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                <div
                    className={cn(
                    "flex items-center p-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    // Updated active states to Blue
                    isPathActive(item.path) 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                >
                    <item.icon className={cn("h-5 w-5 z-10", isSidebarOpen && "mr-3")} />
                    {isSidebarOpen && <span className="font-medium z-10">{item.label}</span>}
                    
                    {!isPathActive(item.path) && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
                </Link>
            ))}
            </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5 space-y-4">
          <div className={cn("flex items-center justify-between", !isSidebarOpen && "flex-col gap-4")}>
             <div className="flex gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
             </div>
             {isSidebarOpen && (
                 <div className="flex items-center gap-3">
                    {/* Updated profile circle to Blue gradient */}
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                        <User className="w-4 h-4" />
                    </div>
                    <div className="text-sm">
                        <p className="font-medium leading-none truncate max-w-[120px]">{studentName}</p>
                    </div>
                 </div>
             )}
          </div>
          
          <Button 
            variant="destructive" 
            className={cn("w-full justify-start bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20", !isSidebarOpen && "justify-center px-2")}
            onClick={handleSignOut}
          >
            <LogOut className={cn("h-5 w-5", isSidebarOpen && "mr-2")} />
            {isSidebarOpen && <span>{t('logout')}</span>}
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Header - Updated Colors */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <LogoDropdown>
          <div className="flex items-center gap-2 font-bold text-lg">
            <Cloud className="text-blue-600 h-5 w-5" />
            <span>CloudCampus</span>
          </div>
        </LogoDropdown>
        <div className="flex gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto h-[calc(100vh-65px)] md:h-screen scroll-smooth">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/discipline" element={<DisciplinePage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/notifications" element={<ParentNotificationsPage />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation - Updated Colors */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-white/10 flex justify-around p-2 z-50 safe-area-pb shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path} className="flex-1">
            <div 
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all",
                // Updated active color
                isPathActive(item.path) ? "text-blue-600 scale-110" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-6 w-6 mb-1" />
            </div>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default ParentDashboard;
