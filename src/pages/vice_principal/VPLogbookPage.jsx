/**
 * VPLogbookPage.jsx — Vice Principal
 * Drill-down flow:
 *   Level 0 — Subject tiles (pending count badge)
 *   Level 1 — Entry list for the subject
 *   Level 2 — Full entry detail + VP comment
 *
 * Design: purple/pink glass, PageTransition, all strings via t()
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronRight, ChevronLeft, User,
  Loader2, MessageSquare, Send, Eye, Clock, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Textarea } from '@/components/ui/textarea';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

/* ── Status helpers ─────────────────────────────────────── */
const STATUS_CFG = {
  pending:   { label: 'statusPendingLog', color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', icon: Clock      },
  viewed:    { label: 'statusViewed',     color: 'text-blue-400',   border: 'border-blue-400/30',   bg: 'bg-blue-400/10',   icon: Eye        },
  completed: { label: 'statusCompleted',  color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10',  icon: CheckCircle2},
};

const StatusPill = ({ status, t }) => {
  const cfg  = STATUS_CFG[status] || STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.color, cfg.border, cfg.bg)}>
      <Icon className="h-3 w-3" /> {t(cfg.label)}
    </span>
  );
};

const Breadcrumb = ({ items }) => (
  <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />}
        {item.onClick
          ? <button onClick={item.onClick} className="hover:text-purple-400 underline underline-offset-2 transition-colors font-medium">{item.label}</button>
          : <span className="text-foreground font-bold">{item.label}</span>
        }
      </React.Fragment>
    ))}
  </div>
);

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const VPLogbookPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const vpName   = localStorage.getItem('userName') || 'Vice Principal';
  const schoolId = localStorage.getItem('schoolId');

  const [level,           setLevel]           = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedEntry,   setSelectedEntry]   = useState(null);
  const [subjectStats,    setSubjectStats]    = useState([]);
  const [entries,         setEntries]         = useState([]);
  const [comment,         setComment]         = useState('');
  const [sending,         setSending]         = useState(false);
  const [loadingStats,    setLoadingStats]    = useState(false);
  const [loadingEntries,  setLoadingEntries]  = useState(false);

  /* reset on class change */
  useEffect(() => {
    setLevel(0); setSelectedSubject(null); setSelectedEntry(null);
    setSubjectStats([]); setEntries([]); setComment('');
  }, [selectedClass]);

  /* Level 0: subject stats */
  useEffect(() => {
    if (!selectedClass) return;
    setLoadingStats(true);
    supabase.from('e_logbook_entries').select('subject, status').eq('class_id', selectedClass)
      .then(({ data, error }) => {
        if (error) { console.error(error); setLoadingStats(false); return; }
        const map = new Map();
        (data || []).forEach(row => {
          if (!map.has(row.subject)) map.set(row.subject, { total: 0, pending: 0 });
          const s = map.get(row.subject);
          s.total += 1;
          if (!row.status || row.status === 'pending') s.pending += 1;
        });
        setSubjectStats(Array.from(map.entries())
          .map(([subject, s]) => ({ subject, ...s }))
          .sort((a, b) => a.subject.localeCompare(b.subject)));
        setLoadingStats(false);
      });
  }, [selectedClass]);

  /* Level 0 → 1 */
  const handlePickSubject = useCallback(async (subject) => {
    setSelectedSubject(subject); setLevel(1); setEntries([]);
    setLoadingEntries(true);
    const { data } = await supabase.from('e_logbook_entries').select('*')
      .eq('class_id', selectedClass).eq('subject', subject)
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setLoadingEntries(false);
  }, [selectedClass]);

  /* Level 1 → 2: mark viewed */
  const handleOpenEntry = useCallback(async (entry) => {
    setSelectedEntry(entry); setLevel(2); setComment('');
    if (!entry.status || entry.status === 'pending') {
      const { error } = await supabase.from('e_logbook_entries')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', entry.id);
      if (!error) {
        const updated = { ...entry, status: 'viewed', viewed_at: new Date().toISOString() };
        setSelectedEntry(updated);
        setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
        setSubjectStats(prev => prev.map(s =>
          s.subject === entry.subject ? { ...s, pending: Math.max(0, s.pending - 1) } : s
        ));
      }
    }
  }, []);

  /* Send comment */
  const handleSendComment = async () => {
    if (!comment.trim() || !selectedEntry) return;
    setSending(true);
    try {
      const { error: updateErr } = await supabase.from('e_logbook_entries')
        .update({ vp_comment: comment.trim() }).eq('id', selectedEntry.id);
      if (updateErr) throw updateErr;
      await supabase.from('notifications').insert({
        sender_name: vpName, sender_role: 'vice_principal',
        title:   `Comment on your logbook — ${selectedEntry.subject}`,
        content: `Re: "${selectedEntry.topic}"\n\n${comment.trim()}`,
        target_type: 'teacher', target_id: selectedEntry.teacher_id,
        school_id: parseInt(schoolId), created_at: new Date().toISOString(),
      });
      setSelectedEntry(prev => ({ ...prev, vp_comment: comment.trim() }));
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, vp_comment: comment.trim() } : e));
      setComment('');
      toast({ title: t('commentSent'), description: t('commentSentDesc') });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: t('error'), description: t('commentError') });
    } finally { setSending(false); }
  };

  const goToLevel = (n) => {
    setLevel(n);
    if (n < 2) { setSelectedEntry(null); setComment(''); }
    if (n < 1) { setSelectedSubject(null); setEntries([]); }
  };

  const breadcrumbs = [
    { label: t('subjects'), onClick: level > 0 ? () => goToLevel(0) : null },
    ...(level >= 1 && selectedSubject ? [{ label: selectedSubject, onClick: level > 1 ? () => goToLevel(1) : null }] : []),
    ...(level >= 2 && selectedEntry   ? [{ label: selectedEntry.topic }] : []),
  ];

  /* ── Empty state ──────────────────────────────────── */
  if (!selectedClass) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
          <div className="p-5 rounded-3xl bg-white/5"><BookOpen className="h-10 w-10 text-muted-foreground opacity-30" /></div>
          <p className="text-sm text-muted-foreground">{t('noClassSelected')}</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <>
      <Helmet><title>{t('eLogbookReview')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              {t('eLogbookReview')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t('eLogbookDesc')}</p>
          </motion.div>

          {/* Breadcrumb + back */}
          {level > 0 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3">
              <button onClick={() => goToLevel(level - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all active:scale-95">
                <ChevronLeft className="h-4 w-4" /> {t('back')}
              </button>
              <Breadcrumb items={breadcrumbs} />
            </motion.div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Level 0: Subject tiles ───────────────── */}
            {level === 0 && (
              <motion.div key="l0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {loadingStats ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[0,1,2,3,4,5].map(i => (
                      <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : subjectStats.length === 0 ? (
                  <div className="glass rounded-2xl p-14 flex flex-col items-center text-center gap-4">
                    <div className="p-5 rounded-3xl bg-white/5"><BookOpen className="h-9 w-9 text-muted-foreground opacity-30" /></div>
                    <p className="text-sm text-muted-foreground">{t('noLogbookEntries')}</p>
                  </div>
                ) : (
                  <motion.div variants={stagger} initial="hidden" animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {subjectStats.map(({ subject, total, pending }) => (
                      <motion.button key={subject} variants={fadeUp}
                        onClick={() => handlePickSubject(subject)}
                        className="relative group flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/3 hover:bg-purple-500/6 hover:border-purple-500/35 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 text-left active:scale-[0.98]">
                        {/* Subject initial */}
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center shrink-0">
                          <span className="text-purple-300 font-black text-xl">{subject.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {total} {total !== 1 ? t('entries').toLowerCase() : t('entry').toLowerCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {pending > 0 && (
                            <span className="flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-black shadow-md shadow-yellow-500/30">
                              {pending}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Level 1: Entry list ──────────────────── */}
            {level === 1 && (
              <motion.div key="l1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {loadingEntries ? (
                  <div className="space-y-3">
                    {[0,1,2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
                  </div>
                ) : entries.length === 0 ? (
                  <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm">
                    {t('noEntriesForSubject')}
                  </div>
                ) : (
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
                    {entries.map((entry) => (
                      <motion.button key={entry.id} variants={fadeUp}
                        onClick={() => handleOpenEntry(entry)}
                        className="group w-full flex items-center justify-between p-4 rounded-2xl border border-white/8 bg-white/3 hover:bg-purple-500/5 hover:border-purple-500/25 transition-all text-left gap-4 active:scale-[0.99]">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold truncate">{entry.topic}</p>
                          {entry.sub_topics && (
                            <p className="text-xs text-muted-foreground truncate">{entry.sub_topics}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" /> {entry.teacher_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {entry.vp_comment && (
                              <span className="flex items-center gap-1 text-xs text-blue-400">
                                <MessageSquare className="h-3 w-3" /> {t('commented')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          <StatusPill status={entry.status || 'pending'} t={t} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Level 2: Full entry detail ───────────── */}
            {level === 2 && selectedEntry && (
              <motion.div key="l2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="glass rounded-2xl p-7 space-y-6 border-t-2 border-t-purple-500/60">

                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-xl font-black">{selectedEntry.topic}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{selectedSubject}</p>
                    </div>
                    <StatusPill status={selectedEntry.status || 'pending'} t={t} />
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {selectedEntry.teacher_name || '—'}</span>
                    <span>{new Date(selectedEntry.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    {selectedEntry.viewed_at && (
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <Eye className="h-4 w-4" /> {t('markAsViewed')} {new Date(selectedEntry.viewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Sub-topics */}
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">{t('subTopicsLabel')}</p>
                    <div className="p-4 rounded-xl bg-white/4 border border-white/8 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedEntry.sub_topics || <span className="italic text-muted-foreground">{t('noneSpecified')}</span>}
                    </div>
                  </div>

                  {/* Existing VP comment */}
                  {selectedEntry.vp_comment && (
                    <div>
                      <p className="text-[10px] font-bold text-blue-400/70 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> {t('yourPreviousComment')}
                      </p>
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200 whitespace-pre-wrap leading-relaxed">
                        {selectedEntry.vp_comment}
                      </div>
                    </div>
                  )}

                  {/* Comment textarea */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-purple-400/70 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {selectedEntry.vp_comment ? t('updateComment') : t('addComment')}
                    </p>
                    <Textarea
                      placeholder={`${t('commentPlaceholder').replace('the teacher', selectedEntry.teacher_name || 'the teacher')}`}
                      className="bg-white/5 border-white/10 focus:border-purple-500/50 min-h-[110px] resize-none rounded-xl"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground">
                        {t('commentNotice')} <span className="font-semibold text-foreground">{selectedEntry.teacher_name || 'the teacher'}</span>.
                      </p>
                      <button
                        onClick={handleSendComment}
                        disabled={!comment.trim() || sending}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-semibold shadow-md shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-50 shrink-0">
                        {sending
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('submitting')}</>
                          : <><Send className="h-3.5 w-3.5" /> {t('sendComment')}</>}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </PageTransition>
    </>
  );
};

export default VPLogbookPage;
