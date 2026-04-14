
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Clock, FileText, Users,
  TrendingDown, CheckCircle2, BarChart3, Archive,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const DisciplineYearClosedPage = ({ closedYear }) => {
  const schoolId = localStorage.getItem('schoolId');
  const [stats,   setStats]   = useState(null);
  const [topStudents, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!closedYear) return;
    const fetch = async () => {
      const sid = parseInt(schoolId);
      const [{ data: abs }, { data: pun }, { data: jus }] = await Promise.all([
        supabase.from('absences').select('student_matricule, hours, status').eq('school_id', sid).eq('academic_year_id', closedYear.id),
        supabase.from('punishments').select('student_matricule').eq('school_id', sid).eq('academic_year_id', closedYear.id),
        supabase.from('justifications').select('status').eq('school_id', sid),
      ]);
      const a = abs || []; const p = pun || []; const j = jus || [];
      const totalHours = a.reduce((acc, x) => acc + (x.hours || 0), 0);
      const unjustified = a.filter(x => x.status === 'unjustified');
      const unjustHours = unjustified.reduce((acc, x) => acc + (x.hours || 0), 0);

      // Top students by absence hours
      const byStudent = {};
      a.forEach(x => { byStudent[x.student_matricule] = (byStudent[x.student_matricule] || 0) + (x.hours || 0); });
      const sorted = Object.entries(byStudent).sort((a,b) => b[1]-a[1]).slice(0, 5);

      setStats({
        totalAbsences: a.length,
        totalHours,
        unjustifiedHours: unjustHours,
        punishments: p.length,
        pendingJustifications: j.filter(x => x.status === 'pending').length,
      });
      setTop(sorted);
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/10 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 pointer-events-none" />
        <div className="h-14 w-14 rounded-3xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 relative">
          <Archive className="h-7 w-7 text-orange-400" />
        </div>
        <div className="relative">
          <p className="font-black text-xl">{closedYear?.name} — Discipline Archive</p>
          <p className="text-sm text-muted-foreground">All records are read-only. Awaiting next academic year.</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="animate-pulse h-24 rounded-2xl bg-white/5" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Absence Records', val: stats.totalAbsences, sub: `${stats.totalHours}h total`, color: 'amber' },
              { label: 'Unjustified Hours', val: `${stats.unjustifiedHours}h`, sub: 'not justified', color: 'red' },
              { label: 'Discipline Cases', val: stats.punishments, sub: 'punishments issued', color: 'orange' },
              { label: 'Justifications', val: stats.pendingJustifications, sub: 'still pending', color: 'violet' },
            ].map(s => {
              const c = {
                amber:  'border-amber-500/20 bg-amber-500/8 text-amber-400',
                red:    'border-red-500/20 bg-red-500/8 text-red-400',
                orange: 'border-orange-500/20 bg-orange-500/8 text-orange-400',
                violet: 'border-violet-500/20 bg-violet-500/8 text-violet-400',
              }[s.color];
              return (
                <div key={s.label} className={cn('glass rounded-2xl p-5 border', c)}>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">{s.label}</p>
                  <p className="text-2xl font-black">{s.val}</p>
                  <p className="text-xs opacity-60 mt-1">{s.sub}</p>
                </div>
              );
            })}
          </div>

          {topStudents.length > 0 && (
            <div className="glass rounded-2xl border border-white/8 overflow-hidden">
              <div className="p-4 border-b border-white/8">
                <p className="font-bold text-sm">Most Absences — {closedYear?.name}</p>
              </div>
              <div className="divide-y divide-white/5">
                {topStudents.map(([mat, hrs], i) => (
                  <div key={mat} className="flex items-center gap-4 px-4 py-3">
                    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0',
                      i === 0 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-muted-foreground')}>
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm font-semibold text-muted-foreground truncate">{mat}</p>
                    <p className="font-mono font-black text-sm text-red-400">{hrs}h</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-bold text-sm">Standby</p>
              <p className="text-xs text-muted-foreground mt-0.5">Waiting for the administration to open the new academic year.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DisciplineYearClosedPage;
