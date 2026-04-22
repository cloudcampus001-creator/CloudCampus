/**
 * ReportCardView.jsx
 * Reusable report card component — works in app (glassmorphism) + print mode
 * Props:
 *   studentMatricule  — student's unique ID
 *   yearId            — academic_years.id
 *   classId           — classes.id
 *   schoolId          — schools.id
 *   termId            — (optional) filter to one term; null = show all terms
 *   onClose           — optional close handler (shown as × button)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Printer, X, AlertCircle, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────── helpers ────────────────────────────── */
const fmt   = (n, d = 2) => (n != null && !isNaN(n)) ? Number(n).toFixed(d) : '—';
const round = (n)        => n != null ? Math.round(n * 100) / 100 : null;

const getMention = (avg) => {
  if (avg == null) return '—';
  if (avg >= 18)  return 'Excellent';
  if (avg >= 16)  return 'Très Bien';
  if (avg >= 14)  return 'Bien';
  if (avg >= 12)  return 'Assez Bien';
  if (avg >= 10)  return 'Passable';
  return 'Insuffisant';
};

const mentionColor = (avg) => {
  if (avg == null) return '';
  if (avg >= 16)  return 'text-emerald-600 dark:text-emerald-400';
  if (avg >= 12)  return 'text-blue-600 dark:text-blue-400';
  if (avg >= 10)  return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

const scoreColor = (avg) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= 10)  return 'text-emerald-400 font-bold';
  if (avg >= 8)   return 'text-amber-400 font-semibold';
  return 'text-red-400 font-semibold';
};

const decisionBadge = (d) => {
  const map = {
    promoted:  { label: 'Admis',    cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    repeating: { label: 'Redoublt.', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    council:   { label: 'Conseil',  cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    excluded:  { label: 'Exclu',    cls: 'bg-red-900/20 text-red-300 border-red-800/30' },
  };
  const cfg = map[d];
  if (!cfg) return null;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border', cfg.cls)}>
      {cfg.label}
    </span>
  );
};

/* ──────────────────── local compute ─────────────────────── */
const computeSeqAvg = (marks, seqId, subject) => {
  const r = marks.filter(m => m.sequence_id === seqId && m.subject === subject);
  if (!r.length) return null;
  const vals = r.map(m => (m.mark / (m.total_marks || 20)) * 20);
  return round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const computeTermAvgForSubject = (marks, sequences, termId, subject) => {
  const seqs = sequences.filter(s => s.term_id === termId);
  const avgs = seqs.map(s => computeSeqAvg(marks, s.id, subject)).filter(v => v != null);
  if (!avgs.length) return null;
  return round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
};

const computeAnnualAvgForSubject = (marks, sequences, terms, subject) => {
  const avgs = terms.map(t => computeTermAvgForSubject(marks, sequences, t.id, subject)).filter(v => v != null);
  if (!avgs.length) return null;
  return round(avgs.reduce((a, b) => a + b, 0) / avgs.length);
};

const computeGeneralAvg = (subjectAvgs, coeffMap) => {
  let tw = 0, tc = 0;
  Object.entries(subjectAvgs).forEach(([subj, avg]) => {
    if (avg == null) return;
    const c = coeffMap[subj] || 1;
    tw += avg * c; tc += c;
  });
  return tc === 0 ? null : round(tw / tc);
};

/* ═══════════════════════ COMPONENT ═══════════════════════ */
export const ReportCardView = ({
  studentMatricule,
  yearId,
  classId,
  schoolId,
  termId   = null,
  onClose  = null,
}) => {
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [cardData, setCardData] = useState(null);

  const load = useCallback(async () => {
    if (!studentMatricule || !yearId || !classId || !schoolId) return;
    setLoading(true); setError(null);

    try {
      const [
        { data: school },
        { data: student },
        { data: year },
        { data: allTerms },
        { data: allSequences },
        { data: myMarks },
        { data: coeffRows },
        { data: comments },
        { data: absenceRows },
        { data: punishRows },
        { data: enrollments },
        { data: history },
      ] = await Promise.all([
        supabase.from('schools').select('name,address,phone,logo_url').eq('id', +schoolId).maybeSingle(),
        supabase.from('students').select('name,matricule,date_of_birth,gender').eq('matricule', studentMatricule).maybeSingle(),
        supabase.from('academic_years').select('*').eq('id', yearId).maybeSingle(),
        supabase.from('terms').select('*').eq('academic_year_id', yearId).order('term_index'),
        supabase.from('sequences').select('*').eq('academic_year_id', yearId).order('sequence_index'),
        supabase.from('student_marks').select('subject,mark,total_marks,sequence_id,academic_year_id').eq('student_matricule', studentMatricule).eq('academic_year_id', yearId),
        supabase.from('subject_coefficients').select('subject_name,coefficient').eq('class_id', +classId),
        supabase.from('report_card_comments').select('*').eq('student_matricule', studentMatricule).eq('academic_year_id', yearId),
        supabase.from('absences').select('duration,is_justified').eq('student_matricule', studentMatricule).eq('academic_year_id', yearId),
        supabase.from('punishments').select('id').eq('student_matricule', studentMatricule).eq('academic_year_id', yearId),
        supabase.from('student_enrollments').select('student_matricule').eq('class_id', +classId).eq('academic_year_id', yearId),
        supabase.from('student_academic_history').select('decision,vp_note,annual_average').eq('student_matricule', studentMatricule).eq('academic_year_id', yearId).maybeSingle(),
      ]);

      const terms     = allTerms     || [];
      const sequences = allSequences || [];
      const marks     = myMarks      || [];
      const coeffMap  = {};
      (coeffRows || []).forEach(c => { coeffMap[c.subject_name] = c.coefficient; });

      // Get classmates list (enrollments or fallback)
      let classmateList = (enrollments || []).map(e => e.student_matricule);
      if (!classmateList.length) {
        const { data: fb } = await supabase.from('students').select('matricule').eq('class_id', +classId);
        classmateList = (fb || []).map(s => s.matricule);
      }
      const totalStudents = classmateList.length || 1;

      // Fetch ALL classmates' marks for min/max/avg/rank computation
      let classmateMarksMap = {};
      if (classmateList.length > 0) {
        const { data: cm } = await supabase.from('student_marks')
          .select('student_matricule,subject,mark,total_marks,sequence_id')
          .in('student_matricule', classmateList)
          .eq('academic_year_id', yearId);
        (cm || []).forEach(m => {
          if (!classmateMarksMap[m.student_matricule]) classmateMarksMap[m.student_matricule] = [];
          classmateMarksMap[m.student_matricule].push(m);
        });
      }

      // Subjects from my marks
      const allSubjects = [...new Set(marks.map(m => m.subject))].sort();

      // ── Annual averages for rank ──
      const myAnnualSubjAvgs = {};
      allSubjects.forEach(s => { myAnnualSubjAvgs[s] = computeAnnualAvgForSubject(marks, sequences, terms, s); });
      const myGeneralAnnual = computeGeneralAvg(myAnnualSubjAvgs, coeffMap);

      const classmateGeneralAvgs = classmateList.map(mat => {
        const cMarks = classmateMarksMap[mat] || [];
        const cSubjAvgs = {};
        allSubjects.forEach(s => { cSubjAvgs[s] = computeAnnualAvgForSubject(cMarks, sequences, terms, s); });
        return computeGeneralAvg(cSubjAvgs, coeffMap);
      });
      const annualRank = myGeneralAnnual != null
        ? classmateGeneralAvgs.filter(a => a != null && a > myGeneralAnnual).length + 1
        : null;

      // ── Terms data ──
      const visibleTerms = termId ? terms.filter(t => t.id === termId) : terms;
      const termsData = visibleTerms.map(term => {
        const termSeqs = sequences.filter(s => s.term_id === term.id);

        // Subjects visible in this term
        const termSubjects = [...new Set(
          marks.filter(m => termSeqs.some(s => s.id === m.sequence_id)).map(m => m.subject)
        )].sort();

        const subjectRows = termSubjects.map(subject => {
          const seqAvgs = {};
          termSeqs.forEach(seq => { seqAvgs[seq.id] = computeSeqAvg(marks, seq.id, subject); });
          const termAvg = computeTermAvgForSubject(marks, sequences, term.id, subject);

          // Class stats for this subject/term
          const classVals = classmateList
            .map(mat => computeTermAvgForSubject(classmateMarksMap[mat] || [], sequences, term.id, subject))
            .filter(v => v != null);

          return {
            subject,
            coeff: coeffMap[subject] || 1,
            seqAvgs,
            termAvg,
            classMin: classVals.length ? round(Math.min(...classVals)) : null,
            classMax: classVals.length ? round(Math.max(...classVals)) : null,
            classAvg: classVals.length ? round(classVals.reduce((a,b)=>a+b,0)/classVals.length) : null,
          };
        });

        // Term general avg
        const termSubjAvgs = {};
        termSubjects.forEach(s => { termSubjAvgs[s] = computeTermAvgForSubject(marks, sequences, term.id, s); });
        const termGeneralAvg = computeGeneralAvg(termSubjAvgs, coeffMap);

        // Term rank
        const classmateTermAvgs = classmateList.map(mat => {
          const cSubjAvgs = {};
          termSubjects.forEach(s => { cSubjAvgs[s] = computeTermAvgForSubject(classmateMarksMap[mat]||[], sequences, term.id, s); });
          return computeGeneralAvg(cSubjAvgs, coeffMap);
        });
        const termRank = termGeneralAvg != null
          ? classmateTermAvgs.filter(a => a != null && a > termGeneralAvg).length + 1
          : null;

        const comment = (comments || []).find(c => c.term_id === term.id) || null;
        return { term, sequences: termSeqs, subjects: subjectRows, generalAvg: termGeneralAvg, rank: termRank, totalStudents, comment };
      });

      // ── Annual subject rows (for annual tab) ──
      const annualSubjectRows = allSubjects.map(subject => {
        const annualAvg = myAnnualSubjAvgs[subject];
        const termAvgs  = terms.map(t => computeTermAvgForSubject(marks, sequences, t.id, subject)).filter(v=>v!=null);
        const classAnnualVals = classmateList
          .map(mat => computeAnnualAvgForSubject(classmateMarksMap[mat]||[], sequences, terms, subject))
          .filter(v => v != null);
        return {
          subject,
          coeff:    coeffMap[subject] || 1,
          termAvgs, // [T1avg, T2avg, T3avg]
          annualAvg,
          classMin: classAnnualVals.length ? round(Math.min(...classAnnualVals)) : null,
          classMax: classAnnualVals.length ? round(Math.max(...classAnnualVals)) : null,
          classAvg: classAnnualVals.length ? round(classAnnualVals.reduce((a,b)=>a+b,0)/classAnnualVals.length) : null,
        };
      }).filter(r => r.annualAvg != null);

      // Absences
      const justified   = (absenceRows||[]).filter(a=>a.is_justified).reduce((s,a)=>s+(a.duration||0),0);
      const unjustified = (absenceRows||[]).filter(a=>!a.is_justified).reduce((s,a)=>s+(a.duration||0),0);

      setCardData({
        school: school || { name: 'School', address: '' },
        student: student || { name: studentMatricule, matricule: studentMatricule },
        year: year || {},
        terms: termsData,
        annual: {
          subjects: annualSubjectRows,
          generalAvg: myGeneralAnnual,
          rank: annualRank,
          totalStudents,
          comment: (comments||[]).find(c=>c.term_id===null)||null,
        },
        absences: { justified, unjustified, total: justified + unjustified },
        punishments: (punishRows||[]).length,
        promotionDecision: history?.decision || null,
        isAnnualView: !termId,
      });
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [studentMatricule, yearId, classId, schoolId, termId]);

  useEffect(() => { load(); }, [load]);

  /* ── render states ── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-sm text-muted-foreground">Building report card…</p>
    </div>
  );
  if (error) return (
    <div className="flex items-center gap-2 text-red-400 py-10 justify-center text-sm">
      <AlertCircle className="h-5 w-5" /> {error}
    </div>
  );
  if (!cardData) return null;

  const { school, student, year, terms, annual, absences, punishments, promotionDecision, isAnnualView } = cardData;

  /* ── PRINT handler ── */
  const handlePrint = () => window.print();

  return (
    <>
      {/* ── Print CSS injected into head ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #cc-report-card { display: block !important; position: static !important; }
          #cc-report-card .no-print { display: none !important; }
          #cc-report-card {
            background: white !important;
            color: #111 !important;
            font-size: 11px !important;
            padding: 12mm 15mm !important;
            max-width: none !important;
          }
          #cc-report-card .rc-table { border-collapse: collapse; width: 100%; }
          #cc-report-card .rc-table th,
          #cc-report-card .rc-table td { border: 1px solid #bbb; padding: 3px 6px; font-size: 10px; }
          #cc-report-card .rc-header-school { font-size: 16px; font-weight: 900; }
          #cc-report-card .rc-title { font-size: 13px; font-weight: 700; text-align: center; border: 1px solid #333; padding: 4px; margin: 8px 0; }
          #cc-report-card .rc-section { border: 1px solid #bbb; padding: 6px; margin-bottom: 6px; border-radius: 2px; }
          #cc-report-card .print-color-fix { color: #111 !important; background: transparent !important; border-color: #bbb !important; }
        }
      `}</style>

      <div id="cc-report-card" className="w-full space-y-5 max-w-5xl mx-auto">

        {/* ── Controls (hidden when printing) ── */}
        <div className="no-print flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-xl">{student?.name}</h2>
            <p className="text-sm text-muted-foreground">{student?.matricule} · {year?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-all text-sm font-semibold">
              <Printer className="h-4 w-4" /> Imprimer / PDF
            </button>
            {onClose && (
              <button onClick={onClose}
                className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ════════════════ RENDER EACH TERM ════════════════ */}
        {terms.map(td => (
          <TermCard key={td.term.id} td={td} school={school} student={student} year={year}
            absences={absences} promotionDecision={null} />
        ))}

        {/* ════════════════ ANNUAL CARD (if showing all terms) ════════════════ */}
        {isAnnualView && (
          <AnnualCard data={annual} school={school} student={student} year={year}
            absences={absences} punishments={punishments} promotionDecision={promotionDecision}
            termNames={terms.map(t => t.term.name)} />
        )}
      </div>
    </>
  );
};

/* ═══════════════════ TERM CARD ══════════════════════════════ */
const TermCard = ({ td, school, student, year, absences }) => {
  const { term, sequences, subjects, generalAvg, rank, totalStudents, comment } = td;

  return (
    <div className="rc-section glass rounded-3xl border border-white/10 overflow-hidden print:rounded-none print:border-gray-400">

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 print:border-gray-300 bg-white/3">
        <div className="flex items-start justify-between gap-4">
          {/* School */}
          <div>
            <p className="rc-header-school font-black text-base text-foreground">{school?.name}</p>
            <p className="text-xs text-muted-foreground">{school?.address}</p>
          </div>
          {/* Title */}
          <div className="text-center">
            <p className="rc-title font-black text-sm uppercase tracking-wider">Bulletin de Notes</p>
            <p className="text-xs text-muted-foreground">{term.name} · {year?.name}</p>
          </div>
          {/* Student */}
          <div className="text-right">
            <p className="font-bold text-sm">{student?.name}</p>
            <p className="text-xs text-muted-foreground">Matr. {student?.matricule}</p>
            {student?.date_of_birth && <p className="text-xs text-muted-foreground">Né(e) le {new Date(student.date_of_birth).toLocaleDateString('fr-FR')}</p>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-white/10 border-b border-white/10 print:divide-gray-300 print:border-gray-300">
        {[
          { label: 'Moyenne Générale', value: fmt(generalAvg), highlight: true },
          { label: 'Rang', value: rank ? `${rank}e / ${totalStudents}` : '—' },
          { label: 'Absences Justifiées', value: `${absences?.justified || 0}h` },
          { label: 'Absences Injustifiées', value: `${absences?.unjustified || 0}h` },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="px-4 py-2 text-center">
            <p className={cn('text-lg font-black', highlight && scoreColor(generalAvg))}>{value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Marks table */}
      <div className="overflow-x-auto">
        <table className="rc-table w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/3 print:border-gray-300">
              <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider w-44">Matière</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground w-12">Coef.</th>
              {sequences.map(seq => (
                <th key={seq.id} className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[70px]">
                  {seq.name}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-bold text-foreground bg-white/5 min-w-[70px]">Moy. Trim.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Min cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Max cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Moy cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[80px]">Mention</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((row, i) => (
              <tr key={row.subject} className={cn('border-b border-white/5 print:border-gray-200', i % 2 === 0 ? 'bg-transparent' : 'bg-white/2')}>
                <td className="px-4 py-2 font-semibold text-foreground">{row.subject}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{row.coeff}</td>
                {sequences.map(seq => (
                  <td key={seq.id} className={cn('px-3 py-2 text-center', scoreColor(row.seqAvgs[seq.id]))}>
                    {fmt(row.seqAvgs[seq.id])}
                  </td>
                ))}
                <td className={cn('px-3 py-2 text-center bg-white/3 font-bold', scoreColor(row.termAvg))}>
                  {fmt(row.termAvg)}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classMin)}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classMax)}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classAvg)}</td>
                <td className={cn('px-3 py-2 text-center text-[11px] font-semibold', mentionColor(row.termAvg))}>
                  {getMention(row.termAvg)}
                </td>
              </tr>
            ))}
            {/* General average row */}
            <tr className="border-t-2 border-white/20 bg-white/5 font-black print:border-gray-400">
              <td className="px-4 py-2.5 font-black text-foreground" colSpan={2}>MOYENNE GÉNÉRALE</td>
              <td colSpan={sequences.length} />
              <td className={cn('px-3 py-2.5 text-center text-base font-black', scoreColor(generalAvg))}>
                {fmt(generalAvg)}
              </td>
              <td colSpan={3} />
              <td className={cn('px-3 py-2 text-center text-xs font-bold', mentionColor(generalAvg))}>
                {getMention(generalAvg)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Comments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-4 border-t border-white/10 print:border-gray-300">
        <CommentBox label="Appréciation du Titulaire" value={comment?.teacher_comment} />
        <CommentBox label="Appréciation du Censeur" value={comment?.vp_comment} />
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conduite</p>
          {comment?.conduct ? (
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
              {comment.conduct}
            </span>
          ) : (
            <p className="text-xs text-muted-foreground italic">Non renseignée</p>
          )}
        </div>
      </div>

      {/* Signature block */}
      <div className="grid grid-cols-3 divide-x divide-white/10 px-6 py-3 border-t border-white/10 text-center print:divide-gray-300 print:border-gray-300">
        {['Signature du Parent', 'Signature du Titulaire', 'Signature du Censeur'].map(label => (
          <div key={label} className="px-4">
            <p className="text-[10px] text-muted-foreground mb-6">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════ ANNUAL CARD ════════════════════════════ */
const AnnualCard = ({ data, school, student, year, absences, punishments, promotionDecision, termNames }) => {
  const { subjects, generalAvg, rank, totalStudents, comment } = data;
  if (!subjects.length) return null;

  return (
    <div className="rc-section glass rounded-3xl border border-white/15 overflow-hidden print:rounded-none print:border-gray-400 mt-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 print:border-gray-300 bg-indigo-500/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-black text-base text-foreground">{school?.name}</p>
            <p className="text-xs text-muted-foreground">{school?.address}</p>
          </div>
          <div className="text-center">
            <p className="font-black text-sm uppercase tracking-wider text-indigo-300">BILAN ANNUEL</p>
            <p className="text-xs text-muted-foreground">Année Scolaire {year?.name}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm">{student?.name}</p>
            <p className="text-xs text-muted-foreground">Matr. {student?.matricule}</p>
          </div>
        </div>
      </div>

      {/* Annual stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-white/10 border-b border-white/10 print:divide-gray-300 print:border-gray-300">
        {[
          { label: 'Moyenne Annuelle', value: fmt(generalAvg), highlight: true },
          { label: 'Rang Final', value: rank ? `${rank}e / ${totalStudents}` : '—' },
          { label: 'Abs. Justifiées', value: `${absences?.justified || 0}h` },
          { label: 'Abs. Injustifiées', value: `${absences?.unjustified || 0}h` },
          { label: 'Décision', value: promotionDecision ? (
            <span className="text-base">{decisionBadge(promotionDecision)}</span>
          ) : '—' },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="px-4 py-3 text-center">
            {typeof value === 'object' ? (
              <div className="flex justify-center">{value}</div>
            ) : (
              <p className={cn('text-lg font-black', highlight && scoreColor(generalAvg))}>{value}</p>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Annual marks table */}
      <div className="overflow-x-auto">
        <table className="rc-table w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/3 print:border-gray-300">
              <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase tracking-wider w-44">Matière</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground w-12">Coef.</th>
              {termNames.map((name, i) => (
                <th key={i} className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[70px]">{name}</th>
              ))}
              <th className="px-3 py-2 text-center font-bold text-foreground bg-white/5 min-w-[80px]">Moy. Ann.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Min cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Max cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[60px]">Moy cl.</th>
              <th className="px-3 py-2 text-center font-bold text-muted-foreground min-w-[80px]">Mention</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((row, i) => (
              <tr key={row.subject} className={cn('border-b border-white/5 print:border-gray-200', i%2===0?'':'bg-white/2')}>
                <td className="px-4 py-2 font-semibold text-foreground">{row.subject}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{row.coeff}</td>
                {row.termAvgs.map((avg, ti) => (
                  <td key={ti} className={cn('px-3 py-2 text-center', scoreColor(avg))}>{fmt(avg)}</td>
                ))}
                {/* Pad missing term columns */}
                {termNames.slice(row.termAvgs.length).map((_, ti) => (
                  <td key={`pad-${ti}`} className="px-3 py-2 text-center text-muted-foreground">—</td>
                ))}
                <td className={cn('px-3 py-2 text-center bg-white/3 font-bold', scoreColor(row.annualAvg))}>
                  {fmt(row.annualAvg)}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classMin)}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classMax)}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{fmt(row.classAvg)}</td>
                <td className={cn('px-3 py-2 text-center text-[11px] font-semibold', mentionColor(row.annualAvg))}>
                  {getMention(row.annualAvg)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-white/20 bg-white/5 print:border-gray-400">
              <td className="px-4 py-2.5 font-black text-foreground" colSpan={2}>MOYENNE GÉNÉRALE</td>
              <td colSpan={termNames.length} />
              <td className={cn('px-3 py-2.5 text-center text-base font-black', scoreColor(generalAvg))}>
                {fmt(generalAvg)}
              </td>
              <td colSpan={3} />
              <td className={cn('px-3 py-2 text-center text-xs font-bold', mentionColor(generalAvg))}>
                {getMention(generalAvg)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Annual comments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-6 py-4 border-t border-white/10 print:border-gray-300">
        <CommentBox label="Appréciation du Titulaire" value={comment?.teacher_comment} />
        <CommentBox label="Appréciation du Censeur / Principal" value={comment?.vp_comment} />
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conduite Annuelle</p>
          {comment?.conduct ? (
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
              {comment.conduct}
            </span>
          ) : (
            <p className="text-xs text-muted-foreground italic">Non renseignée</p>
          )}
          {promotionDecision && (
            <div className="mt-2">{decisionBadge(promotionDecision)}</div>
          )}
        </div>
      </div>

      {/* Signature block */}
      <div className="grid grid-cols-3 divide-x divide-white/10 px-6 py-4 border-t border-white/10 text-center print:divide-gray-300 print:border-gray-300">
        {['Signature du Parent / Tuteur', 'Signature du Prof. Principal', 'Cachet & Signature du Censeur'].map(label => (
          <div key={label} className="px-4">
            <p className="text-[10px] text-muted-foreground mb-8">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Small comment box ── */
const CommentBox = ({ label, value }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    <div className="min-h-[48px] rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-xs text-foreground print:border-gray-300">
      {value || <span className="text-muted-foreground italic">—</span>}
    </div>
  </div>
);

export default ReportCardView;
