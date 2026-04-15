
/**
 * VPMarksPage.jsx — Vice Principal
 * Marksheet tab: Organized (accordion) or Flat table
 * Report Cards tab: select sequences → generate → ranked table → CSV + Print
 *
 * Design: purple/pink glass, PageTransition, all strings via t()
 * Logic: unchanged from original (separate-fetch pattern for FK-join fix)
 */
import React, { useState, useEffect } from 'react';
import {
  FileCheck, Loader2, GraduationCap, Download, Printer,
  RefreshCw, ClipboardList, BookOpen, ChevronDown, ChevronRight,
  LayoutList, Table2, Send, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

/* ── constants: sequences loaded dynamically from DB ────── */
// SEQUENCES removed — now fetched from the `sequences` table per academic year

/* ── helpers ───────────────────────────────────────────── */
function ordinal(n) {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
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

/* Separate-fetch helper — avoids FK-join issues on text-to-text FKs */
async function fetchMarksForClass(classId) {
  const cid = parseInt(classId);
  const { data: rawMarks, error } = await supabase
    .from('student_marks')
    .select('id, student_matricule, teacher_id, subject, assessment_name, mark, total_marks, created_at')
    .eq('class_id', cid).order('assessment_name').order('subject').limit(1000);
  if (error) throw error;
  if (!rawMarks?.length) return [];

  const { data: students } = await supabase.from('students').select('matricule, name').eq('class_id', cid);
  const studentMap = {};
  (students || []).forEach(s => { studentMap[s.matricule] = s.name; });

  const teacherIds = [...new Set(rawMarks.map(m => m.teacher_id).filter(Boolean))];
  const teacherMap = {};
  if (teacherIds.length) {
    const { data: teachers } = await supabase.from('teachers').select('id, name').in('id', teacherIds);
    (teachers || []).forEach(t => { teacherMap[t.id] = t.name; });
  }
  return rawMarks.map(m => ({
    ...m,
    students: { name: studentMap[m.student_matricule] || m.student_matricule || '—' },
    teachers: { name: teacherMap[m.teacher_id] || '—' },
  }));
}

async function buildReportCards(classId, schoolId, selectedSeqs) {
  const cid = parseInt(classId);
  const [
    { data: students }, { data: classSubjRows }, { data: enrollRows },
    { data: coefRows }, { data: markRows }, { data: classRow },
  ] = await Promise.all([
    supabase.from('students').select('matricule, name').eq('class_id', cid).order('name'),
    supabase.from('class_subjects').select('subject, is_obligatory').eq('class_id', cid),
    supabase.from('student_subject_enrollments').select('student_matricule, subject').eq('class_id', cid),
    supabase.from('subject_coefficients').select('subject_name, coefficient').eq('class_id', cid),
    supabase.from('student_marks').select('student_matricule, subject, mark, total_marks, assessment_name')
      .eq('class_id', cid).in('assessment_name', selectedSeqs),
    supabase.from('classes').select('name').eq('id', cid).single(),
  ]);
  const className = classRow?.name || '';
  const coefMap = {};
  (coefRows || []).forEach(r => { coefMap[r.subject_name] = parseFloat(r.coefficient); });
  const obligatorySet = new Set((classSubjRows || []).filter(r => r.is_obligatory !== false).map(r => r.subject));
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

function printCards(cards, allSubjects, className, selectedSeqs, schoolName, template = {}) {
  const period = selectedSeqs.join(' + '), total = cards.length;
  const cardsHtml = cards.map(student => {
    const rows = allSubjects.map(sub => {
      const r = student.subjectRows.find(x => x.subject === sub);
      if (!r || !r.offered) return '';
      const mark = r.markOn20 !== null ? r.markOn20.toFixed(2) : '—';
      const weighted = r.weighted !== null ? r.weighted.toFixed(2) : '—';
      const color = r.markOn20 === null ? '#6b7280' : r.markOn20 >= 10 ? '#15803d' : '#dc2626';
      return `<tr><td>${sub}</td><td class="c">${r.coef}</td><td class="c" style="color:${color};font-weight:700">${mark}</td><td class="c">${weighted}</td></tr>`;
    }).join('');
    const avgColor = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const decision = student.average == null ? '—' : student.average >= 10 ? 'PROMOTED' : 'NOT PROMOTED';
    const decColor = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const sumW = student.subjectRows.filter(r => r.offered && r.weighted !== null).reduce((s, r) => s + r.weighted, 0).toFixed(2);
    return `<div class="card">
      <div class="hdr">
        ${template.logo_url ? `<img src="${template.logo_url}" alt="logo" style="height:56px;object-fit:contain;display:block;margin:0 auto 6px;">` : ''}
        <div class="school" style="color:${template.accent_color || '#7c3aed'}">${template.school_name || schoolName || 'CloudCampus School'}</div>
        ${template.motto ? `<div class="motto">«${template.motto}»</div>` : ''}
        ${template.address ? `<div class="addr">${template.address}</div>` : ''}
        <div class="sub">ACADEMIC REPORT CARD</div>
        <div class="meta"><span><b>Student:</b> ${student.name}</span><span><b>Class:</b> ${className}</span><span><b>Period:</b> ${period}</span><span><b>Date:</b> ${new Date().toLocaleDateString()}</span></div></div>
      <table><thead><tr><th>Subject</th><th>Coef</th><th>Mark /20</th><th>Weighted</th></tr></thead><tbody>${rows}</tbody>
      <tfoot>
        <tr class="tot"><td colspan="2"><b>General Average</b></td><td class="c" style="color:${avgColor};font-size:1.1em;font-weight:800">${student.average !== null ? student.average.toFixed(2) + '/20' : '—'}</td><td class="c">${sumW}</td></tr>
        <tr class="tot"><td colspan="2"><b>Class Rank</b></td><td colspan="2" class="c">${ordinal(student.rank)} / ${total}</td></tr>
        <tr class="tot"><td colspan="2"><b>Decision</b></td><td colspan="2" class="c" style="color:${decColor};font-weight:700">${decision}</td></tr>
      </tfoot></table>
      <div class="sigs"><span>Class Teacher: ____________________</span>${template.principal ? `<span>Principal: ${template.principal}</span>` : '<span>Vice Principal: ____________________</span>'}<span>Parent: ____________________</span></div>
    </div>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report Cards</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937}
  .card{max-width:700px;margin:0 auto;padding:28px;page-break-after:always}.card:last-child{page-break-after:avoid}
  .hdr{text-align:center;border-bottom:3px solid ${template.accent_color||'#7c3aed'};padding-bottom:14px;margin-bottom:16px}
  .school{font-size:17px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
  .motto{font-size:11px;font-style:italic;color:#6b7280;margin-top:3px}
  .addr{font-size:10px;color:#9ca3af;margin-top:4px}
  .sub{font-size:11px;font-weight:700;color:#374151;margin-top:3px;letter-spacing:3px;text-transform:uppercase}
  .meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;margin-top:10px;font-size:11px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d1d5db;padding:6px 9px}
  thead tr{background:${template.accent_color||'#7c3aed'};color:#fff}tbody tr:nth-child(even){background:#f8fafc}tfoot .tot{background:#faf5ff}
  .c{text-align:center}.sigs{display:flex;justify-content:space-between;margin-top:22px;font-size:10px;color:#6b7280;flex-wrap:wrap;gap:8px}
  @media print{@page{size:A4;margin:1.4cm}}</style></head><body>${cardsHtml}</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

/* ── Organized View ────────────────────────────────────── */
function OrganizedView({ marks, t }) {
  const [openSeqs,  setOpenSeqs]  = useState({});
  const [openSubjs, setOpenSubjs] = useState({});

  const grouped = {};
  marks.forEach(m => {
    const seq = m.assessment_name, sub = m.subject, teacher = m.teachers?.name || '—';
    if (!grouped[seq]) grouped[seq] = {};
    if (!grouped[seq][sub]) grouped[seq][sub] = { teacher, rows: [] };
    grouped[seq][sub].rows.push({ name: m.students?.name || m.student_matricule || '—', mark: m.mark, total: m.total_marks });
  });
  Object.values(grouped).forEach(subjects => Object.values(subjects).forEach(s => s.rows.sort((a, b) => a.name.localeCompare(b.name))));
  const seqOrder = (dbSequences.length > 0
    ? dbSequences.map(s => s.name)
    : ['Sequence 1','Sequence 2','Sequence 3','Sequence 4','Sequence 5','Sequence 6']
  ).filter(v => grouped[v]);
  if (!seqOrder.length) return <p className="text-center py-8 text-muted-foreground text-sm">{t('noMarksYet')}</p>;

  return (
    <div className="space-y-3">
      {seqOrder.map(seq => {
        const seqOpen  = openSeqs[seq] !== false;
        const subjects = Object.keys(grouped[seq]).sort();
        const totalM   = Object.values(grouped[seq]).reduce((n, s) => n + s.rows.length, 0);
        return (
          <div key={seq} className="rounded-2xl border border-white/8 overflow-hidden">
            <button onClick={() => setOpenSeqs(p => ({ ...p, [seq]: !p[seq] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/8 hover:bg-purple-500/12 transition-colors text-left">
              <div className="flex items-center gap-3">
                {seqOpen ? <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />}
                <span className="font-bold text-purple-300">{seq}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  {subjects.length} subj · {totalM} entries
                </span>
              </div>
            </button>
            {seqOpen && (
              <div className="divide-y divide-white/5">
                {subjects.map(sub => {
                  const { teacher, rows } = grouped[seq][sub];
                  const key      = `${seq}||${sub}`;
                  const subjOpen = openSubjs[key] !== false;
                  const passed   = rows.filter(r => r.mark / r.total >= 0.5).length;
                  return (
                    <div key={sub} className="bg-white/[0.01]">
                      <button onClick={() => setOpenSubjs(p => ({ ...p, [key]: !p[key] }))}
                        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-white/4 transition-colors text-left">
                        <div className="flex items-center gap-2.5">
                          {subjOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className="font-semibold text-sm">{sub}</span>
                          <span className="text-xs text-muted-foreground">· {teacher}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-green-400">{passed} {t('passed')}</span>
                          <span className="text-xs text-muted-foreground">/ {rows.length}</span>
                        </div>
                      </button>
                      {subjOpen && (
                        <div className="mx-4 mb-3 rounded-xl border border-white/8 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/8">
                                {[t('studentLabel'), 'Mark', 'On 20'].map(h => (
                                  <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground text-xs first:text-left text-center first-of-type:text-left">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, i) => {
                                const on20 = (row.mark * 20) / row.total;
                                return (
                                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/4">
                                    <td className="px-3 py-2 font-medium">{row.name}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground">{row.mark} / {row.total}</td>
                                    <td className={cn('px-3 py-2 text-center font-bold font-mono', on20 >= 10 ? 'text-green-400' : 'text-red-400')}>
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

/* ── Flat View ─────────────────────────────────────────── */
function FlatView({ marks, t }) {
  if (!marks.length) return <p className="text-center py-8 text-muted-foreground text-sm">{t('noMarksYet')}</p>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/8">
            {[t('studentLabel'), 'Subject', 'Sequence', 'Mark', 'Date'].map(h => (
              <th key={h} className="h-10 px-4 font-medium text-muted-foreground text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {marks.map((m, i) => {
            const pass = m.mark / m.total_marks >= 0.5;
            return (
              <tr key={m.id ?? i} className="border-b border-white/6 hover:bg-white/4">
                <td className="p-3 font-medium">{m.students?.name || m.student_matricule}</td>
                <td className="p-3">{m.subject}</td>
                <td className="p-3 text-muted-foreground">{m.assessment_name}</td>
                <td className="p-3">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border',
                    pass ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-red-500/15 text-red-400 border-red-500/25'
                  )}>{m.mark} / {m.total_marks}</span>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const VPMarksPage = ({ selectedClass }) => {
  const { toast }  = useToast();
  const { t }      = useLanguage();
  const schoolId   = localStorage.getItem('schoolId');
  const schoolName = localStorage.getItem('schoolName') || '';

  const [activeTab,    setActiveTab]    = useState('marksheet');
  const [marks,        setMarks]        = useState([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [viewMode,     setViewMode]     = useState('organized');

  const [selectedSeqs, setSelectedSeqs] = useState([]);
  const [generating,   setGenerating]   = useState(false);
  const [dbSequences,  setDbSequences]  = useState([]);   // from sequences table

  // Load sequences from DB for current year
  useEffect(() => {
    const schoolId = localStorage.getItem('schoolId');
    if (!schoolId) return;
    supabase.from('academic_years').select('id')
      .eq('school_id', parseInt(schoolId)).eq('is_current', true).maybeSingle()
      .then(({ data: year }) => {
        if (!year) return;
        supabase.from('sequences').select('*, terms(name)')
          .eq('school_id', parseInt(schoolId))
          .eq('academic_year_id', year.id)
          .order('sequence_index')
          .then(({ data: seqs }) => {
            setDbSequences(seqs || []);
          });
      });
  }, []);
  const [reportCards,  setReportCards]  = useState([]);
  const [allSubjects,  setAllSubjects]  = useState([]);
  const [className,    setClassName]    = useState('');
  const [generated,    setGenerated]    = useState(false);

  /* report card template from admin */
  const [template,     setTemplate]     = useState({});
  /* distribute state */
  const [distributing, setDistributing] = useState(false);
  const [distProgress, setDistProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!selectedClass) return;
    setGenerated(false); setReportCards([]);
    (async () => {
      setMarksLoading(true);
      try {
        setMarks(await fetchMarksForClass(selectedClass));
      } catch (err) {
        toast({ variant: 'destructive', title: t('error'), description: err.message });
        setMarks([]);
      } finally { setMarksLoading(false); }
      const { data: cls } = await supabase.from('classes').select('name').eq('id', parseInt(selectedClass)).single();
      if (cls) setClassName(cls.name);

      /* fetch report template from school */
      if (schoolId) {
        const { data: sch } = await supabase.from('schools')
          .select('name, report_school_name, report_motto, report_address, report_principal, report_logo_url, report_accent_color')
          .eq('id', parseInt(schoolId)).maybeSingle();
        if (sch) setTemplate({
          school_name:  sch.report_school_name  || sch.name || '',
          motto:        sch.report_motto        || '',
          address:      sch.report_address      || '',
          principal:    sch.report_principal    || '',
          logo_url:     sch.report_logo_url     || '',
          accent_color: sch.report_accent_color || '#7c3aed',
        });
      }
    })();
  }, [selectedClass]);

  const toggleSeq = seq => setSelectedSeqs(p => p.includes(seq) ? p.filter(s => s !== seq) : [...p, seq]);

  const handleGenerate = async () => {
    if (!selectedSeqs.length) {
      toast({ variant: 'destructive', title: t('error'), description: 'Select at least one sequence.' });
      return;
    }
    setGenerating(true);
    try {
      const { cards, allSubjects: subs, className: cn } = await buildReportCards(selectedClass, schoolId, selectedSeqs);
      setReportCards(cards); setAllSubjects(subs);
      if (cn) setClassName(cn);
      setGenerated(true);
      toast({ title: `✓ ${t('success')}`, description: `${cards.length} ${t('reportCardsGenerated')}` });
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message });
    } finally { setGenerating(false); }
  };

  /* ── helper: build single-student HTML card ── */
  const buildStudentCardHtml = (student, allSubjects, className, selectedSeqs, template, totalCards) => {
    const period  = selectedSeqs.join(' + ');
    const accent  = template?.accent_color || '#7c3aed';
    const rows = allSubjects.map(sub => {
      const r = student.subjectRows.find(x => x.subject === sub);
      if (!r || !r.offered) return '';
      const mark     = r.markOn20 !== null ? r.markOn20.toFixed(2) : '—';
      const weighted = r.weighted  !== null ? r.weighted.toFixed(2) : '—';
      const color    = r.markOn20 === null ? '#6b7280' : r.markOn20 >= 10 ? '#15803d' : '#dc2626';
      return `<tr><td>${sub}</td><td class="c">${r.coef}</td><td class="c" style="color:${color};font-weight:700">${mark}</td><td class="c">${weighted}</td></tr>`;
    }).join('');
    const avgColor = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const decisionEn = student.average == null ? '—' : student.average >= 10 ? 'PROMOTED ✓' : 'NOT PROMOTED ✗';
    const decisionFr = student.average == null ? '—' : student.average >= 10 ? 'PROMU(E) ✓' : 'NON PROMU(E) ✗';
    const decColor   = student.average == null ? '#6b7280' : student.average >= 10 ? '#15803d' : '#dc2626';
    const sumW = student.subjectRows.filter(r => r.offered && r.weighted !== null).reduce((s, r) => s + r.weighted, 0).toFixed(2);
    const rankStr = student.rank ? `${ordinal(student.rank)} / ${totalCards}` : '—';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Report Card — ${student.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff;padding:28px;max-width:700px;margin:0 auto}
.hdr{text-align:center;border-bottom:3px solid ${accent};padding-bottom:14px;margin-bottom:16px}
.logo{max-height:60px;object-fit:contain;display:block;margin:0 auto 6px}
.school{font-size:17px;font-weight:800;color:${accent};letter-spacing:1px;text-transform:uppercase}
.motto{font-size:11px;font-style:italic;color:#6b7280;margin-top:3px}
.addr{font-size:10px;color:#9ca3af;margin-top:4px}
.sub{font-size:11px;font-weight:700;color:#374151;margin-top:6px;letter-spacing:3px;text-transform:uppercase}
.meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;margin-top:10px;font-size:11px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
th,td{border:1px solid #d1d5db;padding:6px 9px}
thead tr{background:${accent};color:#fff}
tbody tr:nth-child(even){background:#f8fafc}
tfoot .tot{background:#faf5ff;font-weight:600}
.c{text-align:center}
.sigs{display:flex;justify-content:space-between;margin-top:22px;font-size:10px;color:#6b7280;flex-wrap:wrap;gap:8px}
.bilingual{margin-top:16px;padding:10px;background:#f9fafb;border-radius:6px;font-size:11px;color:#374151;border:1px solid #e5e7eb}
</style></head><body>
<div class="hdr">
  ${template?.logo_url ? `<img class="logo" src="${template.logo_url}" alt="logo" onerror="this.style.display='none'">` : ''}
  <div class="school">${template?.school_name || schoolName || 'CloudCampus School'}</div>
  ${template?.motto  ? `<div class="motto">«${template.motto}»</div>` : ''}
  ${template?.address ? `<div class="addr">${template.address}</div>` : ''}
  <div class="sub">ACADEMIC REPORT CARD / BULLETIN DE NOTES</div>
  <div class="meta">
    <span><b>Student / Élève:</b> ${student.name}</span>
    <span><b>Class / Classe:</b> ${className}</span>
    <span><b>Period / Période:</b> ${period}</span>
    <span><b>Date:</b> ${new Date().toLocaleDateString()}</span>
  </div>
</div>
<table>
  <thead><tr><th>Subject / Matière</th><th>Coef</th><th>Mark / Note /20</th><th>Weighted / Pondéré</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr class="tot"><td colspan="2"><b>General Average / Moyenne Générale</b></td>
      <td class="c" style="color:${avgColor};font-size:1.15em;font-weight:800">${student.average !== null ? student.average.toFixed(2) + '/20' : '—'}</td>
      <td class="c">${sumW}</td></tr>
    <tr class="tot"><td colspan="2"><b>Class Rank / Rang</b></td>
      <td colspan="2" class="c">${rankStr}</td></tr>
    <tr class="tot"><td colspan="2"><b>Decision / Décision</b></td>
      <td colspan="2" class="c" style="color:${decColor};font-weight:700">${decisionEn} · ${decisionFr}</td></tr>
  </tfoot>
</table>
<div class="sigs">
  <span>Class Teacher / Prof Principal: ____________________</span>
  ${template?.principal ? `<span>Principal: ${template.principal}</span>` : '<span>Vice Principal / Censeur: ____________________</span>'}
  <span>Parent: ____________________</span>
</div>
</body></html>`;
  };

  /* ── distribute: generate individual HTML card per student, upload, notify ── */
  const handleDistribute = async () => {
    if (!reportCards.length) return;
    const vpName = localStorage.getItem('userName') || 'Vice Principal';
    const period = selectedSeqs.join(' + ');
    const total  = reportCards.length;
    setDistributing(true);
    setDistProgress({ done: 0, total });
    let sent = 0;

    try {
      const notifications = [];

      for (const student of reportCards) {
        // 1. Generate the individual HTML report card
        const html = buildStudentCardHtml(student, allSubjects, className, selectedSeqs, template, total);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const fileName = `report_${schoolId}_${period.replace(/[\s+]+/g, '_')}_${student.matricule}.html`;
        const storagePath = `report_cards/${schoolId}/${fileName}`;

        // 2. Upload to Supabase storage (library_documents bucket — UNRESTRICTED)
        let fileUrl = null;
        try {
          const { error: upErr } = await supabase.storage
            .from('library_documents')
            .upload(storagePath, blob, { upsert: true, contentType: 'text/html' });
          if (!upErr) {
            const { data: urlData } = supabase.storage
              .from('library_documents')
              .getPublicUrl(storagePath);
            fileUrl = urlData?.publicUrl || null;
          } else {
            console.warn('Upload error for', student.name, upErr.message);
          }
        } catch (upEx) {
          console.warn('Upload exception for', student.name, upEx.message);
        }

        // 3. Build bilingual notification content
        const avg      = student.average !== null ? student.average.toFixed(2) : '—';
        const rankStr  = student.rank ? `${student.rank}${student.rank===1?'st':student.rank===2?'nd':student.rank===3?'rd':'th'} / ${total}` : '—';
        const decEn    = student.average !== null ? (student.average >= 10 ? 'PROMOTED ✓' : 'NOT PROMOTED ✗') : '—';
        const decFr    = student.average !== null ? (student.average >= 10 ? 'PROMU(E) ✓' : 'NON PROMU(E) ✗') : '—';
        const graded   = student.subjectRows.filter(r => r.offered && r.markOn20 !== null);
        const lines    = graded.map(r => `• ${r.subject}: ${r.markOn20.toFixed(2)}/20 (coef ${r.coef})`).join('\n');

        const body = [
          `🇬🇧 ${period} results for your child:`,
          lines,
          `📊 Average: ${avg}/20  |  🏅 Rank: ${rankStr}  |  📋 ${decEn}`,
          ``,
          `🇫🇷 Résultats de ${period} pour votre enfant :`,
          lines,
          `📊 Moyenne : ${avg}/20  |  🏅 Rang : ${rankStr}  |  📋 ${decFr}`,
          fileUrl ? `\n📄 Ouvrez la pièce jointe pour voir le bulletin complet.` : '',
        ].join('\n');

        notifications.push({
          sender_name:  vpName,
          sender_role:  'vice_principal',
          title:        `📊 Report Card / Bulletin — ${period} · ${className}`,
          content:      body,
          target_type:  'parent',
          target_id:    student.matricule,
          school_id:    parseInt(schoolId),
          file_url:     fileUrl,
          created_at:   new Date().toISOString(),
        });

        sent++;
        setDistProgress({ done: sent, total });
      }

      // 4. Insert all notifications in chunks of 20
      const CHUNK = 20;
      for (let i = 0; i < notifications.length; i += CHUNK) {
        const { error } = await supabase.from('notifications').insert(notifications.slice(i, i + CHUNK));
        if (error) throw error;
      }

      toast({
        title: `✓ Distributed to ${sent} parents`,
        description: `Each parent received their child's report card${notifications[0]?.file_url ? ' with a PDF link' : ''}.`,
        className: 'bg-green-500/10 border-green-500/50 text-green-400',
      });
    } catch (err) {
      const hint = err.message?.includes('integer')
        ? 'Run SQL: ALTER TABLE notifications ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;'
        : err.message;
      toast({ variant: 'destructive', title: 'Distribution failed', description: hint });
    } finally {
      setDistributing(false);
      setDistProgress({ done: 0, total: 0 });
    }
  };

  /* Empty state */
  if (!selectedClass) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
          <div className="p-5 rounded-3xl bg-white/5"><FileCheck className="h-10 w-10 text-muted-foreground opacity-30" /></div>
          <p className="text-sm text-muted-foreground">{t('noClassSelected')}</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <>
      <Helmet><title>{t('marksReportCards')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/15">
              <GraduationCap className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                {t('marksReportCards')}
                {className && (
                  <span className="ml-3 text-sm font-bold px-3 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 align-middle">
                    {className}
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('marksReportDesc')}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 p-1 bg-white/4 border border-white/8 rounded-2xl w-fit">
            {[
              { id: 'marksheet',    label: t('marksheet'),   icon: ClipboardList },
              { id: 'reportcards',  label: t('reportCards'), icon: BookOpen      },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}>
                <tab.icon className="h-4 w-4" /> {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">

            {/* ── MARKSHEET ────────────────────────────── */}
            {activeTab === 'marksheet' && (
              <motion.div key="marksheet" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass rounded-2xl overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center justify-between flex-wrap gap-3 px-6 pt-6 pb-4 border-b border-white/8">
                    <div>
                      <h2 className="font-bold text-base">{t('marksheet')} — {className}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {viewMode === 'organized' ? t('organizedViewDesc') : t('flatViewDesc')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/8 rounded-xl">
                      {[
                        { id: 'organized', label: t('organizedView'), icon: LayoutList },
                        { id: 'flat',      label: t('flatView'),      icon: Table2     },
                      ].map(v => (
                        <button key={v.id} onClick={() => setViewMode(v.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                            viewMode === v.id
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow'
                              : 'text-muted-foreground hover:text-foreground'
                          )}>
                          <v.icon className="h-3.5 w-3.5" /> {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-6">
                    {marksLoading ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>
                    ) : viewMode === 'organized'
                      ? <OrganizedView marks={marks} t={t} />
                      : <FlatView      marks={marks} t={t} />
                    }
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── REPORT CARDS ─────────────────────────── */}
            {activeTab === 'reportcards' && (
              <motion.div key="reportcards" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-6">

                {/* Step 1 */}
                <div className="glass rounded-2xl p-6 space-y-5 border-t-2 border-t-purple-500/60">
                  <div>
                    <h2 className="font-bold text-base">{t('step1SelectSeqs')}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{t('step1Desc')}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SEQUENCES.map(seq => (
                      <label key={seq.value} className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all',
                        selectedSeqs.includes(seq.value)
                          ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                          : 'bg-white/4 border-white/8 hover:border-white/20 text-muted-foreground'
                      )}>
                        <input type="checkbox" checked={selectedSeqs.includes(seq.value)}
                          onChange={() => toggleSeq(seq.value)}
                          className="w-4 h-4 rounded accent-purple-500 shrink-0 cursor-pointer" />
                        <span className="text-sm font-medium">{seq.label}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={handleGenerate} disabled={generating || !selectedSeqs.length}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all active:scale-[0.98] disabled:opacity-50">
                    {generating
                      ? <><Loader2 className="h-4 w-4 animate-spin" />{t('generating')}</>
                      : <><RefreshCw className="h-4 w-4" />{t('generateBtn')}</>}
                  </button>
                </div>

                {/* Results */}
                {generated && (
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-white/8">
                      <div>
                        <h2 className="font-bold text-base">{className} — {selectedSeqs.join(' + ')}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reportCards.length} students · {allSubjects.length} subjects ·{' '}
                          <span className="text-green-400">green</span> ≥ 10/20, <span className="text-red-400">red</span> &lt; 10/20
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => exportCSV(reportCards, allSubjects, className, selectedSeqs)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all">
                          <Download className="h-3.5 w-3.5" /> {t('downloadCSV')}
                        </button>
                        <button onClick={() => printCards(reportCards, allSubjects, className, selectedSeqs, schoolName, template)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all">
                          <Printer className="h-3.5 w-3.5" /> {t('printPDF')}
                        </button>
                        <button
                          onClick={handleDistribute}
                          disabled={distributing}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-50">
                          {distributing
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('distributing')} {distProgress.done}/{distProgress.total}</>
                            : <><Send className="h-3.5 w-3.5" /> {t('distributeBtn')}</>}
                        </button>
                      </div>
                    </div>

                    <div className="p-4">
                      {!reportCards.length ? (
                        <p className="text-center py-8 text-muted-foreground text-sm">{t('noStudentsFound')}</p>
                      ) : (
                        <div className="overflow-auto">
                          <table className="text-sm border-collapse min-w-max w-full">
                            <thead>
                              <tr className="bg-white/5">
                                <th className="sticky left-0 z-10 bg-card p-3 border border-white/8 text-center font-semibold text-xs w-16">{t('rankLabel')}</th>
                                <th className="p-3 border border-white/8 text-left font-semibold text-xs min-w-[160px]">{t('studentLabel')}</th>
                                {allSubjects.map(sub => {
                                  const coef = reportCards[0]?.subjectRows.find(r => r.subject === sub)?.coef ?? 1;
                                  return (
                                    <th key={sub} className="p-3 border border-white/8 text-center font-semibold text-xs">
                                      <div>{sub}</div>
                                      <div className="text-[10px] font-normal text-muted-foreground">coef {coef}</div>
                                    </th>
                                  );
                                })}
                                <th className="p-3 border border-white/8 text-center font-bold text-xs bg-purple-500/10 text-purple-300 min-w-[100px]">
                                  {t('generalAverage')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportCards.map((s, idx) => (
                                <tr key={s.matricule} className={cn('border-b border-white/8 hover:bg-white/4', idx % 2 !== 0 && 'bg-white/[0.015]')}>
                                  <td className="sticky left-0 z-10 bg-card p-3 border border-white/8 text-center font-bold text-sm">
                                    <span className={s.rank === 1 ? 'text-yellow-400' : s.rank === 2 ? 'text-slate-300' : s.rank === 3 ? 'text-orange-400' : ''}>
                                      {ordinal(s.rank)}
                                    </span>
                                  </td>
                                  <td className="p-3 border border-white/8 font-medium">{s.name}</td>
                                  {allSubjects.map(sub => {
                                    const row = s.subjectRows.find(r => r.subject === sub);
                                    if (!row?.offered) return <td key={sub} className="p-3 border border-white/8 text-center text-xs text-muted-foreground/30">N/A</td>;
                                    const clr = row.markOn20 === null ? 'text-muted-foreground' : row.markOn20 >= 10 ? 'text-green-400' : 'text-red-400';
                                    return <td key={sub} className={cn('p-3 border border-white/8 text-center font-mono font-semibold text-sm', clr)}>{row.markOn20 !== null ? row.markOn20.toFixed(2) : '—'}</td>;
                                  })}
                                  <td className={cn('p-3 border border-white/8 text-center font-bold text-base bg-purple-500/5',
                                    s.average === null ? 'text-muted-foreground' : s.average >= 10 ? 'text-green-300' : 'text-red-400'
                                  )}>{s.average !== null ? s.average.toFixed(2) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </PageTransition>
    </>
  );
};

export default VPMarksPage;
