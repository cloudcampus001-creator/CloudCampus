/**
 * VPReportCardsPage.jsx
 * VP views all students' report cards per class + manages comments
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, Search, Loader2, Users, ChevronDown, ChevronUp,
  MessageSquare, Award, X, Save, Printer, RefreshCw,
  GraduationCap, Sparkles, TrendingUp,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import { ReportCardView } from '@/components/ReportCardView';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

const fmt = (n) => n != null ? Number(n).toFixed(2) : '—';

const scoreColor = (avg) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= 10)  return 'text-emerald-400';
  if (avg >= 8)   return 'text-amber-400';
  return 'text-red-400';
};

const CONDUCT_OPTIONS = ['Excellent','Très Bien','Bien','Assez Bien','Passable','À améliorer'];

/* ── Comment modal ────────────────────────────────────────── */
const CommentModal = ({ open, onClose, student, yearId, termId, schoolId, onSaved }) => {
  const { toast }    = useToast();
  const [saving,     setSaving]     = useState(false);
  const [vpComment,  setVpComment]  = useState('');
  const [tComment,   setTComment]   = useState('');
  const [conduct,    setConduct]    = useState('');
  const [loaded,     setLoaded]     = useState(false);

  useEffect(() => {
    if (!open || !student || !yearId) return;
    setLoaded(false);
    supabase.from('report_card_comments')
      .select('*')
      .eq('student_matricule', student.matricule)
      .eq('academic_year_id', yearId)
      .is(termId ? 'term_id' : null, termId || null)
      .maybeSingle()
      .then(({ data }) => {
        setVpComment(data?.vp_comment || '');
        setTComment(data?.teacher_comment || '');
        setConduct(data?.conduct || '');
        setLoaded(true);
      });
  }, [open, student, yearId, termId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      student_matricule: student.matricule,
      academic_year_id: yearId,
      term_id: termId || null,
      school_id: +localStorage.getItem('schoolId'),
      vp_comment: vpComment || null,
      teacher_comment: tComment || null,
      conduct: conduct || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('report_card_comments').upsert(payload, {
      onConflict: 'student_matricule,academic_year_id,term_id',
    });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    toast({ title: '✅ Commentaires sauvegardés' });
    onSaved?.();
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass rounded-3xl p-6 w-full max-w-lg border border-white/15 shadow-2xl shadow-black/50 space-y-5"
        style={{ background: 'rgba(10,10,20,0.90)', backdropFilter: 'blur(24px)' }}>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <p className="font-black text-base">Commentaires</p>
              <p className="text-xs text-muted-foreground">{student?.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!loaded ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Appréciation du Titulaire / Prof. Principal</label>
              <textarea value={tComment} onChange={e => setTComment(e.target.value)} rows={3}
                placeholder="Observations du professeur principal…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Appréciation du Censeur / Proviseur</label>
              <textarea value={vpComment} onChange={e => setVpComment(e.target.value)} rows={3}
                placeholder="Observations du Censeur…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Conduite</label>
              <div className="flex flex-wrap gap-2">
                {CONDUCT_OPTIONS.map(opt => (
                  <button key={opt} type="button" onClick={() => setConduct(c => c === opt ? '' : opt)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                      conduct === opt
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/30'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold transition-all">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

/* ═══════════════════ MAIN PAGE ══════════════════════════════ */
const VPReportCardsPage = () => {
  const { toast }  = useToast();
  const schoolId   = localStorage.getItem('schoolId');
  const vpId       = localStorage.getItem('userId');

  const [classes,       setClasses]       = useState([]);
  const [terms,         setTerms]         = useState([]);
  const [currentYear,   setCurrentYear]   = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTerm,  setSelectedTerm]  = useState(null); // null = annual
  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [search,        setSearch]        = useState('');

  const [commentTarget, setCommentTarget] = useState(null); // { student }
  const [viewTarget,    setViewTarget]    = useState(null); // { student } → full card view

  /* ── Init ── */
  useEffect(() => {
    if (!schoolId) return;
    const init = async () => {
      const [{ data: year }, { data: cls }] = await Promise.all([
        supabase.from('academic_years').select('*').eq('school_id', +schoolId).eq('is_current', true).maybeSingle(),
        supabase.from('classes').select('id,name').eq('school_id', +schoolId).eq('vp_id', +vpId).order('name'),
      ]);
      setCurrentYear(year || null);
      setClasses(cls || []);
      if (cls?.length === 1) setSelectedClass(cls[0]);
      if (year) {
        const { data: t } = await supabase.from('terms').select('*').eq('academic_year_id', year.id).order('term_index');
        setTerms(t || []);
      }
    };
    init();
  }, [schoolId, vpId]);

  /* ── Load students with averages ── */
  const loadStudents = useCallback(async () => {
    if (!selectedClass || !currentYear) return;
    setLoading(true);
    try {
      // Get students in this class
      const { data: enrollments } = await supabase.from('student_enrollments')
        .select('student_matricule, students(name)')
        .eq('class_id', selectedClass.id)
        .eq('academic_year_id', currentYear.id);

      let list = [];
      if (enrollments?.length) {
        list = enrollments.map(e => ({ matricule: e.student_matricule, name: e.students?.name || e.student_matricule }));
      } else {
        const { data: fb } = await supabase.from('students').select('matricule,name').eq('class_id', selectedClass.id).order('name');
        list = fb || [];
      }

      if (!list.length) { setStudents([]); setLoading(false); return; }

      // Fetch marks for all students in this class
      const matricules = list.map(s => s.matricule);
      const { data: allMarks } = await supabase.from('student_marks')
        .select('student_matricule,subject,mark,total_marks,sequence_id')
        .in('student_matricule', matricules)
        .eq('academic_year_id', currentYear.id);

      const { data: sequences } = await supabase.from('sequences')
        .select('id,term_id').eq('academic_year_id', currentYear.id);
      const { data: coeffRows } = await supabase.from('subject_coefficients')
        .select('subject_name,coefficient').eq('class_id', selectedClass.id);

      const coeffMap = {};
      (coeffRows||[]).forEach(c => { coeffMap[c.subject_name] = c.coefficient; });

      const { data: comments } = await supabase.from('report_card_comments')
        .select('student_matricule,conduct')
        .eq('academic_year_id', currentYear.id)
        .in('student_matricule', matricules);

      const marksMap = {};
      (allMarks||[]).forEach(m => {
        if (!marksMap[m.student_matricule]) marksMap[m.student_matricule] = [];
        marksMap[m.student_matricule].push(m);
      });
      const commentMap = {};
      (comments||[]).forEach(c => { commentMap[c.student_matricule] = c; });

      // Compute averages
      const seqsArr = sequences || [];
      const termsArr = terms;

      const withAvg = list.map(s => {
        const marks  = marksMap[s.matricule] || [];
        const allSubjects = [...new Set(marks.map(m => m.subject))];
        let tw = 0, tc = 0;

        allSubjects.forEach(subj => {
          // Annual average for subject
          const tAvgs = termsArr.map(t => {
            const seqs = seqsArr.filter(sq => sq.term_id === t.id);
            const seqAvgs = seqs.map(sq => {
              const r = marks.filter(m => m.sequence_id === sq.id && m.subject === subj);
              if (!r.length) return null;
              const vals = r.map(m => (m.mark/(m.total_marks||20))*20);
              return vals.reduce((a,b)=>a+b,0)/vals.length;
            }).filter(v=>v!=null);
            return seqAvgs.length ? seqAvgs.reduce((a,b)=>a+b,0)/seqAvgs.length : null;
          }).filter(v=>v!=null);
          const annAvg = tAvgs.length ? tAvgs.reduce((a,b)=>a+b,0)/tAvgs.length : null;
          if (annAvg != null) {
            const c = coeffMap[subj] || 1;
            tw += annAvg * c; tc += c;
          }
        });

        const generalAvg = tc > 0 ? Math.round((tw/tc)*100)/100 : null;
        return { ...s, generalAvg, conduct: commentMap[s.matricule]?.conduct || null };
      });

      // Compute ranks
      const sorted = [...withAvg].sort((a,b)=>{
        if (a.generalAvg==null&&b.generalAvg==null) return 0;
        if (a.generalAvg==null) return 1;
        if (b.generalAvg==null) return -1;
        return b.generalAvg - a.generalAvg;
      });
      const rankMap = {};
      sorted.forEach((s,i)=>{ rankMap[s.matricule] = i+1; });
      const final = withAvg.map(s => ({ ...s, rank: rankMap[s.matricule] }));
      final.sort((a,b)=>(a.rank||999)-(b.rank||999));
      setStudents(final);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClass, currentYear, terms, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule.toLowerCase().includes(search.toLowerCase()));

  /* ── If viewing a single student's card ── */
  if (viewTarget) return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-4">
        <ReportCardView
          studentMatricule={viewTarget.matricule}
          yearId={currentYear?.id}
          classId={selectedClass?.id}
          schoolId={schoolId}
          termId={selectedTerm?.id || null}
          onClose={() => setViewTarget(null)}
        />
      </div>
    </PageTransition>
  );

  return (
    <PageTransition>
      <Helmet><title>Bulletins de Notes · CloudCampus</title></Helmet>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <BookMarked className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-black text-2xl text-foreground">Bulletins de Notes</h1>
              <p className="text-sm text-muted-foreground">{currentYear?.name || 'Chargement…'}</p>
            </div>
          </div>
        </motion.div>

        {/* Selectors */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="glass rounded-2xl p-4 border border-white/10 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Class */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Classe</label>
              <div className="flex flex-wrap gap-2">
                {classes.map(c => (
                  <button key={c.id} onClick={() => setSelectedClass(c)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                      selectedClass?.id === c.id
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                    {c.name}
                  </button>
                ))}
                {classes.length === 0 && <p className="text-xs text-muted-foreground">Aucune classe assignée</p>}
              </div>
            </div>
            {/* Term */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Période</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedTerm(null)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                    !selectedTerm
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                  Bilan Annuel
                </button>
                {terms.map(t => (
                  <button key={t.id} onClick={() => setSelectedTerm(t)}
                    className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                      selectedTerm?.id === t.id
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un élève…"
              className="pl-9 bg-white/5 border-white/10 focus:border-indigo-500/50 rounded-xl" />
          </div>
        </motion.div>

        {/* Student list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
        ) : !selectedClass ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Sélectionnez une classe pour voir les bulletins</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Aucun élève trouvé</div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
            {/* Summary */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{filtered.length}</span> élèves</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {students.filter(s=>s.generalAvg!=null&&s.generalAvg>=10).length} admissibles
                </span>
              </div>
            </div>

            {filtered.map(student => (
              <motion.div key={student.matricule} variants={fadeUp}
                className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  {/* Rank badge */}
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm border shrink-0',
                    student.rank === 1 ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' :
                    student.rank <= 3 ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' :
                    'bg-white/5 border-white/10 text-muted-foreground')}>
                    {student.rank}e
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.matricule}</p>
                  </div>

                  {/* Average */}
                  <div className="text-right shrink-0">
                    <p className={cn('text-xl font-black', scoreColor(student.generalAvg))}>
                      {fmt(student.generalAvg)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ 20</p>
                  </div>

                  {/* Conduct */}
                  {student.conduct && (
                    <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 shrink-0">
                      {student.conduct}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setCommentTarget(student)}
                      className="h-8 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Note
                    </button>
                    <button
                      onClick={() => setViewTarget(student)}
                      className="h-8 px-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-xs font-semibold text-indigo-300 transition-all flex items-center gap-1.5">
                      <BookMarked className="h-3.5 w-3.5" /> Bulletin
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Comment modal */}
      <AnimatePresence>
        {commentTarget && (
          <CommentModal
            open={!!commentTarget}
            onClose={() => setCommentTarget(null)}
            student={commentTarget}
            yearId={currentYear?.id}
            termId={selectedTerm?.id || null}
            schoolId={schoolId}
            onSaved={loadStudents}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default VPReportCardsPage;
