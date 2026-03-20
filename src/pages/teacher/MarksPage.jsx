import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Save, Loader2, AlertTriangle, UserX, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const MarksPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const SEQUENCES = [
    { value: 'Sequence 1', label: t('seq1') },
    { value: 'Sequence 2', label: t('seq2') },
    { value: 'Sequence 3', label: t('seq3') },
    { value: 'Sequence 4', label: t('seq4') },
    { value: 'Sequence 5', label: t('seq5') },
    { value: 'Sequence 6', label: t('seq6') },
  ];

  const [classOptions,    setClassOptions]    = useState([]);
  const [subjectOptions,  setSubjectOptions]  = useState([]);
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSeq,     setSelectedSeq]     = useState('');
  const [students,        setStudents]        = useState([]);
  const [marks,           setMarks]           = useState({});
  const [totalMarks,      setTotalMarks]      = useState(20);
  const [missing,         setMissing]         = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [checkingDup,     setCheckingDup]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [showWarning,     setShowWarning]     = useState(false);
  const [showFillZero,    setShowFillZero]    = useState(false);
  const [dupInfo,         setDupInfo]         = useState(null);

  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  /* 1. load classes */
  useEffect(() => {
    supabase.from('timetables').select('class_id, classes(id, name)').eq('teacher_id', teacherId)
      .then(({ data }) => {
        const seen = new Set(), unique = [];
        data?.forEach(item => {
          if (item.classes && !seen.has(item.class_id)) {
            seen.add(item.class_id);
            unique.push({ id: item.classes.id, name: item.classes.name });
          }
        });
        setClassOptions(unique);
      });
  }, [teacherId]);

  /* 2. class → subjects */
  useEffect(() => {
    if (!selectedClass) { setSubjectOptions([]); setStudents([]); setSelectedSubject(''); setSelectedSeq(''); setMarks({}); setMissing([]); return; }
    supabase.from('timetables').select('subject').eq('teacher_id', teacherId).eq('class_id', selectedClass)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.subject).filter(Boolean))];
        setSubjectOptions(unique);
        setSelectedSubject(unique.length === 1 ? unique[0] : '');
      });
    setSelectedSeq(''); setMarks({}); setMissing([]);
  }, [selectedClass, teacherId]);

  /* 3. subject/seq → enrolled students */
  useEffect(() => {
    if (!selectedClass || !selectedSubject) { setStudents([]); setMarks({}); setMissing([]); return; }
    const fetch = async () => {
      setLoadingStudents(true);
      try {
        const { data: subjectConfig } = await supabase.from('class_subjects')
          .select('is_obligatory').eq('class_id', selectedClass).eq('subject', selectedSubject).maybeSingle();
        const isObligatory = subjectConfig === null || subjectConfig?.is_obligatory !== false;
        let enrolled = [];
        if (isObligatory) {
          const { data } = await supabase.from('students').select('*').eq('class_id', selectedClass).order('name');
          enrolled = data || [];
        } else {
          const { data: enrolRows } = await supabase.from('student_subject_enrollments')
            .select('student_matricule').eq('class_id', selectedClass).eq('subject', selectedSubject);
          const mats = (enrolRows || []).map(e => e.student_matricule);
          if (mats.length > 0) {
            const { data } = await supabase.from('students').select('*').in('matricule', mats).order('name');
            enrolled = data || [];
          }
        }
        setStudents(enrolled); setMarks({}); setMissing([]);
      } catch (err) { console.error(err); }
      finally { setLoadingStudents(false); }
    };
    fetch();
  }, [selectedClass, selectedSubject]);

  /* 4. detect missing when sequence chosen */
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedSeq || students.length === 0) { setMissing([]); return; }
    const detect = async () => {
      setCheckingDup(true);
      try {
        const { data: existing } = await supabase.from('student_marks').select('student_matricule')
          .eq('class_id', selectedClass).eq('subject', selectedSubject)
          .eq('assessment_name', selectedSeq).eq('teacher_id', teacherId);
        const alreadyHave = new Set((existing || []).map(r => r.student_matricule));
        setMissing(students.filter(s => !alreadyHave.has(s.matricule)));
        setDupInfo(alreadyHave.size > 0 ? { count: alreadyHave.size } : null);
      } catch (err) { console.error(err); }
      finally { setCheckingDup(false); }
    };
    detect();
  }, [selectedClass, selectedSubject, selectedSeq, students, teacherId]);

  const handleMarkChange = (matricule, value) => {
    if (value === '' || (Number(value) >= 0 && Number(value) <= totalMarks))
      setMarks(prev => ({ ...prev, [matricule]: value }));
  };

  const fillMissingWithZero = () => {
    setMarks(prev => {
      const updated = { ...prev };
      missing.forEach(s => { if (!updated[s.matricule]) updated[s.matricule] = '0'; });
      return updated;
    });
    setShowFillZero(false);
    toast({ title: t('success'), description: `${missing.length} students filled with 0.` });
  };

  const doSubmit = async () => {
    setSaving(true);
    try {
      const marksData = students
        .filter(s => marks[s.matricule] !== '' && marks[s.matricule] !== undefined)
        .map(s => ({
          student_matricule: s.matricule, teacher_id: parseInt(teacherId),
          class_id: parseInt(selectedClass), subject: selectedSubject,
          assessment_name: selectedSeq, mark: parseFloat(marks[s.matricule]),
          total_marks: parseFloat(totalMarks), school_id: parseInt(schoolId),
          created_at: new Date().toISOString(),
        }));
      if (marksData.length === 0) throw new Error('No marks entered.');
      await supabase.from('student_marks').delete()
        .eq('class_id', parseInt(selectedClass)).eq('subject', selectedSubject)
        .eq('assessment_name', selectedSeq).eq('teacher_id', parseInt(teacherId));
      const { error } = await supabase.from('student_marks').insert(marksData);
      if (error) throw error;

      // ── Notify each student's parent ─────────────────────────────────────
      // Send one notification per student so parents see their child's mark
      // directly in their notification feed.
      const teacherName = localStorage.getItem('userName') || 'Teacher';
      const className = classOptions.find(c => c.id.toString() === selectedClass)?.name || '';
      try {
        const notifications = marksData.map(m => {
          const on20 = ((m.mark / m.total_marks) * 20).toFixed(2);
          return {
            sender_name:  teacherName,
            sender_role:  'teacher',
            title:        `${t('markNotifTitle')}: ${selectedSubject} — ${selectedSeq}`,
            content:      `${t('markNotifContent').replace('{mark}', m.mark).replace('{total}', m.total_marks).replace('{on20}', on20).replace('{subject}', selectedSubject).replace('{seq}', selectedSeq)}${className ? ` · ${className}` : ''}.`,
            target_type:  'parent',
            target_id:    m.student_matricule, // requires: ALTER TABLE notifications ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT;
            school_id:    parseInt(schoolId),
            created_at:   new Date().toISOString(),
          };
        });
        const { error: notifErr } = await supabase.from('notifications').insert(notifications);
        if (notifErr) {
          // Most likely cause: target_id column is still INTEGER — run the SQL migration
          console.error('Mark notifications failed:', notifErr.message);
          toast({ variant: 'destructive', title: t('error'), description: `Run SQL migration: ALTER TABLE notifications ALTER COLUMN target_id TYPE TEXT USING target_id::TEXT; — ${notifErr.message}` });
        }
      } catch (notifErr) {
        console.error('Could not send mark notifications:', notifErr.message);
      }

      toast({ title: `✓ ${t('success')}`, description: t('marksSaved') });
      setMarks({}); setDupInfo(null); setMissing([]);
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message || t('marksError') });
    } finally { setSaving(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !selectedSeq) {
      toast({ variant: 'destructive', title: t('error'), description: 'Select class, subject and sequence.' }); return;
    }
    const filled = Object.values(marks).filter(v => v !== '' && v !== undefined);
    if (filled.length === 0) {
      toast({ variant: 'destructive', title: t('error'), description: 'Enter at least one mark.' }); return;
    }
    if (dupInfo) setShowWarning(true); else await doSubmit();
  };

  const readyToShow    = selectedClass && selectedSubject && selectedSeq && !loadingStudents;
  const missingCount   = missing.filter(s => marks[s.matricule] === undefined || marks[s.matricule] === '').length;

  return (
    <>
      <Helmet><title>{t('enterMarks')} — CloudCampus</title></Helmet>

      {/* Overwrite dialog */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> {t('marksExistWarning')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('marksExistDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-yellow-600 hover:bg-yellow-700"
              onClick={async () => { setShowWarning(false); await doSubmit(); }}>
              {t('yesReplace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fill zero dialog */}
      <AlertDialog open={showFillZero} onOpenChange={setShowFillZero}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" /> {t('fillZeroTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{missingCount}</strong> {t('fillZeroDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={fillMissingWithZero}>
              {t('fillWithZero')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PageTransition>
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400 flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-emerald-400 shrink-0" />
              {t('enterMarks')}
            </h1>
          </motion.div>

          {/* Selectors */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('classLabel')}</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11">
                      <SelectValue placeholder={t('selectClass')} />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('subjectSection')}</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11">
                      <SelectValue placeholder={selectedClass ? t('selectSubject') : t('selectClassFirst')} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">{t('sequence')}</Label>
                  <Select value={selectedSeq} onValueChange={setSelectedSeq} disabled={!selectedSubject}>
                    <SelectTrigger className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11">
                      <SelectValue placeholder={selectedSubject ? t('selectSequence') : t('selectSubjectFirst')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SEQUENCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Overwrite banner */}
              <AnimatePresence>
                {dupInfo && !checkingDup && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-500">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p className="text-sm">{t('marksExistBanner')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Student marks list */}
          {readyToShow && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="glass rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="font-bold text-base">{t('studentMarks')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedSubject} · {selectedSeq}
                      {students.length > 0 && <span className="ml-1.5">({students.length} {t('studentsEnrolled')})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">{t('totalMarks')}:</Label>
                    <Input type="number" className="w-20 bg-white/5 border-white/10 rounded-xl h-9 text-center"
                      value={totalMarks} onChange={e => setTotalMarks(e.target.value)} min={1} />
                  </div>
                </div>

                {students.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">{t('noStudentsEnrolled')}</p>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Missing marks banner */}
                    <AnimatePresence>
                      {missingCount > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30">
                          <div className="flex items-center gap-2 text-orange-400">
                            <UserX className="h-4 w-4 shrink-0" />
                            <p className="text-sm"><strong>{missingCount}</strong> {t('missingMarksBanner')}</p>
                          </div>
                          <button type="button" onClick={() => setShowFillZero(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/40 text-orange-400 text-xs font-semibold hover:bg-orange-500/10 transition-colors shrink-0">
                            <CheckCheck className="h-3.5 w-3.5" /> {t('fillWithZero')}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                      {students.map((student, idx) => {
                        const val      = marks[student.matricule];
                        const hasMark  = val !== undefined && val !== '';
                        const isMissing = missing.some(m => m.matricule === student.matricule);
                        return (
                          <motion.div key={student.matricule}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.015 }}
                            className={cn(
                              'flex items-center justify-between p-3.5 rounded-xl border transition-colors',
                              hasMark ? 'bg-emerald-500/5 border-emerald-500/20'
                                : isMissing && selectedSeq ? 'bg-orange-500/5 border-orange-500/20'
                                : 'bg-white/3 border-white/6'
                            )}>
                            <div>
                              <p className="font-medium text-sm">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.matricule}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input type="number" placeholder="—" className="w-20 text-right bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-9"
                                value={val ?? ''} onChange={e => handleMarkChange(student.matricule, e.target.value)}
                                step="0.5" min={0} max={totalMarks} />
                              <span className="text-muted-foreground text-sm w-8">/ {totalMarks}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    <button type="submit" disabled={saving || students.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                      {saving
                        ? <><Loader2 className="h-4 w-4 animate-spin" />{t('savingMarks')}</>
                        : <><Save className="h-4 w-4" />{t('saveMarks')} — {selectedSeq}</>}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export default MarksPage;