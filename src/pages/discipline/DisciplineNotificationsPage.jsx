/**
 * DisciplineNotificationsPage.jsx
 * Rebuilt to match the Teacher / VP notification pages exactly.
 * Orange / red accent, clickable timeline grouped by day,
 * GlassPopup detail sheet, realtime subscription, mark-as-read on mount.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Shield, Users, Info, Paperclip, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { NotifSkeleton } from '@/components/Skeletons';

/* ── date helpers ───────────────────────────────────────── */
const formatDay = (d) => {
  const date = new Date(d);
  const now  = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const formatTime = (d) => {
  const date = new Date(d);
  const diff = new Date() - date;
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const groupByDay = (items) => {
  const map = {};
  items.forEach((n) => {
    const key = formatDay(n.created_at);
    if (!map[key]) map[key] = [];
    map[key].push(n);
  });
  return Object.entries(map);
};

/* ── type → style mapping ───────────────────────────────── */
const TYPE_STYLE = {
  school: {
    icon: Bell, dot: 'bg-orange-500', ring: 'ring-orange-500/30',
    label: 'School-wide',
    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  },
  discipline_master: {
    icon: Shield, dot: 'bg-red-500', ring: 'ring-red-500/30',
    label: 'Personal',
    cls: 'bg-red-500/15 text-red-400 border-red-500/25',
  },
  staff: {
    icon: Users, dot: 'bg-amber-500', ring: 'ring-amber-500/30',
    label: 'Staff',
    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  },
  default: {
    icon: Info, dot: 'bg-orange-500', ring: 'ring-orange-500/30',
    label: 'General',
    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  },
};

const typeStyle = (n) => TYPE_STYLE[n.target_type] ?? TYPE_STYLE.default;

/* ── animation presets ──────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/* ═══════════════════════════════════════════════════════════ */
const DisciplineNotificationsPage = () => {
  const { t }      = useLanguage();
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);

  const userId   = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  /* ── fetch ──────────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', parseInt(schoolId))
        .order('created_at', { ascending: false });

      // Keep only notifications relevant to discipline master role
      const relevant = (data || []).filter(
        (n) =>
          n.target_type === 'school' ||
          n.target_type === 'staff' ||
          (n.target_type === 'discipline_master' &&
            String(n.target_id) === String(userId)),
      );
      setNotifs(relevant);
      setLoading(false);
    })();
  }, [schoolId, userId]);

  /* ── mark all as read on mount ──────────────────────── */
  useEffect(() => {
    if (!schoolId || !userId) return;
    const key = `notif_read_at_discipline_${schoolId}_${userId}`;
    localStorage.setItem(key, new Date().toISOString());
  }, [schoolId, userId]);

  /* ── realtime ───────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase
      .channel(`dm_notifs_page_${schoolId}_${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `school_id=eq.${parseInt(schoolId)}`,
        },
        ({ new: n }) => {
          const ok =
            n.target_type === 'school' ||
            n.target_type === 'staff' ||
            (n.target_type === 'discipline_master' &&
              String(n.target_id) === String(userId));
          if (ok) setNotifs((prev) => [n, ...prev]);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, userId]);

  /* ── filter counts ──────────────────────────────────── */
  const schoolCount   = notifs.filter((n) => n.target_type === 'school').length;
  const staffCount    = notifs.filter((n) => n.target_type === 'staff').length;
  const personalCount = notifs.filter((n) => n.target_type === 'discipline_master').length;

  const FILTERS = [
    { id: 'all',               label: t('all'),       count: notifs.length    },
    { id: 'school',            label: 'School-wide',  count: schoolCount,    hidden: schoolCount === 0    },
    { id: 'staff',             label: 'Staff',         count: staffCount,     hidden: staffCount === 0     },
    { id: 'discipline_master', label: 'Personal',      count: personalCount,  hidden: personalCount === 0  },
  ].filter((f) => !f.hidden);

  const visible = filter === 'all'
    ? notifs
    : notifs.filter((n) => n.target_type === filter);

  const grouped = groupByDay(visible);

  /* ── render ─────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>{t('notifications')} · Discipline · CloudCampus</title>
      </Helmet>

      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* ── Header ─────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-400">
              {t('notifications')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('dmReceivedNotifsDesc')}
            </p>
          </motion.div>

          {/* ── Filter pills ────────────────────────────── */}
          {!loading && notifs.length > 0 && FILTERS.length > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex gap-2 flex-wrap"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200',
                    filter === f.id
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-md shadow-orange-500/25'
                      : 'bg-white/4 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8',
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      filter === f.id ? 'bg-white/25' : 'bg-white/10',
                    )}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Skeletons ───────────────────────────────── */}
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <NotifSkeleton key={i} />
              ))}
            </div>
          )}

          {/* ── Empty state ─────────────────────────────── */}
          {!loading && visible.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4"
            >
              <div className="p-5 rounded-3xl bg-white/5">
                <Bell className="h-10 w-10 text-muted-foreground opacity-30" />
              </div>
              <div>
                <h2 className="font-bold text-base">All caught up</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('noNotificationsDesc')}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Timeline ────────────────────────────────── */}
          {!loading &&
            grouped.map(([day, items]) => (
              <motion.div
                key={day}
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {/* Day divider */}
                <div className="flex items-center gap-3 py-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    {day}
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* Notifications with vertical timeline line */}
                <div className="relative ml-5 space-y-3">
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-white/8" />

                  {items.map((n) => {
                    const st = typeStyle(n);
                    const IconComp = st.icon;
                    // parse cls to extract individual Tailwind classes safely
                    const [bgCls, textCls, borderCls] = st.cls.split(' ');

                    return (
                      <motion.div key={n.id} variants={fadeUp}>
                        <button
                          onClick={() => setSelected(n)}
                          className="relative w-full text-left pl-8 group"
                        >
                          {/* Timeline dot */}
                          <span
                            className={cn(
                              'absolute left-0 top-4 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ring-background transition-transform group-hover:scale-125',
                              st.dot,
                              st.ring,
                            )}
                          />

                          {/* Card */}
                          <div className="glass rounded-2xl p-4 border border-white/8 hover:border-orange-500/25 hover:bg-white/4 transition-all duration-200 active:scale-[0.99]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                {/* Icon */}
                                <div className={cn('p-2 rounded-xl shrink-0 mt-0.5', bgCls)}>
                                  <IconComp className={cn('h-4 w-4', textCls)} />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm leading-tight">
                                      {n.title}
                                    </p>
                                    <span
                                      className={cn(
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0',
                                        st.cls,
                                      )}
                                    >
                                      {st.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {n.content}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                    {n.sender_name && (
                                      <span>
                                        {t('notifFrom')}:{' '}
                                        <span className="font-semibold capitalize">
                                          {n.sender_name}
                                        </span>
                                      </span>
                                    )}
                                    {n.file_url && (
                                      <span className="flex items-center gap-0.5 text-orange-400">
                                        <Paperclip className="h-2.5 w-2.5" />
                                        Attachment
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Timestamp */}
                              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                {formatTime(n.created_at)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
        </div>
      </PageTransition>

      {/* ── Detail GlassPopup ────────────────────────────── */}
      <GlassPopup
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={
          selected
            ? `${t('notifFrom')}: ${selected.sender_name || '—'} · ${new Date(
                selected.created_at,
              ).toLocaleDateString(undefined, {
                day: 'numeric', month: 'long', year: 'numeric',
              })}`
            : ''
        }
        variant="sheet"
        maxWidth="max-w-md"
        footer={
          selected?.file_url ? (
            <a
              href={selected.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              {t('notifAttachment')}
            </a>
          ) : undefined
        }
      >
        {selected && (() => {
          const st = typeStyle(selected);
          return (
            <div className="space-y-4">
              {/* Type badge */}
              <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border', st.cls)}>
                {st.label}
              </span>

              {/* Body */}
              <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/4">
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {selected.content}
                </p>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 px-1">
                <span className="capitalize">
                  {selected.sender_role?.replace('_', ' ')}
                </span>
                <span>
                  {new Date(selected.created_at).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })()}
      </GlassPopup>
    </>
  );
};

export default DisciplineNotificationsPage;
