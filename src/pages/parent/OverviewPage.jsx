import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, BookOpen, AlertTriangle, CheckCircle,
  TrendingUp, Award, Calendar, Bell, ChevronRight,
  FileStack, Shield, MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import PageTransition from '@/components/PageTransition';
import { StatCardSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── animation helpers ──────────────────────────────── */
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ── recharts glass tooltip ─────────────────────────── */
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

/* ── stat card ──────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, colorClass, iconBg, danger }) => (
  <motion.div variants={fadeUp}>
    <div className={cn(
      'glass rounded-2xl p-5 border-l-4 hover:scale-[1.02] active:scale-[0.99] transition-transform duration-200',
      danger ? 'border-l-red-500' : colorClass
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn('p-2 rounded-xl', danger ? 'bg-red-500/15' : iconBg)}>
          <Icon className={cn('h-4 w-4', danger ? 'text-red-400' : 'text-blue-400')} />
        </div>
      </div>
      <p className={cn('text-3xl font-black', danger ? 'text-red-400' : 'text-foreground')}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  </motion.div>
);

const BAR_COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];

/* ─────────────────────────────────────────────────── */

const OverviewPage = ({ unreadCount = 0 }) => {
  const navigate      = useNavigate();
  const { t }         = useLanguage();
  const [loading, setLoading]             = useState(true);
  const [stats, setStats]                 = useState({ assignments: 0, absences: 0, books: 0 });
  const [absenceHistory, setAbsenceHistory] = useState([]);
  const [subjectDocs, setSubjectDocs]     = useState([]);

  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');
  const studentName      = localStorage.getItem('studentName');

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [{ count: assignCount }, { data: absData }, { count: bookCount }, { data: docs }] =
        await Promise.all([
          supabase.from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', parseInt(classId))
            .eq('document_type', 'assignment'),
          supabase.from('absences')
            .select('hours, created_at')
            .eq('student_matricule', studentMatricule)
            .order('created_at', { ascending: true }),
          supabase.from('library_books')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId),
          supabase.from('documents')
            .select('subject')
            .eq('class_id', parseInt(classId)),
        ]);

      const totalAbs = (absData || []).reduce((s, a) => s + a.hours, 0);
      setStats({ assignments: assignCount || 0, absences: totalAbs, books: bookCount || 0 });

      /* absence trend by month */
      const monthMap = {};
      (absData || []).forEach(a => {
        const m = new Date(a.created_at).toLocaleString('default', { month: 'short' });
        monthMap[m] = (monthMap[m] || 0) + a.hours;
      });
      const trend = Object.entries(monthMap).slice(-6).map(([month, hours]) => ({ month, hours }));
      setAbsenceHistory(trend.length ? trend : [{ month: '—', hours: 0 }]);

      /* docs per subject */
      const subMap = {};
      (docs || []).forEach(d => { if (d.subject) subMap[d.subject] = (subMap[d.subject] || 0) + 1; });
      setSubjectDocs(Object.entries(subMap).slice(0, 6).map(([subject, count]) => ({ subject: subject.slice(0, 8), count })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [schoolId, classId, studentMatricule]);

  useEffect(() => { load(); }, [load]);

  /* ── greeting ───────────────────────────────────── */
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      <Helmet><title>{t('overview')} — {studentName || t('role_parent')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-8">

          {/* ── Greeting ──────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                    {greeting}!
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1">
                  {t('hereIsWhat')}{' '}
                  <span className="font-bold text-foreground">{studentName}</span>{' '}
                  {t('today')}.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <Calendar className="h-4 w-4 text-blue-400" />
                {dateLabel}
              </div>
            </div>
          </motion.div>

          {/* ── BIG NOTIFICATION CTA ──────────────────── */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 }}>
            <button
              onClick={() => navigate('/dashboard/parent/notifications')}
              className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
            >
              {/* Glow layer */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

              <div className={cn(
                'relative glass rounded-2xl flex items-center gap-5 p-5 border transition-all duration-300',
                unreadCount > 0
                  ? 'border-blue-500/40 bg-blue-500/5 group-hover:border-blue-500/60'
                  : 'border-white/10 group-hover:border-blue-500/30'
              )}>
                {/* Icon with pulse on unread */}
                <div className="relative shrink-0">
                  <div className={cn(
                    'p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110',
                    unreadCount > 0
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/30'
                      : 'bg-white/8'
                  )}>
                    <Bell className={cn('h-7 w-7', unreadCount > 0 ? 'text-white' : 'text-muted-foreground')} />
                  </div>
                  {/* Pulse ring when unread */}
                  {unreadCount > 0 && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-blue-400 animate-ping opacity-30" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-lg leading-tight">{t('notifications')}</p>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold shadow-md shadow-blue-500/30">
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
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {unreadCount > 0
                      ? t('viewAllNotifications')
                      : t('noNotificationsDesc')}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-blue-400 group-hover:translate-x-1 transition-all duration-200 shrink-0" />
              </div>
            </button>
          </motion.div>

          {/* ── Stat Cards ────────────────────────────── */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map(i => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid gap-4 md:grid-cols-3">
              <StatCard
                icon={FileText} label={t('activeAssignments')}
                value={stats.assignments} sub={t('dueTerm')}
                colorClass="border-l-blue-500" iconBg="bg-blue-500/15"
              />
              <StatCard
                icon={BookOpen} label={t('libraryBooks')}
                value={stats.books} sub={t('availableNow')}
                colorClass="border-l-cyan-500" iconBg="bg-cyan-500/15"
              />
              <StatCard
                icon={stats.absences > 0 ? AlertTriangle : CheckCircle}
                label={t('unjustifiedAbsences')}
                value={`${stats.absences}h`}
                sub={stats.absences === 0 ? t('perfectAttendance') : t('submitJustificationHint')}
                colorClass="border-l-green-500" iconBg="bg-green-500/15"
                danger={stats.absences > 0}
              />
            </motion.div>
          )}

          {/* ── Charts ────────────────────────────────── */}
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <ChartSkeleton /><ChartSkeleton />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">

              {/* Absence trend */}
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <div className="glass rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">{t('absenceTrend')}</h3>
                      <p className="text-xs text-muted-foreground">{t('hoursPerMonth')}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-red-500/10">
                      <TrendingUp className="h-4 w-4 text-red-400" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={absenceHistory} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="absGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<GlassTooltip />} />
                      <Area type="monotone" dataKey="hours" name={t('hours')} stroke="#ef4444" strokeWidth={2.5}
                        fill="url(#absGrad)" dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Docs per subject */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                <div className="glass rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">{t('studyMaterials')}</h3>
                      <p className="text-xs text-muted-foreground">{t('docsPerSubject')}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Award className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                  {subjectDocs.length === 0 ? (
                    <div className="flex items-center justify-center h-36 text-muted-foreground text-sm">
                      {t('noDocumentsYet')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={subjectDocs} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="subject" tick={{ fontSize: 9, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.8)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<GlassTooltip />} />
                        <Bar dataKey="count" name={t('documents')} radius={[6, 6, 0, 0]}>
                          {subjectDocs.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* ── Quick Actions ─────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            <div className="glass rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-base">{t('quickActions')}</h3>
                <p className="text-xs text-muted-foreground">{t('jumpToSection')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { icon: FileStack,      label: t('documents'),  sub: t('accessDocuments'),    path: '/dashboard/parent/docs',       color: 'indigo' },
                  { icon: Shield,         label: t('discipline'), sub: t('submitJustification'), path: '/dashboard/parent/discipline', color: 'orange' },
                  { icon: BookOpen,       label: t('library'),    sub: t('downloadTextbooks'),   path: '/dashboard/parent/library',    color: 'cyan'   },
                  { icon: MessageSquare,  label: t('chat'),       sub: t('talkToTeachers'),      path: '/dashboard/parent/chat',       color: 'purple' },
                ].map((item) => (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/6 hover:bg-white/7 hover:border-white/12 transition-all active:scale-[0.98] text-left group">
                    <div className={`p-2.5 rounded-xl bg-${item.color}-500/15 group-hover:bg-${item.color}-500/25 transition-colors shrink-0`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-400`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
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

export default OverviewPage;
