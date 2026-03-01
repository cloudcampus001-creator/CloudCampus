/**
 * VPMarksPage.jsx
 * src/pages/vice_principal/VPMarksPage.jsx
 *
 * Marksheet tab has TWO view modes (toggle button):
 *  • Organized  (default) — accordion: Sequence → Subject (+ teacher name) → student rows
 *  • Flat table           — simple chronological table
 *
 * Report Cards tab:
 *  Select sequences → Generate → ranked table → CSV + Print/PDF
 *
 * FIX: Replaced FK-join queries (students!inner, students(name)) with
 *      separate queries + in-JS merging. PostgREST cannot always resolve
 *      non-standard text-to-text FKs (student_matricule → matricule)
 *      so the join silently returned null, making marks appear empty.
 */
import React, { useState, useEffect } from 'react';
import {
  FileCheck, Loader2, GraduationCap, Download, Printer,
  RefreshCw, ClipboardList, BookOpen, ChevronDown, ChevronRight,
  LayoutList, Table2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

// ── Constants ─────────────────────────────────────────────────────────────────
const SEQUENCES = [
  { value: 'Sequence 1', label: '1st Sequence' },
  { value: 'Sequence 2', label: '2nd Sequence' },
  { value: 'Sequence 3', label: '3rd Sequence' },
  { value: 'Sequence 4', label: '4th Sequence' },
  { value: 'Sequence 5', label: '5th Sequence' },
  { value: 'Sequence 6', label: '6th Sequence' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ordinal(n) {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function assignRanks(cards) {
  const sorted = [...cards].sort((a, b) => {
    if (a.average == null && b.average == null) return 0;
    if (a.average == null) return 1;
    if (b.average == null) return -1;
    return b.average - a.average;
  });
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].average == null) { sorted[i].rank = null; }
    else if (i > 0 && sorted[i].average === sorted[i - 1].average) { sorted[i].rank = sorted[i - 1].rank; }
    else { sorted[i].rank = rank; }
    rank++;
  }
  return sorted;
}

// ── Fetch marks with student + teacher names (NO FK joins) ───────────────────
// Instead of relying on PostgREST FK resolution (which breaks for text-to-text
// FKs like student_matricule → matricule), we fetch three tables separately
// and merge them in JavaScript.
async function fetchMarksForClass(classId) {
  const cid = parseInt(classId);

  // 1. Raw marks — no joins
  const { data: rawMarks, error } = await supabase
    .from('student_marks')
    .select('id, student_matricule, teacher_id, subject, assessment_name, mark, total_marks, created_at')
    .eq('class_id', cid)
    .order('assessment_name')
    .order('subject')
    .limit(1000);

  if (error) throw error;
  if (!rawMarks || rawMarks.length === 0) return [];

  // 2. Student names for this class
  const { data: students } = await supabase
    .from('students')
    .select('matricule, name')
    .eq('class_id', cid);

  const studentMap = {};
  (students || []).forEach(s => { studentMap[s.matricule] = s.name; });

  // 3. Teacher names (only the IDs that actually appear in the marks)
  const teacherIds = [...new Set(rawMarks.map(m => m.teacher_id).filter(Boolean))];
  const teacherMap = {};
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', teacherIds);
    (teachers || []).forEach(t => { teacherMap[t.id] = t.name; });
  }

  // 4. Merge — shape each row exactly like the old join result
  return rawMarks.map(m => ({
    ...m,
    students: { name: studentMap[m.student_matricule] || m.student_matricule || '—' },
    teachers: { name: teacherMap[m.teacher_id]        || '—' },
  }));
}

// ── Report card generation ────────────────────────────────────────────────────
async function buildReportCards(classId, schoolId, selectedSeqs) {
  const cid = parseInt(classId);

  const [
    { data: students },
    { data: classSubjRows },
    { data: enrollRows },
    { data: coefRows },
    { data: markRows },
    { data: classRow },
  ] = await Promise.all([
    supabase.from('students').select('matricule, name').eq('class_id', cid).order('name'),
    supabase.from('class_subjects').select('subject, is_obligatory').eq('class_id', cid),
    supabase.from('student_subject_enrollments').select('student_matricule, subject').eq('class_id', cid),
    supabase.from('subject_coefficients').select('subject_name, coefficient').eq('class_id', cid),
    supabase.from('student_marks')
      .select('student_matricule, subject, mark, total_marks, assessment_name')
      .eq('class_id', cid)
      .in('assessment_name', selectedSeqs),
    supabase.from('classes').select('name').eq('id', cid).single(),
  ]);

  const className = classRow?.name || '';
  const coefMap = {};
  (coefRows || []).forEach(r => { coefMap[r.subject_name] = parseFloat(r.coefficient); });

  const obligatorySet = new Set(
    (classSubjRows || []).filter(r => r.is_obligatory !== false).map(r => r.subject)
  );
  const additionalMap = {};
  (enrollRows || []).forEach(r => {
    if (!additionalMap[r.student_matricule]) additionalMap[r.student_matricule] = new Set();
    additionalMap[r.student_matricule].add(r.subject);
  });

  const allSubjectsSet = new Set([...obligatorySet]);
  (enrollRows || []).forEach(r => allSubjectsSet.add(r.subject));
  const allSubjects = [...allSubjectsSet].sort();

  const marksLookup = {};
  (markRows || []).forEach(m => {
    const on20 = (m.mark * 20) / m.total_marks;
    const key = `${m.student_matricule}|${m.subject}|${m.assessment_name}`;
    if (!marksLookup[key]) marksLookup[key] = [];
    marksLookup[key].push(on20);
  });

  const cards = (students || []).map(student => {
    const subjectRows = allSubjects.map(subject => {
      const isObligatory = obligatorySet.has(subject);
      const isEnrolled   = additionalMap[student.matricule]?.has(subject);
      if (!isObligatory && !isEnrolled) return { subject, coef: coefMap[subject] ?? 1, markOn20: null, weighted: null, offered: false };
      const coef = coefMap[subject] ?? 1;
      const seqMarks = selectedSeqs.map(seq => {
        const arr = marksLookup[`${student.matricule}|${subject}|${seq}`];
        return arr ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      }).filter(v => v !== null);
      if (!seqMarks.length) return { subject, coef, markOn20: null, weighted: null, offered: true };
      const markOn20 = seqMarks.reduce((a, b) => a + b, 0) / seqMarks.length;
      return { subject, coef, markOn20, weighted: markOn20 * coef, offered: true };
    });

    const graded = subjectRows.filter(r => r.offered && r.markOn20 !== null);
    let average = null;
    if (graded.length > 0) {
      const sw = graded.reduce((s, r) => s + r.weighted, 0);
      const sc = graded.reduce((s, r) => s + r.coef, 0);
      average = sc > 0 ? Math.round((sw / sc) * 100) / 100 : null;
    }
    return { matricule: student.matricule, name: student.name, subjectRows, average, rank: null };
  });

  return { cards: assignRanks(cards), allSubjects, className };
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(cards, allSubjects, className, selectedSeqs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const period = selectedSeqs.join(' + ');
  const subjectHeaders = allSubjects.map(sub => {
    const coef = cards[0]?.subjectRows.find(r => r.subject === sub)?.coef ?? 1;
    return `${sub} (coef ${coef})`;
  });
  const csv = [
    [`CLASS REPORT CARDS — ${className} — ${period}`], [],
    ['Rank', 'Student', ...subjectHeaders, 'General Average /20'],
    ...cards.map(s => [
      s.rank ?? '—', s.name,
      ...allSubjects.map(sub => {
        const r = s.subjectRows.find(x => x.subject === sub);
        return !r || !r.offered ? 'N/A' : r.markOn20 !== null ? r.markOn20.toFixed(2) : '—';
      }),
      s.average !== null ? s.average.toFixed(2) : '—',
    ]),
  ].map(row => row.map(q).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report_${className.replace(/\s+/g, '_')}_${period.replace(/[\s+]+/g, '_')}.csv`;
  a.click();
}

// ── Print / PDF ───────────────────────────────────────────────────────────────
function printCards(cards, allSubjects, className, selectedSeqs, schoolName) {
  const period  = selectedSeqs.join(' + ');
  const total   = cards.length;
  const cardsHtml = cards.map(student => {
    const rows = allSubjects.map(sub => {
      const r = student.subjectRows.find(x => x.subject === sub);
      if (!r || !r.offered) return '';
      const mark     = r.markOn20 !== null ? r.markOn20.toFixed(2) : '—';
      const weighted = r.weighted  !== null ? r.weighted.toFixed(2) : '—';
      const color    = r.markOn20 === null ? '#6b7280' : r.markOn20 >= 10 ? '#15803d' : '#dc2626';
      return `<tr><td>${sub}</td><td class="c">${r.coef}</td><td class="c" style="color:${color};font-weight:700">${mark}</td><td class="c">${weighted}</td></tr>`;
    }).join('');
    const avgColor = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const decision = student.average == null ? '—' : student.average >= 10 ? 'PROMOTED' : 'NOT PROMOTED';
    const decColor = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const sumW = student.subjectRows.filter(r => r.offered && r.weighted !== null).reduce((s, r) => s + r.weighted, 0).toFixed(2);
    return `<div class="card">
      <div class="hdr"><div class="school">${schoolName || 'CloudCampus School'}</div><div class="sub">ACADEMIC REPORT CARD</div>
        <div class="meta"><span><b>Student:</b> ${student.name}</span><span><b>Class:</b> ${className}</span><span><b>Period:</b> ${period}</span><span><b>Date:</b> ${new Date().toLocaleDateString()}</span></div></div>
      <table><thead><tr><th>Subject</th><th>Coef</th><th>Mark /20</th><th>Weighted</th></tr></thead><tbody>${rows}</tbody>
      <tfoot>
        <tr class="tot"><td colspan="2"><b>General Average</b></td><td class="c" style="color:${avgColor};font-size:1.1em;font-weight:800">${student.average !== null ? student.average.toFixed(2) + '/20' : '—'}</td><td class="c">${sumW}</td></tr>
        <tr class="tot"><td colspan="2"><b>Class Rank</b></td><td colspan="2" class="c">${ordinal(student.rank)} / ${total}</td></tr>
        <tr class="tot"><td colspan="2"><b>Decision</b></td><td colspan="2" class="c" style="color:${decColor};font-weight:700">${decision}</td></tr>
      </tfoot></table>
      <div class="sigs"><span>Class Teacher: ____________________</span><span>Vice Principal: ____________________</span><span>Parent: ____________________</span></div>
    </div>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Cards</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937}
  .card{max-width:700px;margin:0 auto;padding:28px;page-break-after:always}.card:last-child{page-break-after:avoid}
  .hdr{text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:14px;margin-bottom:16px}
  .school{font-size:17px;font-weight:800;color:#1e3a8a;letter-spacing:1px;text-transform:uppercase}
  .sub{font-size:11px;font-weight:700;color:#374151;margin-top:3px;letter-spacing:3px;text-transform:uppercase}
  .meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;margin-top:10px;font-size:11px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:6px 9px}
  thead tr{background:#1e3a8a;color:#fff}tbody tr:nth-child(even){background:#f8fafc}tfoot .tot{background:#f1f5f9}
  .c{text-align:center}.sigs{display:flex;justify-content:space-between;margin-top:22px;font-size:10px;color:#6b7280;flex-wrap:wrap;gap:8px}
  @media print{@page{size:A4;margin:1.4cm}}</style></head><body>${cardsHtml}</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

// ── Organized Marksheet View ──────────────────────────────────────────────────
function OrganizedView({ marks }) {
  const [openSeqs, setOpenSeqs]   = useState({});
  const [openSubjs, setOpenSubjs] = useState({});

  const grouped = {};
  marks.forEach(m => {
    const seq     = m.assessment_name;
    const sub     = m.subject;
    const teacher = m.teachers?.name || '—';
    if (!grouped[seq]) grouped[seq] = {};
    if (!grouped[seq][sub]) grouped[seq][sub] = { teacher, rows: [] };
    grouped[seq][sub].rows.push({
      name:  m.students?.name || m.student_matricule || '—',
      mark:  m.mark,
      total: m.total_marks,
    });
  });

  Object.values(grouped).forEach(subjects =>
    Object.values(subjects).forEach(s =>
      s.rows.sort((a, b) => a.name.localeCompare(b.name))
    )
  );

  const seqOrder = SEQUENCES.map(s => s.value).filter(v => grouped[v]);

  if (seqOrder.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No marks found for this class yet.</div>;
  }

  const toggleSeq  = seq => setOpenSeqs(p  => ({ ...p, [seq]:  !p[seq]  }));
  const toggleSubj = key => setOpenSubjs(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-3">
      {seqOrder.map(seq => {
        const seqOpen    = openSeqs[seq] !== false;
        const subjects   = Object.keys(grouped[seq]).sort();
        const totalMarks = Object.values(grouped[seq]).reduce((n, s) => n + s.rows.length, 0);
        return (
          <div key={seq} className="rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => toggleSeq(seq)}
              className="w-full flex items-center justify-between px-4 py-3
                         bg-pink-500/10 hover:bg-pink-500/15 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {seqOpen
                  ? <ChevronDown  className="w-4 h-4 text-pink-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-pink-400 shrink-0" />}
                <span className="font-bold text-pink-300">{seq}</span>
                <Badge variant="outline" className="text-[10px] bg-pink-500/10 text-pink-400 border-pink-500/30">
                  {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · {totalMarks} entries
                </Badge>
              </div>
            </button>

            {seqOpen && (
              <div className="divide-y divide-white/5">
                {subjects.map(sub => {
                  const { teacher, rows } = grouped[seq][sub];
                  const subjKey  = `${seq}||${sub}`;
                  const subjOpen = openSubjs[subjKey] !== false;
                  const passed   = rows.filter(r => r.mark / r.total >= 0.5).length;
                  return (
                    <div key={sub} className="bg-white/[0.01]">
                      <button
                        onClick={() => toggleSubj(subjKey)}
                        className="w-full flex items-center justify-between px-5 py-2.5
                                   hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          {subjOpen
                            ? <ChevronDown  className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className="font-semibold text-sm">{sub}</span>
                          <span className="text-xs text-muted-foreground">· {teacher}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-green-400">{passed} passed</span>
                          <span className="text-xs text-muted-foreground">/ {rows.length}</span>
                        </div>
                      </button>

                      {subjOpen && (
                        <div className="mx-4 mb-3 rounded-lg border border-white/10 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10">
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Student</th>
                                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs">Mark</th>
                                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs">On 20</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, i) => {
                                const on20 = (row.mark * 20) / row.total;
                                const pass = on20 >= 10;
                                return (
                                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                    <td className="px-3 py-2 font-medium">{row.name}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground">
                                      {row.mark} / {row.total}
                                    </td>
                                    <td className={`px-3 py-2 text-center font-bold font-mono
                                        ${pass ? 'text-green-400' : 'text-red-400'}`}>
                                      {on20.toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Flat Marksheet View ───────────────────────────────────────────────────────
function FlatView({ marks }) {
  if (marks.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No marks found for this class yet.</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/10">
            {['Student', 'Subject', 'Sequence', 'Mark', 'Date'].map(h => (
              <th key={h} className="h-11 px-4 font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {marks.map((m, i) => (
            <tr key={m.id ?? i} className="border-b border-white/10 hover:bg-white/5">
              <td className="p-4 font-medium">{m.students?.name || m.student_matricule}</td>
              <td className="p-4">{m.subject}</td>
              <td className="p-4 text-muted-foreground">{m.assessment_name}</td>
              <td className="p-4">
                <Badge variant={m.mark / m.total_marks >= 0.5 ? 'default' : 'destructive'}>
                  {m.mark} / {m.total_marks}
                </Badge>
              </td>
              <td className="p-4 text-muted-foreground text-xs">
                {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
const VPMarksPage = ({ selectedClass }) => {
  const { toast }  = useToast();
  const schoolId   = localStorage.getItem('schoolId');
  const schoolName = localStorage.getItem('schoolName') || '';

  // Marksheet
  const [marks,        setMarks]        = useState([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [viewMode,     setViewMode]     = useState('organized');

  // Report cards
  const [selectedSeqs, setSelectedSeqs] = useState([]);
  const [generating,   setGenerating]   = useState(false);
  const [reportCards,  setReportCards]  = useState([]);
  const [allSubjects,  setAllSubjects]  = useState([]);
  const [className,    setClassName]    = useState('');
  const [generated,    setGenerated]    = useState(false);

  useEffect(() => {
    if (!selectedClass) return;
    setGenerated(false);
    setReportCards([]);

    (async () => {
      setMarksLoading(true);
      try {
        // ── THE FIX ───────────────────────────────────────────────────────────
        // Use the separate-fetch helper that avoids all FK-join issues.
        // fetchMarksForClass() does 3 clean queries and merges in JS.
        const enriched = await fetchMarksForClass(selectedClass);
        setMarks(enriched);
      } catch (err) {
        console.error('VPMarksPage — failed to load marks:', err);
        toast({
          variant: 'destructive',
          title: 'Error loading marks',
          description: err.message || 'Could not fetch marks for this class.',
        });
        setMarks([]);
      } finally {
        setMarksLoading(false);
      }

      // Fetch class name separately
      const { data: cls } = await supabase
        .from('classes')
        .select('name')
        .eq('id', parseInt(selectedClass))
        .single();
      if (cls) setClassName(cls.name);
    })();
  }, [selectedClass]);

  const toggleSeq = seq =>
    setSelectedSeqs(prev =>
      prev.includes(seq) ? prev.filter(s => s !== seq) : [...prev, seq]
    );

  const handleGenerate = async () => {
    if (!selectedSeqs.length) {
      toast({ variant: 'destructive', title: 'No sequence selected', description: 'Tick at least one sequence.' });
      return;
    }
    setGenerating(true);
    try {
      const { cards, allSubjects: subs, className: cn } =
        await buildReportCards(selectedClass, schoolId, selectedSeqs);
      setReportCards(cards);
      setAllSubjects(subs);
      if (cn) setClassName(cn);
      setGenerated(true);
      toast({ title: 'Done!', description: `${cards.length} report cards generated.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <FileCheck className="w-16 h-16 mb-4 opacity-20" />
        <p>Please select a class to review marks and generate report cards.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Marks & Report Cards — Vice Principal</title></Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-pink-500 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Marks &amp; Report Cards
              {className && (
                <Badge variant="outline" className="ml-3 text-sm bg-pink-500/10 text-pink-400 border-pink-500/30">
                  {className}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Review submitted marks or generate ranked class report cards.
            </p>
          </div>
        </div>

        <Tabs defaultValue="marksheet" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-xs bg-muted/30">
            <TabsTrigger value="marksheet" className="flex items-center gap-1.5 text-xs">
              <ClipboardList className="w-4 h-4" /> Marksheet
            </TabsTrigger>
            <TabsTrigger value="reportcards" className="flex items-center gap-1.5 text-xs">
              <BookOpen className="w-4 h-4" /> Report Cards
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1 — Marksheet ── */}
          <TabsContent value="marksheet" className="mt-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle>Marksheet — {className}</CardTitle>
                    <CardDescription>
                      Marks submitted by teachers.{' '}
                      {viewMode === 'organized'
                        ? 'Grouped by sequence → subject → students.'
                        : 'Chronological flat table.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                    <button
                      onClick={() => setViewMode('organized')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${viewMode === 'organized'
                          ? 'bg-pink-500 text-white shadow'
                          : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <LayoutList className="w-3.5 h-3.5" /> Organized
                    </button>
                    <button
                      onClick={() => setViewMode('flat')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${viewMode === 'flat'
                          ? 'bg-pink-500 text-white shadow'
                          : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Table2 className="w-3.5 h-3.5" /> Flat
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {marksLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                  </div>
                ) : viewMode === 'organized' ? (
                  <OrganizedView marks={marks} />
                ) : (
                  <FlatView marks={marks} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2 — Report Cards ── */}
          <TabsContent value="reportcards" className="mt-6 space-y-6">
            <Card className="glass border-t-4 border-t-pink-500">
              <CardHeader>
                <CardTitle className="text-base">Step 1 — Select Sequences to Compile</CardTitle>
                <CardDescription>
                  Combine sequences (e.g. 1st + 2nd). Each subject mark will be the mean across selected
                  sequences, then multiplied by its coefficient to compute the general average.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SEQUENCES.map(seq => (
                    <label
                      key={seq.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                        transition-all select-none
                        ${selectedSeqs.includes(seq.value)
                          ? 'bg-pink-500/15 border-pink-500/50 text-pink-200'
                          : 'bg-white/5 border-white/10 hover:border-white/30 text-muted-foreground'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSeqs.includes(seq.value)}
                        onChange={() => toggleSeq(seq.value)}
                        className="w-4 h-4 rounded accent-pink-500 shrink-0 cursor-pointer"
                      />
                      <span className="text-sm font-medium">{seq.label}</span>
                    </label>
                  ))}
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !selectedSeqs.length}
                  className="bg-pink-600 hover:bg-pink-700 text-white mt-2"
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating…</>
                    : <><RefreshCw className="w-4 h-4 mr-2" />Generate Report Cards</>}
                </Button>
              </CardContent>
            </Card>

            {generated && (
              <Card className="glass">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <CardTitle>{className} — {selectedSeqs.join(' + ')}</CardTitle>
                      <CardDescription>
                        {reportCards.length} students · {allSubjects.length} subjects ·{' '}
                        <span className="text-green-400 font-medium">green</span> ≥ 10/20,{' '}
                        <span className="text-red-400 font-medium">red</span> &lt; 10/20
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm"
                        onClick={() => exportCSV(reportCards, allSubjects, className, selectedSeqs)}
                        className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                        <Download className="w-4 h-4 mr-1.5" /> CSV
                      </Button>
                      <Button variant="outline" size="sm"
                        onClick={() => printCards(reportCards, allSubjects, className, selectedSeqs, schoolName)}
                        className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
                        <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reportCards.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No students found in this class.</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="text-sm border-collapse min-w-max w-full">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="sticky left-0 z-10 bg-card p-3 border border-white/10 text-center font-semibold whitespace-nowrap w-16">Rank</th>
                            <th className="p-3 border border-white/10 text-left font-semibold whitespace-nowrap min-w-[160px]">Student</th>
                            {allSubjects.map(sub => {
                              const coef = reportCards[0]?.subjectRows.find(r => r.subject === sub)?.coef ?? 1;
                              return (
                                <th key={sub} className="p-3 border border-white/10 text-center font-semibold whitespace-nowrap">
                                  <div className="text-xs">{sub}</div>
                                  <div className="text-[10px] font-normal text-muted-foreground">coef {coef}</div>
                                </th>
                              );
                            })}
                            <th className="p-3 border border-white/10 text-center font-bold whitespace-nowrap bg-pink-500/10 text-pink-300 min-w-[100px]">
                              Average /20
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportCards.map((student, idx) => (
                            <tr key={student.matricule}
                                className={`border-b border-white/10 hover:bg-white/5 ${idx % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
                              <td className="sticky left-0 z-10 bg-card p-3 border border-white/10 text-center font-bold">
                                <span className={student.rank === 1 ? 'text-yellow-400' : student.rank === 2 ? 'text-slate-300' : student.rank === 3 ? 'text-orange-400' : ''}>
                                  {ordinal(student.rank)}
                                </span>
                              </td>
                              <td className="p-3 border border-white/10 font-medium whitespace-nowrap">{student.name}</td>
                              {allSubjects.map(sub => {
                                const row = student.subjectRows.find(r => r.subject === sub);
                                if (!row || !row.offered) return (
                                  <td key={sub} className="p-3 border border-white/10 text-center text-xs text-muted-foreground/40">N/A</td>
                                );
                                const mark = row.markOn20;
                                const cls  = mark === null ? 'text-muted-foreground' : mark >= 10 ? 'text-green-400' : 'text-red-400';
                                return (
                                  <td key={sub} className={`p-3 border border-white/10 text-center font-mono font-semibold ${cls}`}>
                                    {mark !== null ? mark.toFixed(2) : '—'}
                                  </td>
                                );
                              })}
                              <td className={`p-3 border border-white/10 text-center font-bold text-base bg-pink-500/5
                                ${student.average === null ? 'text-muted-foreground' : student.average >= 10 ? 'text-green-300' : 'text-red-400'}`}>
                                {student.average !== null ? student.average.toFixed(2) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default VPMarksPage;
