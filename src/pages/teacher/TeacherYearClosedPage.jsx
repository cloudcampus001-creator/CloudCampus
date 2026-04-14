
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Star, TrendingUp, Clock, BarChart3,
  CheckCircle2, Loader2, Award,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const TeacherYearClosedPage = ({ closedYear }) => {
  const schoolId  = localStorage.getItem('schoolId');
  const teacherId = localStorage.getItem('userId');
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!closedYear) return;
    const fetch = async () => {
      const [{ data: marks }, { data: logbook }] = await Promise.all([
        supabase.from('student_marks').select('subject, mark, total_marks')
          .eq('school_id', parseInt(schoolId)).eq('academic_year_id', closedYear.id).eq('teacher_id', teacherId),
        supabase.from('e_logbook_entries').select('status, subject')
          .eq('school_id', parseInt(schoolId)).eq('academic_year_id', closedYear.id).eq('teacher_id', teacherId),
      ]);
      const m = marks || [];
      const l = logbook || [];
      const subjects = [...new Set(m.map(x => x.subject))];
      const avgPerSubject = subjects.map(sub => {
        const subMarks = m.filter(x => x.subject === sub);
        const avg = subMarks.reduce((acc, x) => acc + (x.mark / x.total_marks) * 20, 0) / subMarks.length;
        return { subject: sub, count: subMarks.length, avg: Math.round(avg * 100) / 100 };
      });
      setStats({
        totalMarks: m.length,
        subjects: subjects.length,
        logbookEntries: l.length,
        approvedLogbook: l.filter(x => x.status === 'approved').length,
        avgPerSubject,
      });
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId, teacherId]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl p-8 border border-white/10 text-center space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 pointer-events-none" />
        <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto relative">
          <BookOpen className="h-9 w-9 text-emerald-400" />
        </div>
        <div className="relative">
          <p className="font-black text-2xl">{closedYear?.name}</p>
          <p className="text-muted-foreground text-sm mt-1">Academic year complete — your contributions are saved.</p>
        </div>
        {!loading && stats && (
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold text-sm relative">
            <Award className="h-4 w-4" />
            {stats.totalMarks} marks entered across {stats.subjects} subject{stats.subjects !== 1 ? 's' : ''}
          </div>
        )}
      </motion.div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="animate-pulse h-20 rounded-2xl bg-white/5" />)}</div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Marks Entered',     val: stats.totalMarks,       color: 'emerald', icon: Star },
              { label: 'Logbook Entries',   val: stats.logbookEntries,   color: 'blue',    icon: BookOpen },
              { label: 'Approved Logbooks', val: stats.approvedLogbook,  color: 'indigo',  icon: CheckCircle2 },
              { label: 'Subjects Taught',   val: stats.subjects,         color: 'amber',   icon: BarChart3 },
            ].map(s => {
              const colors = {
                emerald: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300',
                blue:    'border-blue-500/20 bg-blue-500/8 text-blue-300',
                indigo:  'border-indigo-500/20 bg-indigo-500/8 text-indigo-300',
                amber:   'border-amber-500/20 bg-amber-500/8 text-amber-300',
              }[s.color];
              const Icon = s.icon;
              return (
                <div key={s.label} className={cn('glass rounded-2xl p-4 border', colors)}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 opacity-70" />
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{s.label}</p>
                  </div>
                  <p className="text-2xl font-black">{s.val}</p>
                </div>
              );
            })}
          </div>

          {/* Per-subject breakdown */}
          {stats.avgPerSubject.length > 0 && (
            <div className="glass rounded-2xl border border-white/8 overflow-hidden">
              <div className="p-4 border-b border-white/8">
                <p className="font-bold text-sm">Class Averages by Subject</p>
              </div>
              <div className="divide-y divide-white/5">
                {stats.avgPerSubject.map(s => (
                  <div key={s.subject} className="flex items-center gap-4 px-4 py-3">
                    <p className="flex-1 font-semibold text-sm">{s.subject}</p>
                    <p className="text-xs text-muted-foreground">{s.count} mark{s.count !== 1 ? 's' : ''}</p>
                    <p className="font-mono font-black text-sm text-emerald-400">{s.avg}/20</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standby message */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-bold text-sm">Standby for next year</p>
              <p className="text-xs text-muted-foreground mt-0.5">The administration will notify you when the new academic year begins.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherYearClosedPage;
