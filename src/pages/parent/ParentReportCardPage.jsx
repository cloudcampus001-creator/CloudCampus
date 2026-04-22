/**
 * ParentReportCardPage.jsx
 * Parent views their child's report card with term tabs
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookMarked, Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import { ReportCardView } from '@/components/ReportCardView';

const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const ParentReportCardPage = () => {
  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');
  const studentName      = localStorage.getItem('studentName') || 'Élève';

  const [yearId,       setYearId]       = useState(null);
  const [terms,        setTerms]        = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null); // null = annual
  const [initLoading,  setInitLoading]  = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    const init = async () => {
      setInitLoading(true);
      const { data: year } = await supabase
        .from('academic_years')
        .select('id,name')
        .eq('school_id', +schoolId)
        .eq('is_current', true)
        .maybeSingle();

      if (!year) { setInitLoading(false); return; }
      setYearId(year.id);

      const { data: t } = await supabase
        .from('terms')
        .select('*')
        .eq('academic_year_id', year.id)
        .order('term_index');
      setTerms(t || []);
      setInitLoading(false);
    };
    init();
  }, [schoolId]);

  if (initLoading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  );

  if (!yearId) return (
    <div className="text-center py-24 text-muted-foreground text-sm">
      Aucune année scolaire active pour le moment.
    </div>
  );

  return (
    <PageTransition>
      <Helmet><title>Mon Bulletin · CloudCampus</title></Helmet>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <BookMarked className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="font-black text-2xl">Bulletin de Notes</h1>
            <p className="text-sm text-muted-foreground">{studentName}</p>
          </div>
        </motion.div>

        {/* Term tabs */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible"
          className="flex flex-wrap gap-2 p-1 glass rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setSelectedTerm(null)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
              !selectedTerm
                ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 shadow-lg shadow-blue-500/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
            )}>
            Bilan Annuel
          </button>
          {terms.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTerm(t)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                selectedTerm?.id === t.id
                  ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 shadow-lg shadow-blue-500/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent'
              )}>
              {t.name}
            </button>
          ))}
        </motion.div>

        {/* The actual report card */}
        <ReportCardView
          studentMatricule={studentMatricule}
          yearId={yearId}
          classId={classId}
          schoolId={schoolId}
          termId={selectedTerm?.id || null}
        />
      </div>
    </PageTransition>
  );
};

export default ParentReportCardPage;
