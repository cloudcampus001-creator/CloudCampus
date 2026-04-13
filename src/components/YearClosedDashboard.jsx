/**
 * YearClosedDashboard.jsx
 * Shown to ALL roles when the academic year is closed.
 * Each role gets a tailored view of what happened and what comes next.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive, GraduationCap, TrendingUp, TrendingDown,
  Minus, AlertTriangle, Trophy, Users, BookOpen,
  CheckCircle2, Clock, ChevronRight, Star, Award,
  BarChart3, Loader2, School, ArrowRight, Download,
  CalendarClock, FileText,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

/* ── Animations ─────────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp  = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ── Stat card ──────────────────────────────────────────── */
const StatCard = ({ label, value, sub, color, icon: Icon, delay = 0 }) => {
  const colors = {
    indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  icon: 'text-indigo-400',  val: 'text-indigo-300' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', val: 'text-emerald-300' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: 'text-amber-400',   val: 'text-amber-300' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: 'text-red-400',     val: 'text-red-300' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400',    val: 'text-blue-300' },
    violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  icon: 'text-violet-400',  val: 'text-violet-300' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <motion.div variants={fadeUp} transition={{ delay }}
      className={cn('glass rounded-2xl p-5 border', c.border, c.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">{label}</p>
          <p className={cn('text-3xl font-black', c.val)}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center shrink-0', c.bg, 'border', c.border)}>
          <Icon className={cn('h-5 w-5', c.icon)} />
        </div>
      </div>
    </motion.div>
  );
};

/* ── Decision pill ──────────────────────────────────────── */
const DecisionPill = ({ decision }) => {
  const map = {
    promoted:  { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', icon: TrendingUp,    label: 'Promoted' },
    council:   { color: 'bg-amber-500/15  text-amber-400  border-amber-500/25',     icon: Minus,         label: 'Council' },
    repeating: { color: 'bg-red-500/15    text-red-400    border-red-500/25',        icon: TrendingDown,  label: 'Repeating' },
    excluded:  { color: 'bg-red-900/30    text-red-300    border-red-500/20',        icon: AlertTriangle, label: 'Excluded' },
  };
  const cfg = map[decision] || map.council;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border', cfg.color)}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   ADMIN YEAR-CLOSED VIEW
═══════════════════════════════════════════════════════════ */
const AdminClosedView = ({ closedYear, schoolId }) => {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: history } = await supabase
        .from('student_academic_history')
        .select('decision')
        .eq('school_id', parseInt(schoolId))
        .eq('academic_year_id', closedYear.id);
      const h = history || [];
      setStats({
        total:     h.length,
        promoted:  h.filter(r => r.decision === 'promoted').length,
        council:   h.filter(r => r.decision === 'council').length,
        repeating: h.filter(r => r.decision === 'repeating').length,
        excluded:  h.filter(r => r.decision === 'excluded').length,
      });
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId]);

  const pct = (v) => stats?.total > 0 ? Math.round((v / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 border border-white/10 flex flex-wrap items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Archive className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-lg">{closedYear.name} — Closed</p>
          <p className="text-sm text-muted-foreground">This academic year is archived. Start a new year to resume school activity.</p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-bold shrink-0">
          Year-End Mode
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="animate-pulse h-28 rounded-2xl bg-white/5" />)}
        </div>
      ) : (
        <>
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Promoted"        value={stats.promoted}  sub={`${pct(stats.promoted)}% of class`}    color="emerald" icon={TrendingUp}    delay={0} />
            <StatCard label="Council"         value={stats.council}   sub={`${pct(stats.council)}% deliberated`}  color="amber"   icon={Minus}         delay={0.05} />
            <StatCard label="Repeating"       value={stats.repeating} sub={`${pct(stats.repeating)}% staying`}   color="red"     icon={TrendingDown}  delay={0.1} />
            <StatCard label="Excluded"        value={stats.excluded}  sub={`${pct(stats.excluded)}% excluded`}   color="violet"  icon={AlertTriangle} delay={0.15} />
          </motion.div>

          <div className="glass rounded-2xl p-5 border border-white/8 space-y-4">
            <p className="font-bold text-sm">Promotion Breakdown — {closedYear.name}</p>
            {[
              { label: 'Promoted',         value: stats.promoted,  color: '#10b981' },
              { label: 'Council Decision', value: stats.council,   color: '#f59e0b' },
              { label: 'Repeating',        value: stats.repeating, color: '#ef4444' },
              { label: 'Excluded',         value: stats.excluded,  color: '#8b5cf6' },
            ].map(row => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span style={{ color: row.color }}>{row.value} — {pct(row.value)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div className="h-full rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${pct(row.value)}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    style={{ background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="glass rounded-2xl p-5 border border-indigo-500/15 space-y-3">
        <p className="font-black text-sm flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-indigo-400" /> Next Steps
        </p>
        {[
          'Go to Academic Year Engine → create the next year',
          'Configure terms and sequences for the new year',
          'Monitor parent enrollment decisions',
          'Activate the new year when ready',
        ].map((text, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-black text-indigo-400 shrink-0">
              {i + 1}
            </div>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   VP YEAR-CLOSED VIEW
═══════════════════════════════════════════════════════════ */
const VPClosedView = ({ closedYear, schoolId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('student_academic_history')
        .select('*, students(name), classes(name)')
        .eq('school_id', parseInt(schoolId))
        .eq('academic_year_id', closedYear.id)
        .order('annual_average', { ascending: false });
      setHistory(data || []);
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId]);

  const total    = history.length;
  const promoted = history.filter(h => h.decision === 'promoted').length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 border border-white/10 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <GraduationCap className="h-7 w-7 text-violet-400" />
        </div>
        <div>
          <p className="font-black text-lg">Year-End Summary</p>
          <p className="text-sm text-muted-foreground">{closedYear.name} — All promotion decisions recorded</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Students"  value={total}    color="indigo"  icon={Users} />
        <StatCard label="Promotion Rate"  value={`${total > 0 ? Math.round((promoted/total)*100) : 0}%`}
          sub={`${promoted} promoted`} color="emerald" icon={TrendingUp} />
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-14 rounded-xl bg-white/5" />)}</div>
      ) : (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <div className="p-4 border-b border-white/8">
            <p className="font-bold text-sm">All Promotion Decisions</p>
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{h.students?.name}</p>
                  <p className="text-xs text-muted-foreground">{h.classes?.name}</p>
                </div>
                <span className="font-mono font-bold text-sm shrink-0">{h.annual_average ?? '—'}/20</span>
                <DecisionPill decision={h.decision} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   TEACHER YEAR-CLOSED VIEW
═══════════════════════════════════════════════════════════ */
const TeacherClosedView = ({ closedYear, schoolId, teacherId }) => {
  const [markCount, setMarkCount] = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase
        .from('student_marks')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', parseInt(schoolId))
        .eq('academic_year_id', closedYear.id)
        .eq('teacher_id', teacherId);
      setMarkCount(count || 0);
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId, teacherId]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 border border-white/10 text-center space-y-4">
        <div className="h-20 w-20 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
          <BookOpen className="h-9 w-9 text-blue-400" />
        </div>
        <div>
          <p className="font-black text-xl">{closedYear.name} Complete</p>
          <p className="text-muted-foreground text-sm mt-1">The academic year has been closed by the administration.</p>
        </div>
        {!loading && (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold text-sm">
            <Star className="h-4 w-4" /> You entered {markCount} marks this year
          </div>
        )}
      </motion.div>

      <div className="glass rounded-2xl p-5 border border-white/8 space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/8">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">Waiting for the administration to open the next academic year.</p>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   DISCIPLINE YEAR-CLOSED VIEW
═══════════════════════════════════════════════════════════ */
const DisciplineClosedView = ({ closedYear, schoolId }) => {
  const [stats, setStats]     = useState({ absences: 0, punishments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const sid = parseInt(schoolId);
      const [{ count: a }, { count: p }] = await Promise.all([
        supabase.from('absences').select('*',{ count:'exact',head:true }).eq('school_id',sid).eq('academic_year_id',closedYear.id),
        supabase.from('punishments').select('*',{ count:'exact',head:true }).eq('school_id',sid).eq('academic_year_id',closedYear.id),
      ]);
      setStats({ absences: a || 0, punishments: p || 0 });
      setLoading(false);
    };
    fetch();
  }, [closedYear, schoolId]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8 border border-white/10 text-center space-y-4">
        <div className="h-20 w-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <Archive className="h-9 w-9 text-amber-400" />
        </div>
        <div>
          <p className="font-black text-xl">{closedYear.name} — Archived</p>
          <p className="text-muted-foreground text-sm mt-1">All discipline records are now read-only.</p>
        </div>
      </motion.div>

      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Absence Records" value={stats.absences}    sub="hours logged"       color="amber" icon={Clock} />
          <StatCard label="Discipline Cases" value={stats.punishments} sub="cases this year"    color="red"   icon={AlertTriangle} />
        </div>
      )}

      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/8">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">Standby — waiting for admin to open the next academic year.</p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   PARENT YEAR-END VIEW
═══════════════════════════════════════════════════════════ */
const ParentClosedView = ({ closedYear, schoolId, parentId }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: parent } = await supabase
        .from('parents').select('student_matricules').eq('id', parseInt(parentId)).single();
      if (!parent?.student_matricules?.length) { setLoading(false); return; }
      const { data: historyData } = await supabase
        .from('student_academic_history')
        .select('*, students(name), classes(name)')
        .in('student_matricule', parent.student_matricules)
        .eq('academic_year_id', closedYear.id);
      setChildren(historyData || []);
      if (historyData?.length > 0) setSelected(historyData[0]);
      setLoading(false);
    };
    fetch();
  }, [closedYear, parentId]);

  const decisionMeta = {
    promoted:  { icon: TrendingUp,    colorKey: 'emerald', title: 'Promoted! 🎉',     desc: 'Your child has passed and will move to the next class.' },
    council:   { icon: Minus,         colorKey: 'amber',   title: 'Council Decision', desc: "The VP is reviewing your child's case. You'll be notified of the final decision." },
    repeating: { icon: TrendingDown,  colorKey: 'red',     title: 'Repeating',        desc: 'Your child will repeat the same class next year.' },
    excluded:  { icon: AlertTriangle, colorKey: 'red',     title: 'Excluded',         desc: 'Contact the school administration urgently.' },
  };

  if (loading) return (
    <div className="space-y-4">
      {[1,2].map(i => <div key={i} className="animate-pulse h-36 rounded-2xl bg-white/5" />)}
    </div>
  );

  if (children.length === 0) return (
    <div className="glass rounded-2xl p-12 text-center border border-white/8">
      <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
      <p className="font-bold text-muted-foreground">Results not published yet</p>
      <p className="text-sm text-muted-foreground/60 mt-1">Check back once the VP has published promotion results.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <CalendarClock className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <p className="font-black text-base">Year-End: {closedYear.name}</p>
          <p className="text-sm text-muted-foreground">Review results and confirm next year's enrollment.</p>
        </div>
      </motion.div>

      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map(c => (
            <button key={c.student_matricule} onClick={() => setSelected(c)}
              className={cn('px-4 py-2 rounded-xl text-sm font-bold border transition-all',
                selected?.student_matricule === c.student_matricule
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
              {c.students?.name}
            </button>
          ))}
        </div>
      )}

      {selected && (() => {
        const meta = decisionMeta[selected.decision] || decisionMeta.council;
        const Icon = meta.icon;
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                <Icon className="h-7 w-7 text-foreground" />
              </div>
              <div>
                <p className="font-black text-lg">{selected.students?.name}</p>
                <p className="text-sm text-muted-foreground">{selected.classes?.name} — {closedYear.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/8">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">Annual Average</p>
                <p className="font-black text-2xl">
                  {selected.annual_average ?? '—'}
                  <span className="text-sm font-normal text-muted-foreground">/20</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/8 flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">Decision</p>
                <DecisionPill decision={selected.decision} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/4 border border-white/8">
              <p className="font-bold text-sm">{meta.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{meta.desc}</p>
              {selected.vp_note && (
                <p className="text-xs text-muted-foreground mt-2 italic border-t border-white/8 pt-2">
                  VP note: "{selected.vp_note}"
                </p>
              )}
            </div>

            {['promoted', 'council'].includes(selected.decision) && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Choose Enrollment for Next Year</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { icon: School,          color: 'emerald', title: 'Stay at this school',         desc: 'Automatically enroll for next year' },
                    { icon: GraduationCap,   color: 'blue',    title: 'Transfer to another school',  desc: 'Search CloudCampus schools and request transfer' },
                    { icon: Download,        color: 'muted',   title: 'Leave CloudCampus',           desc: 'Download full academic PDF record' },
                  ].map(opt => {
                    const OIcon = opt.icon;
                    return (
                      <button key={opt.title}
                        className={cn('flex items-center gap-4 p-4 rounded-xl border text-left transition-all group w-full',
                          opt.color === 'emerald' ? 'bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/15' :
                          opt.color === 'blue'    ? 'bg-blue-500/8    border-blue-500/20    hover:bg-blue-500/15'    :
                                                    'bg-white/4        border-white/8         hover:bg-white/8')}>
                        <OIcon className={cn('h-5 w-5 shrink-0',
                          opt.color === 'emerald' ? 'text-emerald-400' :
                          opt.color === 'blue'    ? 'text-blue-400'    : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{opt.title}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        );
      })()}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════ */
const YearClosedDashboard = ({ role }) => {
  const schoolId  = localStorage.getItem('schoolId');
  const userId    = localStorage.getItem('userId')
    || localStorage.getItem('adminId')
    || localStorage.getItem('vpId')
    || localStorage.getItem('teacherId')
    || localStorage.getItem('dmId')
    || localStorage.getItem('parentId');

  const [closedYear, setClosedYear] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', parseInt(schoolId))
        .eq('status', 'closed')
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
      setClosedYear(data || null);
      setLoading(false);
    };
    fetch();
  }, [schoolId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!closedYear) return (
    <div className="glass rounded-2xl p-12 text-center border border-white/8 m-6">
      <Archive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
      <p className="font-bold text-muted-foreground">No closed year found</p>
    </div>
  );

  const views = {
    administrator:  <AdminClosedView      closedYear={closedYear} schoolId={schoolId} />,
    vice_principal: <VPClosedView         closedYear={closedYear} schoolId={schoolId} />,
    teacher:        <TeacherClosedView    closedYear={closedYear} schoolId={schoolId} teacherId={userId} />,
    discipline:     <DisciplineClosedView closedYear={closedYear} schoolId={schoolId} />,
    parent:         <ParentClosedView     closedYear={closedYear} schoolId={schoolId} parentId={userId} />,
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {views[role] || views.administrator}
    </div>
  );
};

export default YearClosedDashboard;
export { AdminClosedView, VPClosedView, TeacherClosedView, DisciplineClosedView, ParentClosedView };
