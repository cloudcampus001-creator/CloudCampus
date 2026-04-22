/**
 * ParentReportCardPage.jsx
 * Parent sees only published/deliberated report cards.
 * When VP publishes → parent is notified → comes here → sees published periods → opens PDF.
 * Each published card opens in a new window (auto-prints / save as PDF).
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookMarked, Loader2, FileText, ExternalLink,
  Lock, CheckCircle2, Bell, GraduationCap,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const fmt = (n) => n != null ? Number(n).toFixed(2) : '—';
const getMention = (avg) => {
  if (avg == null) return '—';
  if (avg >= 18) return 'Excellent';
  if (avg >= 16) return 'Très Bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez Bien';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
};
const scoreColor = (avg) => {
  if (avg == null) return 'text-muted-foreground';
  if (avg >= 10) return 'text-emerald-400';
  if (avg >= 8)  return 'text-amber-400';
  return 'text-red-400';
};

/* ── Client-side average recompute ── */
const computeSeqAvg = (marks, seqId, subject) => {
  const r = marks.filter(m => m.sequence_id === seqId && m.subject === subject);
  if (!r.length) return null;
  const vals = r.map(m => (m.mark / (m.total_marks || 20)) * 20);
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
};
const computeGeneralAvgForPeriod = (marks, sequences, publication, coeffMap) => {
  const scopeSeqs = publication.period_type === 'sequence'
    ? sequences.filter(s => s.id === publication.period_id)
    : sequences.filter(s => s.term_id === publication.period_id);
  const subjects = [...new Set(marks.filter(m => scopeSeqs.some(s => s.id === m.sequence_id)).map(m => m.subject))];
  let tw = 0, tc = 0;
  subjects.forEach(subj => {
    const avgs = scopeSeqs.map(seq => computeSeqAvg(marks, seq.id, subj)).filter(v => v != null);
    if (!avgs.length) return;
    const avg = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const c = coeffMap[subj] || 1;
    tw += avg * c; tc += c;
  });
  return tc === 0 ? null : Math.round((tw / tc) * 100) / 100;
};

const ParentReportCardPage = () => {
  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');
  const studentName      = localStorage.getItem('studentName') || 'Élève';

  const [loading,       setLoading]       = useState(true);
  const [publications,  setPublications]  = useState([]);
  const [myMarks,       setMyMarks]       = useState([]);
  const [sequences,     setSequences]     = useState([]);
  const [coeffMap,      setCoeffMap]      = useState({});
  const [currentYear,   setCurrentYear]   = useState(null);
  const [openingPdf,    setOpeningPdf]    = useState(null); // pub.id being opened

  useEffect(() => {
    if (!schoolId || !classId) return;
    (async () => {
      setLoading(true);
      // Get current year
      const { data: year } = await supabase.from('academic_years').select('id,name').eq('school_id', +schoolId).eq('is_current', true).maybeSingle();
      if (!year) { setLoading(false); return; }
      setCurrentYear(year);

      // Get published periods for this class
      const { data: pubs } = await supabase.from('report_card_publications').select('*')
        .eq('class_id', +classId).eq('academic_year_id', year.id)
        .order('published_at', { ascending: false });
      setPublications(pubs || []);

      if (!pubs?.length) { setLoading(false); return; }

      // Get my marks + sequences + coefficients in parallel
      const [{ data: marks }, { data: seqs }, { data: coeffs }] = await Promise.all([
        supabase.from('student_marks').select('subject,mark,total_marks,sequence_id').eq('student_matricule', studentMatricule).eq('academic_year_id', year.id),
        supabase.from('sequences').select('*').eq('academic_year_id', year.id).order('sequence_index'),
        supabase.from('subject_coefficients').select('subject_name,coefficient').eq('class_id', +classId),
      ]);
      setMyMarks(marks || []);
      setSequences(seqs || []);
      const cmap = {};
      (coeffs||[]).forEach(c => { cmap[c.subject_name] = c.coefficient; });
      setCoeffMap(cmap);
      setLoading(false);
    })();
  }, [schoolId, classId, studentMatricule]);

  /* ── Open report card PDF in new window ── */
  const openReportCard = async (pub) => {
    setOpeningPdf(pub.id);
    try {
      // If we have a storage URL, construct it from base path
      if (pub.storage_base_path) {
        const filePath = `${pub.storage_base_path}/${studentMatricule}.html`;
        const { data: urlData } = supabase.storage.from('library_documents').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          window.open(urlData.publicUrl, '_blank');
          setOpeningPdf(null);
          return;
        }
      }
      // Fallback: check notifications for a file_url
      const { data: notif } = await supabase.from('notifications').select('file_url').eq('target_type', 'parent').eq('target_id', studentMatricule).ilike('title', `%${pub.period_name}%`).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (notif?.file_url) {
        window.open(notif.file_url, '_blank');
      } else {
        // No stored file — show a message
        alert('Le fichier PDF n\'est pas encore disponible. Veuillez réessayer plus tard.');
      }
    } catch {
      alert('Impossible d\'ouvrir le bulletin. Veuillez réessayer.');
    } finally {
      setOpeningPdf(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  );

  return (
    <PageTransition>
      <Helmet><title>Mes Bulletins · CloudCampus</title></Helmet>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <GraduationCap className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-black text-2xl">Mes Bulletins</h1>
            <p className="text-sm text-muted-foreground">{studentName} · {currentYear?.name || '—'}</p>
          </div>
        </motion.div>

        {/* No publications yet */}
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
                Vous recevrez une notification dès qu'un bulletin est prêt.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> Notifications activées
            </div>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">
              <span className="font-bold text-foreground">{publications.length}</span> bulletin{publications.length > 1 ? 's' : ''} disponible{publications.length > 1 ? 's' : ''}
            </p>

            {publications.map(pub => {
              const myAvg = computeGeneralAvgForPeriod(myMarks, sequences, pub, coeffMap);
              const isOpening = openingPdf === pub.id;
              return (
                <motion.div key={pub.id} variants={fadeUp}
                  className="glass rounded-2xl border border-white/10 hover:border-white/20 transition-all overflow-hidden">
                  <div className="flex items-center gap-4 p-5">
                    {/* Period badge */}
                    <div className="h-12 w-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex flex-col items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>

                    {/* Info */}
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
                        Publié le {new Date(pub.published_at).toLocaleDateString('fr-FR')} par {pub.published_by_vp_name || 'le Censeur'}
                      </p>
                    </div>

                    {/* My average (recomputed client-side) */}
                    {myAvg != null && (
                      <div className="text-right shrink-0 mr-2">
                        <p className={cn('text-2xl font-black', scoreColor(myAvg))}>{fmt(myAvg)}</p>
                        <p className="text-[10px] text-muted-foreground">{getMention(myAvg)}</p>
                      </div>
                    )}

                    {/* Open button */}
                    <button
                      onClick={() => openReportCard(pub)}
                      disabled={isOpening}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 text-blue-300 text-sm font-semibold transition-all active:scale-95 shrink-0 disabled:opacity-60">
                      {isOpening
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <ExternalLink className="h-4 w-4" />}
                      <span className="hidden sm:inline">Ouvrir PDF</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Info box */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-xs text-muted-foreground">
          <Bell className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p>Vous serez notifié(e) dès qu'un nouveau bulletin est publié par votre établissement. Cliquez sur <b className="text-foreground">Ouvrir PDF</b> pour consulter ou imprimer votre bulletin.</p>
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default ParentReportCardPage;
