import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Users, BookOpen, GraduationCap, BookMarked,
  Bell, ChevronRight, Send, CheckCircle
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import { StatCardSkeleton } from '@/components/Skeletons';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const StatCard = ({ icon: Icon, label, value, sub, borderColor, iconBg, iconColor }) => (
  <motion.div variants={fadeUp}>
    <div className={cn('glass rounded-2xl p-5 border-l-4 hover:scale-[1.02] transition-transform cursor-default', borderColor)}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn('p-2 rounded-xl', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  </motion.div>
);

const VPHome = ({ selectedClass, unreadCount = 0 }) => {
  const navigate  = useNavigate();
  const { t }     = useLanguage();

  const [loading,     setLoading]     = useState(true);
  const [classInfo,   setClassInfo]   = useState(null);
  const [pendingLogs, setPendingLogs] = useState(0);

  const userName = localStorage.getItem('userName') || 'Vice Principal';
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    if (!selectedClass) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const [{ data: cls }, { count: logs }] = await Promise.all([
          supabase.from('classes').select('name, students(count)').eq('id', selectedClass).single(),
          supabase.from('e_logbook_entries').select('*', { count: 'exact', head: true })
            .eq('class_id', selectedClass).eq('status', 'pending'),
        ]);
        setClassInfo(cls);
        setPendingLogs(logs || 0);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [selectedClass]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');
  const studentCount = classInfo?.students?.[0]?.count ?? 0;

  const QUICK = [
    { icon: BookOpen,      label: t('logbookReview'),     sub: t('vpLogbookSub'),     path: '/dashboard/vice-principal/logbooks',          color: 'purple' },
    { icon: BookMarked,    label: t('attributeSubjects'), sub: t('vpAttributeSub'),   path: '/dashboard/vice-principal/attribute-subjects', color: 'pink'   },
    { icon: GraduationCap, label: t('marksheetReview'),  sub: t('vpMarksSub'),       path: '/dashboard/vice-principal/marks',             color: 'indigo' },
  ];

  return (
    <>
      <Helmet><title>{t('vpDashboard')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                  {greeting}!
                </span>
              </h1>
              <p className="text-muted-foreground mt-1">
                <span className="font-bold text-foreground">{userName}</span> · {t('role_vp')}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 border border-white/10 px-4 py-2 rounded-full">
              <Calendar className="h-4 w-4 text-purple-400" />
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </motion.div>

          {/* ── Received Notifications CTA ─────────────── */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }}>
            <button
              onClick={() => navigate('/dashboard/vice-principal/notifications')}
              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <div className={cn(
                'relative glass rounded-2xl flex items-center gap-5 p-5 border transition-all duration-300',
                unreadCount > 0
                  ? 'border-purple-500/40 bg-purple-500/5 group-hover:border-purple-500/60'
                  : 'border-white/10 group-hover:border-purple-500/30'
              )}>
                <div className="relative shrink-0">
                  <div className={cn(
                    'p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110',
                    unreadCount > 0
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
                      : 'bg-white/8'
                  )}>
                    <Bell className={cn('h-7 w-7', unreadCount > 0 ? 'text-white' : 'text-muted-foreground')} />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-purple-400 animate-ping opacity-30" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-lg">{t('notifications')}</p>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold shadow-md shadow-purple-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {unreadCount} {t('unreadNotifications')}
                      </span>
                    )}
                    {unreadCount === 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/25">
                        <CheckCircle className="h-3 w-3" />{t('allRead')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('vpNotifsDesc')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-purple-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* ── Send Notification CTA ──────────────────── */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.14 }}>
            <button
              onClick={() => navigate('/dashboard/vice-principal/notify')}
              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600/15 to-purple-500/15 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
              <div className="relative glass rounded-2xl flex items-center gap-5 p-5 border border-white/10 group-hover:border-pink-500/35 transition-all duration-300">
                <div className="p-4 rounded-2xl bg-white/8 group-hover:bg-pink-500/15 transition-colors group-hover:scale-110 duration-300 shrink-0">
                  <Send className="h-7 w-7 text-muted-foreground group-hover:text-pink-400 transition-colors" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-lg">{t('vpSendNotif')}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('vpSendNotifDesc')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-pink-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* ── Stat cards ────────────────────────────── */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <StatCardSkeleton /><StatCardSkeleton />
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid gap-4 md:grid-cols-2">
              <StatCard icon={Users} label={t('selectedClass')}
                value={classInfo ? classInfo.name : '—'}
                sub={`${studentCount} ${t('students').toLowerCase()}`}
                borderColor="border-l-purple-500" iconBg="bg-purple-500/15" iconColor="text-purple-400" />
              <StatCard icon={BookOpen} label={t('pendingELogs')}
                value={pendingLogs}
                sub={pendingLogs === 0 ? t('allReviewed') : t('awaitingReview')}
                borderColor="border-l-pink-500" iconBg="bg-pink-500/15" iconColor="text-pink-400" />
            </motion.div>
          )}

          {/* ── Quick actions ─────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="glass rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-base">{t('quickActions')}</h3>
                <p className="text-xs text-muted-foreground">{t('jumpToSection')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {QUICK.map((item) => (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/6 hover:bg-white/7 hover:border-white/12 transition-all active:scale-[0.98] text-left group">
                    <div className={`p-2.5 rounded-xl bg-${item.color}-500/15 group-hover:bg-${item.color}-500/25 transition-colors shrink-0`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-400`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </PageTransition>
    </>
  );
};

export default VPHome;
