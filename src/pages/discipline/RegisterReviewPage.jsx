/**
 * RegisterReviewPage.jsx  –  Discipline Master
 * Full redesign: date nav, class selector, live search, per-student
 * attendance rows with +1h and Reset controls, summary strip.
 * Full translation via t(). All Supabase logic preserved.
 */
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Users, Search,
  Loader2, AlertCircle, CheckCircle, Calendar,
  Plus, RotateCcw,
} from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const SkeletonRow = () => (
  <div className="flex items-center justify-between p-4 rounded-2xl animate-pulse bg-white/4 border border-white/5">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-white/8" />
      <div className="space-y-1.5">
        <div className="h-4 w-32 bg-white/8 rounded-lg" />
        <div className="h-3 w-20 bg-white/5 rounded-lg" />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <div className="h-7 w-16 bg-white/8 rounded-full" />
      <div className="h-8 w-8 bg-white/5 rounded-lg" />
    </div>
  </div>
);

const RegisterReviewPage = () => {
  const { toast }  = useToast();
  const { t }      = useLanguage();
  const userId     = localStorage.getItem('userId');
  const schoolId   = localStorage.getItem('schoolId');

  const [loading,       setLoading]       = useState(false);
  const [classes,       setClasses]       = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate,  setSelectedDate]  = useState(new Date());
  const [students,      setStudents]      = useState([]);
  const [attendance,    setAttendance]    = useState({});
  const [searchQuery,   setSearchQuery]   = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('classes').select('*')
        .eq('dm_id', parseInt(userId)).eq('school_id', parseInt(schoolId)).order('name');
      setClasses(data || []);
      if (data?.length) setSelectedClass(data[0].id.toString());
    };
    fetch();
  }, [userId, schoolId]);

  useEffect(() => {
    if (selectedClass) fetchDailyRegister();
  }, [selectedClass, selectedDate]);

  const fetchDailyRegister = async () => {
    setLoading(true);
    try {
      const [{ data: studentsData }, { data: absenceData }] = await Promise.all([
        supabase.from('students').select('*')
          .eq('class_id', parseInt(selectedClass))
          .eq('school_id', parseInt(schoolId)).order('name'),
        supabase.from('absences').select('*')
          .eq('class_id', parseInt(selectedClass))
          .eq('date', format(selectedDate, 'yyyy-MM-dd')),
      ]);
      const map = {};
      (studentsData || []).forEach(s => { map[s.matricule] = { hours: 0, count: 0 }; });
      (absenceData   || []).forEach(r => {
        if (map[r.student_matricule]) {
          map[r.student_matricule].hours += Number(r.hours);
          map[r.student_matricule].count += 1;
        }
      });
      setStudents(studentsData || []);
      setAttendance(map);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: 'Failed to load register.' });
    } finally { setLoading(false); }
  };

  const adjustAbsence = async (student, action) => {
    const dateStr      = format(selectedDate, 'yyyy-MM-dd');
    const currentHours = attendance[student.matricule]?.hours || 0;
    try {
      if (action === 'add') {
        await supabase.from('absences').insert({
          student_matricule: student.matricule,
          class_id: parseInt(selectedClass), date: dateStr,
          hours: 1, status: 'unjustified',
          school_id: parseInt(schoolId), teacher_id: null,
        });
        setAttendance(prev => ({ ...prev, [student.matricule]: { hours: currentHours + 1, count: (prev[student.matricule]?.count || 0) + 1 } }));
      } else {
        await supabase.from('absences').delete()
          .eq('student_matricule', student.matricule)
          .eq('class_id', parseInt(selectedClass)).eq('date', dateStr);
        setAttendance(prev => ({ ...prev, [student.matricule]: { hours: 0, count: 0 } }));
      }
    } catch (err) {
      toast({ variant: 'destructive', title: t('updateFailed'), description: err.message });
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalAbsent  = students.filter(s => (attendance[s.matricule]?.hours || 0) > 0).length;
  const totalPresent = students.length - totalAbsent;
  const isToday      = isSameDay(selectedDate, new Date());

  return (
    <>
      <Helmet><title>{t('registerTitle')} · CloudCampus</title></Helmet>
      <div className="space-y-5 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{t('registerTitle')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{t('registerSub')}</p>
          </div>
          {/* Date nav */}
          <div className="flex items-center gap-1 glass rounded-2xl border border-white/10 p-1.5 self-start sm:self-auto">
            <button onClick={() => setSelectedDate(prev => addDays(prev, -1))}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 px-4 min-w-[140px] justify-center">
              <Calendar className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="font-bold text-sm capitalize">
                {isToday ? t('today') : format(selectedDate, 'EEE, dd MMM')}
              </span>
            </div>
            <button onClick={() => setSelectedDate(prev => addDays(prev, 1))} disabled={isToday}
              className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl border border-white/10 p-4 flex flex-col sm:flex-row gap-3">
          <div className="sm:w-56 shrink-0">
            <Select value={selectedClass || ''} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-orange-500/40">
                <SelectValue placeholder={t('selectClassPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input placeholder={t('searchStudentName')}
              className="pl-10 h-11 bg-white/5 border-white/10 focus:border-orange-500/40 rounded-xl"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </motion.div>

        {/* Summary */}
        {students.length > 0 && !loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4 border border-green-500/20 bg-green-500/5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-green-400">{totalPresent}</p>
                <p className="text-xs text-muted-foreground">{t('present')}</p>
              </div>
            </div>
            <div className="glass rounded-2xl p-4 border border-red-500/20 bg-red-500/5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-red-400">{totalAbsent}</p>
                <p className="text-xs text-muted-foreground">{t('absent')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Student list */}
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          {loading ? (
            <div className="p-3 space-y-2">{[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}</div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
              <Users className="h-12 w-12 opacity-15" />
              <p className="text-sm">{t('selectClassToView')}</p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
              {filteredStudents.map((student, idx) => {
                const data = attendance[student.matricule] || { hours: 0, count: 0 };
                const isAbsent = data.hours > 0;
                return (
                  <motion.div key={student.matricule}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.015 }}
                    className={cn('flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                      isAbsent ? 'bg-red-500/6 border-red-500/20' : 'bg-white/3 border-white/6 hover:bg-white/6')}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('h-10 w-10 rounded-full flex items-center justify-center font-black text-sm shrink-0',
                        isAbsent ? 'bg-red-500/15 text-red-400' : 'bg-green-500/10 text-green-400')}>
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{student.name}</p>
                        <p className="text-[11px] text-muted-foreground">{student.matricule}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border',
                        isAbsent ? 'bg-red-500/12 border-red-500/25 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400')}>
                        {isAbsent ? `${data.hours}h ${t('hoursAbsent')}` : t('present')}
                      </span>
                      <button onClick={() => adjustAbsence(student, 'add')} title={t('addHour')}
                        className="h-8 w-8 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 flex items-center justify-center transition-all active:scale-90">
                        <Plus className="h-4 w-4" />
                      </button>
                      {isAbsent && (
                        <button onClick={() => adjustAbsence(student, 'clear')} title={t('resetAbsence')}
                          className="h-8 w-8 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-red-400 hover:border-red-500/30 flex items-center justify-center transition-all active:scale-90">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RegisterReviewPage;
