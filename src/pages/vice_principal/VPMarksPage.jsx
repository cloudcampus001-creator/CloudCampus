/**
 * VPMarksPage.jsx — Vice Principal
 * Marksheet only: Organized (accordion) or Flat table
 * Report Cards have been moved to VPReportCardsPage.jsx
 */
import React, { useState, useEffect } from 'react';
import {
  FileCheck, Loader2, GraduationCap,
  ChevronDown, ChevronRight,
  LayoutList, Table2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

async function fetchMarksForClass(classId) {
  const cid = parseInt(classId);
  const { data: rawMarks, error } = await supabase
    .from('student_marks')
    .select('id, student_matricule, teacher_id, subject, assessment_name, mark, total_marks, created_at')
    .eq('class_id', cid).order('assessment_name').order('subject').limit(2000);
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

function OrganizedView({ marks, t }) {
  const [openSeqs, setOpenSeqs]   = useState({});
  const [openSubjs, setOpenSubjs] = useState({});
  const grouped = {};
  marks.forEach(m => {
    const seq = m.assessment_name, sub = m.subject, teacher = m.teachers?.name || '—';
    if (!grouped[seq]) grouped[seq] = {};
    if (!grouped[seq][sub]) grouped[seq][sub] = { teacher, rows: [] };
    grouped[seq][sub].rows.push({ name: m.students?.name || m.student_matricule || '—', mark: m.mark, total: m.total_marks });
  });
  Object.values(grouped).forEach(subjects => Object.values(subjects).forEach(s => s.rows.sort((a, b) => a.name.localeCompare(b.name))));
  const seqOrder = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB || a.localeCompare(b);
  });
  if (!seqOrder.length) return <p className="text-center py-8 text-muted-foreground text-sm">{t('noMarksYet')}</p>;
  return (
    <div className="space-y-3">
      {seqOrder.map(seq => {
        const seqOpen = openSeqs[seq] !== false;
        const subjects = Object.keys(grouped[seq]).sort();
        const totalM = Object.values(grouped[seq]).reduce((n, s) => n + s.rows.length, 0);
        return (
          <div key={seq} className="rounded-2xl border border-white/8 overflow-hidden">
            <button onClick={() => setOpenSeqs(p => ({ ...p, [seq]: !p[seq] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/8 hover:bg-purple-500/12 transition-colors text-left">
              <div className="flex items-center gap-3">
                {seqOpen ? <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />}
                <span className="font-bold text-purple-300">{seq}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">{subjects.length} matières · {totalM} notes</span>
              </div>
            </button>
            {seqOpen && (
              <div className="divide-y divide-white/5">
                {subjects.map(sub => {
                  const { teacher, rows } = grouped[seq][sub];
                  const key = `${seq}||${sub}`;
                  const subjOpen = openSubjs[key] !== false;
                  const passed = rows.filter(r => r.mark / r.total >= 0.5).length;
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
                            <thead><tr className="bg-white/5 border-b border-white/8">{[t('studentLabel'), 'Note', 'Sur 20'].map(h => (<th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">{h}</th>))}</tr></thead>
                            <tbody>
                              {rows.map((row, i) => {
                                const on20 = (row.mark * 20) / row.total;
                                return (
                                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/4">
                                    <td className="px-3 py-2 font-medium">{row.name}</td>
                                    <td className="px-3 py-2 text-center text-muted-foreground">{row.mark} / {row.total}</td>
                                    <td className={cn('px-3 py-2 text-center font-bold font-mono', on20 >= 10 ? 'text-green-400' : 'text-red-400')}>{on20.toFixed(2)}</td>
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

function FlatView({ marks, t }) {
  if (!marks.length) return <p className="text-center py-8 text-muted-foreground text-sm">{t('noMarksYet')}</p>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm text-left">
        <thead><tr className="border-b border-white/8">{[t('studentLabel'), 'Matière', 'Séquence', 'Note', 'Date'].map(h => (<th key={h} className="h-10 px-4 font-medium text-muted-foreground text-xs">{h}</th>))}</tr></thead>
        <tbody>
          {marks.map((m, i) => {
            const pass = m.mark / m.total_marks >= 0.5;
            return (
              <tr key={m.id ?? i} className="border-b border-white/6 hover:bg-white/4">
                <td className="p-3 font-medium">{m.students?.name || m.student_matricule}</td>
                <td className="p-3">{m.subject}</td>
                <td className="p-3 text-muted-foreground">{m.assessment_name}</td>
                <td className="p-3"><span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', pass ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-red-500/15 text-red-400 border-red-500/25')}>{m.mark} / {m.total_marks}</span></td>
                <td className="p-3 text-muted-foreground text-xs">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const VPMarksPage = ({ selectedClass }) => {
  const { toast }      = useToast();
  const { t }          = useLanguage();
  const [marks,        setMarks]        = useState([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [viewMode,     setViewMode]     = useState('organized');
  const [className,    setClassName]    = useState('');

  useEffect(() => {
    if (!selectedClass) return;
    setMarks([]);
    (async () => {
      setMarksLoading(true);
      try { setMarks(await fetchMarksForClass(selectedClass)); }
      catch (err) { toast({ variant: 'destructive', title: t('error'), description: err.message }); setMarks([]); }
      finally { setMarksLoading(false); }
      const { data: cls } = await supabase.from('classes').select('name').eq('id', parseInt(selectedClass)).single();
      if (cls) setClassName(cls.name);
    })();
  }, [selectedClass]);

  if (!selectedClass) return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
        <div className="p-5 rounded-3xl bg-white/5"><FileCheck className="h-10 w-10 text-muted-foreground opacity-30" /></div>
        <p className="text-sm text-muted-foreground">{t('noClassSelected')}</p>
      </div>
    </PageTransition>
  );

  return (
    <>
      <Helmet><title>Feuille de Notes · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/15">
              <GraduationCap className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                {t('marksheet')}{className && <span className="ml-3 text-sm font-bold px-3 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 align-middle">{className}</span>}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Toutes les notes saisies par les enseignants</p>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-3 px-6 pt-6 pb-4 border-b border-white/8">
                <div>
                  <h2 className="font-bold text-base">{t('marksheet')} — {className}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{viewMode === 'organized' ? t('organizedViewDesc') : t('flatViewDesc')}</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/8 rounded-xl">
                  {[{ id: 'organized', label: t('organizedView'), icon: LayoutList }, { id: 'flat', label: t('flatView'), icon: Table2 }].map(v => (
                    <button key={v.id} onClick={() => setViewMode(v.id)}
                      className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        viewMode === v.id ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow' : 'text-muted-foreground hover:text-foreground')}>
                      <v.icon className="h-3.5 w-3.5" /> {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6">
                {marksLoading
                  ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /></div>
                  : viewMode === 'organized' ? <OrganizedView marks={marks} t={t} /> : <FlatView marks={marks} t={t} />}
              </div>
            </div>
          </motion.div>
        </div>
      </PageTransition>
    </>
  );
};

export default VPMarksPage;
