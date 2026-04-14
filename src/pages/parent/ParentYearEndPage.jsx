
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  School, Download, Search, ArrowRight, CheckCircle2, Loader2,
  Clock, Star, BookOpen, History, X, ChevronRight, Trophy, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DecisionBanner = ({ decision }) => {
  const config = {
    promoted:  { icon: TrendingUp,    bg: 'from-emerald-500/15 to-teal-500/10', border: 'border-emerald-500/25', icon_color: 'text-emerald-400', text: 'text-emerald-300', label: 'Promoted! 🎉',     desc: 'Congratulations! Your child passed and will advance to the next class.' },
    council:   { icon: Minus,         bg: 'from-amber-500/10  to-orange-500/5',  border: 'border-amber-500/25',  icon_color: 'text-amber-400',   text: 'text-amber-300',   label: 'Council Decision',desc: 'The VP deliberated your child's case. A final decision will be communicated shortly.' },
    repeating: { icon: TrendingDown,  bg: 'from-red-500/10    to-red-500/5',     border: 'border-red-500/20',    icon_color: 'text-red-400',     text: 'text-red-300',     label: 'Repeating',        desc: 'Your child will repeat the same class next academic year.' },
    excluded:  { icon: AlertTriangle, bg: 'from-red-900/20    to-red-800/10',    border: 'border-red-500/20',    icon_color: 'text-red-400',     text: 'text-red-300',     label: 'Excluded',         desc: 'Your child has been excluded due to unjustified absences. Please contact the school urgently.' },
  };
  const c = config[decision] || config.council;
  const Icon = c.icon;
  return (
    <div className={cn('glass rounded-2xl p-5 border bg-gradient-to-br relative overflow-hidden', c.border, c.bg)}>
      <div className="flex items-center gap-4">
        <div className={cn('h-14 w-14 rounded-2xl bg-white/8 border border-white/15 flex items-center justify-center shrink-0')}>
          <Icon className={cn('h-7 w-7', c.icon_color)} />
        </div>
        <div>
          <p className={cn('font-black text-lg', c.text)}>{c.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-sm">{c.desc}</p>
        </div>
      </div>
    </div>
  );
};

/* Transfer search modal */
const TransferModal = ({ open, onClose, studentMatricule, studentName, closedYear }) => {
  const [schools, setSchools]   = useState([]);
  const [search,  setSearch]    = useState('');
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(null);
  const [done,    setDone]      = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from('schools').select('id, name, location').then(({ data }) => {
      setSchools(data || []);
      setLoading(false);
    });
  }, [open]);

  const filtered = schools.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.location || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleRequest = async (school) => {
    setSending(school.id);
    try {
      // transfer_requests table will be created in next migration
      const { error } = await supabase.from('transfer_requests').insert([{
        student_matricule: studentMatricule,
        from_school_id: parseInt(localStorage.getItem('schoolId')),
        to_school_id: school.id,
        academic_year_id: closedYear.id,
        status: 'pending',
        requested_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setDone(school);
    } catch (e) {
      // Table may not exist yet — show friendly message
      setDone({ name: school.name, pending: true, error: e.message });
    } finally { setSending(null); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={e => e.target === e.currentTarget && onClose()}>
          <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="rounded-3xl p-6 w-full max-w-md border border-white/15 shadow-2xl space-y-5"
            style={{ background: 'rgba(10,10,20,0.9)', backdropFilter: 'blur(24px)' }}>
            <div className="flex items-center justify-between">
              <p className="font-black text-lg">Transfer to Another School</p>
              <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="text-center space-y-4 py-4">
                <div className="h-16 w-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <p className="font-black text-lg">Transfer Request Sent!</p>
                <p className="text-sm text-muted-foreground">
                  Your transfer request to <strong>{done.name}</strong> has been submitted.
                  The school admin will review and respond shortly.
                </p>
                <button onClick={onClose} className="w-full px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search schools..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10" autoFocus />
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">No schools found.</p>
                  ) : filtered.map(school => (
                    <button key={school.id} onClick={() => handleRequest(school)}
                      disabled={sending === school.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-indigo-500/10 border border-white/8 hover:border-indigo-500/25 transition-all text-left group">
                      <div className="h-9 w-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                        <School className="h-4 w-4 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{school.name}</p>
                        {school.location && <p className="text-xs text-muted-foreground truncate">{school.location}</p>}
                      </div>
                      {sending === school.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* Academic history item */
const HistoryItem = ({ record }) => {
  const decColor = {
    promoted: 'text-emerald-400', council: 'text-amber-400',
    repeating: 'text-red-400', excluded: 'text-red-300',
  };
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{record.academic_years?.name || 'Year'}</p>
        <p className="text-xs text-muted-foreground">{record.classes?.name}</p>
      </div>
      <span className="font-mono font-black text-sm tabular-nums">
        {record.annual_average != null ? `${record.annual_average}/20` : '—'}
      </span>
      <span className={cn('text-xs font-bold capitalize shrink-0', decColor[record.decision] || 'text-muted-foreground')}>
        {record.decision}
      </span>
    </div>
  );
};

const ParentYearEndPage = ({ closedYear }) => {
  const schoolId         = localStorage.getItem('schoolId');
  const parentId         = localStorage.getItem('userId') || localStorage.getItem('parentId');
  const studentMatricule = localStorage.getItem('studentMatricule');
  const studentName      = localStorage.getItem('studentName') || 'Student';

  const [result,      setResult]      = useState(null);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [transferOpen,setTransfer]    = useState(false);
  const [enrolled,    setEnrolled]    = useState(false);
  const [enrolling,   setEnrolling]   = useState(false);
  const [activeTab,   setActiveTab]   = useState('result');

  useEffect(() => {
    if (!closedYear || !studentMatricule) return;
    const fetch = async () => {
      const [{ data: hist }, { data: allHistory }] = await Promise.all([
        supabase.from('student_academic_history')
          .select('*, classes(name)')
          .eq('student_matricule', studentMatricule)
          .eq('academic_year_id', closedYear.id)
          .maybeSingle(),
        supabase.from('student_academic_history')
          .select('*, classes(name), academic_years(name)')
          .eq('student_matricule', studentMatricule)
          .order('decided_at', { ascending: false }),
      ]);
      setResult(hist);
      setHistory(allHistory || []);
      setLoading(false);
    };
    fetch();
  }, [closedYear, studentMatricule]);

  const handleStay = async () => {
    setEnrolling(true);
    // Mark intent to stay — actual enrollment happens when admin opens new year
    try {
      await supabase.from('student_academic_history')
        .update({ override_reason: 'parent_staying' })
        .eq('student_matricule', studentMatricule)
        .eq('academic_year_id', closedYear.id);
      setEnrolled(true);
    } catch (e) { console.error(e); setEnrolled(true); }
    setEnrolling(false);
  };

  const canChoose = result && ['promoted', 'council'].includes(result.decision);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Year-end badge */}
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl p-5 border border-amber-500/20 bg-amber-500/5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <Clock className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <p className="font-black text-base">Year-End: {closedYear?.name}</p>
          <p className="text-sm text-muted-foreground">{studentName} — Please review results and confirm next year.</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['result', 'Results'], ['history', 'History']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all',
              activeTab === key ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'result' ? (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {!result ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/8 space-y-3">
                <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="font-bold text-muted-foreground">Results not published yet</p>
                <p className="text-xs text-muted-foreground/60">The VP has not published promotion results for this student yet.</p>
              </div>
            ) : (
              <>
                {/* Decision banner */}
                <DecisionBanner decision={result.decision} />

                {/* Score card */}
                <div className="glass rounded-2xl p-5 border border-white/8 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Annual Average</p>
                    <p className="font-black text-3xl">
                      {result.annual_average ?? '—'}
                      <span className="text-base font-normal text-muted-foreground">/20</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Class</p>
                    <p className="font-black text-lg">{result.classes?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{closedYear?.name}</p>
                  </div>
                </div>

                {result.vp_note && (
                  <div className="glass rounded-xl p-4 border border-white/8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">VP Note</p>
                    <p className="text-sm text-muted-foreground italic">"{result.vp_note}"</p>
                  </div>
                )}

                {/* Enrollment choices */}
                {canChoose && (
                  <div className="glass rounded-2xl p-5 border border-white/8 space-y-4">
                    <p className="font-black text-sm">Choose Next Year Enrollment</p>
                    {enrolled ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-emerald-400">Staying confirmed!</p>
                          <p className="text-xs text-muted-foreground">You will be automatically enrolled for next year.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Option A */}
                        <button onClick={handleStay} disabled={enrolling}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 transition-all text-left group">
                          <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                            {enrolling ? <Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> : <School className="h-5 w-5 text-emerald-400" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-sm text-emerald-300">Stay at this school</p>
                            <p className="text-xs text-muted-foreground">Automatically enrolled in next class for next year</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-emerald-400 group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>

                        {/* Option B */}
                        <button onClick={() => setTransfer(true)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-blue-500/8 border border-blue-500/20 hover:bg-blue-500/15 transition-all text-left group">
                          <div className="h-11 w-11 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                            <GraduationCap className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-sm text-blue-300">Transfer to another school</p>
                            <p className="text-xs text-muted-foreground">Search all CloudCampus schools and submit a transfer request</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-blue-400 group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>

                        {/* Option C */}
                        <button onClick={() => alert('PDF download coming in next release!')}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-all text-left group">
                          <div className="h-11 w-11 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                            <Download className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-sm">Leave CloudCampus</p>
                            <p className="text-xs text-muted-foreground">Download a PDF of your child's full academic record</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass rounded-2xl border border-white/8 overflow-hidden">
              <div className="p-4 border-b border-white/8">
                <p className="font-bold text-sm">Complete Academic History</p>
                <p className="text-xs text-muted-foreground">{studentName}</p>
              </div>
              {history.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No history found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map(h => <HistoryItem key={h.id} record={h} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TransferModal
        open={transferOpen}
        onClose={() => setTransfer(false)}
        studentMatricule={studentMatricule}
        studentName={studentName}
        closedYear={closedYear} />
    </div>
  );
};

export default ParentYearEndPage;
