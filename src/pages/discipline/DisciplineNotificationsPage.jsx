/**
 * DisciplineNotificationsPage.jsx
 * Full-page notifications feed for the Discipline Master,
 * matching the design of Teacher/VP notifications pages.
 * Orange/red brand accent, realtime subscription, read-state tracking.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, CheckCheck, Calendar, Sparkles, Filter } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } } };

const Skel = () => (
  <div className="animate-pulse flex gap-3.5 p-4 rounded-2xl bg-white/4 border border-white/5">
    <div className="h-10 w-10 rounded-xl bg-white/8 shrink-0" />
    <div className="flex-1 space-y-2 pt-1">
      <div className="h-4 w-2/3 bg-white/8 rounded-lg" />
      <div className="h-3 w-full bg-white/5 rounded-lg" />
      <div className="h-3 w-1/3 bg-white/5 rounded-lg" />
    </div>
  </div>
);

const TARGET_LABELS = {
  school:           { label: 'School-wide', color: '#f97316' },
  discipline_master:{ label: 'Discipline',  color: '#ef4444' },
  staff:            { label: 'Staff',        color: '#f59e0b' },
  teacher:          { label: 'Teachers',     color: '#10b981' },
  vice_principal:   { label: 'VP',           color: '#a855f7' },
};

const DisciplineNotificationsPage = () => {
  const { t, lang }  = useLanguage();
  const userId       = localStorage.getItem('userId');
  const schoolId     = localStorage.getItem('schoolId');
  const READ_KEY     = `notif_read_at_discipline_${schoolId}_${userId}`;

  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [readAt,   setReadAt]   = useState(() => localStorage.getItem(READ_KEY));

  const markAllRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem(READ_KEY, now);
    setReadAt(now);
  };

  const fetchNotifs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('school_id', parseInt(schoolId))
      .or('target_type.eq.school,target_type.eq.discipline_master,target_type.eq.staff')
      .order('created_at', { ascending: false });
    setNotifs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifs(); }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel(`dm_notifs_page_${schoolId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        payload => setNotifs(prev => [payload.new, ...prev])
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [schoolId]);

  const unreadCount = notifs.filter(n => !readAt || new Date(n.created_at) > new Date(readAt)).length;

  const filtered = filter === 'unread'
    ? notifs.filter(n => !readAt || new Date(n.created_at) > new Date(readAt))
    : notifs;

  const isUnread = (n) => !readAt || new Date(n.created_at) > new Date(readAt);

  return (
    <>
      <Helmet><title>Notifications · Discipline</title></Helmet>

      <div className="space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <span>{t('dmReceivedNotifs')}</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">{t('notifications') || 'Notifications'}</h1>
            <p className="text-muted-foreground text-sm">{t('dmReceivedNotifsDesc')}</p>
          </div>

          {unreadCount > 0 && (
            <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm font-bold hover:bg-orange-500/15 transition-all shrink-0 self-start sm:self-auto">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </motion.button>
          )}
        </motion.div>

        {/* Stats strip */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3">
          <div className="glass rounded-2xl p-4 border border-white/8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center">
              <Bell className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-black">{notifs.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className={cn('glass rounded-2xl p-4 border flex items-center gap-3',
            unreadCount > 0 ? 'border-orange-500/25 bg-orange-500/6' : 'border-white/8')}>
            <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center',
              unreadCount > 0 ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-white/5 border border-white/10')}>
              <span className={cn('text-lg font-black', unreadCount > 0 ? 'text-orange-400' : 'text-muted-foreground')}>
                {unreadCount}
              </span>
            </div>
            <div>
              <p className="text-2xl font-black">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Unread</p>
            </div>
          </div>
        </motion.div>

        {/* Filter pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
          className="flex gap-2">
          {[
            { key: 'all',    label: 'All' },
            { key: 'unread', label: `Unread ${unreadCount > 0 ? `(${unreadCount})` : ''}` },
          ].map(pill => (
            <button key={pill.key} onClick={() => setFilter(pill.key)}
              className={cn('px-4 py-2 rounded-full text-sm font-semibold border transition-all',
                filter === pill.key
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20')}>
              {pill.label}
            </button>
          ))}
        </motion.div>

        {/* Notification list */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <Skel key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass rounded-2xl border border-white/8">
            <Bell className="h-12 w-12 text-muted-foreground opacity-15" />
            <p className="text-muted-foreground">{t('dmNoNotifs')}</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
            {filtered.map((notif, idx) => {
              const unread = isUnread(notif);
              const tgt    = TARGET_LABELS[notif.target_type] || { label: notif.target_type, color: '#f97316' };
              return (
                <motion.div key={notif.id} variants={fadeUp}
                  className={cn('flex gap-3.5 p-4 rounded-2xl border transition-all',
                    unread ? 'bg-orange-500/6 border-orange-500/20' : 'glass border-white/8 hover:border-white/14')}>
                  {/* Icon */}
                  <div className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: tgt.color + '18', border: `1px solid ${tgt.color}28` }}>
                    <Info className="h-4.5 w-4.5" style={{ color: tgt.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border"
                          style={{ background: tgt.color + '15', borderColor: tgt.color + '30', color: tgt.color }}>
                          {tgt.label}
                        </span>
                        {unread && <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(notif.created_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}
                      </span>
                    </div>
                    <p className="font-bold text-sm leading-snug">{notif.title}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{notif.content}</p>
                    {notif.sender_name && (
                      <p className="text-[11px] text-muted-foreground/60 mt-2 capitalize">
                        {notif.sender_role} · {notif.sender_name}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </>
  );
};

export default DisciplineNotificationsPage;
