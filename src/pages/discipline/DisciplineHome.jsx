/**
 * DisciplineHome.jsx
 * Redesigned to match the quality of Teacher/VP home pages.
 *
 * Changes vs original:
 *  ✓ Greeting (morning / afternoon / evening) + DM name + live date
 *  ✓ HUGE received-notifications CTA button (orange/red gradient when unread,
 *    green "all caught up" when 0 — mirrors VPHome pattern)
 *  ✓ 2 stat cards only (Pending Justifications + Punishments Issued)
 *  ✗ "Registers Reviewed" card REMOVED
 *  ✓ Quick-actions grid (3 cols)
 *  ✓ Recent notifications mini-feed (last 5, grouped)
 *  ✓ Full translation via t()
 *  ✓ Orange / red brand accent throughout
 *  ✓ Skeletons while loading
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, FileText, CheckSquare,
  Loader2, Info, TrendingUp, Calendar, Sparkles,
  ShieldAlert, ClipboardCheck,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── tiny helpers ──────────────────────────────────────────────────────────── */
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

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ── Skeleton component ────────────────────────────────────────────────────── */
const Skel = ({ className }) => (
  <div className={cn('animate-pulse rounded-xl bg-white/5', className)} />
);

/* ═══════════════════════════════════════════════════════════════════════════ */
const DisciplineHome = ({ unreadCount = 0 }) => {
  const navigate    = useNavigate();
  const { t, lang } = useLanguage();

  const userName = localStorage.getItem('userName') || 'Discipline Master';
  const userId   = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  const [stats,   setStats]   = useState({ pendingJustifications: 0, punishmentsIssued: 0 });
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  /* Unread count: passed via prop from DisciplineDashboard OR derived locally */
  const [localUnread, setLocalUnread] = useState(unreadCount);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      /* ── Notifications ── */
      const { data: notifsData } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', parseInt(schoolId))
        .or('target_type.eq.school,target_type.eq.discipline_master,target_type.eq.staff')
        .order('created_at', { ascending: false })
        .limit(5);

      const notifList = notifsData || [];
      setNotifs(notifList);

      /* Derive local unread count from localStorage timestamp */
      const readAt = localStorage.getItem(`notif_read_at_discipline_${schoolId}_${userId}`);
      const unread = readAt
        ? notifList.filter(n => new Date(n.created_at) > new Date(readAt)).length
        : notifList.length;
      setLocalUnread(unread);

      /* ── Stats ── */
      const [{ count: justCount }, { count: punishCount }] = await Promise.all([
        supabase.from('justifications').select('id', { count: 'exact', head: true })
          .eq('status', 'pending').eq('dm_id', userId),
        supabase.from('punishments').select('id', { count: 'exact', head: true })
          .eq('signaled_by_id', userId).eq('signaled_by_role', 'discipline'),
      ]);

      setStats({ pendingJustifications: justCount || 0, punishmentsIssued: punishCount || 0 });
    } catch (err) {
      console.error('DisciplineHome fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const greeting = lang === 'fr' ? greetFr() : greet();
  const firstName = userName.split(' ')[0];

  /* ── Quick actions ── */
  const quickActions = [
    {
      label: t('dmRecordPunishment'),
      icon: ShieldAlert,
      path: '/dashboard/discipline/punishments',
      from: '#f97316', to: '#ef4444',
      glow: 'rgba(249,115,22,0.25)',
    },
    {
      label: t('dmReviewJustifications'),
      icon: FileText,
      path: '/dashboard/discipline/justifications',
      from: '#3b82f6', to: '#06b6d4',
      glow: 'rgba(59,130,246,0.22)',
    },
    {
      label: t('dmCheckRegisters'),
      icon: ClipboardCheck,
      path: '/dashboard/discipline/registers',
      from: '#a855f7', to: '#ec4899',
      glow: 'rgba(168,85,247,0.22)',
    },
  ];

  /* ── Date pill ── */
  const dateStr = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <>
      <Helmet><title>{t('dmDashboard')} · CloudCampus</title></Helmet>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8 pb-4">

        {/* ── Header row ─────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            {/* Greeting */}
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <span>{greeting},</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
              {firstName} <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">👋</span>
            </h1>
            <p className="text-muted-foreground text-sm">{t('dmDashboardDesc')}</p>
          </div>

          {/* Date pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-muted-foreground text-xs font-medium shrink-0 self-start sm:self-auto">
            <Calendar className="h-3.5 w-3.5 text-orange-400" />
            <span className="capitalize">{dateStr}</span>
          </div>
        </motion.div>

        {/* ── HUGE Notification CTA ──────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <button
            onClick={() => {
              localStorage.setItem(`notif_read_at_discipline_${schoolId}_${userId}`, new Date().toISOString());
              setLocalUnread(0);
              navigate('/dashboard/discipline');  // stays on same page; notifications shown below
            }}
            className="w-full group relative overflow-hidden rounded-3xl p-6 flex items-center justify-between gap-4 transition-all duration-300 active:scale-[0.99]"
            style={localUnread > 0
              ? { background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(239,68,68,0.12))', border: '1px solid rgba(249,115,22,0.35)', boxShadow: '0 8px 40px rgba(249,115,22,0.18)' }
              : { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', boxShadow: '0 4px 20px rgba(34,197,94,0.08)' }
            }
          >
            {/* Shimmer sweep */}
            {localUnread > 0 && (
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.12), transparent)' }} />
            )}

            <div className="flex items-center gap-4 relative z-10">
              <div className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg',
                localUnread > 0
                  ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/30'
                  : 'bg-green-500/15'
              )}>
                <Bell className={cn('h-7 w-7', localUnread > 0 ? 'text-white animate-[ring_2s_ease-in-out_infinite]' : 'text-green-400')} />
              </div>

              <div className="text-left">
                <p className={cn('text-xl font-black leading-tight', localUnread > 0 ? 'text-foreground' : 'text-green-400')}>
                  {localUnread > 0
                    ? `${localUnread} ${t('dmUnreadBadge')}`
                    : t('dmAllCaughtUp')}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('dmReceivedNotifsDesc')}</p>
              </div>
            </div>

            {/* Arrow */}
            <div className={cn(
              'h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 relative z-10 transition-transform duration-200 group-hover:translate-x-1',
              localUnread > 0 ? 'bg-orange-500/20' : 'bg-green-500/15'
            )}>
              <svg className={cn('h-5 w-5', localUnread > 0 ? 'text-orange-400' : 'text-green-400')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </motion.div>

        {/* ── 2 Stat cards (no Registers Reviewed) ──────────────────────────── */}
        <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pending Justifications */}
          <motion.div variants={fadeUp}>
            {loading ? <Skel className="h-32" /> : (
              <button onClick={() => navigate('/dashboard/discipline/justifications')}
                className="w-full group glass rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] border border-white/8 hover:border-blue-500/30"
                style={{ boxShadow: 'none' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.14)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
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
                {/* Bottom accent bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/50 to-cyan-400/30 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </motion.div>

          {/* Punishments Issued */}
          <motion.div variants={fadeUp}>
            {loading ? <Skel className="h-32" /> : (
              <button onClick={() => navigate('/dashboard/discipline/punishments')}
                className="w-full group glass rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.99] border border-white/8 hover:border-red-500/30 relative overflow-hidden"
                style={{ boxShadow: 'none' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(239,68,68,0.14)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
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

        {/* ── Quick Actions grid ─────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-0.5">
            {t('dmQuickActions')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.path}
                  onClick={() => navigate(action.path)}
                  className="group relative overflow-hidden flex items-center gap-3.5 p-4 rounded-2xl border border-white/8 bg-card/40 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
                  style={{ boxShadow: 'none' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 28px ${action.glow}`; e.currentTarget.style.borderColor = action.from + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = ''; }}>
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${action.from}18`, border: `1px solid ${action.from}28` }}>
                    <Icon className="h-5 w-5" style={{ color: action.from }} />
                  </div>
                  <span className="text-sm font-semibold text-left leading-tight">{action.label}</span>
                  {/* Hover gradient bg */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                    style={{ background: `linear-gradient(135deg, ${action.from}0a, ${action.to}06)` }} />
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Recent Notifications mini-feed ────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('dmReceivedNotifs')}
            </h2>
            {localUnread > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
                {localUnread} {t('dmUnreadBadge')}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skel key={i} className="h-16" />)}
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 glass rounded-2xl border border-white/8">
              <Bell className="h-10 w-10 text-muted-foreground opacity-15" />
              <p className="text-sm text-muted-foreground">{t('dmNoNotifs')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifs.map((notif, idx) => {
                const readAt = localStorage.getItem(`notif_read_at_discipline_${schoolId}_${userId}`);
                const isNew = !readAt || new Date(notif.created_at) > new Date(readAt);
                return (
                  <motion.div key={notif.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={cn(
                      'flex items-start gap-3.5 p-4 rounded-2xl border transition-all',
                      isNew
                        ? 'bg-orange-500/8 border-orange-500/25'
                        : 'glass border-white/8 hover:border-white/15'
                    )}>
                    {/* Type dot */}
                    <div className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                      notif.target_type === 'school' ? 'bg-orange-500/15' : 'bg-blue-500/15'
                    )}>
                      <Info className={cn('h-4 w-4', notif.target_type === 'school' ? 'text-orange-400' : 'text-blue-400')} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{notif.title}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isNew && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />}
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{notif.content}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1 capitalize">
                        {notif.sender_role}{notif.sender_name ? ` · ${notif.sender_name}` : ''}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* Bell ring keyframe */}
      <style>{`
        @keyframes ring {
          0%,100% { transform: rotate(0); }
          10%,30% { transform: rotate(-12deg); }
          20%,40% { transform: rotate(12deg); }
          50% { transform: rotate(0); }
        }
      `}</style>
    </>
  );
};

export default DisciplineHome;
