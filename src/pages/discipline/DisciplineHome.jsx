import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, FileText,
  TrendingUp, Calendar, Sparkles,
  ShieldAlert, ClipboardCheck, ChevronRight, CheckCircle,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── helpers ─────────────────────────────────────────────── */
const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
const greetFr = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 17) return 'Bon après-midi';
  return 'Bonsoir';
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

const Skel = ({ className }) => (
  <div className={cn('animate-pulse rounded-xl bg-white/5', className)} />
);

/* ═════════════════════════════════════════════════════════ */
const DisciplineHome = ({ unreadCount = 0 }) => {
  const navigate    = useNavigate();
  const { t, lang } = useLanguage();

  const userName = localStorage.getItem('userName') || 'Discipline Master';
  const userId   = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  const [stats,   setStats]   = useState({ pendingJustifications: 0, punishmentsIssued: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      /* ── Stats ── */
      const [{ count: justCount }, { count: punishCount }] = await Promise.all([
        supabase.from('justifications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending').eq('dm_id', userId),
        supabase.from('punishments')
          .select('id', { count: 'exact', head: true })
          .eq('signaled_by_id', userId).eq('signaled_by_role', 'discipline'),
      ]);

      setStats({ pendingJustifications: justCount || 0, punishmentsIssued: punishCount || 0 });
    } catch (err) {
      console.error('DisciplineHome fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const greeting  = lang === 'fr' ? greetFr() : greet();
  const firstName = userName.split(' ')[0];

  const quickActions = [
    {
      label: t('dmRecordPunishment'),
      icon:  ShieldAlert,
      path:  '/dashboard/discipline/punishments',
      from:  '#f97316', to: '#ef4444',
      glow:  'rgba(249,115,22,0.25)',
    },
    {
      label: t('dmReviewJustifications'),
      icon:  FileText,
      path:  '/dashboard/discipline/justifications',
      from:  '#3b82f6', to: '#06b6d4',
      glow:  'rgba(59,130,246,0.22)',
    },
    {
      label: t('dmCheckRegisters'),
      icon:  ClipboardCheck,
      path:  '/dashboard/discipline/registers',
      from:  '#a855f7', to: '#ec4899',
      glow:  'rgba(168,85,247,0.22)',
    },
  ];

  const dateStr = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  /* ── navigate to notifications page ───────────────────── */
  const goToNotifications = () => {
    navigate('/dashboard/discipline/notifications');
  };

  return (
    <>
      <Helmet><title>{t('dmDashboard')} · CloudCampus</title></Helmet>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8 pb-4">

        {/* ── Header ──────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <span>{greeting},</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              {firstName} <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">👋</span>
            </h1>
            <p className="text-muted-foreground text-sm">{t('dmDashboardDesc')}</p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-muted-foreground text-xs font-medium shrink-0 self-start sm:self-auto">
            <Calendar className="h-3.5 w-3.5 text-orange-400" />
            <span className="capitalize">{dateStr}</span>
          </div>
        </motion.div>

        {/* ── Notification CTA — navigates to notifications page ── */}
        <motion.div variants={fadeUp}>
          <button
            onClick={goToNotifications}
            className="w-full group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-[0.99]"
          >
            {/* Hover tint */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

            <div
              className={cn(
                'relative glass rounded-2xl flex items-center gap-5 p-5 border transition-all duration-300',
                unreadCount > 0
                  ? 'border-orange-500/40 bg-orange-500/5 group-hover:border-orange-500/60'
                  : 'border-white/10 group-hover:border-orange-500/30',
              )}
            >
              {/* Bell icon */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    'p-4 rounded-2xl transition-transform duration-300 group-hover:scale-110',
                    unreadCount > 0
                      ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30'
                      : 'bg-white/8',
                  )}
                >
                  <Bell className={cn('h-7 w-7', unreadCount > 0 ? 'text-white' : 'text-muted-foreground')} />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute inset-0 rounded-2xl border-2 border-orange-400 animate-ping opacity-30" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-bold text-lg">{t('notifications')}</p>
                  {unreadCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow-md shadow-orange-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {unreadCount} {t('unreadNotifications')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-semibold border border-green-500/25">
                      <CheckCircle className="h-3 w-3" /> {t('allRead')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{t('dmReceivedNotifsDesc')}</p>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-orange-400 group-hover:translate-x-1 transition-all shrink-0" />
            </div>
          </button>
        </motion.div>

        {/* ── 2 Stat cards ────────────────────────────────── */}
        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Pending Justifications */}
          <motion.div variants={fadeUp}>
            {loading ? <Skel className="h-32" /> : (
              <button
                onClick={() => navigate('/dashboard/discipline/justifications')}
                className="w-full group glass rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] border border-white/8 hover:border-blue-500/30 relative overflow-hidden"
                style={{ boxShadow: 'none' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.14)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-11 w-11 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  {stats.pendingJustifications > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      {t('dmPendingJustSub')}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-black text-foreground">{stats.pendingJustifications}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('dmPendingJust')}</p>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/50 to-cyan-400/30 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </motion.div>

          {/* Punishments Issued */}
          <motion.div variants={fadeUp}>
            {loading ? <Skel className="h-32" /> : (
              <button
                onClick={() => navigate('/dashboard/discipline/punishments')}
                className="w-full group glass rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] border border-white/8 hover:border-red-500/30 relative overflow-hidden"
                style={{ boxShadow: 'none' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(239,68,68,0.14)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-11 w-11 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  {stats.punishmentsIssued > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                      {t('dmPunishmentsSub')}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-black text-foreground">{stats.punishmentsIssued}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('dmPunishmentsIssued')}</p>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500/50 to-red-400/30 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </motion.div>
        </motion.div>

        {/* ── Quick Actions ────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-0.5">
            {t('dmQuickActions')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="group relative overflow-hidden flex items-center gap-3.5 p-4 rounded-2xl border border-white/8 bg-card/40 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
                  style={{ boxShadow: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 28px ${action.glow}`; e.currentTarget.style.borderColor = action.from + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = ''; }}
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${action.from}18`, border: `1px solid ${action.from}28` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: action.from }} />
                  </div>
                  <span className="text-sm font-semibold text-left leading-tight flex-1">{action.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all shrink-0" />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${action.from}0a, ${action.to}06)` }}
                  />
                </button>
              );
            })}
          </div>
        </motion.div>

      </motion.div>
    </>
  );
};

export default DisciplineHome;