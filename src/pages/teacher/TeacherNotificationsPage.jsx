import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, School, User, Paperclip, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { NotifSkeleton } from '@/components/Skeletons';

/* ─── tiny helpers ──────────────────────────────────────── */
const formatDay = (dateStr) => {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTime = (dateStr) => {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = now - d;
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const groupByDay = (items) => {
  const map = {};
  items.forEach(n => {
    const key = formatDay(n.created_at);
    if (!map[key]) map[key] = [];
    map[key].push(n);
  });
  return Object.entries(map);
};

/* type → style mapping */
const TYPE_STYLE = {
  school:  { icon: School, dot: 'bg-indigo-500', ring: 'ring-indigo-500/30', label: 'School-wide', labelCls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
  teacher: { icon: User,   dot: 'bg-teal-500',   ring: 'ring-teal-500/30',   label: 'Personal',    labelCls: 'bg-teal-500/15  text-teal-400  border-teal-500/25'   },
  default: { icon: Info,   dot: 'bg-emerald-500',ring: 'ring-emerald-500/30',label: 'General',     labelCls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
};
const typeStyle = (n) => TYPE_STYLE[n.target_type] ?? TYPE_STYLE.default;

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const TeacherNotificationsPage = () => {
  const { t }       = useLanguage();
  const [notifs,    setNotifs]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [selected,  setSelected]  = useState(null);

  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  /* ── fetch ──────────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('notifications').select('*')
        .eq('school_id', parseInt(schoolId)).order('created_at', { ascending: false });
      const filtered = (data || []).filter(n =>
        n.target_type === 'school' ||
        (n.target_type === 'teacher' && String(n.target_id) === String(teacherId))
      );
      setNotifs(filtered);
      setLoading(false);
    })();
  }, [schoolId, teacherId]);

  /* ── realtime ───────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`teacher_notifs_page_${schoolId}_${teacherId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        ({ new: n }) => {
          const isRelevant = n.target_type === 'school' || (n.target_type === 'teacher' && String(n.target_id) === String(teacherId));
          if (isRelevant) setNotifs(prev => [n, ...prev]);
        }
      ).subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId, teacherId]);

  const schoolCount  = notifs.filter(n => n.target_type === 'school').length;
  const personalCount = notifs.filter(n => n.target_type === 'teacher').length;

  const FILTERS = [
    { id: 'all',     label: t('all'),        count: notifs.length },
    { id: 'school',  label: 'School-wide',   count: schoolCount,  hidden: schoolCount === 0  },
    { id: 'teacher', label: 'Personal',      count: personalCount,hidden: personalCount === 0 },
  ].filter(f => !f.hidden);

  const visible  = filter === 'all' ? notifs : notifs.filter(n => n.target_type === filter);
  const grouped  = groupByDay(visible);

  return (
    <>
      <Helmet><title>{t('adminNotifications')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              {t('adminNotifications')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('adminNotificationsDesc')}</p>
          </motion.div>

          {/* Filter pills */}
          {!loading && notifs.length > 0 && FILTERS.length > 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="flex gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200',
                    filter === f.id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent shadow-md shadow-emerald-500/25'
                      : 'bg-white/4 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8'
                  )}>
                  {f.label}
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    filter === f.id ? 'bg-white/25 text-white' : 'bg-white/10'
                  )}>{f.count}</span>
                </button>
              ))}
            </motion.div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="space-y-3">{[0,1,2,3,4].map(i => <NotifSkeleton key={i} />)}</div>
          )}

          {/* Empty */}
          {!loading && visible.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4">
              <div className="p-5 rounded-3xl bg-white/5"><Bell className="h-10 w-10 text-muted-foreground opacity-30" /></div>
              <div>
                <h2 className="font-bold text-base">All caught up</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('noNotificationsDesc')}</p>
              </div>
            </motion.div>
          )}

          {/* Timeline */}
          {!loading && grouped.map(([day, items]) => (
            <motion.div key={day} variants={stagger} initial="hidden" animate="visible" className="space-y-2">
              {/* Day divider */}
              <div className="flex items-center gap-3 py-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{day}</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Timeline items */}
              <div className="relative ml-5 space-y-3">
                {/* Vertical line */}
                <div className="absolute left-0 top-0 bottom-0 w-px bg-white/8" />

                {items.map((n) => {
                  const st = typeStyle(n);
                  return (
                    <motion.div key={n.id} variants={fadeUp}>
                      <button onClick={() => setSelected(n)}
                        className="relative w-full text-left pl-8 group">
                        {/* Dot */}
                        <span className={cn(
                          'absolute left-0 top-4 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ring-background transition-transform group-hover:scale-125',
                          st.dot, st.ring
                        )} />

                        <div className="glass rounded-2xl p-4 border border-white/8 hover:border-emerald-500/25 hover:bg-white/4 transition-all duration-200 active:scale-[0.99]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={cn('p-2 rounded-xl shrink-0 mt-0.5', st.labelCls.includes('indigo') ? 'bg-indigo-500/15' : st.labelCls.includes('teal') ? 'bg-teal-500/15' : 'bg-emerald-500/15')}>
                                <st.icon className={cn('h-4 w-4', st.labelCls.includes('indigo') ? 'text-indigo-400' : st.labelCls.includes('teal') ? 'text-teal-400' : 'text-emerald-400')} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm leading-tight">{n.title}</p>
                                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0', st.labelCls)}>
                                    {st.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{n.content}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                  {n.sender_name && <span>{t('notifFrom')}: <span className="font-semibold capitalize">{n.sender_name}</span></span>}
                                  {n.file_url && <span className="flex items-center gap-0.5 text-emerald-400"><Paperclip className="h-2.5 w-2.5" />Attachment</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatTime(n.created_at)}</span>
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

      {/* Detail popup */}
      <GlassPopup
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected ? `${t('notifFrom')}: ${selected.sender_name || '—'} · ${new Date(selected.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
        variant="sheet"
        maxWidth="max-w-md"
        footer={selected?.file_url ? (
          <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]">
            <ExternalLink className="h-4 w-4" /> {t('notifAttachment')}
          </a>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-4">
            {/* Type badge */}
            <span className={cn('text-xs font-bold px-3 py-1.5 rounded-full border', typeStyle(selected).labelCls)}>
              {typeStyle(selected).label}
            </span>
            {/* Body */}
            <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/4">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{selected.content}</p>
            </div>
            {/* Meta */}
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 px-1">
              <span className="capitalize">{selected.sender_role?.replace('_', ' ')}</span>
              <span>{new Date(selected.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </GlassPopup>
    </>
  );
};

export default TeacherNotificationsPage;
