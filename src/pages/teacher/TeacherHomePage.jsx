import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, BookOpen, Clock, Bell, ChevronRight, Activity, GraduationCap, Upload, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageTransition from '@/components/PageTransition';
import { StatCardSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] } } };

const GlassTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/85 dark:bg-gray-950/90 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-gray-800 dark:text-white mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, colorClass, iconBg, iconColor }) => (
  <motion.div variants={fadeUp}>
    <div className={cn('glass rounded-2xl p-5 border-l-4 hover:scale-[1.02] transition-transform cursor-default', colorClass)}>
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

const TeacherHomePage = ({ unreadCount = 0 }) => {
  const navigate  = useNavigate();
  const { t }     = useLanguage();
  const [loading, setLoading]       = useState(true);
  const [timetable, setTimetable]   = useState([]);
  const [stats, setStats]           = useState({ classes: 0, pendingLogs: 0, totalStudents: 0 });
  const [logTrend, setLogTrend]     = useState([]);

  const teacherId = localStorage.getItem('userId');
  const userName  = localStorage.getItem('userName') || 'Teacher';

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[new Date().getDay()];

      const [{ data: ttData }, { count: pendingLogs }, { data: logs }] = await Promise.all([
        supabase.from('timetables').select('*, classes(name)')
          .eq('teacher_id', teacherId).eq('day_of_week', currentDay).order('start_time'),
        supabase.from('e_logbook_entries').select('*', { count: 'exact', head: true })
          .eq('teacher_id', teacherId).eq('status', 'pending'),
        supabase.from('e_logbook_entries').select('created_at')
          .eq('teacher_id', teacherId).order('created_at', { ascending: true }),
      ]);

      setTimetable(ttData || []);
      setStats({ classes: ttData?.length || 0, pendingLogs: pendingLogs || 0 });

      /* log trend by month */
      const monthMap = {};
      (logs || []).forEach(l => {
        const m = new Date(l.created_at).toLocaleString('default', { month: 'short' });
        monthMap[m] = (monthMap[m] || 0) + 1;
      });
      const trend = Object.entries(monthMap).slice(-6).map(([month, count]) => ({ month, count }));
      setLogTrend(trend.length ? trend : [{ month: '—', count: 0 }]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');

  /* current active period */
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const activeSlot = timetable.find(s => s.start_time?.slice(0,5) <= currentTime && s.end_time?.slice(0,5) >= currentTime);

  return (
    <>
      <Helmet><title>{t('teacherDashboard')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Greeting ──────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                    {greeting}!
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  <span className="font-bold text-foreground">{userName}</span> · {t('role_teacher')}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <Calendar className="h-4 w-4 text-emerald-400" />
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </motion.div>

          {/* ── Active class banner ───────────────────── */}
          {!loading && activeSlot && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}>
              <div className="glass rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/15 shrink-0">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{t('activeClass')}</p>
                  <p className="font-bold text-sm mt-0.5">{activeSlot.classes?.name} — {activeSlot.subject}</p>
                  <p className="text-xs text-muted-foreground">{activeSlot.start_time?.slice(0,5)} – {activeSlot.end_time?.slice(0,5)}</p>
                </div>
                <button onClick={() => navigate('/dashboard/teacher/activity')}
                  className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all active:scale-95">
                  Open Activity →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Notification CTA ─────────────────────── */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <button
              onClick={() => navigate('/dashboard/teacher/notifications')}
              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <div className={cn(
                'relative glass rounded-2xl flex items-center gap-5 p-5 border transition-all duration-300',
                unreadCount > 0
                  ? 'border-emerald-500/40 bg-emerald-500/5 group-hover:border-emerald-500/60'
                  : 'border-white/10 group-hover:border-emerald-500/30'
              )}>
                <div className="relative shrink-0">
                  <div className={cn(
                    'p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110',
                    unreadCount > 0
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30'
                      : 'bg-white/8'
                  )}>
                    <Bell className={cn('h-7 w-7', unreadCount > 0 ? 'text-white' : 'text-muted-foreground')} />
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400 animate-ping opacity-30" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-lg">{t('adminNotifications')}</p>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        {unreadCount} {t('unreadNotifications')}
                      </span>
                    )}
                    {unreadCount === 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/25">
                        {t('allRead')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('adminNotificationsDesc')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* ── Stat cards ───────────────────────────── */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <StatCardSkeleton /><StatCardSkeleton />
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid gap-4 md:grid-cols-2">
              <StatCard icon={Calendar}  label={t('todaysClasses')} value={stats.classes}
                sub={new Date().toLocaleDateString(undefined, { weekday: 'long' })}
                colorClass="border-l-emerald-500" iconBg="bg-emerald-500/15" iconColor="text-emerald-400" />
              <StatCard icon={BookOpen}  label={t('pendingELogs')} value={stats.pendingLogs}
                sub="Waiting for VP review"
                colorClass="border-l-teal-500" iconBg="bg-teal-500/15" iconColor="text-teal-400" />
            </motion.div>
          )}

          {/* ── Chart + timetable ────────────────────── */}
          <div className="grid gap-6 md:grid-cols-5">

            {/* e-Log trend */}
            {loading ? <div className="md:col-span-2"><ChartSkeleton /></div> : (
              <motion.div className="md:col-span-2" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <div className="glass rounded-2xl p-5 space-y-4 h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">e-Log Activity</h3>
                      <p className="text-xs text-muted-foreground">Entries per month</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10">
                      <BookOpen className="h-4 w-4 text-emerald-400" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <AreaChart data={logTrend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="logGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<GlassTooltip />} />
                      <Area type="monotone" dataKey="count" name="Logs" stroke="#10b981" strokeWidth={2.5}
                        fill="url(#logGrad)" dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Timetable */}
            <motion.div className="md:col-span-3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
              <div className="glass rounded-2xl p-5 space-y-4 h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base">{t('todaysTimetable')}</h3>
                    <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-teal-500/10">
                    <Clock className="h-4 w-4 text-teal-400" />
                  </div>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[0,1,2].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
                  </div>
                ) : timetable.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-white/5"><Clock className="h-8 w-8 text-muted-foreground opacity-30" /></div>
                    <p className="text-sm text-muted-foreground">{t('noClassesScheduled')}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {timetable.map((slot) => {
                      const isNow = slot.start_time?.slice(0,5) <= currentTime && slot.end_time?.slice(0,5) >= currentTime;
                      return (
                        <div key={slot.id} className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          isNow
                            ? 'bg-emerald-500/8 border-emerald-500/30'
                            : 'bg-white/3 border-white/6 hover:bg-white/5'
                        )}>
                          <div className={cn('p-2 rounded-lg shrink-0', isNow ? 'bg-emerald-500/20' : 'bg-white/8')}>
                            <Clock className={cn('h-4 w-4', isNow ? 'text-emerald-400' : 'text-muted-foreground')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{slot.classes?.name}</p>
                            <p className="text-xs text-muted-foreground">{slot.subject}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn('text-xs font-bold', isNow ? 'text-emerald-400' : 'text-muted-foreground')}>
                              {slot.start_time?.slice(0,5)} – {slot.end_time?.slice(0,5)}
                            </p>
                            {isNow && <p className="text-[10px] text-emerald-400 font-semibold">● NOW</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Quick actions ─────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="glass rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-base">{t('quickActions')}</h3>
                <p className="text-xs text-muted-foreground">{t('jumpToSection')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { icon: Activity,      label: t('liveActivity'), sub: 'e-Log & register',   path: '/dashboard/teacher/activity', color: 'emerald' },
                  { icon: GraduationCap, label: t('marks'),        sub: 'Enter student marks', path: '/dashboard/teacher/marks',    color: 'teal'    },
                  { icon: Upload,        label: t('publish'),      sub: 'Docs & notifications',path: '/dashboard/teacher/publish',  color: 'cyan'    },
                ].map((item) => (
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

export default TeacherHomePage;
