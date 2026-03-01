/**
 * MarksPage.jsx (Teacher)
 * ───────────────────────
 * • Sequence dropdown instead of free-text assessment name
 * • Duplicate-data warning + confirmation dialog before overwrite
 * • Respects subject enrolments: obligatory → all students; additional → only enrolled
 * • After loading students, detects who has no marks yet and offers to fill "00"
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Save, Loader2, AlertTriangle, UserX, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Helmet } from 'react-helmet';

const SEQUENCES = [
  { value: 'Sequence 1', label: '1st Sequence' },
  { value: 'Sequence 2', label: '2nd Sequence' },
  { value: 'Sequence 3', label: '3rd Sequence' },
  { value: 'Sequence 4', label: '4th Sequence' },
  { value: 'Sequence 5', label: '5th Sequence' },
  { value: 'Sequence 6', label: '6th Sequence' },
];

const MarksPage = () => {
  const { toast } = useToast();

  // ── selectors ──────────────────────────────────────────────────────────────
  const [classOptions,    setClassOptions]    = useState([]);
  const [subjectOptions,  setSubjectOptions]  = useState([]);
  const [selectedClass,   setSelectedClass]   = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSeq,     setSelectedSeq]     = useState('');

  // ── marks ──────────────────────────────────────────────────────────────────
  const [students,   setStudents]   = useState([]);   // enrolled students
  const [marks,      setMarks]      = useState({});
  const [totalMarks, setTotalMarks] = useState(20);

  // ── missing students (enrolled but no mark) ───────────────────────────────
  const [missing, setMissing] = useState([]); // Student objects with no mark

  // ── ui ─────────────────────────────────────────────────────────────────────
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [checkingDup,     setCheckingDup]     = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [showWarning,     setShowWarning]      = useState(false);
  const [showFillZero,    setShowFillZero]     = useState(false);
  const [dupInfo,         setDupInfo]          = useState(null);

  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  // ── 1. load classes ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('timetables')
          .select('class_id, classes(id, name)')
          .eq('teacher_id', teacherId);
        if (error) throw error;
        const seen = new Set();
        const unique = [];
        data?.forEach(item => {
          if (item.classes && !seen.has(item.class_id)) {
            seen.add(item.class_id);
            unique.push({ id: item.classes.id, name: item.classes.name });
          }
        });
        setClassOptions(unique);
      } catch (err) { console.error(err); }
    };
    fetch();
  }, [teacherId]);

  // ── 2. class changes → load subjects ──────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) {
      setSubjectOptions([]); setStudents([]); setSelectedSubject(''); setSelectedSeq(''); setMarks({}); setMissing([]);
      return;
    }
    const fetchSubjects = async () => {
      const { data } = await supabase
        .from('timetables')
        .select('subject')
        .eq('teacher_id', teacherId)
        .eq('class_id', selectedClass);
      if (data) {
        const unique = [...new Set(data.map(r => r.subject).filter(Boolean))];
        setSubjectOptions(unique);
        setSelectedSubject(unique.length === 1 ? unique[0] : '');
      }
    };
    fetchSubjects();
    setSelectedSeq(''); setMarks({}); setMissing([]);
  }, [selectedClass, teacherId]);

  // ── 3. subject / seq changes → fetch enrolled students ───────────────────
  useEffect(() => {
    if (!selectedClass || !selectedSubject) { setStudents([]); setMarks({}); setMissing([]); return; }
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        // Determine obligatory vs additional
        const { data: subjectConfig } = await supabase
          .from('class_subjects')
          .select('is_obligatory')
          .eq('class_id', selectedClass)
          .eq('subject', selectedSubject)
          .maybeSingle();

        const isObligatory = subjectConfig === null || subjectConfig?.is_obligatory !== false;

        let enrolled = [];
        if (isObligatory) {
          const { data } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', selectedClass)
            .order('name');
          enrolled = data || [];
        } else {
          const { data: enrolRows } = await supabase
            .from('student_subject_enrollments')
            .select('student_matricule')
            .eq('class_id', selectedClass)
            .eq('subject', selectedSubject);
          const mats = (enrolRows || []).map(e => e.student_matricule);
          if (mats.length > 0) {
            const { data } = await supabase
              .from('students')
              .select('*')
              .in('matricule', mats)
              .order('name');
            enrolled = data || [];
          }
        }
        setStudents(enrolled);
        setMarks({});
        setMissing([]);
      } catch (err) { console.error(err); }
      finally { setLoadingStudents(false); }
    };
    fetchStudents();
  }, [selectedClass, selectedSubject]);

  // ── 4. detect missing marks when sequence is chosen ───────────────────────
  useEffect(() => {
    if (!selectedClass || !selectedSubject || !selectedSeq || students.length === 0) {
      setMissing([]); return;
    }
    const detectMissing = async () => {
      setCheckingDup(true);
      try {
        const { data: existingMarks } = await supabase
          .from('student_marks')
          .select('student_matricule')
          .eq('class_id', selectedClass)
          .eq('subject', selectedSubject)
          .eq('assessment_name', selectedSeq)
          .eq('teacher_id', teacherId);

        const alreadyHave = new Set((existingMarks || []).map(r => r.student_matricule));
        const noMark = students.filter(s => !alreadyHave.has(s.matricule));
        setMissing(noMark);
        setDupInfo(alreadyHave.size > 0 ? { count: alreadyHave.size } : null);
      } catch (err) { console.error(err); }
      finally { setCheckingDup(false); }
    };
    detectMissing();
  }, [selectedClass, selectedSubject, selectedSeq, students, teacherId]);

  // ── mark input ─────────────────────────────────────────────────────────────
  const handleMarkChange = (matricule, value) => {
    if (value === '' || (Number(value) >= 0 && Number(value) <= totalMarks)) {
      setMarks(prev => ({ ...prev, [matricule]: value }));
    }
  };

  // ── fill missing with 00 ───────────────────────────────────────────────────
  const fillMissingWithZero = () => {
    setMarks(prev => {
      const updated = { ...prev };
      missing.forEach(s => {
        if (updated[s.matricule] === undefined || updated[s.matricule] === '') {
          updated[s.matricule] = '0';
        }
      });
      return updated;
    });
    setShowFillZero(false);
    toast({ title: 'Done', description: `${missing.length} missing student(s) filled with 0.` });
  };

  // ── actual save ────────────────────────────────────────────────────────────
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
          assessment_name:   selectedSeq,
          mark:              parseFloat(marks[s.matricule]),
          total_marks:       parseFloat(totalMarks),
          school_id:         parseInt(schoolId),
          created_at:        new Date().toISOString(),
        }));

      if (marksData.length === 0) throw new Error('No marks entered.');

      // Delete then re-insert (safe upsert)
      await supabase
        .from('student_marks')
        .delete()
        .eq('class_id',        parseInt(selectedClass))
        .eq('subject',         selectedSubject)
        .eq('assessment_name', selectedSeq)
        .eq('teacher_id',      parseInt(teacherId));

      const { error } = await supabase.from('student_marks').insert(marksData);
      if (error) throw error;

      toast({ title: 'Saved!', description: `${selectedSeq} marks for ${selectedSubject} saved.` });
      setMarks({}); setDupInfo(null); setMissing([]);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to save.' });
    } finally { setSaving(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !selectedSeq) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Select class, subject, and sequence.' });
      return;
    }
    const filled = Object.values(marks).filter(v => v !== '' && v !== undefined);
    if (filled.length === 0) {
      toast({ variant: 'destructive', title: 'No marks', description: 'Enter at least one mark.' });
      return;
    }
    if (dupInfo) { setShowWarning(true); } else { await doSubmit(); }
  };

  const readyToShow = selectedClass && selectedSubject && selectedSeq && !loadingStudents;
  const missingCount = missing.filter(s => marks[s.matricule] === undefined || marks[s.matricule] === '').length;

  return (
    <>
      <Helmet><title>Enter Marks - Teacher Dashboard</title></Helmet>

      {/* Overwrite confirmation */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Marks Already Exist
            </AlertDialogTitle>
            <AlertDialogDescription>
              Marks for <strong>{selectedSubject}</strong> — <strong>{selectedSeq}</strong> already
              exist for this class. Saving will <strong>permanently replace</strong> the existing data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-yellow-600 hover:bg-yellow-700"
              onClick={async () => { setShowWarning(false); await doSubmit(); }}>
              Yes, Replace Marks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fill-zero confirmation */}
      <AlertDialog open={showFillZero} onOpenChange={setShowFillZero}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" /> Fill Missing Marks with 0
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{missingCount} student{missingCount !== 1 ? 's' : ''}</strong> have not been given a
              mark yet. Do you want to automatically set their mark to <strong>0 / {totalMarks}</strong>?
              You can still change individual values before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={fillMissingWithZero}>
              Fill with 0
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <GraduationCap className="h-8 w-8" /> Enter Student Marks
        </h1>

        {/* Selectors */}
        <Card className="glass">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classOptions.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject / Section</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass || subjectOptions.length === 0}>
                  <SelectTrigger><SelectValue placeholder={selectedClass ? 'Select subject' : '— pick class first —'} /></SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sequence</Label>
                <Select value={selectedSeq} onValueChange={setSelectedSeq} disabled={!selectedSubject}>
                  <SelectTrigger><SelectValue placeholder={selectedSubject ? 'Select sequence' : '— pick subject first —'} /></SelectTrigger>
                  <SelectContent>
                    {SEQUENCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Overwrite warning banner */}
            <AnimatePresence>
              {dupInfo && !checkingDup && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                  <p className="text-sm">
                    Marks for <strong>{selectedSubject}</strong> — <strong>{selectedSeq}</strong> already
                    exist. Saving will <strong>replace</strong> all existing data for this combination.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Student list */}
        {readyToShow && (
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Student Marks</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedSubject} · {selectedSeq}
                  {students.length > 0 && (
                    <span className="ml-2 text-xs">({students.length} student{students.length !== 1 ? 's' : ''} enrolled)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Total:</Label>
                <Input type="number" className="w-20" value={totalMarks}
                  onChange={e => setTotalMarks(e.target.value)} min={1} />
              </div>
            </CardHeader>

            <CardContent>
              {students.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No students enrolled for this subject.</p>
              ) : (
                <form onSubmit={handleSubmit}>

                  {/* Missing-marks notice */}
                  <AnimatePresence>
                    {missingCount > 0 && selectedSeq && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="mb-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <div className="flex items-center gap-2 text-orange-500">
                          <UserX className="h-5 w-5 shrink-0" />
                          <p className="text-sm">
                            <strong>{missingCount}</strong> student{missingCount !== 1 ? 's' : ''}{' '}
                            {missingCount !== 1 ? 'have' : 'has'} no mark entered yet.
                          </p>
                        </div>
                        <Button type="button" size="sm" variant="outline"
                          className="border-orange-500/40 text-orange-500 hover:bg-orange-500/10 shrink-0"
                          onClick={() => setShowFillZero(true)}
                        >
                          <CheckCheck className="h-3.5 w-3.5 mr-1" /> Fill with 0
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {students.map((student, idx) => {
                      const val = marks[student.matricule];
                      const hasMark = val !== undefined && val !== '';
                      const isMissing = missing.some(m => m.matricule === student.matricule);
                      return (
                        <motion.div key={student.matricule}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.015 }}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors
                            ${hasMark ? 'bg-card/60 border-white/10' : isMissing && selectedSeq ? 'bg-orange-500/5 border-orange-500/20' : 'bg-card/40 border-white/5'}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.matricule}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input type="number" placeholder="—"
                              className="w-20 text-right"
                              value={val ?? ''}
                              onChange={e => handleMarkChange(student.matricule, e.target.value)}
                              step="0.5" min={0} max={totalMarks}
                            />
                            <span className="text-muted-foreground text-sm w-8">/ {totalMarks}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <Button type="submit" className="w-full" disabled={saving || students.length === 0}>
                      {saving
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                        : <><Save className="mr-2 h-4 w-4" /> Save {selectedSeq} Marks</>
                      }
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </>
  );
};

export default MarksPage;
