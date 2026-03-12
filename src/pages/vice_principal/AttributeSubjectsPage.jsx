/**
 * AttributeSubjectsPage.jsx — Vice Principal
 * VP can toggle subjects between Obligatory / Additional,
 * and assign specific students to additional subjects.
 *
 * Design: purple/pink glass, PageTransition, all strings via t()
 * Logic: unchanged from original
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Users, Lock, Unlock, Save, Search,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

const AttributeSubjectsPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const { t }     = useLanguage();
  const schoolId  = localStorage.getItem('schoolId');

  const [subjects,      setSubjects]      = useState([]);
  const [allStudents,   setAllStudents]   = useState([]);
  const [enrollments,   setEnrollments]   = useState({});
  const [search,        setSearch]        = useState({});
  const [loading,       setLoading]       = useState(false);
  const [savingSubject, setSavingSubject] = useState(null);

  useEffect(() => { setSubjects([]); setAllStudents([]); setEnrollments({}); setSearch({}); }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    (async () => {
      try {
        const { data: ttRows } = await supabase.from('timetables').select('subject').eq('class_id', selectedClass);
        const unique = [...new Set((ttRows || []).map(r => r.subject).filter(Boolean))].sort();

        const { data: configRows } = await supabase.from('class_subjects').select('subject, is_obligatory').eq('class_id', selectedClass);
        const configMap = Object.fromEntries((configRows || []).map(r => [r.subject, r.is_obligatory]));

        setSubjects(unique.map(subject => ({
          subject,
          is_obligatory: configMap[subject] !== undefined ? configMap[subject] : true,
          expanded: false,
        })));

        const { data: students } = await supabase.from('students').select('matricule, name').eq('class_id', selectedClass).order('name');
        setAllStudents(students || []);

        const { data: enrolRows } = await supabase.from('student_subject_enrollments').select('subject, student_matricule').eq('class_id', selectedClass);
        const enrolMap = {};
        (enrolRows || []).forEach(row => {
          if (!enrolMap[row.subject]) enrolMap[row.subject] = new Set();
          enrolMap[row.subject].add(row.student_matricule);
        });
        setEnrollments(enrolMap);
      } catch (err) {
        toast({ variant: 'destructive', title: t('subjectLoadError'), description: err.message });
      } finally { setLoading(false); }
    })();
  }, [selectedClass, schoolId, toast, t]);

  const toggleObligatory = (subject) =>
    setSubjects(prev => prev.map(s =>
      s.subject === subject ? { ...s, is_obligatory: !s.is_obligatory, expanded: s.is_obligatory ? false : s.expanded } : s
    ));

  const toggleExpand = (subject) =>
    setSubjects(prev => prev.map(s => s.subject === subject ? { ...s, expanded: !s.expanded } : s));

  const toggleStudent = (subject, matricule) =>
    setEnrollments(prev => {
      const cur = new Set(prev[subject] || []);
      cur.has(matricule) ? cur.delete(matricule) : cur.add(matricule);
      return { ...prev, [subject]: cur };
    });

  const toggleAll = (subject, all) =>
    setEnrollments(prev => ({
      ...prev,
      [subject]: all ? new Set(allStudents.map(s => s.matricule)) : new Set(),
    }));

  const saveSubject = async (subjectObj) => {
    const { subject, is_obligatory } = subjectObj;
    setSavingSubject(subject);
    try {
      const { error: configErr } = await supabase.from('class_subjects').upsert({
        class_id: parseInt(selectedClass), school_id: parseInt(schoolId), subject, is_obligatory,
      }, { onConflict: 'class_id,subject' });
      if (configErr) throw configErr;

      if (is_obligatory) {
        await supabase.from('student_subject_enrollments').delete().eq('class_id', selectedClass).eq('subject', subject);
        setEnrollments(prev => ({ ...prev, [subject]: new Set() }));
      } else {
        await supabase.from('student_subject_enrollments').delete().eq('class_id', selectedClass).eq('subject', subject);
        const chosen = [...(enrollments[subject] || new Set())];
        if (chosen.length) {
          const { error: enrolErr } = await supabase.from('student_subject_enrollments').insert(
            chosen.map(mat => ({ student_matricule: mat, class_id: parseInt(selectedClass), school_id: parseInt(schoolId), subject }))
          );
          if (enrolErr) throw enrolErr;
        }
      }
      toast({ title: `✓ ${t('success')}`, description: `${subject} ${t('savedAs')} ${is_obligatory ? t('obligatory') : t('additional')}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: t('subjectSaveError'), description: err.message });
    } finally { setSavingSubject(null); }
  };

  /* Empty state */
  if (!selectedClass) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
          <div className="p-5 rounded-3xl bg-white/5"><BookMarked className="h-10 w-10 text-muted-foreground opacity-30" /></div>
          <p className="text-sm text-muted-foreground">{t('noClassSelected')}</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <>
      <Helmet><title>{t('attributeSubjectsTitle')} · CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/15">
              <BookMarked className="h-7 w-7 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                {t('attributeSubjectsTitle')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('attributeSubjectsDesc')}</p>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-9 w-9 animate-spin text-purple-400" /></div>
          ) : subjects.length === 0 ? (
            <div className="glass rounded-2xl p-14 flex flex-col items-center text-center gap-4">
              <div className="p-5 rounded-3xl bg-white/5"><BookMarked className="h-9 w-9 text-muted-foreground opacity-30" /></div>
              <p className="text-sm text-muted-foreground">{t('noSubjectsFound')}</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
              {subjects.map((subjectObj) => {
                const { subject, is_obligatory, expanded } = subjectObj;
                const enrolSet   = enrollments[subject] || new Set();
                const enrolCount = is_obligatory ? allStudents.length : enrolSet.size;
                const isSaving   = savingSubject === subject;
                const searchTerm = (search[subject] || '').toLowerCase();
                const filtered   = allStudents.filter(s => s.name.toLowerCase().includes(searchTerm));

                return (
                  <motion.div key={subject} variants={fadeUp}>
                    <div className="glass rounded-2xl overflow-hidden border border-white/8 hover:border-purple-500/20 transition-colors duration-200">

                      {/* Subject row */}
                      <div className="flex items-center justify-between px-5 py-4 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-500/25 to-pink-500/15 flex items-center justify-center shrink-0">
                            <span className="text-purple-300 font-black text-lg">{subject.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate">{subject}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-full border',
                                is_obligatory
                                  ? 'bg-green-500/15 text-green-400 border-green-500/25'
                                  : 'bg-orange-500/15 text-orange-400 border-orange-500/25'
                              )}>
                                {is_obligatory ? t('obligatory') : t('additional')}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {is_obligatory
                                  ? `${allStudents.length} ${t('allStudentsCount')}`
                                  : `${enrolCount} ${t('studentsAssigned')}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Toggle obligatory/additional */}
                          <button onClick={() => toggleObligatory(subject)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95',
                              is_obligatory
                                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                                : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                            )}>
                            {is_obligatory
                              ? <><Lock className="h-3.5 w-3.5" /> {t('obligatory')}</>
                              : <><Unlock className="h-3.5 w-3.5" /> {t('additional')}</>}
                          </button>

                          {/* Expand student picker (additional only) */}
                          {!is_obligatory && (
                            <button onClick={() => toggleExpand(subject)}
                              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}

                          {/* Save */}
                          <button onClick={() => saveSubject(subjectObj)} disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:from-purple-500/30 hover:to-pink-500/25 transition-all active:scale-95 disabled:opacity-50">
                            {isSaving
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <><Save className="h-3.5 w-3.5" /> {t('saveSubject')}</>}
                          </button>
                        </div>
                      </div>

                      {/* Student picker */}
                      <AnimatePresence>
                        {!is_obligatory && expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden">
                            <div className="border-t border-white/8 px-5 py-4 space-y-3 bg-white/[0.015]">
                              {/* Search + all/none */}
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    placeholder={t('searchStudents')}
                                    className="pl-9 h-9 bg-white/5 border-white/10 focus:border-purple-500/50 rounded-xl text-sm"
                                    value={search[subject] || ''}
                                    onChange={e => setSearch(p => ({ ...p, [subject]: e.target.value }))}
                                  />
                                </div>
                                <button onClick={() => toggleAll(subject, true)}
                                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-all active:scale-95">
                                  {t('selectAll')}
                                </button>
                                <button onClick={() => toggleAll(subject, false)}
                                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold transition-all active:scale-95">
                                  {t('selectNone')}
                                </button>
                              </div>

                              {/* Student list */}
                              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 -mr-1">
                                {filtered.length === 0 ? (
                                  <p className="text-center py-6 text-sm text-muted-foreground">{t('noStudentsMatch')}</p>
                                ) : filtered.map(student => {
                                  const checked = enrolSet.has(student.matricule);
                                  return (
                                    <button key={student.matricule} onClick={() => toggleStudent(subject, student.matricule)}
                                      className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left active:scale-[0.99]',
                                        checked
                                          ? 'bg-purple-500/15 border-purple-500/30'
                                          : 'border-transparent hover:bg-white/5 hover:border-white/10'
                                      )}>
                                      <div className={cn(
                                        'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                                        checked ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-transparent shadow-md shadow-purple-500/30' : 'border-muted-foreground/30'
                                      )}>
                                        {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium leading-tight truncate">{student.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{student.matricule}</p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <p className="text-[11px] text-muted-foreground text-right">
                                <span className="font-bold text-purple-400">{enrolSet.size}</span> / {allStudents.length} {t('selectedCount')}
                              </p>
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
        </div>
      </PageTransition>
    </>
  );
};

export default AttributeSubjectsPage;
