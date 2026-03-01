/**
 * AttributeSubjectsPage.jsx
 * ─────────────────────────
 * VP can:
 *  1. See all subjects taught in the selected class (from timetables).
 *  2. Toggle each subject between Obligatory and Additional.
 *  3. For Additional subjects: pick which students are enrolled.
 *
 * DB tables used:
 *  • class_subjects            — stores obligatory flag per class+subject
 *  • student_subject_enrollments — stores per-student additional enrolments
 *  • timetables                — source of subject list
 *  • students                  — student roster for the class
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Users, Lock, Unlock, Save, Search,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const AttributeSubjectsPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const schoolId = localStorage.getItem('schoolId');

  // ── data ─────────────────────────────────────────────────────────────────
  const [subjects, setSubjects]         = useState([]); // [{subject, is_obligatory, expanded}]
  const [allStudents, setAllStudents]   = useState([]); // full class list
  const [enrollments, setEnrollments]   = useState({}); // subject → Set of matricules
  const [search, setSearch]             = useState({}); // subject → search string

  // ── loading / saving ──────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [savingSubject, setSavingSubject] = useState(null); // which subject is saving

  // ── reset on class change ─────────────────────────────────────────────────
  useEffect(() => {
    setSubjects([]); setAllStudents([]); setEnrollments({}); setSearch({});
  }, [selectedClass]);

  // ── load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) return;
    const load = async () => {
      setLoading(true);
      try {
        // 1. Subjects from timetable
        const { data: ttRows } = await supabase
          .from('timetables')
          .select('subject')
          .eq('class_id', selectedClass);

        const uniqueSubjects = [...new Set((ttRows || []).map(r => r.subject).filter(Boolean))].sort();

        // 2. Existing config from class_subjects
        const { data: configRows } = await supabase
          .from('class_subjects')
          .select('subject, is_obligatory')
          .eq('class_id', selectedClass);

        const configMap = Object.fromEntries((configRows || []).map(r => [r.subject, r.is_obligatory]));

        setSubjects(uniqueSubjects.map(subject => ({
          subject,
          is_obligatory: configMap[subject] !== undefined ? configMap[subject] : true,
          expanded: false,
        })));

        // 3. All students in this class
        const { data: students } = await supabase
          .from('students')
          .select('matricule, name')
          .eq('class_id', selectedClass)
          .order('name');
        setAllStudents(students || []);

        // 4. Existing enrolments for additional subjects
        const { data: enrolRows } = await supabase
          .from('student_subject_enrollments')
          .select('subject, student_matricule')
          .eq('class_id', selectedClass);

        const enrolMap = {};
        (enrolRows || []).forEach(row => {
          if (!enrolMap[row.subject]) enrolMap[row.subject] = new Set();
          enrolMap[row.subject].add(row.student_matricule);
        });
        setEnrollments(enrolMap);

      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Load error', description: err.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedClass, schoolId, toast]);

  // ── toggle obligatory flag ────────────────────────────────────────────────
  const toggleObligatory = (subject) => {
    setSubjects(prev => prev.map(s =>
      s.subject === subject ? { ...s, is_obligatory: !s.is_obligatory, expanded: s.is_obligatory ? false : s.expanded } : s
    ));
  };

  // ── expand / collapse the student picker ─────────────────────────────────
  const toggleExpand = (subject) => {
    setSubjects(prev => prev.map(s =>
      s.subject === subject ? { ...s, expanded: !s.expanded } : s
    ));
  };

  // ── toggle a single student's enrolment ───────────────────────────────────
  const toggleStudent = (subject, matricule) => {
    setEnrollments(prev => {
      const current = new Set(prev[subject] || []);
      if (current.has(matricule)) current.delete(matricule); else current.add(matricule);
      return { ...prev, [subject]: current };
    });
  };

  // ── select / deselect all students for a subject ─────────────────────────
  const toggleAll = (subject, selectAll) => {
    setEnrollments(prev => ({
      ...prev,
      [subject]: selectAll ? new Set(allStudents.map(s => s.matricule)) : new Set(),
    }));
  };

  // ── save a single subject ─────────────────────────────────────────────────
  const saveSubject = async (subjectObj) => {
    const { subject, is_obligatory } = subjectObj;
    setSavingSubject(subject);
    try {
      // Upsert class_subjects config
      const { error: configErr } = await supabase
        .from('class_subjects')
        .upsert({
          class_id: parseInt(selectedClass),
          school_id: parseInt(schoolId),
          subject,
          is_obligatory,
        }, { onConflict: 'class_id,subject' });
      if (configErr) throw configErr;

      if (is_obligatory) {
        // Remove all enrolment rows — everyone is implicitly enrolled
        await supabase
          .from('student_subject_enrollments')
          .delete()
          .eq('class_id', selectedClass)
          .eq('subject', subject);
        setEnrollments(prev => ({ ...prev, [subject]: new Set() }));
      } else {
        // Rebuild enrolment rows for the chosen students
        await supabase
          .from('student_subject_enrollments')
          .delete()
          .eq('class_id', selectedClass)
          .eq('subject', subject);

        const chosen = [...(enrollments[subject] || new Set())];
        if (chosen.length > 0) {
          const rows = chosen.map(mat => ({
            student_matricule: mat,
            class_id: parseInt(selectedClass),
            school_id: parseInt(schoolId),
            subject,
          }));
          const { error: enrolErr } = await supabase
            .from('student_subject_enrollments')
            .insert(rows);
          if (enrolErr) throw enrolErr;
        }
      }

      toast({
        title: 'Saved',
        description: `${subject} set as ${is_obligatory ? 'Obligatory' : 'Additional'}.`,
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Save error', description: err.message });
    } finally {
      setSavingSubject(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <BookMarked className="w-16 h-16 mb-4 opacity-20" />
        <p>Please select a class to attribute subjects.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Attribute Subjects - Vice Principal</title></Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookMarked className="h-8 w-8 text-pink-500" />
            Attribute Subjects
          </h1>
          <p className="text-muted-foreground mt-1">
            Mark subjects as <strong>Obligatory</strong> (all students) or{' '}
            <strong>Additional</strong> (assign specific students).
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-pink-500" />
          </div>
        ) : subjects.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-16 text-center text-muted-foreground">
              No subjects found for this class in the timetable.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {subjects.map((subjectObj) => {
              const { subject, is_obligatory, expanded } = subjectObj;
              const enrolSet  = enrollments[subject] || new Set();
              const enrolCount = is_obligatory ? allStudents.length : enrolSet.size;
              const isSaving  = savingSubject === subject;
              const searchTerm = (search[subject] || '').toLowerCase();
              const filteredStudents = allStudents.filter(s =>
                s.name.toLowerCase().includes(searchTerm)
              );

              return (
                <Card key={subject} className="glass overflow-hidden">
                  {/* Subject row */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                        <span className="text-pink-500 font-bold">{subject.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{subject}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className={is_obligatory
                              ? 'text-green-500 border-green-500/40 text-xs'
                              : 'text-orange-400 border-orange-400/40 text-xs'
                            }
                          >
                            {is_obligatory ? 'Obligatory' : 'Additional'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {is_obligatory
                              ? `${allStudents.length} students (all)`
                              : `${enrolCount} student${enrolCount !== 1 ? 's' : ''} assigned`
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle obligatory / additional */}
                      <Button
                        variant="outline"
                        size="sm"
                        className={is_obligatory
                          ? 'border-green-500/40 text-green-500 hover:bg-green-500/10'
                          : 'border-orange-400/40 text-orange-400 hover:bg-orange-400/10'
                        }
                        onClick={() => toggleObligatory(subject)}
                      >
                        {is_obligatory
                          ? <><Lock className="h-3.5 w-3.5 mr-1" /> Obligatory</>
                          : <><Unlock className="h-3.5 w-3.5 mr-1" /> Additional</>
                        }
                      </Button>

                      {/* Student picker toggle (only for additional) */}
                      {!is_obligatory && (
                        <Button variant="ghost" size="icon" onClick={() => toggleExpand(subject)}>
                          {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />
                          }
                        </Button>
                      )}

                      {/* Save */}
                      <Button
                        size="sm"
                        className="bg-pink-500/20 text-pink-500 hover:bg-pink-500/30 border border-pink-500/30"
                        onClick={() => saveSubject(subjectObj)}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><Save className="h-3.5 w-3.5 mr-1" /> Save</>
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Student picker (additional subjects only) */}
                  <AnimatePresence>
                    {!is_obligatory && expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-white/10 px-5 py-4 space-y-3">
                          {/* Search + select-all */}
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search students…"
                                className="pl-9 h-9 bg-background/50"
                                value={search[subject] || ''}
                                onChange={e => setSearch(prev => ({ ...prev, [subject]: e.target.value }))}
                              />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => toggleAll(subject, true)}>All</Button>
                            <Button variant="outline" size="sm" onClick={() => toggleAll(subject, false)}>None</Button>
                          </div>

                          {/* Student list */}
                          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                            {filteredStudents.length === 0 ? (
                              <p className="text-center py-4 text-sm text-muted-foreground">No students match.</p>
                            ) : filteredStudents.map(student => {
                              const checked = enrolSet.has(student.matricule);
                              return (
                                <button
                                  key={student.matricule}
                                  onClick={() => toggleStudent(subject, student.matricule)}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left
                                    ${checked ? 'bg-pink-500/15 border border-pink-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                                    ${checked ? 'bg-pink-500 border-pink-500' : 'border-muted-foreground/40'}`}
                                  >
                                    {checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{student.name}</p>
                                    <p className="text-xs text-muted-foreground">{student.matricule}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <p className="text-xs text-muted-foreground text-right">
                            {enrolSet.size} / {allStudents.length} selected — click <strong>Save</strong> to confirm
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default AttributeSubjectsPage;
