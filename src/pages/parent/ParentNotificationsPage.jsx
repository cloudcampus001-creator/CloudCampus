import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Calendar, User, Paperclip, ExternalLink,
  Megaphone, BookOpen, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { NotifSkeleton } from '@/components/Skeletons';
import { cn } from '@/lib/utils';

/* ── notification type metadata ─────────────────────── */
const TYPE = {
  school: { key: 'notifSchoolWide', gradient: 'from-indigo-500 to-violet-500', bg: 'bg-indigo-500/12', border: 'border-indigo-500/20', icon: Megaphone, dot: 'bg-indigo-400' },
  class:  { key: 'notifYourClass',  gradient: 'from-blue-500 to-cyan-500',     bg: 'bg-blue-500/12',   border: 'border-blue-500/20',   icon: BookOpen,  dot: 'bg-blue-400'   },
  parent: { key: 'notifPersonal',   gradient: 'from-purple-500 to-pink-500',   bg: 'bg-purple-500/12', border: 'border-purple-500/20', icon: User,      dot: 'bg-purple-400' },
};
const getMeta = (type) => TYPE[type] || TYPE.school;

/* ── helpers ─────────────────────────────────────────── */
const relTime = (date, t) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return t('notifJustNow');
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const dayLabel = (date, t) => {
  const d    = new Date(date);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return t('notifToday');
  if (diff === 1) return t('notifYesterday');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
};

/* groups notifications by calendar day */
const groupByDay = (notifs) => {
  const groups = {};
  notifs.forEach(n => {
    const key = new Date(n.created_at).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return Object.entries(groups);
};

/* ── filter pills ────────────────────────────────────── */
const FILTERS = ['all', 'school', 'class', 'parent'];

/* ── animations ─────────────────────────────────────── */
const listItem = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };

/* ─────────────────────────────────────────────────── */
const ParentNotificationsPage = () => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('all');
  const [selected, setSelected]           = useState(null);

  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');

  const isRelevant = useCallback((n) =>
    n.target_type === 'school' ||
    (n.target_type === 'class'  && String(n.target_id) === String(classId)) ||
    (n.target_type === 'parent' && String(n.target_id) === String(studentMatricule)),
  [classId, studentMatricule]);

  /* ── fetch ──────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('notifications').select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });
        setNotifications((data || []).filter(isRelevant));
      } finally { setLoading(false); }
    })();
  }, [schoolId, isRelevant]);

  /* ── realtime ───────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`notif_page_${schoolId}_${studentMatricule}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        ({ new: n }) => { if (isRelevant(n)) setNotifications(prev => [n, ...prev]); }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, isRelevant, studentMatricule]);

  /* ── mark all read on mount ─────────────────────── */
  useEffect(() => {
    const key = `notif_read_at_${schoolId}_${studentMatricule}`;
    localStorage.setItem(key, new Date().toISOString());
  }, []);

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.target_type === filter);

  const grouped = groupByDay(filtered);
  const meta    = selected ? getMeta(selected.target_type) : null;

  return (
    <>
      <Helmet><title>{t('notifications')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ── Header ──────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                  {t('notifications')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {loading ? t('loading') : `${notifications.length} ${t('notifications').toLowerCase()}`}
                </p>
              </div>
              {/* unread badge if any remain */}
            </div>
          </motion.div>

          {/* ── Filter pills ────────────────────────── */}
          {!loading && notifications.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="flex gap-2 flex-wrap">
              {FILTERS.map(f => {
                const count = f === 'all' ? notifications.length : notifications.filter(n => n.target_type === f).length;
                if (f !== 'all' && count === 0) return null;
                const m = f !== 'all' ? getMeta(f) : null;
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200',
                      filter === f
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent shadow-md shadow-blue-500/25'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20'
                    )}>
                    {f !== 'all' && <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />}
                    {f === 'all' ? `${t('all')} (${count})` : `${t(m.key)} (${count})`}
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ── Skeletons ───────────────────────────── */}
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map(i => <NotifSkeleton key={i} />)}
            </div>
          )}

          {/* ── Empty ───────────────────────────────── */}
          {!loading && notifications.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-5 rounded-3xl bg-blue-500/10">
                <Bell className="h-10 w-10 text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{t('noNotifications')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('noNotificationsDesc')}</p>
              </div>
            </motion.div>
          )}

          {/* ── Timeline ────────────────────────────── */}
          {!loading && filtered.length > 0 && (
            <div className="space-y-8">
              {grouped.map(([dayKey, dayNotifs]) => (
                <div key={dayKey} className="space-y-1">

                  {/* Day divider */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-white/8" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {dayLabel(dayNotifs[0].created_at, t)}
                    </span>
                    <div className="h-px flex-1 bg-white/8" />
                  </div>

                  {/* Notifications for this day */}
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2 relative">
                    {/* Timeline line */}
                    <div className="absolute left-[19px] top-5 bottom-5 w-px bg-white/8 pointer-events-none" />

                    {dayNotifs.map((n) => {
                      const m = getMeta(n.target_type);
                      const IconComp = m.icon;
                      return (
                        <motion.div key={n.id} variants={listItem}>
                          <button onClick={() => setSelected(n)} className="w-full text-left group pl-10 relative">

                            {/* Timeline dot */}
                            <span className={cn('absolute left-[14px] top-5 w-[11px] h-[11px] rounded-full border-2 border-background z-10', m.dot)} />

                            {/* Card */}
                            <div className={cn(
                              'glass rounded-2xl p-4 border transition-all duration-200 active:scale-[0.99]',
                              m.border, m.bg,
                              'group-hover:shadow-lg group-hover:translate-x-0.5'
                            )}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {/* Icon */}
                                  <div className={cn('p-2 rounded-xl shrink-0 mt-0.5 transition-transform group-hover:scale-110', m.bg)}>
                                    <IconComp className={cn('h-3.5 w-3.5 bg-gradient-to-br bg-clip-text', m.gradient)}
                                      style={{ color: n.target_type === 'school' ? '#818cf8' : n.target_type === 'class' ? '#60a5fa' : '#c084fc' }}
                                    />
                                  </div>
                                  {/* Text */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-tight group-hover:text-blue-400 transition-colors">
                                      {n.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                      {n.content}
                                    </p>
                                  </div>
                                </div>

                                {/* Meta — time + type badge */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                                    {relTime(n.created_at, t)}
                                  </span>
                                  <span className={cn(
                                    'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r text-white',
                                    m.gradient
                                  )}>
                                    {t(m.key)}
                                  </span>
                                </div>
                              </div>

                              {/* Footer row */}
                              {(n.sender_name || n.file_url) && (
                                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/6">
                                  {n.sender_name && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <User className="h-2.5 w-2.5" />
                                      {n.sender_name}
                                      <span className="opacity-50">·</span>
                                      <span className="capitalize">{n.sender_role?.replace('_', ' ')}</span>
                                    </span>
                                  )}
                                  {n.file_url && (
                                    <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-400">
                                      <Paperclip className="h-2.5 w-2.5" />
                                      {t('notifAttachment')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              ))}
            </div>
          )}

          {/* ── No filter results ───────────────────── */}
          {!loading && notifications.length > 0 && filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl p-12 flex flex-col items-center text-center gap-3">
              <Bell className="h-8 w-8 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No notifications for this filter.</p>
              <button onClick={() => setFilter('all')} className="text-xs text-blue-400 hover:underline">
                {t('all')} →
              </button>
            </motion.div>
          )}

        </div>
      </PageTransition>

      {/* ── iOS Glass Popup — notification detail ─── */}
      <GlassPopup
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected && `${t(getMeta(selected.target_type).key)} · ${new Date(selected.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        variant="sheet"
        maxWidth="max-w-lg"
      >
        {selected && meta && (
          <div className="space-y-4">

            {/* Sender card */}
            {selected.sender_name && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-black/4 dark:bg-white/4">
                <div className={cn(
                  'h-10 w-10 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 bg-gradient-to-br',
                  meta.gradient
                )}>
                  {selected.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 dark:text-white">{selected.sender_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {selected.sender_role?.replace('_', ' ')}
                  </p>
                </div>
                <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r text-white shrink-0', meta.gradient)}>
                  {t(meta.key)}
                </span>
              </div>
            )}

            {/* Message body */}
            <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/8">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {selected.content}
              </p>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 px-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {new Date(selected.created_at).toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })}
            </div>

            {/* Attachment */}
            {selected.file_url && (
              <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-500/8 border border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 transition-colors">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium flex-1">{t('notifAttachment')}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            )}
          </div>
        )}
      </GlassPopup>
    </>
  );
};

export default ParentNotificationsPage;
