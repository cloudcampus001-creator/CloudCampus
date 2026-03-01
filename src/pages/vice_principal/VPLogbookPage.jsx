/**
 * VPLogbookPage.jsx
 * ──────────────────
 * Drill-down flow:
 *   Level 0 — Subject tiles (with pending count badge)
 *   Level 1 — Entry list for the subject (date, topic, status chip)
 *   Level 2 — Full entry detail
 *             • On open: status "pending" → "viewed" (sets viewed_at)
 *             • VP can type a comment and send it
 *             • Comment creates a notification row targeting the teacher
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, ChevronRight, ChevronLeft, User,
  Loader2, MessageSquare, Send, Eye, Clock, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';

// ─── helpers ─────────────────────────────────────────────────────────────────
const statusConfig = {
  pending:   { label: 'Pending',   color: 'text-yellow-500', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10', icon: Clock },
  viewed:    { label: 'Viewed',    color: 'text-blue-400',   border: 'border-blue-400/40',   bg: 'bg-blue-400/10',   icon: Eye },
  completed: { label: 'Completed', color: 'text-green-500',  border: 'border-green-500/40',  bg: 'bg-green-500/10',  icon: CheckCircle2 },
};
const StatusBadge = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color} ${cfg.border} ${cfg.bg}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

const Breadcrumb = ({ items }) => (
  <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {item.onClick
          ? <button onClick={item.onClick} className="hover:text-foreground underline underline-offset-2 transition-colors">{item.label}</button>
          : <span className="text-foreground font-medium">{item.label}</span>
        }
      </React.Fragment>
    ))}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────
const VPLogbookPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const vpName    = localStorage.getItem('userName') || 'Vice Principal';
  const schoolId  = localStorage.getItem('schoolId');

  // ── drill-down ─────────────────────────────────────────────────────────────
  const [level, setLevel]                   = useState(0);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedEntry, setSelectedEntry]   = useState(null); // full entry object

  // ── data ───────────────────────────────────────────────────────────────────
  const [subjectStats, setSubjectStats]     = useState([]); // [{subject, total, pending}]
  const [entries, setEntries]               = useState([]);  // entries for selected subject
  const [comment, setComment]               = useState('');
  const [sending, setSending]               = useState(false);

  // ── loading ────────────────────────────────────────────────────────────────
  const [loadingStats, setLoadingStats]     = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // ── reset on class change ──────────────────────────────────────────────────
  useEffect(() => {
    setLevel(0); setSelectedSubject(null); setSelectedEntry(null);
    setSubjectStats([]); setEntries([]); setComment('');
  }, [selectedClass]);

  // ── Level 0: load subject stats ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) return;
    const load = async () => {
      setLoadingStats(true);
      try {
        const { data, error } = await supabase
          .from('e_logbook_entries')
          .select('subject, status')
          .eq('class_id', selectedClass);
        if (error) throw error;

        // Group by subject
        const map = new Map(); // subject → {total, pending}
        (data || []).forEach(row => {
          if (!map.has(row.subject)) map.set(row.subject, { total: 0, pending: 0 });
          const s = map.get(row.subject);
          s.total += 1;
          if (!row.status || row.status === 'pending') s.pending += 1;
        });
        setSubjectStats(Array.from(map.entries()).map(([subject, s]) => ({ subject, ...s })).sort((a, b) => a.subject.localeCompare(b.subject)));
      } catch (err) { console.error(err); }
      finally { setLoadingStats(false); }
    };
    load();
  }, [selectedClass]);

  // ── Level 0 → 1 ────────────────────────────────────────────────────────────
  const handlePickSubject = useCallback(async (subject) => {
    setSelectedSubject(subject); setLevel(1); setEntries([]);
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from('e_logbook_entries')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject', subject)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingEntries(false); }
  }, [selectedClass]);

  // ── Level 1 → 2: open entry, mark as viewed ────────────────────────────────
  const handleOpenEntry = useCallback(async (entry) => {
    setSelectedEntry(entry); setLevel(2); setComment('');

    // Mark as viewed if still pending
    if (!entry.status || entry.status === 'pending') {
      try {
        const { error } = await supabase
          .from('e_logbook_entries')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', entry.id);
        if (!error) {
          // Update local state so the badge updates immediately
          const updated = { ...entry, status: 'viewed', viewed_at: new Date().toISOString() };
          setSelectedEntry(updated);
          setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
          // Also update subject stats (pending count -1)
          setSubjectStats(prev => prev.map(s =>
            s.subject === entry.subject ? { ...s, pending: Math.max(0, s.pending - 1) } : s
          ));
        }
      } catch (err) { console.error(err); }
    }
  }, []);

  // ── Send comment ───────────────────────────────────────────────────────────
  const handleSendComment = async () => {
    if (!comment.trim() || !selectedEntry) return;
    setSending(true);
    try {
      // 1. Save comment on the logbook entry
      const { error: updateErr } = await supabase
        .from('e_logbook_entries')
        .update({ vp_comment: comment.trim() })
        .eq('id', selectedEntry.id);
      if (updateErr) throw updateErr;

      // 2. Send notification to the teacher
      const { error: notifErr } = await supabase
        .from('notifications')
        .insert({
          sender_name:  vpName,
          sender_role:  'vice_principal',
          title:        `Comment on your logbook — ${selectedEntry.subject}`,
          content:      `Re: "${selectedEntry.topic}"\n\n${comment.trim()}`,
          target_type:  'teacher',
          target_id:    selectedEntry.teacher_id,
          school_id:    parseInt(schoolId),
          created_at:   new Date().toISOString(),
        });
      if (notifErr) throw notifErr;

      // Update local state
      setSelectedEntry(prev => ({ ...prev, vp_comment: comment.trim() }));
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, vp_comment: comment.trim() } : e));
      setComment('');
      toast({ title: 'Comment sent', description: `${selectedEntry.teacher_name} will receive a notification.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally { setSending(false); }
  };

  const goToLevel = (n) => {
    setLevel(n);
    if (n < 2) { setSelectedEntry(null); setComment(''); }
    if (n < 1) { setSelectedSubject(null); setEntries([]); }
  };

  const breadcrumbs = [
    { label: 'Subjects', onClick: level > 0 ? () => goToLevel(0) : null },
    ...(level >= 1 && selectedSubject ? [{ label: selectedSubject, onClick: level > 1 ? () => goToLevel(1) : null }] : []),
    ...(level >= 2 && selectedEntry   ? [{ label: selectedEntry.topic }] : []),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <BookOpen className="w-16 h-16 mb-4 opacity-20" />
        <p>Please select a class to review logbook entries.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Logbook Review - Vice Principal</title></Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">E-Logbook Review</h1>
          <p className="text-muted-foreground">Monitoring daily academic activities, organised by subject.</p>
        </div>

        {/* Breadcrumb + back */}
        {level > 0 && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => goToLevel(level - 1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Breadcrumb items={breadcrumbs} />
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ── Level 0: Subject tiles ──────────────────────────────── */}
          {level === 0 && (
            <motion.div key="l0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {loadingStats ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></div>
              ) : subjectStats.length === 0 ? (
                <Card className="glass">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No logbook entries found for this class yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {subjectStats.map(({ subject, total, pending }) => (
                    <motion.button
                      key={subject}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => handlePickSubject(subject)}
                      className="relative flex items-center gap-4 p-5 rounded-2xl border text-left transition-all
                        bg-card/40 border-white/10 hover:bg-card/70 hover:border-pink-500/40 hover:shadow-lg"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-pink-500/20 flex items-center justify-center shrink-0">
                        <span className="text-pink-400 font-black text-xl">{subject.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{total} entr{total !== 1 ? 'ies' : 'y'}</p>
                      </div>
                      {pending > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-bold">
                          {pending}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Level 1: Entry list for subject ────────────────────── */}
          {level === 1 && (
            <motion.div key="l1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {loadingEntries ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-pink-500" /></div>
              ) : entries.length === 0 ? (
                <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">No entries for {selectedSubject}.</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {entries.map(entry => (
                    <motion.button
                      key={entry.id}
                      onClick={() => handleOpenEntry(entry)}
                      whileHover={{ x: 4 }}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 bg-card/40 hover:bg-card/70 hover:border-pink-500/30 transition-all text-left gap-4"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold truncate">{entry.topic}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.sub_topics}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" /> {entry.teacher_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {entry.vp_comment && (
                            <span className="flex items-center gap-1 text-xs text-blue-400">
                              <MessageSquare className="h-3 w-3" /> Commented
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <StatusBadge status={entry.status || 'pending'} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Level 2: Full entry detail ──────────────────────────── */}
          {level === 2 && selectedEntry && (
            <motion.div key="l2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="glass">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">{selectedEntry.topic}</CardTitle>
                      <CardDescription className="mt-1">{selectedSubject}</CardDescription>
                    </div>
                    <StatusBadge status={selectedEntry.status || 'pending'} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {selectedEntry.teacher_name || 'Unknown teacher'}</span>
                    <span>{new Date(selectedEntry.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    {selectedEntry.viewed_at && (
                      <span className="flex items-center gap-1.5 text-blue-400">
                        <Eye className="h-4 w-4" /> Viewed {new Date(selectedEntry.viewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sub-topics */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sub-topics covered</h3>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedEntry.sub_topics || <span className="italic text-muted-foreground">None specified.</span>}
                    </div>
                  </div>

                  {/* Existing VP comment (read-only view if already sent) */}
                  {selectedEntry.vp_comment && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-400" /> Your previous comment
                      </h3>
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200 whitespace-pre-wrap">
                        {selectedEntry.vp_comment}
                      </div>
                    </div>
                  )}

                  {/* Comment box */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-pink-400" />
                      {selectedEntry.vp_comment ? 'Update comment' : 'Add a comment'}
                    </h3>
                    <Textarea
                      placeholder={`Leave feedback for ${selectedEntry.teacher_name || 'the teacher'}…`}
                      className="min-h-[100px] bg-background/50 border-white/10 focus:border-pink-500/50 resize-none"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground">
                        A notification will be sent to <strong>{selectedEntry.teacher_name || 'the teacher'}</strong>.
                      </p>
                      <Button
                        onClick={handleSendComment}
                        disabled={!comment.trim() || sending}
                        className="bg-pink-500 hover:bg-pink-600 gap-2"
                        size="sm"
                      >
                        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send Comment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </>
  );
};

export default VPLogbookPage;
