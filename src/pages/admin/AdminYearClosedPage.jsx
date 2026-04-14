
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Archive, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Users, BarChart3, ArrowRight, Plus, Loader2, CheckCircle2,
  CalendarClock, RefreshCw, School,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32 } } };

const StatCard = ({ label, value, sub, color, icon: Icon }) => {
  const c = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', val: 'text-emerald-300' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-400',   val: 'text-amber-300' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: 'text-red-400',     val: 'text-red-300' },
    violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  icon: 'text-violet-400',  val: 'text-violet-300' },
    indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  icon: 'text-indigo-400',  val: 'text-indigo-300' },
  }[color] || { bg:'bg-white/5', border:'border-white/10', icon:'text-muted-foreground', val:'text-foreground' };
  return (
    <motion.div variants={fadeUp} className={cn('glass rounded-2xl p-5 border', c.border, c.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">{label}</p>
          <p className={cn('text-3xl font-black', c.val)}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center border', c.bg, c.border)}>
          <Icon className={cn('h-5 w-5', c.icon)} />
        </div>
      </div>
    </motion.div>
  );
};

const AdminYearClosedPage = ({ closedYear }) => {
  const schoolId = localStorage.getItem('schoolId');
  const [stats,    setStats]   = useState(null);
  const [students, setStudents] = useState([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    if (!closedYear) return;
    const fetch = async () => {
      const [{ data: hist }, { count: sc }] = await Promise.all([
        supabase.from('student_academic_history').select('decision').eq('school_id', parseInt(schoolId)).eq('academic_year_id', closedYear.id),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId)),
      ]);
      const h = hist || [];
      setStats({
        total:     h.length,
        promoted:  h.filter(r => r.decision === 'promoted').length,
        council:   h.filter(r => r.decision === 'council').length,
        repeating: h.filter(r => r.decision === 'repeating').length,
        excluded:  h.filter(r => r.decision === 'excluded').length,
        totalStudents: sc || 0,
      });
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId]);

  const pct = v => stats?.total > 0 ? Math.round((v / stats.total) * 100) : 0;
  const promotionRate = stats ? pct(stats.promoted) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Hero banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="h-16 w-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Archive className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="font-black text-xl">{closedYear?.name} — Closed</p>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">Year-End Mode</span>
            </div>
            <p className="text-sm text-muted-foreground">The school year has been archived. Create and activate a new year to resume operations.</p>
          </div>
          <Link to="/dashboard/administrator/academic-year"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/25 shrink-0">
            <Plus className="h-4 w-4" /> Start New Year
          </Link>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse h-28 rounded-2xl bg-white/5" />)}
        </div>
      ) : (
        <>
          <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Promoted"  value={stats.promoted}  sub={`${pct(stats.promoted)}%`}  color="emerald" icon={TrendingUp} />
            <StatCard label="Council"   value={stats.council}   sub={`${pct(stats.council)}%`}   color="amber"   icon={Minus} />
            <StatCard label="Repeating" value={stats.repeating} sub={`${pct(stats.repeating)}%`} color="red"     icon={TrendingDown} />
            <StatCard label="Excluded"  value={stats.excluded}  sub={`${pct(stats.excluded)}%`}  color="violet"  icon={AlertTriangle} />
          </motion.div>

          {/* Promotion rate donut summary */}
          <div className="glass rounded-2xl p-6 border border-white/8 space-y-5">
            <div className="flex items-center justify-between">
              <p className="font-black">Promotion Breakdown — {closedYear?.name}</p>
              <span className="text-2xl font-black text-emerald-400">{promotionRate}%</span>
            </div>
            {[
              { label: 'Promoted',         value: stats.promoted,  color: '#10b981', bg: 'bg-emerald-500' },
              { label: 'Council Decision', value: stats.council,   color: '#f59e0b', bg: 'bg-amber-500' },
              { label: 'Repeating',        value: stats.repeating, color: '#ef4444', bg: 'bg-red-500' },
              { label: 'Excluded',         value: stats.excluded,  color: '#8b5cf6', bg: 'bg-violet-500' },
            ].map(row => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span style={{ color: row.color }}>{row.value} — {pct(row.value)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className={cn('h-full rounded-full', row.bg)}
                    initial={{ width: 0 }} animate={{ width: `${pct(row.value)}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Next steps */}
          <div className="glass rounded-2xl p-5 border border-indigo-500/15 space-y-4">
            <p className="font-black text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-indigo-400" /> Next Steps to Open New Year
            </p>
            {[
              { step: 1, text: 'Go to Academic Year Engine → create new year with dates & thresholds', done: false },
              { step: 2, text: 'Add terms (trimestres/semesters) and sequences inside each term', done: false },
              { step: 3, text: 'Activate the new year — all users' dashboards will update immediately', done: false },
              { step: 4, text: 'Monitor parent enrollment decisions in Year-End Mode', done: false },
            ].map(item => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[11px] font-black text-indigo-400 shrink-0">
                  {item.step}
                </div>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminYearClosedPage;
