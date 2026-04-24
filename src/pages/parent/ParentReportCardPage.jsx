/**
 * ParentReportCardPage.jsx
 * Parent sees only VP-published report cards.
 * PDF/bulletin is shown in the internal ReportCardViewerModal — no download.
 * Generated on-demand from live data (no storage dependency).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, Loader2, FileText,
  Lock, CheckCircle2, Bell, AlertCircle, Eye,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import { ReportCardViewerModal } from '@/components/ReportCardViewerModal';
import {
  fetchSchoolTemplate, buildCardHtml,
  computeSeqAvg, computeTermAvgForSubject, computeGeneralAvg,
  fmt, getMention,
} from '@/lib/reportCardBuilder';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const scoreColor = (avg) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= 10)  return 'text-emerald-400';
  if (avg >= 8)   return 'text-amber-400';
  return 'text-red-400';
};

const ParentReportCardPage = () => {
  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');
  const studentName      = localStorage.getItem('studentName') || 'Élève';

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [publications, setPublications] = useState([]);
  const [currentYear,  setCurrentYear]  = useState(null);
  const [previewAvgs,  setPreviewAvgs]  = useState({});

  // Viewer state
  const [viewerOpen,    setViewerOpen]    = useState(false);
  const [viewerHtml,    setViewerHtml]    = useState('');
  const [viewerTitle,   setViewerTitle]   = useState('');
  const [generatingId,  setGeneratingId]  = useState(null);

  /* ── Load publications + preview averages ── */
  useEffect(() => {
    if (!schoolId || !classId || !studentMatricule) return;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: year, error: ye } = await supabase
          .from('academic_years').select('id,name')
          .eq('school_id', +schoolId).eq('is_current', true).maybeSingle();
        if (ye) throw ye;
        if (!year) { setLoading(false); return; }
        setCurrentYear(year);

        const { data: pubs, error: pe } = await supabase
          .from('report_card_publications').select('*')
          .eq('class_id', +classId).eq('academic_year_id', year.id)
          .order('published_at', { ascending: false });
        if (pe) throw pe;
        setPublications(pubs || []);

        if (!pubs?.length) { setLoading(false); return; }

        const [{ data: marks }, { data: seqs }, { data: coeffs }] = await Promise.all([
          supabase.from('student_marks').select('subject,mark,total_marks,sequence_id')
            .eq('student_matricule', studentMatricule).eq('academic_year_id', year.id),
          supabase.from('sequences').select('*').eq('academic_year_id', year.id),
          supabase.from('subject_coefficients').select('subject_name,coefficient').eq('class_id', +classId),
        ]);

        const cmap = {};
        (coeffs || []).forEach(c => { cmap[c.subject_name] = c.coefficient; });

        const avgs = {};
        for (const pub of pubs) {
          const scopeSeqs = pub.period_type === 'sequence'
            ? (seqs || []).filter(s => s.id === pub.period_id)
            : (seqs || []).filter(s => s.term_id === pub.period_id);
          const subjects = [...new Set((marks || []).filter(m => scopeSeqs.some(s => s.id === m.sequence_id)).map(m => m.subject))];
          const subjectAvgs = {};
          subjects.forEach(subj => {
            subjectAvgs[subj] = pub.period_type === 'sequence'
              ? computeSeqAvg(marks || [], pub.period_id, subj)
              : computeTermAvgForSubject(marks || [], seqs || [], pub.period_id, subj);
          });
          avgs[pub.id] = computeGeneralAvg(subjectAvgs, cmap);
        }
        setPreviewAvgs(avgs);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [schoolId, classId, studentMatricule]);

  /* ── Generate and open bulletin in viewer ── */
  const openViewer = useCallback(async (pub) => {
    setGeneratingId(pub.id);
    try {
      const [
        template,
        { data: student },
        { data: allSeqs },
        { data: marks },
        { data: coeffRows },
        { data: absRows },
        { data: enrollments },
      ] = await Promise.all([
        fetchSchoolTemplate(schoolId),
        supabase.from('students').select('name,matricule,date_of_birth,gender').eq('matricule', studentMatricule).maybeSingle(),
        supabase.from('sequences').select('*').eq('academic_year_id', currentYear.id).order('sequence_index'),
        supabase.from('student_marks').select('subject,mark,total_marks,sequence_id')
          .eq('student_matricule', studentMatricule).eq('academic_year_id', currentYear.id),
        supabase.from('subject_coefficients').select('subject_name,coefficient').eq('class_id', +classId),
        supabase.from('absences').select('duration,is_justified')
          .eq('student_matricule', studentMatricule).eq('academic_year_id', currentYear.id),
        supabase.from('student_enrollments').select('student_matricule')
          .eq('class_id', +classId).eq('academic_year_id', currentYear.id),
      ]);

      const scopeSequences = pub.period_type === 'sequence'
        ? (allSeqs || []).filter(s => s.id === pub.period_id)
        : (allSeqs || []).filter(s => s.term_id === pub.period_id);

      const cmap = {};
      (coeffRows || []).forEach(c => { cmap[c.subject_name] = c.coefficient; });

      const subjects = [...new Set((marks || [])
        .filter(m => scopeSequences.some(s => s.id === m.sequence_id))
        .map(m => m.subject)
      )].sort();

      const subjectRows = subjects.map(subj => {
        const seqAvgs = {};
        scopeSequences.forEach(seq => { seqAvgs[seq.id] = computeSeqAvg(marks || [], seq.id, subj); });
        const avg = pub.period_type === 'sequence'
          ? seqAvgs[pub.period_id]
          : computeTermAvgForSubject(marks || [], allSeqs || [], pub.period_id, subj);
        return { subject: subj, coeff: cmap[subj] || 1, seqAvgs, avg };
      });

      const subjectAvgsMap = {};
      subjectRows.forEach(r => { subjectAvgsMap[r.subject] = r.avg; });
      const generalAvg = computeGeneralAvg(subjectAvgsMap, cmap);

      // Rank
      let classmateList = (enrollments || []).map(e => e.student_matricule);
      if (!classmateList.length) {
        const { data: fb } = await supabase.from('students').select('matricule').eq('class_id', +classId);
        classmateList = (fb || []).map(s => s.matricule);
      }
      let rank = null;
      if (classmateList.length > 1 && generalAvg != null) {
        const { data: cmMarks } = await supabase.from('student_marks')
          .select('student_matricule,subject,mark,total_marks,sequence_id')
          .in('student_matricule', classmateList).eq('academic_year_id', currentYear.id);
        const marksMap = {};
        (cmMarks || []).forEach(m => {
          if (!marksMap[m.student_matricule]) marksMap[m.student_matricule] = [];
          marksMap[m.student_matricule].push(m);
        });
        const cmAvgs = classmateList.map(mat => {
          const cm = marksMap[mat] || [];
          const sa = {};
          subjects.forEach(subj => {
            sa[subj] = pub.period_type === 'sequence'
              ? computeSeqAvg(cm, pub.period_id, subj)
              : computeTermAvgForSubject(cm, allSeqs || [], pub.period_id, subj);
          });
          return computeGeneralAvg(sa, cmap);
        });
        rank = cmAvgs.filter(a => a != null && a > generalAvg).length + 1;
      }

      // Absences
      const justified   = (absRows || []).filter(a => a.is_justified).reduce((s, a) => s + (a.duration || 0), 0);
      const unjustified = (absRows || []).filter(a => !a.is_justified).reduce((s, a) => s + (a.duration || 0), 0);

      // Comment
      const termId = pub.period_type === 'sequence' ? scopeSequences[0]?.term_id : pub.period_id;
      const cq = supabase.from('report_card_comments').select('*')
        .eq('student_matricule', studentMatricule).eq('academic_year_id', currentYear.id);
      if (termId) cq.eq('term_id', termId); else cq.is('term_id', null);
      const { data: commentRow } = await cq.maybeSingle();

      // Build HTML for viewer — autoPrint: false (no auto-print in iframe)
      const html = buildCardHtml({
        student:       student || { name: studentName, matricule: studentMatricule },
        template,
        year:          currentYear,
        periodName:    pub.period_name,
        periodType:    pub.period_type,
        subjectRows,
        scopeSequences,
        generalAvg,
        rank,
        totalStudents: classmateList.length || pub.total_students || 1,
        absences:      { justified, unjustified },
        comment:       commentRow || null,
        autoPrint:     false,  // ← view only, no auto-print
      });

      setViewerHtml(html);
      setViewerTitle(`Bulletin — ${pub.period_name}`);
      setViewerOpen(true);
    } catch (e) {
      alert('Impossible de générer le bulletin : ' + e.message);
    } finally {
      setGeneratingId(null);
    }
  }, [currentYear, schoolId, classId, studentMatricule, studentName]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-red-400 py-12 justify-center text-sm">
      <AlertCircle className="h-5 w-5" /> {error}
    </div>
  );

  return (
    <PageTransition>
      <Helmet><title>Mes Bulletins · CloudCampus</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">

        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-black text-2xl">Mes Bulletins</h1>
            <p className="text-sm text-muted-foreground">{studentName} · {currentYear?.name || '—'}</p>
          </div>
        </motion.div>

        {!publications.length ? (
          <motion.div variants={fadeUp} initial="hidden" animate="visible"
            className="glass rounded-3xl border border-white/10 p-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-bold text-foreground">Aucun bulletin disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vos bulletins apparaîtront ici dès qu'ils seront publiés par le Censeur.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> Vous serez notifié(e) dès qu'un bulletin est disponible
            </div>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              <span className="font-bold text-foreground">{publications.length}</span> bulletin{publications.length > 1 ? 's' : ''} disponible{publications.length > 1 ? 's' : ''}
            </p>

            {publications.map(pub => {
              const myAvg  = previewAvgs[pub.id];
              const isGen  = generatingId === pub.id;
              return (
                <motion.div key={pub.id} variants={fadeUp}
                  className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{pub.period_name}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Publié
                        </span>
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border',
                          pub.period_type === 'sequence'
                            ? 'bg-purple-500/15 border-purple-500/25 text-purple-300'
                            : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300')}>
                          {pub.period_type === 'sequence' ? 'Séquence' : 'Trimestre'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(pub.published_at).toLocaleDateString('fr-FR')} · {pub.published_by_vp_name || 'Censeur'}
                      </p>
                    </div>

                    {myAvg != null && (
                      <div className="text-right shrink-0 mr-2 hidden sm:block">
                        <p className={cn('text-2xl font-black', scoreColor(myAvg))}>{fmt(myAvg)}</p>
                        <p className="text-[10px] text-muted-foreground">{getMention(myAvg)}</p>
                      </div>
                    )}

                    <button
                      onClick={() => openViewer(pub)}
                      disabled={isGen}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 text-blue-300 text-sm font-semibold transition-all active:scale-95 shrink-0 disabled:opacity-60">
                      {isGen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                      <span className="hidden sm:inline">{isGen ? 'Chargement…' : 'Voir'}</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-xs text-muted-foreground">
          <Bell className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p>Vous êtes notifié(e) dès qu'un nouveau bulletin est publié par votre établissement. Cliquez sur <b className="text-foreground">Voir</b> pour consulter le bulletin directement dans l'application.</p>
        </motion.div>
      </div>

      {/* Internal viewer — no download for parents */}
      <ReportCardViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        htmlContent={viewerHtml}
        title={viewerTitle}
        subtitle={studentName}
        canDownload={false}
      />
    </PageTransition>
  );
};

export default ParentReportCardPage;
