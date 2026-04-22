/**
 * VPReportCardsPage.jsx — rebuilt with sequence/term selector, PDF, publish & distribute
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, Search, Loader2, MessageSquare, X, Save, Send,
  GraduationCap, Printer, CheckCircle2, AlertCircle, Layers, Calendar,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

const fmt   = (n)        => n != null ? Number(n).toFixed(2) : '—';
const round = (n)        => n != null ? Math.round(n * 100) / 100 : null;

const scoreColor = (avg) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= 10) return 'text-emerald-400';
  if (avg >= 8)  return 'text-amber-400';
  return 'text-red-400';
};

const getMention = (avg) => {
  if (avg == null) return '—';
  if (avg >= 18) return 'Excellent';
  if (avg >= 16) return 'Très Bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez Bien';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
};

const CONDUCT_OPTIONS = ['Excellent','Très Bien','Bien','Assez Bien','Passable','À améliorer'];
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22 } } };

/* ── Client-side average computation ─────────────────────── */
const computeSeqAvg = (marks, seqId, subject) => {
  const r = marks.filter(m => m.sequence_id === seqId && m.subject === subject);
  if (!r.length) return null;
  const vals = r.map(m => (m.mark / (m.total_marks || 20)) * 20);
  return round(vals.reduce((a, b) => a + b, 0) / vals.length);
};
const computeTermAvgForSubject = (marks, sequences, termId, subject) => {
  const seqs = sequences.filter(s => s.term_id === termId);
  const avgs = seqs.map(s => computeSeqAvg(marks, s.id, subject)).filter(v => v != null);
  return avgs.length ? round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
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

/* ── Build printable HTML for a single student ──────────── */
const buildCardHtml = ({ student, school, year, periodName, periodType, subjectRows, scopeSequences, generalAvg, rank, totalStudents, absences, comment, accent = '#6366f1' }) => {
  const avgColor  = generalAvg == null ? '#6b7280' : generalAvg >= 10 ? '#15803d' : '#dc2626';
  const seqHeaders = scopeSequences.map(s => `<th style="text-align:center;min-width:58px">${s.name}</th>`).join('');
  const rows = subjectRows.map(row => {
    const color = row.avg == null ? '#6b7280' : row.avg >= 10 ? '#15803d' : '#dc2626';
    const seqCells = scopeSequences.map(seq => {
      const v = row.seqAvgs?.[seq.id];
      const c2 = v == null ? '#6b7280' : v >= 10 ? '#15803d' : '#dc2626';
      return `<td style="text-align:center;color:${c2};font-weight:600">${v != null ? v.toFixed(2) : '—'}</td>`;
    }).join('');
    return `<tr><td>${row.subject}</td><td style="text-align:center">${row.coeff}</td>${seqCells}<td style="text-align:center;color:${color};font-weight:700">${row.avg != null ? row.avg.toFixed(2) : '—'}</td><td style="text-align:center;color:${color}">${getMention(row.avg)}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Bulletin — ${student.name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1f2937;background:#fff;padding:15mm}
.hdr{text-align:center;border-bottom:3px solid ${accent};padding-bottom:12px;margin-bottom:14px}.school{font-size:16px;font-weight:900;color:${accent};letter-spacing:1px;text-transform:uppercase}
.title-row{background:${accent};color:#fff;text-align:center;padding:6px;font-weight:700;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:10px 0 8px;border-radius:4px}
.info-grid{display:flex;flex-wrap:wrap;gap:5px;font-size:11px;margin-bottom:8px}.info-grid span{background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;padding:2px 7px}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d1d5db;padding:4px 7px}thead tr{background:${accent};color:#fff;font-weight:700}
tbody tr:nth-child(even){background:#f8fafc}.gen-row td{background:#eef2ff;font-weight:700}
.stats{display:flex;border:1px solid #d1d5db;border-radius:5px;overflow:hidden;margin:8px 0}.stat{flex:1;text-align:center;padding:7px 3px;border-right:1px solid #d1d5db}.stat:last-child{border-right:none}
.stat-v{font-size:17px;font-weight:900;color:${accent}}.stat-l{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.cmts{display:flex;gap:7px;margin-top:9px}.cmt{flex:1;border:1px solid #d1d5db;border-radius:3px;padding:5px;min-height:44px;font-size:10px}
.clbl{font-size:9px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
.sigs{display:flex;gap:8px;margin-top:18px;font-size:10px;color:#6b7280}.sig{flex:1;border-top:1px solid #d1d5db;padding-top:5px;text-align:center}
@media print{@page{size:A4;margin:12mm}body{padding:0}}</style></head><body>
<div class="hdr">${school?.logo_url ? `<img src="${school.logo_url}" style="max-height:50px;object-fit:contain;display:block;margin:0 auto 5px" onerror="this.style.display='none'">` : ''}<div class="school">${school?.name || 'CloudCampus'}</div>${school?.address ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px">${school.address}</div>` : ''}</div>
<div class="title-row">BULLETIN DE NOTES — ${periodType === 'sequence' ? 'SÉQUENCE' : 'TRIMESTRE / SEMESTRE'}</div>
<div class="info-grid"><span><b>Élève :</b> ${student.name}</span><span><b>Matricule :</b> ${student.matricule}</span><span><b>Période :</b> ${periodName}</span><span><b>Année :</b> ${year?.name || ''}</span><span><b>Date :</b> ${new Date().toLocaleDateString('fr-FR')}</span></div>
<div class="stats"><div class="stat"><div class="stat-v" style="color:${avgColor}">${fmt(generalAvg)}/20</div><div class="stat-l">Moy. Gén.</div></div><div class="stat"><div class="stat-v">${rank ? `${rank}e/${totalStudents}` : '—'}</div><div class="stat-l">Rang</div></div><div class="stat"><div class="stat-v">${absences?.justified||0}h</div><div class="stat-l">Abs. Just.</div></div><div class="stat"><div class="stat-v" style="color:${(absences?.unjustified||0)>0?'#dc2626':'#1f2937'}">${absences?.unjustified||0}h</div><div class="stat-l">Abs. Inj.</div></div><div class="stat"><div class="stat-v" style="font-size:12px">${getMention(generalAvg)}</div><div class="stat-l">Mention</div></div></div>
<table><thead><tr><th style="text-align:left;min-width:120px">Matière</th><th style="text-align:center;width:38px">Coef</th>${seqHeaders}<th style="text-align:center;min-width:68px">Moy. Période</th><th style="text-align:center;min-width:75px">Mention</th></tr></thead><tbody>${rows}<tr class="gen-row"><td colspan="${2+scopeSequences.length}"><b>MOYENNE GÉNÉRALE</b></td><td style="text-align:center;color:${avgColor};font-size:13px"><b>${fmt(generalAvg)}/20</b></td><td style="text-align:center"><b>${getMention(generalAvg)}</b></td></tr></tbody></table>
<div class="cmts"><div class="cmt"><div class="clbl">Appréciation du Prof. Principal</div>${comment?.teacher_comment||''}</div><div class="cmt"><div class="clbl">Appréciation du Censeur</div>${comment?.vp_comment||''}</div><div class="cmt" style="max-width:140px"><div class="clbl">Conduite</div><b>${comment?.conduct||'—'}</b></div></div>
<div class="sigs"><div class="sig">Signature du Parent / Tuteur</div><div class="sig">Signature du Prof. Principal</div><div class="sig">Cachet & Signature du Censeur</div></div>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},500)});</script>
</body></html>`;
};

/* ── Glass Modal ─────────────────────────────────────────── */
const GlassModal = ({ open, onClose, title, icon: Icon, children }) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass rounded-3xl p-6 w-full max-w-lg border border-white/15 shadow-2xl shadow-black/50 space-y-5"
          style={{ background: 'rgba(10,10,20,0.90)', backdropFilter: 'blur(24px)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Icon className="h-5 w-5 text-indigo-400" />
              </div>
              <p className="font-black text-base">{title}</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Comment Modal ───────────────────────────────────────── */
const CommentModal = ({ open, onClose, student, yearId, termId, schoolId, onSaved }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vpComment, setVpComment] = useState('');
  const [tComment, setTComment] = useState('');
  const [conduct, setConduct] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setLoaded(false);
    const q = supabase.from('report_card_comments').select('*')
      .eq('student_matricule', student.matricule).eq('academic_year_id', yearId);
    if (termId) q.eq('term_id', termId); else q.is('term_id', null);
    q.maybeSingle().then(({ data }) => {
      setVpComment(data?.vp_comment || ''); setTComment(data?.teacher_comment || ''); setConduct(data?.conduct || '');
      setLoaded(true);
    });
  }, [open, student, yearId, termId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('report_card_comments').upsert({
      student_matricule: student.matricule, academic_year_id: yearId, term_id: termId || null,
      school_id: +localStorage.getItem('schoolId'), vp_comment: vpComment || null,
      teacher_comment: tComment || null, conduct: conduct || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'student_matricule,academic_year_id,term_id' });
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Erreur', description: error.message }); return; }
    toast({ title: '✅ Commentaires sauvegardés' }); onSaved?.(); onClose();
  };

  return (
    <GlassModal open={open} onClose={onClose} title="Commentaires" icon={MessageSquare}>
      {!loaded ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div> : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground font-semibold">{student?.name}</p>
          {[['Appréciation du Prof. Principal', tComment, setTComment], ['Appréciation du Censeur', vpComment, setVpComment]].map(([label, val, set]) => (
            <div key={label} className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</label>
              <textarea value={val} onChange={e => set(e.target.value)} rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Conduite</label>
            <div className="flex flex-wrap gap-2">
              {CONDUCT_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setConduct(c => c === opt ? '' : opt)}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', conduct === opt ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10 transition-all">Annuler</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder
            </button>
          </div>
        </div>
      )}
    </GlassModal>
  );
};

/* ═══════════════════ MAIN PAGE ══════════════════════════════ */
const VPReportCardsPage = () => {
  const { toast } = useToast();
  const schoolId  = localStorage.getItem('schoolId');
  const vpId      = localStorage.getItem('userId');
  const vpName    = localStorage.getItem('userName') || 'Vice Principal';

  const [currentYear,    setCurrentYear]    = useState(null);
  const [classes,        setClasses]        = useState([]);
  const [selectedClass,  setSelectedClass]  = useState(null);
  const [terms,          setTerms]          = useState([]);
  const [sequences,      setSequences]      = useState([]);
  const [periodType,     setPeriodType]     = useState('sequence');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [students,       setStudents]       = useState([]);
  const [coeffMap,       setCoeffMap]       = useState({});
  const [loading,        setLoading]        = useState(false);
  const [search,         setSearch]         = useState('');
  const [publishing,     setPublishing]     = useState(false);
  const [pubProgress,    setPubProgress]    = useState({ done: 0, total: 0 });
  const [published,      setPublished]      = useState([]);
  const [commentTarget,  setCommentTarget]  = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  /* ── Init ── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const [{ data: year }, { data: cls }] = await Promise.all([
        supabase.from('academic_years').select('*').eq('school_id', +schoolId).eq('is_current', true).maybeSingle(),
        supabase.from('classes').select('id,name').eq('school_id', +schoolId).eq('vp_id', +vpId).order('name'),
      ]);
      setCurrentYear(year || null);
      setClasses(cls || []);
      if (cls?.length === 1) setSelectedClass(cls[0]);
      if (year) {
        const [{ data: t }, { data: s }] = await Promise.all([
          supabase.from('terms').select('*').eq('academic_year_id', year.id).order('term_index'),
          supabase.from('sequences').select('*').eq('academic_year_id', year.id).order('sequence_index'),
        ]);
        setTerms(t || []); setSequences(s || []);
      }
    })();
  }, [schoolId, vpId]);

  /* ── Load publications for selected class ── */
  useEffect(() => {
    if (!selectedClass || !currentYear) return;
    supabase.from('report_card_publications').select('*')
      .eq('class_id', selectedClass.id).eq('academic_year_id', currentYear.id)
      .order('published_at', { ascending: false })
      .then(({ data }) => setPublished(data || []));
  }, [selectedClass, currentYear]);

  const periods = periodType === 'sequence' ? sequences : terms;

  /* ── Load students for selected period ── */
  const loadStudents = useCallback(async () => {
    if (!selectedClass || !currentYear || !selectedPeriod) return;
    setLoading(true);
    try {
      const { data: enrollments } = await supabase.from('student_enrollments')
        .select('student_matricule, students(name)').eq('class_id', selectedClass.id).eq('academic_year_id', currentYear.id);
      let list = enrollments?.length
        ? enrollments.map(e => ({ matricule: e.student_matricule, name: e.students?.name || e.student_matricule }))
        : ((await supabase.from('students').select('matricule,name').eq('class_id', selectedClass.id).order('name')).data || []);
      if (!list.length) { setStudents([]); setLoading(false); return; }

      const mats = list.map(s => s.matricule);
      const [{ data: allMarks }, { data: coeffRows }, { data: absRows }, { data: commentRows }] = await Promise.all([
        supabase.from('student_marks').select('student_matricule,subject,mark,total_marks,sequence_id').in('student_matricule', mats).eq('academic_year_id', currentYear.id),
        supabase.from('subject_coefficients').select('subject_name,coefficient').eq('class_id', selectedClass.id),
        supabase.from('absences').select('student_matricule,duration,is_justified').in('student_matricule', mats).eq('academic_year_id', currentYear.id),
        supabase.from('report_card_comments').select('*').in('student_matricule', mats).eq('academic_year_id', currentYear.id),
      ]);

      const cmap = {};
      (coeffRows||[]).forEach(c => { cmap[c.subject_name] = c.coefficient; });
      setCoeffMap(cmap);

      const marksMap = {};
      (allMarks||[]).forEach(m => { if (!marksMap[m.student_matricule]) marksMap[m.student_matricule] = []; marksMap[m.student_matricule].push(m); });

      const absMap = {};
      (absRows||[]).forEach(a => {
        if (!absMap[a.student_matricule]) absMap[a.student_matricule] = { justified: 0, unjustified: 0 };
        if (a.is_justified) absMap[a.student_matricule].justified += (a.duration||0);
        else absMap[a.student_matricule].unjustified += (a.duration||0);
      });

      const commentMap = {};
      (commentRows||[]).forEach(c => {
        if (!commentMap[c.student_matricule]) commentMap[c.student_matricule] = {};
        commentMap[c.student_matricule][c.term_id || 'annual'] = c;
      });

      const scopeSequences = periodType === 'sequence' ? [selectedPeriod] : sequences.filter(s => s.term_id === selectedPeriod.id);
      const commentTermId = periodType === 'sequence' ? selectedPeriod.term_id : selectedPeriod.id;

      const allSubjects = [...new Set((allMarks||[]).filter(m => scopeSequences.some(s => s.id === m.sequence_id)).map(m => m.subject))].sort();

      const withAvg = list.map(s => {
        const marks = marksMap[s.matricule] || [];
        const subjectAvgs = {};
        allSubjects.forEach(subj => {
          subjectAvgs[subj] = periodType === 'sequence'
            ? computeSeqAvg(marks, selectedPeriod.id, subj)
            : computeTermAvgForSubject(marks, sequences, selectedPeriod.id, subj);
        });
        const generalAvg = computeGeneralAvg(subjectAvgs, cmap);
        const subjectRows = allSubjects.map(subj => {
          const seqAvgs = {};
          scopeSequences.forEach(seq => { seqAvgs[seq.id] = computeSeqAvg(marks, seq.id, subj); });
          return { subject: subj, coeff: cmap[subj] || 1, seqAvgs, avg: subjectAvgs[subj] };
        });
        return {
          ...s, generalAvg, subjectRows, allSubjects,
          absences: absMap[s.matricule] || { justified: 0, unjustified: 0 },
          comment: commentMap[s.matricule]?.[commentTermId] || null,
        };
      });

      const sorted = [...withAvg].sort((a, b) => b.generalAvg == null ? -1 : a.generalAvg == null ? 1 : b.generalAvg - a.generalAvg);
      const rankMap = {};
      sorted.forEach((s, i) => { rankMap[s.matricule] = i + 1; });
      const final = withAvg.map(s => ({ ...s, rank: rankMap[s.matricule] }));
      final.sort((a, b) => (a.rank||999) - (b.rank||999));
      setStudents(final);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClass, currentYear, selectedPeriod, periodType, sequences, toast]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  /* ── Open PDF (new window, auto-prints) ── */
  const openPdf = async (student) => {
    const { data: school } = await supabase.from('schools').select('name,address,logo_url,report_accent_color').eq('id', +schoolId).maybeSingle();
    const scopeSequences = periodType === 'sequence' ? [selectedPeriod] : sequences.filter(s => s.term_id === selectedPeriod.id);
    const termId = periodType === 'sequence' ? selectedPeriod.term_id : selectedPeriod.id;
    let comment = student.comment;
    if (!comment) {
      const q = supabase.from('report_card_comments').select('*').eq('student_matricule', student.matricule).eq('academic_year_id', currentYear.id);
      if (termId) q.eq('term_id', termId); else q.is('term_id', null);
      const { data } = await q.maybeSingle();
      comment = data;
    }
    const html = buildCardHtml({ student, school, year: currentYear, periodName: selectedPeriod.name, periodType, subjectRows: student.subjectRows, scopeSequences, generalAvg: student.generalAvg, rank: student.rank, totalStudents: students.length, absences: student.absences, comment, accent: school?.report_accent_color || '#6366f1' });
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  /* ── Publish & Distribute ── */
  const handlePublish = async () => {
    setConfirmPublish(false);
    if (!students.length || !selectedPeriod) return;
    setPublishing(true);
    setPubProgress({ done: 0, total: students.length });
    try {
      const { data: school } = await supabase.from('schools').select('name,address,logo_url,report_accent_color').eq('id', +schoolId).maybeSingle();
      const accent = school?.report_accent_color || '#6366f1';
      const scopeSequences = periodType === 'sequence' ? [selectedPeriod] : sequences.filter(s => s.term_id === selectedPeriod.id);
      const termId = periodType === 'sequence' ? selectedPeriod.term_id : selectedPeriod.id;
      const basePath = `report_cards/${schoolId}/${selectedClass.id}/${periodType}_${selectedPeriod.id}`;
      const notifications = [];
      let done = 0;

      for (const student of students) {
        const q = supabase.from('report_card_comments').select('*').eq('student_matricule', student.matricule).eq('academic_year_id', currentYear.id);
        if (termId) q.eq('term_id', termId); else q.is('term_id', null);
        const { data: commentRow } = await q.maybeSingle();
        const html = buildCardHtml({ student, school, year: currentYear, periodName: selectedPeriod.name, periodType, subjectRows: student.subjectRows, scopeSequences, generalAvg: student.generalAvg, rank: student.rank, totalStudents: students.length, absences: student.absences, comment: commentRow, accent });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        let fileUrl = null;
        try {
          const { error: upErr } = await supabase.storage.from('library_documents').upload(`${basePath}/${student.matricule}.html`, blob, { upsert: true, contentType: 'text/html' });
          if (!upErr) { const { data: u } = supabase.storage.from('library_documents').getPublicUrl(`${basePath}/${student.matricule}.html`); fileUrl = u?.publicUrl || null; }
        } catch {}
        notifications.push({ sender_name: vpName, sender_role: 'vice_principal', title: `📊 Bulletin disponible — ${selectedPeriod.name} · ${selectedClass.name}`, content: `Le bulletin de ${selectedPeriod.name} est disponible.\nMoyenne : ${fmt(student.generalAvg)}/20  |  Rang : ${student.rank}e/${students.length}  |  Mention : ${getMention(student.generalAvg)}\n\nConnectez-vous pour voir le bulletin complet.`, target_type: 'parent', target_id: student.matricule, school_id: +schoolId, file_url: fileUrl, created_at: new Date().toISOString() });
        done++; setPubProgress({ done, total: students.length });
      }

      for (let i = 0; i < notifications.length; i += 20) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 20));
      }
      await supabase.from('report_card_publications').upsert({ school_id: +schoolId, academic_year_id: currentYear.id, class_id: selectedClass.id, period_type: periodType, period_id: selectedPeriod.id, period_name: selectedPeriod.name, storage_base_path: basePath, published_at: new Date().toISOString(), published_by_vp_id: vpId, published_by_vp_name: vpName, total_students: students.length }, { onConflict: 'class_id,period_type,period_id' });
      const { data: newPubs } = await supabase.from('report_card_publications').select('*').eq('class_id', selectedClass.id).eq('academic_year_id', currentYear.id).order('published_at', { ascending: false });
      setPublished(newPubs || []);
      toast({ title: `✅ Bulletins distribués — ${students.length} parents notifiés`, description: `${selectedPeriod.name} · ${selectedClass.name}` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur lors de la distribution', description: e.message });
    } finally { setPublishing(false); setPubProgress({ done: 0, total: 0 }); }
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.matricule.toLowerCase().includes(search.toLowerCase()));
  const isAlreadyPublished = published.some(p => p.period_type === periodType && p.period_id === selectedPeriod?.id);

  return (
    <PageTransition>
      <Helmet><title>Bulletins de Notes · CloudCampus</title></Helmet>
      <div className="max-w-5xl mx-auto space-y-6">

        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <BookMarked className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-black text-2xl">Bulletins de Notes</h1>
            <p className="text-sm text-muted-foreground">{currentYear?.name || '—'}</p>
          </div>
        </motion.div>

        {/* Selectors */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="glass rounded-2xl p-5 border border-white/10 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Classe</label>
            <div className="flex flex-wrap gap-2">
              {classes.map(c => (
                <button key={c.id} onClick={() => { setSelectedClass(c); setSelectedPeriod(null); setStudents([]); }}
                  className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', selectedClass?.id === c.id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Type de bulletin</label>
            <div className="flex gap-2">
              {[{ id: 'sequence', label: 'Par Séquence', icon: Layers }, { id: 'term', label: 'Par Trimestre / Semestre', icon: Calendar }].map(opt => (
                <button key={opt.id} onClick={() => { setPeriodType(opt.id); setSelectedPeriod(null); setStudents([]); }}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all', periodType === opt.id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                  <opt.icon className="h-4 w-4" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {periods.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">{periodType === 'sequence' ? 'Séquence' : 'Période'}</label>
              <div className="flex flex-wrap gap-2">
                {periods.map(p => {
                  const alreadyPub = published.some(pub => pub.period_type === periodType && pub.period_id === p.id);
                  return (
                    <button key={p.id} onClick={() => setSelectedPeriod(p)}
                      className={cn('px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all', selectedPeriod?.id === p.id ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10')}>
                      {p.name}
                      {alreadyPub && <span className="ml-1.5 text-emerald-400 text-[9px] font-bold">✓ Publié</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {selectedPeriod && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un élève…" className="pl-9 bg-white/5 border-white/10 focus:border-indigo-500/50 rounded-xl" />
              </div>
              {students.length > 0 && (
                <button onClick={() => setConfirmPublish(true)} disabled={publishing}
                  className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-70',
                    isAlreadyPublished ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-indigo-500 hover:bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-500/25')}>
                  {publishing ? <><Loader2 className="h-4 w-4 animate-spin" /> {pubProgress.done}/{pubProgress.total}</> : <><Send className="h-4 w-4" /> {isAlreadyPublished ? 'Re-distribuer' : 'Publier & Distribuer'}</>}
                </button>
              )}
            </div>

            {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /></div>
            : filtered.length === 0 ? <div className="text-center py-12 text-muted-foreground text-sm">{students.length === 0 ? 'Aucun élève ou note pour cette période' : 'Aucun résultat'}</div>
            : (
              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
                <p className="text-xs text-muted-foreground px-1"><span className="font-bold text-foreground">{filtered.length}</span> élèves · {students.filter(s => s.generalAvg != null && s.generalAvg >= 10).length} ≥ 10</p>
                {filtered.map(student => (
                  <motion.div key={student.matricule} variants={fadeUp} className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex items-center gap-4 p-4">
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm border shrink-0', student.rank === 1 ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' : student.rank <= 3 ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-muted-foreground')}>
                        {student.rank}e
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground">{student.matricule}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-xl font-black', scoreColor(student.generalAvg))}>{fmt(student.generalAvg)}</p>
                        <p className="text-[10px] text-muted-foreground">/ 20</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setCommentTarget(student)} className="h-8 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-muted-foreground transition-all flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" /> Note
                        </button>
                        <button onClick={() => openPdf(student)} className="h-8 px-3 rounded-xl bg-indigo-500/15 border border-indigo-500/25 hover:bg-indigo-500/25 text-xs font-semibold text-indigo-300 transition-all flex items-center gap-1.5">
                          <Printer className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}

        {/* Published history */}
        {published.length > 0 && selectedClass && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="font-bold text-sm">Bulletins publiés — {selectedClass?.name}</p>
            </div>
            <div className="divide-y divide-white/5">
              {published.map(pub => (
                <div key={pub.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{pub.period_name} <span className="text-xs font-normal text-muted-foreground">({pub.period_type === 'sequence' ? 'Séquence' : 'Trimestre'})</span></p>
                    <p className="text-xs text-muted-foreground">{pub.total_students} élèves · {new Date(pub.published_at).toLocaleDateString('fr-FR')} · {pub.published_by_vp_name}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Distribué
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {commentTarget && <CommentModal open={!!commentTarget} onClose={() => setCommentTarget(null)} student={commentTarget} yearId={currentYear?.id} termId={periodType === 'term' ? selectedPeriod?.id : selectedPeriod?.term_id} schoolId={schoolId} onSaved={loadStudents} />}
      </AnimatePresence>

      <GlassModal open={confirmPublish} onClose={() => setConfirmPublish(false)} title="Publier & Distribuer" icon={Send}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Vous allez publier les bulletins de <b className="text-foreground">{selectedPeriod?.name}</b> pour <b className="text-foreground">{selectedClass?.name}</b> et notifier <b className="text-foreground">{students.length} parents</b>.</p>
          {isAlreadyPublished && <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> Cette période a déjà été publiée. Les parents recevront une notification mise à jour.</div>}
          <div className="flex gap-3">
            <button onClick={() => setConfirmPublish(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold hover:bg-white/10 transition-all">Annuler</button>
            <button onClick={handlePublish} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all">
              <Send className="h-4 w-4" /> Confirmer
            </button>
          </div>
        </div>
      </GlassModal>
    </PageTransition>
  );
};

export default VPReportCardsPage;
