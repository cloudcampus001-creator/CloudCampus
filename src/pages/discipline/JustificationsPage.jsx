/**
 * JustificationsPage.jsx  –  Discipline Master
 * ─────────────────────────────────────────────
 * Full redesign:
 *  • Filter pills (All / Pending / Approved / Rejected) with live count badges
 *  • Animated card grid, per-status accent colour, stagger reveal
 *  • GlassPopup bottom-sheet for review (approve / reject)
 *  • File attachment button with external-link icon
 *  • Full translation via t()
 *  • All original Supabase logic preserved exactly
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CheckCircle, XCircle, ExternalLink,
  Download, Loader2, Clock, AlertCircle, User,
  ChevronDown, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── animation helpers ─────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

/* ── status config ─────────────────────────────────────────── */
const STATUS = {
  pending:  { label: 'pending',  color: '#f59e0b', bg: 'bg-amber-500/12',  border: 'border-amber-500/25',  text: 'text-amber-400'  },
  approved: { label: 'approved', color: '#22c55e', bg: 'bg-green-500/12',  border: 'border-green-500/25',  text: 'text-green-400'  },
  rejected: { label: 'rejected', color: '#ef4444', bg: 'bg-red-500/12',    border: 'border-red-500/25',    text: 'text-red-400'    },
};
const getStatus = s => STATUS[s] || STATUS.pending;

/* ── Skeleton ──────────────────────────────────────────────── */
const Skel = () => (
  <div className="animate-pulse glass rounded-2xl p-5 space-y-3 border border-white/8">
    <div className="flex justify-between">
      <div className="h-5 w-20 bg-white/8 rounded-lg" />
      <div className="h-4 w-16 bg-white/5 rounded-lg" />
    </div>
    <div className="h-5 w-40 bg-white/8 rounded-lg" />
    <div className="h-4 w-28 bg-white/5 rounded-lg" />
    <div className="h-16 w-full bg-white/5 rounded-xl" />
    <div className="h-9 w-full bg-white/8 rounded-xl" />
  </div>
);

/* ═══════════════════════════════════════════════════════════ */
const JustificationsPage = () => {
  const { toast }    = useToast();
  const { t }        = useLanguage();
  const userId       = localStorage.getItem('userId');

  const [justifications,      setJustifications]      = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [selectedJust,        setSelectedJust]        = useState(null);
  const [sheetOpen,           setSheetOpen]           = useState(false);
  const [actionLoading,       setActionLoading]       = useState(false);
  const [filter,              setFilter]              = useState('all');

  /* ── fetch ── */
  useEffect(() => { fetchJustifications(); }, []);

  const fetchJustifications = async () => {
    try {
      const { data, error } = await supabase
        .from('justifications')
        .select('*, students(name, matricule)')
        .eq('dm_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setJustifications(data || []);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: 'Could not load justifications.' });
    } finally { setLoading(false); }
  };

  /* ── approve / reject ── */
  const handleAction = async (status) => {
    if (!selectedJust) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('justifications').update({ status }).eq('id', selectedJust.id);
      if (error) throw error;
      toast({
        title: status === 'approved' ? `✓ ${t('approved')}` : `✗ ${t('rejected')}`,
        className: status === 'approved'
          ? 'bg-green-500/10 border-green-500/40 text-green-400'
          : 'bg-red-500/10 border-red-500/40 text-red-400',
      });
      setJustifications(prev =>
        prev.map(j => j.id === selectedJust.id ? { ...j, status } : j)
      );
      setSheetOpen(false);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: 'Failed to update status.' });
    } finally { setActionLoading(false); }
  };

  const openReview = (just) => { setSelectedJust(just); setSheetOpen(true); };

  /* ── filter counts ── */
  const counts = {
    all:      justifications.length,
    pending:  justifications.filter(j => (j.status || 'pending') === 'pending').length,
    approved: justifications.filter(j => j.status === 'approved').length,
    rejected: justifications.filter(j => j.status === 'rejected').length,
  };

  const filtered = filter === 'all'
    ? justifications
    : justifications.filter(j => (j.status || 'pending') === filter);

  const filterPills = [
    { key: 'all',      labelKey: 'filterAll' },
    { key: 'pending',  labelKey: 'filterPending',  color: '#f59e0b' },
    { key: 'approved', labelKey: 'filterApproved', color: '#22c55e' },
    { key: 'rejected', labelKey: 'filterRejected', color: '#ef4444' },
  ];

  /* ── render ── */
  return (
    <>
      <Helmet><title>{t('justificationsTitle')} · CloudCampus</title></Helmet>

      <div className="space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-black tracking-tight">{t('justificationsTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('justificationsSub')}</p>
        </motion.div>

        {/* Filter pills */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2">
          {filterPills.map(pill => (
            <button key={pill.key} onClick={() => setFilter(pill.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border',
                filter === pill.key
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
              )}>
              {t(pill.labelKey)}
              <span className={cn(
                'text-[11px] font-black px-1.5 py-0.5 rounded-full',
                filter === pill.key ? 'bg-orange-500/25 text-orange-300' : 'bg-white/10 text-muted-foreground'
              )}>
                {counts[pill.key]}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skel key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 glass rounded-2xl border border-white/8">
            <FileText className="h-12 w-12 text-muted-foreground opacity-15" />
            <p className="text-muted-foreground">{t('noJustifications')}</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map(item => {
              const st   = getStatus(item.status || 'pending');
              const isPending = (item.status || 'pending') === 'pending';
              return (
                <motion.div key={item.id} variants={fadeUp}
                  className={cn('glass rounded-2xl p-5 border flex flex-col gap-4 transition-all duration-200', st.border,
                    isPending && 'hover:-translate-y-1 hover:shadow-xl cursor-pointer'
                  )}
                  style={isPending ? {} : {}}
                  onClick={isPending ? () => openReview(item) : undefined}
                >
                  {/* Top row: status + date */}
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border', st.bg, st.border, st.text)}>
                      {t(item.status || 'pending')}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Student info */}
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0 font-black text-orange-400">
                      {(item.students?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{item.students?.name}</p>
                      <p className="text-xs text-muted-foreground">{t('parentLabel')}: {item.parent_name}</p>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="bg-white/4 rounded-xl p-3 text-sm text-muted-foreground italic leading-relaxed line-clamp-3 border border-white/6">
                    "{item.message}"
                  </div>

                  {/* Attachment */}
                  {item.file_url && (
                    <button onClick={e => { e.stopPropagation(); window.open(item.file_url, '_blank'); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">
                      <ExternalLink className="h-4 w-4" />
                      {t('viewAttachment')}
                    </button>
                  )}

                  {/* Review CTA — only for pending */}
                  {isPending && (
                    <button onClick={() => openReview(item)}
                      className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', boxShadow: '0 4px 20px rgba(249,115,22,0.25)' }}>
                      {t('reviewCase')}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* ── Review Bottom Sheet ── */}
      <AnimatePresence>
        {sheetOpen && selectedJust && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setSheetOpen(false)} />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto"
            >
              <div className="glass rounded-t-3xl p-6 border border-white/15 border-b-0 shadow-2xl"
                style={{ boxShadow: '0 -16px 60px rgba(249,115,22,0.12)' }}>

                {/* Drag handle */}
                <div className="flex justify-center mb-5">
                  <div className="h-1 w-10 bg-white/20 rounded-full" />
                </div>

                {/* Top accent */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
                  style={{ background: 'linear-gradient(90deg,#f97316,#ef4444)' }} />

                <h2 className="text-xl font-black mb-5">{t('justReviewTitle')}</h2>

                <div className="space-y-4 mb-6">
                  {/* Student */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/8">
                    <div className="h-12 w-12 rounded-2xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center font-black text-xl text-orange-400">
                      {(selectedJust.students?.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{selectedJust.students?.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedJust.students?.matricule}</p>
                      <p className="text-xs text-muted-foreground">{t('parentLabel')}: {selectedJust.parent_name}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{t('reasonProvided')}</p>
                    <p className="text-sm leading-relaxed italic">"{selectedJust.message}"</p>
                  </div>

                  {/* Attachment */}
                  {selectedJust.file_url && (
                    <button onClick={() => window.open(selectedJust.file_url, '_blank')}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-medium transition-all">
                      <ExternalLink className="h-4 w-4" />
                      {t('viewAttachment')}
                    </button>
                  )}

                  {/* Warning */}
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/8 border border-amber-500/20">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300/90 leading-relaxed">{t('justApproveWarning')}</p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleAction('rejected')} disabled={actionLoading}
                    className="py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 6px 24px rgba(239,68,68,0.3)' }}>
                    <XCircle className="h-5 w-5" /> {t('reject')}
                  </button>
                  <button onClick={() => handleAction('approved')} disabled={actionLoading}
                    className="py-3.5 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 6px 24px rgba(34,197,94,0.3)' }}>
                    {actionLoading
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <CheckCircle className="h-5 w-5" />
                    }
                    {t('approve')}
                  </button>
                </div>

                {/* Safe-area spacer */}
                <div className="h-4" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default JustificationsPage;
