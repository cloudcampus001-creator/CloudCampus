import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Save, Loader2, AlertTriangle, UserX,
  CheckCheck, Lock, Calendar, Info,
} from 'lucide-react';
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

/* ── Status badge for sequences ─────────────────────────── */
const SeqBadge = ({ status }) => {
  if (status === 'open')     return <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">OPEN</span>;
  if (status === 'closed')   return <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-muted-foreground">CLOSED</span>;
  return <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">UPCOMING</span>;
};

const MarksPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  /* ── Core selectors ─────────────────────────────────── */
  const [classOptions,    setClassOptions]    = useState([]);
  const [subjectOptions,  setSubjectOptions]  = useState([]);
  const [sequenceOptions, setSequenceOptions] = useState([]);  // from DB
  const [currentYear,     setCurrentYear]     = useState(null);

  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSeqId,   setSelectedSeqId]   = useState('');  // UUID
  const [selectedSeqObj,  setSelectedSeqObj]  = useState(null); // full record

  /* ── Mark state ─────────────────────────────────────── */
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
  const [loadingSeqs,     setLoadingSeqs]     = useState(false);

  /* ── 0. Fetch current academic year + its sequences ── */
  useEffect(() => {
    if (!schoolId) return;
    const fetchYearAndSeqs = async () => {
      setLoadingSeqs(true);
      try {
        // Get current open year
        const { data: year } = await supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .eq('is_current', true)
          .eq('status', 'open')
          .maybeSingle();

        setCurrentYear(year || null);

        if (year) {
          // Get all sequences for this year, ordered
          const { data: seqs } = await supabase
            .from('sequences')
            .select('*, terms(name, term_index)')
            .eq('school_id', parseInt(schoolId))
            .eq('academic_year_id', year.id)
            .order('sequence_index');
          setSequenceOptions(seqs || []);
          // Auto-select the open sequence if there is one
          const openSeq = (seqs || []).find(s => s.status === 'open');
          if (openSeq) {
            setSelectedSeqId(openSeq.id);
            setSelectedSeqObj(openSeq);
          }
        } else {
          setSequenceOptions([]);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingSeqs(false); }
    };
    fetchYearAndSeqs();
  }, [schoolId]);

  /* ── 1. Load teacher classes ────────────────────────── */
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

  /* ── 2. Class → subjects ────────────────────────────── */
  useEffect(() => {
    if (!selectedClass) {
      setSubjectOptions([]); setStudents([]); setSelectedSubject('');
      setMarks({}); setMissing([]); return;
    }
    supabase.from('timetables').select('subject')
      .eq('teacher_id', teacherId).eq('class_id', selectedClass)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.subject).filter(Boolean))];
        setSubjectOptions(unique);
        setSelectedSubject(unique.length === 1 ? unique[0] : '');
      });
    setMarks({}); setMissing([]);
  }, [selectedClass, teacherId]);

  /* ── 3. Subject → enrolled students ─────────────────── */
  useEffect(() => {
    if (!selectedClass || !selectedSubject) {
      setStudents([]); setMarks({}); setMissing([]); return;
    }
    const fetch = async () => {
      setLoadingStudents(true);
      try {
        const { data: subjectConfig } = await supabase.from('class_subjects')
          .select('is_obligatory').eq('class_id', selectedClass).eq('subject', selectedSubject).maybeSingle();
        const isObligatory = subjectConfig === null || subjectConfig?.is_obligatory !== false;
        let enrolled = [];
        if (isObligatory) {
          const { data } = await supabase.from('students').select('*')
            .eq('class_id', selectedClass).order('name');
          enrolled = data || [];
        } else {
          const { data: enrolRows } = await supabase.from('student_subject_enrollments')
            .select('student_matricule').eq('class_id', selectedClass).eq('subject', selectedSubject);
          const mats = (enrolRows || []).map(e => e.student_matricule);
          if (mats.length > 0) {
            const { data } = await supabase.from('students').select('*')
              .in('matricule', mats).order('name');
            enrolled = data || [];
          }
        }
        setStudents(enrolled); setMarks({}); setMissing([]);
      } catch (err) { console.error(err); }
      finally { setLoadingStudents(false); }
    };
    fetch();
  }, [selectedClass, selectedSubject]);

  /* ── 4. Sequence selected → detect existing marks ───── */
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedSeqId || students.length === 0) {
      setMissing([]); return;
    }
    const detect = async () => {
      setCheckingDup(true);
      try {
        // Check by sequence_id (new way) first, fallback to assessment_name (old way)
        const { data: existing } = await supabase.from('student_marks')
          .select('student_matricule')
          .eq('class_id', selectedClass)
          .eq('subject', selectedSubject)
          .eq('teacher_id', teacherId)
          .eq('sequence_id', selectedSeqId);

        const alreadyHave = new Set((existing || []).map(r => r.student_matricule));
        setMissing(students.filter(s => !alreadyHave.has(s.matricule)));
        setDupInfo(alreadyHave.size > 0 ? { count: alreadyHave.size } : null);
      } catch (err) { console.error(err); }
      finally { setCheckingDup(false); }
    };
    detect();
  }, [selectedClass, selectedSubject, selectedSeqId, students, teacherId]);

  /* Keep selectedSeqObj in sync with selectedSeqId */
  useEffect(() => {
    const obj = sequenceOptions.find(s => s.id === selectedSeqId) || null;
    setSelectedSeqObj(obj);
  }, [selectedSeqId, sequenceOptions]);

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
          student_matricule: s.matricule,
          teacher_id:        parseInt(teacherId),
          class_id:          parseInt(selectedClass),
          subject:           selectedSubject,
          // Backward compat: keep assessment_name as the sequence name
          assessment_name:   selectedSeqObj?.name || selectedSeqId,
          // New fields: proper FK links
          sequence_id:       selectedSeqId,
          academic_year_id:  currentYear?.id || null,
          mark:              parseFloat(marks[s.matricule]),
          total_marks:       parseFloat(totalMarks),
          school_id:         parseInt(schoolId),
          created_at:        new Date().toISOString(),
        }));

      if (marksData.length === 0) throw new Error('No marks entered.');

      // Delete existing marks for this teacher/class/subject/sequence
      await supabase.from('student_marks').delete()
        .eq('class_id', parseInt(selectedClass))
        .eq('subject', selectedSubject)
        .eq('sequence_id', selectedSeqId)
        .eq('teacher_id', parseInt(teacherId));

      const { error } = await supabase.from('student_marks').insert(marksData);
      if (error) throw error;

      // Notify parents
      const teacherName = localStorage.getItem('userName') || 'Teacher';
      const className = classOptions.find(c => c.id.toString() === selectedClass)?.name || '';
      try {
        const notifications = marksData.map(m => {
          const on20 = ((m.mark / m.total_marks) * 20).toFixed(2);
          const appreciation =
            on20 >= 16 ? 'Excellent' : on20 >= 14 ? 'Very Good / Très Bien' :
            on20 >= 12 ? 'Good / Bien' : on20 >= 10 ? 'Average / Assez Bien' :
            'Below Average / Insuffisant';
          return {
            sender_name: teacherName, sender_role: 'teacher',
            title: `📝 New mark — ${selectedSubject}`,
            content: `Your child scored ${m.mark}/${m.total_marks} (${on20}/20) in ${selectedSubject} · ${selectedSeqObj?.name || ''}${className ? ` · ${className}` : ''}.\nAppreciation: ${appreciation}`,
            target_type: 'parent', target_id: m.student_matricule,
            school_id: parseInt(schoolId), created_at: new Date().toISOString(),
          };
        });
        await supabase.from('notifications').insert(notifications);
      } catch (e) { console.error('Notification error:', e); }

      toast({ title: `✓ ${t('success')}`, description: t('marksSaved') });
      setMarks({}); setDupInfo(null); setMissing([]);
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message || t('marksError') });
    } finally { setSaving(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !selectedSeqId) {
      toast({ variant: 'destructive', title: t('error'), description: 'Select class, subject and sequence.' }); return;
    }
    if (selectedSeqObj?.status === 'closed') {
      toast({ variant: 'destructive', title: 'Sequence closed', description: 'This sequence has been closed by the admin. Marks cannot be edited.' }); return;
    }
    const filled = Object.values(marks).filter(v => v !== '' && v !== undefined);
    if (filled.length === 0) {
      toast({ variant: 'destructive', title: t('error'), description: 'Enter at least one mark.' }); return;
    }
    if (dupInfo) setShowWarning(true); else await doSubmit();
  };

  const readyToShow  = selectedClass && selectedSubject && selectedSeqId && !loadingStudents;
  const missingCount = missing.filter(s => marks[s.matricule] === undefined || marks[s.matricule] === '').length;
  const isSeqClosed  = selectedSeqObj?.status === 'closed';
  const isSeqUpcoming = selectedSeqObj?.status === 'upcoming';

  /* Group sequences by term for the dropdown */
  const seqsByTerm = sequenceOptions.reduce((acc, seq) => {
    const termName = seq.terms?.name || 'Unknown Term';
    if (!acc[termName]) acc[termName] = [];
    acc[termName].push(seq);
    return acc;
  }, {});

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
            {currentYear && (
              <p className="text-sm text-muted-foreground mt-1 ml-11">
                Year: <span className="font-bold text-emerald-400">{currentYear.name}</span>
                {sequenceOptions.find(s => s.status === 'open') && (
                  <span className="ml-2">· <span className="text-emerald-400 font-bold">
                    {sequenceOptions.find(s => s.status === 'open')?.name} is open
                  </span></span>
                )}
              </p>
            )}
          </motion.div>

          {/* No active year warning */}
          {!loadingSeqs && !currentYear && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-amber-400">No active academic year</p>
                <p className="text-xs text-muted-foreground mt-0.5">The administrator has not set an active year. Contact your school admin.</p>
              </div>
            </motion.div>
          )}

          {/* No open sequence info */}
          {!loadingSeqs && currentYear && sequenceOptions.length > 0 && !sequenceOptions.find(s => s.status === 'open') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/8 border border-blue-500/15">
              <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300/80">No sequence is currently open. The admin must open a sequence before marks can be entered. You can view existing marks.</p>
            </motion.div>
          )}

          {/* Selectors */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Class */}
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

                {/* Subject */}
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

                {/* Sequence — from DB */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {t('sequence')}
                    {loadingSeqs && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </Label>
                  <Select value={selectedSeqId} onValueChange={setSelectedSeqId} disabled={!selectedSubject || sequenceOptions.length === 0}>
                    <SelectTrigger className={cn(
                      'bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11',
                      isSeqClosed && 'border-white/20 opacity-70',
                      selectedSeqObj?.status === 'open' && 'border-emerald-500/30 bg-emerald-500/5'
                    )}>
                      <SelectValue placeholder={
                        sequenceOptions.length === 0
                          ? 'No sequences configured'
                          : selectedSubject ? 'Select sequence' : t('selectSubjectFirst')
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(seqsByTerm).map(([termName, seqs]) => (
                        <React.Fragment key={termName}>
                          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{termName}</div>
                          {seqs.map(seq => (
                            <SelectItem key={seq.id} value={seq.id}>
                              <div className="flex items-center gap-2">
                                <span>{seq.name}</span>
                                <SeqBadge status={seq.status} />
                              </div>
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status banners */}
              <AnimatePresence>
                {isSeqClosed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">This sequence is <strong>closed</strong>. Marks are read-only. Ask the admin to reopen it if needed.</p>
                  </motion.div>
                )}
                {isSeqUpcoming && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
                    <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-300/80">This sequence is <strong>upcoming</strong>. Wait for the admin to open it before entering marks.</p>
                  </motion.div>
                )}
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
                      {selectedSubject} · {selectedSeqObj?.name || ''}
                      {students.length > 0 && <span className="ml-1.5">({students.length} {t('studentsEnrolled')})</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">{t('totalMarks')}:</Label>
                    <Input type="number" className="w-20 bg-white/5 border-white/10 rounded-xl h-9 text-center"
                      value={totalMarks} onChange={e => setTotalMarks(e.target.value)} min={1}
                      disabled={isSeqClosed} />
                  </div>
                </div>

                {students.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">{t('noStudentsEnrolled')}</p>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Missing marks banner */}
                    <AnimatePresence>
                      {missingCount > 0 && !isSeqClosed && (
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
                        const val       = marks[student.matricule];
                        const hasMark   = val !== undefined && val !== '';
                        const isMissing = missing.some(m => m.matricule === student.matricule);
                        return (
                          <motion.div key={student.matricule}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.015 }}
                            className={cn(
                              'flex items-center justify-between p-3.5 rounded-xl border transition-colors',
                              hasMark ? 'bg-emerald-500/5 border-emerald-500/20'
                                : isMissing && selectedSeqId ? 'bg-orange-500/5 border-orange-500/20'
                                : 'bg-white/3 border-white/6'
                            )}>
                            <div>
                              <p className="font-medium text-sm">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.matricule}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number" placeholder="—"
                                className="w-20 text-right bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-9"
                                value={val ?? ''}
                                onChange={e => handleMarkChange(student.matricule, e.target.value)}
                                step="0.5" min={0} max={totalMarks}
                                disabled={isSeqClosed}
                              />
                              <span className="text-muted-foreground text-sm w-8">/ {totalMarks}</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {!isSeqClosed && !isSeqUpcoming && (
                      <button type="submit" disabled={saving || students.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                        {saving
                          ? <><Loader2 className="h-4 w-4 animate-spin" />{t('savingMarks')}</>
                          : <><Save className="h-4 w-4" />{t('saveMarks')} — {selectedSeqObj?.name}</>}
                      </button>
                    )}
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
