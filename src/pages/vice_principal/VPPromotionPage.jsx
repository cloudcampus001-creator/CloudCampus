/**
 * VPPromotionPage.jsx
 * The VP's promotion deliberation dashboard.
 * - Fetches all students in a class with their computed general average
 * - Shows suggested decision from the DB function
 * - VP sets final decision + optional note per student
 * - Bulk promote all clear cases in one click
 * - Finalize locks results into student_academic_history
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, Loader2, Search, Users, Lock, Unlock,
  ChevronDown, ChevronUp, Flag, BarChart3, Sparkles,
  RefreshCw, Info, Pencil, X, Save, Check,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

/* ── Animations ──────────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

/* ── Decision config ─────────────────────────────────────── */
const DECISIONS = {
  promoted:  { label: 'Promoted',         icon: TrendingUp,    bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-400', btn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30' },
  council:   { label: 'Council Decision', icon: Minus,         bg: 'bg-amber-500/15',   border: 'border-amber-500/25',   text: 'text-amber-400',   btn: 'bg-amber-500/20  hover:bg-amber-500/30  text-amber-300  border-amber-500/30'  },
  repeating: { label: 'Repeating',        icon: TrendingDown,  bg: 'bg-red-500/15',     border: 'border-red-500/20',     text: 'text-red-400',     btn: 'bg-red-500/15    hover:bg-red-500/25    text-red-300    border-red-500/20'    },
  excluded:  { label: 'Excluded',         icon: AlertTriangle, bg: 'bg-red-900/20',     border: 'border-red-800/30',     text: 'text-red-300',     btn: 'bg-red-900/20    hover:bg-red-900/30    text-red-300    border-red-800/30'    },
};

const DecisionPill = ({ d, size = 'sm' }) => {
  const cfg = DECISIONS[d];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-bold border capitalize',
      size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
      cfg.bg, cfg.border, cfg.text
    )}>
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {cfg.label}
    </span>
  );
};

/* ── Score color ─────────────────────────────────────────── */
const scoreColor = (avg, threshold = 10) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= threshold) return 'text-emerald-400';
  if (avg >= threshold * 0.8) return 'text-amber-400';
  return 'text-red-400';
};

/* ── Stat card ───────────────────────────────────────────── */
const MiniStat = ({ label, value, color }) => (
  <div className={cn('glass rounded-2xl p-4 border text-center', color)}>
    <p className="text-2xl font-black">{value}</p>
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mt-1">{label}</p>
  </div>
);

/* ── Decision selector inline ────────────────────────────── */
const DecisionSelector = ({ current, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {Object.entries(DECISIONS).map(([key, cfg]) => {
      const Icon = cfg.icon;
      const active = current === key;
      return (
        <button key={key} type="button" onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all',
            active ? `${cfg.bg} ${cfg.border} ${cfg.text} ring-1 ring-offset-1 ring-offset-background ring-current/30` : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'
          )}>
          <Icon className="h-3 w-3" /> {cfg.label}
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════ */
const VPPromotionPage = () => {
  const { toast }  = useToast();
  const schoolId   = localStorage.getItem('schoolId');
  const vpId       = localStorage.getItem('userId');
  const vpName     = localStorage.getItem('userName') || 'Vice Principal';

  /* ── State ──────────────────────────────────────────────── */
  const [classes,       setClasses]       = useState([]);
  const [currentYear,   setCurrentYear]   = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students,      setStudents]      = useState([]);   // [{ matricule, name, avg, suggested, final, note, saved }]
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [finalizing,    setFinalizing]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [filterDec,     setFilterDec]     = useState('all');
  const [expandedId,    setExpandedId]    = useState(null); // which student is expanded

  // Track local overrides: { [matricule]: { decision, note } }
  const [overrides, setOverrides] = useState({});

  /* ── Fetch year + VP classes ─────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    const init = async () => {
      const [{ data: year }, { data: cls }] = await Promise.all([
        supabase.from('academic_years').select('*')
          .eq('school_id', parseInt(schoolId)).eq('is_current', true).maybeSingle(),
        supabase.from('classes').select('id, name, class_level_id, class_levels(name, level_index, is_terminal, cycle)')
          .eq('school_id', parseInt(schoolId)).eq('vp_id', parseInt(vpId)).order('name'),
      ]);
      setCurrentYear(year || null);
      setClasses(cls || []);
      if (cls?.length === 1) setSelectedClass(cls[0]);
    };
    init();
  }, [schoolId, vpId]);

  /* ── Load students + averages for selected class ─────────── */
  const loadStudents = useCallback(async () => {
    if (!selectedClass || !currentYear) return;
    setLoading(true);
    setOverrides({});
    try {
      // 1. Get students enrolled this year in this class
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('student_matricule, students(name)')
        .eq('class_id', selectedClass.id)
        .eq('academic_year_id', currentYear.id);

      // Fallback: if student_enrollments is empty, get from students.class_id directly
      let studentList = [];
      if (enrollments && enrollments.length > 0) {
        studentList = enrollments.map(e => ({
          matricule: e.student_matricule,
          name: e.students?.name || e.student_matricule,
        }));
      } else {
        const { data: fallback } = await supabase.from('students')
          .select('matricule, name').eq('class_id', selectedClass.id).order('name');
        studentList = fallback || [];
      }

      if (studentList.length === 0) {
        setStudents([]); setLoading(false); return;
      }

      // 2. For each student, call the average function + check existing history
      const matricules = studentList.map(s => s.matricule);

      // Get existing promotion decisions (if VP already ran this)
      const { data: existing } = await supabase
        .from('student_academic_history')
        .select('student_matricule, decision, vp_note, annual_average, is_overridden')
        .eq('academic_year_id', currentYear.id)
        .in('student_matricule', matricules);

      const existingMap = {};
      (existing || []).forEach(e => { existingMap[e.student_matricule] = e; });

      // 3. Compute averages using our DB function via RPC
      // We call get_general_annual_average for each student
      const withAverages = await Promise.all(studentList.map(async s => {
        let avg = null;
        let suggested = null;
        try {
          const { data: avgData } = await supabase.rpc('get_general_annual_average', {
            p_student_matricule: s.matricule,
            p_academic_year_id: currentYear.id,
          });
          avg = avgData;

          const { data: decData } = await supabase.rpc('get_promotion_decision', {
            p_student_matricule: s.matricule,
            p_academic_year_id: currentYear.id,
          });
          suggested = decData;
        } catch (e) {
          // RPC may not exist yet — compute locally from marks
          const { data: marks } = await supabase
            .from('student_marks')
            .select('mark, total_marks, subject')
            .eq('student_matricule', s.matricule)
            .eq('academic_year_id', currentYear.id);

          if (marks && marks.length > 0) {
            const subjectAvgs = {};
            marks.forEach(m => {
              const normalized = (m.mark / m.total_marks) * 20;
              if (!subjectAvgs[m.subject]) subjectAvgs[m.subject] = [];
              subjectAvgs[m.subject].push(normalized);
            });
            const subjectMeans = Object.values(subjectAvgs).map(arr => arr.reduce((a, b) => a + b, 0) / arr.length);
            avg = subjectMeans.length > 0
              ? Math.round((subjectMeans.reduce((a, b) => a + b, 0) / subjectMeans.length) * 100) / 100
              : null;
            suggested = avg == null ? null :
              avg >= (currentYear.promotion_threshold || 10) ? 'promoted' :
              avg >= (currentYear.council_zone_min || 8) ? 'council' : 'repeating';
          }
        }

        const hist = existingMap[s.matricule];
        return {
          matricule: s.matricule,
          name: s.name,
          avg,
          suggested,
          finalDecision: hist?.decision || suggested || null,
          note: hist?.vp_note || '',
          alreadySaved: !!hist,
        };
      }));

      // Sort: council first (borderline), then by average desc
      withAverages.sort((a, b) => {
        const order = { council: 0, repeating: 1, promoted: 2, excluded: 3 };
        const ao = order[a.suggested] ?? 9;
        const bo = order[b.suggested] ?? 9;
        if (ao !== bo) return ao - bo;
        if (a.avg == null && b.avg == null) return 0;
        if (a.avg == null) return 1;
        if (b.avg == null) return -1;
        return b.avg - a.avg;
      });

      setStudents(withAverages);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error loading students', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClass, currentYear, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  /* ── Override helpers ────────────────────────────────────── */
  const getDecision = (s) => overrides[s.matricule]?.decision ?? s.finalDecision;
  const getNote     = (s) => overrides[s.matricule]?.note ?? s.note;
  const setDecision = (matricule, decision) => setOverrides(p => ({
    ...p, [matricule]: { ...p[matricule], decision },
  }));
  const setNote = (matricule, note) => setOverrides(p => ({
    ...p, [matricule]: { ...p[matricule], note },
  }));

  /* ── Bulk promote clear cases ────────────────────────────── */
  const bulkPromoteClear = () => {
    const newOverrides = { ...overrides };
    students.forEach(s => {
      if (s.suggested === 'promoted' && getDecision(s) !== 'promoted') {
        newOverrides[s.matricule] = { ...newOverrides[s.matricule], decision: 'promoted' };
      }
    });
    setOverrides(newOverrides);
    const count = students.filter(s => s.suggested === 'promoted').length;
    toast({ title: `✅ ${count} students marked as Promoted`, description: 'Review and finalize when ready.' });
  };

  /* ── Save individual student decision ────────────────────── */
  const saveOne = async (s) => {
    const decision = getDecision(s);
    const note     = getNote(s);
    if (!decision) {
      toast({ variant: 'destructive', title: 'No decision', description: 'Select a decision first.' }); return;
    }
    setSaving(s.matricule);
    try {
      const record = {
        student_matricule: s.matricule,
        academic_year_id:  currentYear.id,
        school_id:         parseInt(schoolId),
        class_id:          selectedClass.id,
        annual_average:    s.avg,
        decision,
        decided_by_vp_id:  parseInt(vpId),
        vp_note:           note || null,
        decided_at:        new Date().toISOString(),
      };
      // Upsert — if already saved, update override fields
      const { error } = await supabase.from('student_academic_history')
        .upsert([record], { onConflict: 'student_matricule,academic_year_id' });
      if (error) throw error;
      // Mark as saved in local state
      setStudents(prev => prev.map(st =>
        st.matricule === s.matricule ? { ...st, finalDecision: decision, note, alreadySaved: true } : st
      ));
      // Clear override since it's now persisted
      setOverrides(p => { const n = { ...p }; delete n[s.matricule]; return n; });
      toast({ title: '✅ Decision saved', description: `${s.name} → ${DECISIONS[decision]?.label}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally { setSaving(null); }
  };

  /* ── Finalize all (save all pending) ─────────────────────── */
  const finalizeAll = async () => {
    const pending = students.filter(s => getDecision(s) && !s.alreadySaved || overrides[s.matricule]);
    if (pending.length === 0) {
      toast({ title: 'All decisions already saved', description: 'Nothing new to finalize.' }); return;
    }
    setFinalizing(true);
    try {
      const records = students
        .filter(s => getDecision(s))
        .map(s => ({
          student_matricule: s.matricule,
          academic_year_id:  currentYear.id,
          school_id:         parseInt(schoolId),
          class_id:          selectedClass.id,
          annual_average:    s.avg,
          decision:          getDecision(s),
          decided_by_vp_id:  parseInt(vpId),
          vp_note:           getNote(s) || null,
          decided_at:        new Date().toISOString(),
        }));
      const { error } = await supabase.from('student_academic_history')
        .upsert(records, { onConflict: 'student_matricule,academic_year_id' });
      if (error) throw error;
      toast({ title: `🎓 ${records.length} decisions finalized`, description: `${selectedClass.name} promotion records saved.` });
      setOverrides({});
      await loadStudents();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Finalize failed', description: e.message });
    } finally { setFinalizing(false); }
  };

  /* ── Computed stats ──────────────────────────────────────── */
  const stats = {
    total:     students.length,
    promoted:  students.filter(s => getDecision(s) === 'promoted').length,
    council:   students.filter(s => getDecision(s) === 'council').length,
    repeating: students.filter(s => getDecision(s) === 'repeating').length,
    excluded:  students.filter(s => getDecision(s) === 'excluded').length,
    undecided: students.filter(s => !getDecision(s)).length,
    saved:     students.filter(s => s.alreadySaved && !overrides[s.matricule]).length,
    pending:   Object.keys(overrides).length + students.filter(s => !s.alreadySaved && getDecision(s)).length,
  };
  const clearCaseCount = students.filter(s => s.suggested === 'promoted' && !s.alreadySaved).length;

  /* ── Filter + search ─────────────────────────────────────── */
  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterDec === 'all' || getDecision(s) === filterDec || (filterDec === 'undecided' && !getDecision(s));
    return matchSearch && matchFilter;
  });

  /* ── No year guard ───────────────────────────────────────── */
  if (!currentYear) return (
    <PageTransition>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass rounded-2xl p-12 text-center border border-amber-500/15 bg-amber-500/5 space-y-3">
          <AlertTriangle className="h-12 w-12 text-amber-400/50 mx-auto" />
          <p className="font-black text-lg">No Active Academic Year</p>
          <p className="text-muted-foreground text-sm">The administrator must activate an academic year before promotions can be run.</p>
        </div>
      </div>
    </PageTransition>
  );

  return (
    <PageTransition>
      <Helmet><title>Promotion Engine — CloudCampus</title></Helmet>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-2xl font-black flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/25 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-purple-400" />
            </div>
            Promotion Engine
          </h1>
          <p className="text-muted-foreground text-sm pl-14">
            {currentYear.name} · Deliberate and record promotion decisions per class.
          </p>
        </motion.div>

        {/* Class selector */}
        {classes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {classes.map(cls => (
              <button key={cls.id} onClick={() => { setSelectedClass(cls); setSearch(''); setFilterDec('all'); }}
                className={cn('px-4 py-2.5 rounded-xl text-sm font-bold border transition-all',
                  selectedClass?.id === cls.id
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-lg shadow-purple-500/10'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
                {cls.name}
                {cls.class_levels && (
                  <span className="ml-1.5 text-[10px] opacity-60">{cls.class_levels.name}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* No class assigned */}
        {classes.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center border border-white/8">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-bold text-muted-foreground">No classes assigned to you</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Contact the administrator to assign classes to your account.</p>
          </div>
        )}

        {selectedClass && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <MiniStat label="Total"     value={stats.total}     color="border-white/8" />
              <MiniStat label="Promoted"  value={stats.promoted}  color="border-emerald-500/20 bg-emerald-500/5" />
              <MiniStat label="Council"   value={stats.council}   color="border-amber-500/20 bg-amber-500/5" />
              <MiniStat label="Repeating" value={stats.repeating} color="border-red-500/20 bg-red-500/5" />
              <MiniStat label="Excluded"  value={stats.excluded}  color="border-violet-500/20 bg-violet-500/5" />
              <MiniStat label="Unsaved"   value={stats.pending}   color={stats.pending > 0 ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-white/8'} />
            </div>

            {/* Action bar */}
            <div className="glass rounded-2xl p-4 border border-white/8 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 h-9" />
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {['all', 'promoted', 'council', 'repeating', 'excluded', 'undecided'].map(f => (
                  <button key={f} onClick={() => setFilterDec(f)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-bold border capitalize transition-all',
                      filterDec === f ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
                    {f}
                    {f !== 'all' && f !== 'undecided' && stats[f] > 0 && (
                      <span className="ml-1 opacity-60">({stats[f]})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Bulk + refresh + finalize */}
              <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap">
                <button onClick={loadStudents} disabled={loading}
                  className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all">
                  <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
                </button>
                {clearCaseCount > 0 && (
                  <button onClick={bulkPromoteClear}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 transition-all">
                    <Sparkles className="h-3.5 w-3.5" /> Promote Clear ({clearCaseCount})
                  </button>
                )}
                <button onClick={finalizeAll} disabled={finalizing || stats.pending === 0}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border',
                    stats.pending > 0
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white border-transparent shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed')}>
                  {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                  Finalize All ({stats.pending})
                </button>
              </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/8 border border-blue-500/15">
              <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300/80">
                <strong>Council zone:</strong> averages between {currentYear.council_zone_min} and {currentYear.council_zone_max}/20 — deliberate these manually.
                Students with ≥ {currentYear.promotion_threshold}/20 are auto-suggested as Promoted.
                Unjustified absences ≥ {currentYear.max_unjustified_hours}h → Excluded.
              </p>
            </div>

            {/* Student list */}
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse h-16 rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/8">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="font-bold text-muted-foreground">
                  {students.length === 0 ? 'No students found in this class' : 'No results match your filter'}
                </p>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
                {filtered.map(s => {
                  const decision   = getDecision(s);
                  const note       = getNote(s);
                  const cfg        = DECISIONS[decision];
                  const isExpanded = expandedId === s.matricule;
                  const isDirty    = !!overrides[s.matricule];
                  const threshold  = currentYear.promotion_threshold || 10;

                  return (
                    <motion.div key={s.matricule} variants={fadeUp} layout>
                      <div className={cn(
                        'glass rounded-2xl border transition-all overflow-hidden',
                        decision ? `${cfg?.border} ${cfg?.bg}` : 'border-white/8',
                        isDirty && 'ring-1 ring-indigo-500/30'
                      )}>
                        {/* Main row */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          {/* Average */}
                          <div className="w-16 shrink-0 text-center">
                            <p className={cn('text-xl font-black tabular-nums', scoreColor(s.avg, threshold))}>
                              {s.avg != null ? s.avg : '—'}
                            </p>
                            <p className="text-[9px] text-muted-foreground/60">/20</p>
                          </div>

                          {/* Name + matricule */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm truncate">{s.name}</p>
                              {s.alreadySaved && !isDirty && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              )}
                              {isDirty && (
                                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">unsaved</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{s.matricule}</p>
                          </div>

                          {/* Suggested vs final */}
                          <div className="hidden md:flex items-center gap-2 shrink-0">
                            {s.suggested && s.suggested !== decision && (
                              <span className="text-[10px] text-muted-foreground">suggested:</span>
                            )}
                            {s.suggested && s.suggested !== decision && <DecisionPill d={s.suggested} />}
                            {decision && <DecisionPill d={decision} />}
                            {!decision && <span className="text-xs text-muted-foreground italic">no decision</span>}
                          </div>

                          {/* Expand + save */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isDirty && (
                              <button onClick={() => saveOne(s)} disabled={saving === s.matricule}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/25 transition-all">
                                {saving === s.matricule ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save
                              </button>
                            )}
                            <button onClick={() => setExpandedId(isExpanded ? null : s.matricule)}
                              className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded deliberation panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-white/8 px-4 py-4 space-y-4 overflow-hidden">

                              {/* Decision selector */}
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                  Promotion Decision
                                </p>
                                <DecisionSelector
                                  current={decision}
                                  onChange={d => setDecision(s.matricule, d)}
                                />
                              </div>

                              {/* VP Note */}
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                  VP Note (optional — permanent record)
                                </p>
                                <textarea
                                  value={note}
                                  onChange={e => setNote(s.matricule, e.target.value)}
                                  placeholder="Add a deliberation note for this student's permanent record..."
                                  rows={2}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-purple-500/40 transition-colors placeholder:text-muted-foreground/40"
                                />
                              </div>

                              <div className="flex gap-2">
                                <button onClick={() => setExpandedId(null)}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                                  Collapse
                                </button>
                                <button onClick={() => saveOne(s)} disabled={saving === s.matricule || !decision}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20">
                                  {saving === s.matricule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  Save Decision
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Bottom summary */}
            {students.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-white/8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {stats.saved} / {stats.total} saved
                  </span>
                  {stats.undecided > 0 && (
                    <span className="text-amber-400 font-bold">{stats.undecided} without decision</span>
                  )}
                  {stats.council > 0 && (
                    <span className="text-amber-400">{stats.council} in council zone</span>
                  )}
                </div>
                <button onClick={finalizeAll} disabled={finalizing || stats.pending === 0}
                  className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border',
                    stats.pending > 0
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white border-transparent shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 border-white/10 text-muted-foreground cursor-not-allowed')}>
                  {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                  Finalize {stats.pending} Unsaved Decisions
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default VPPromotionPage;
