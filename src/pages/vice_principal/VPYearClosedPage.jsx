
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Users, Search, ChevronDown, Download, Loader2, BookOpen,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const DecisionPill = ({ d }) => {
  const m = {
    promoted:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    council:   'bg-amber-500/15 text-amber-400 border-amber-500/25',
    repeating: 'bg-red-500/15 text-red-400 border-red-500/25',
    excluded:  'bg-red-900/30 text-red-300 border-red-500/20',
  };
  const icons = { promoted: TrendingUp, council: Minus, repeating: TrendingDown, excluded: AlertTriangle };
  const Icon = icons[d] || Minus;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border capitalize', m[d] || 'bg-white/5 text-muted-foreground border-white/10')}>
      <Icon className="h-3 w-3" /> {d}
    </span>
  );
};

const VPYearClosedPage = ({ closedYear }) => {
  const schoolId = localStorage.getItem('schoolId');
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');

  useEffect(() => {
    if (!closedYear) return;
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
  const filtered = history.filter(h => {
    const matchesSearch = h.students?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || h.decision === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/10 flex flex-wrap items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 pointer-events-none" />
        <div className="h-14 w-14 rounded-3xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0 relative">
          <GraduationCap className="h-7 w-7 text-violet-400" />
        </div>
        <div className="relative">
          <p className="font-black text-xl">Year-End Summary</p>
          <p className="text-sm text-muted-foreground">{closedYear?.name} — All promotions recorded. Records are read-only.</p>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Decisions', val: total,    color: 'text-foreground' },
          { label: 'Promoted',        val: promoted,  color: 'text-emerald-400' },
          { label: 'Rate',            val: `${total > 0 ? Math.round((promoted/total)*100) : 0}%`, color: 'text-indigo-400' },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4 border border-white/8 text-center">
            <p className={cn('text-2xl font-black', s.color)}>{s.val}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10" />
        </div>
        {['all', 'promoted', 'council', 'repeating', 'excluded'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3.5 py-2 rounded-xl text-xs font-bold border capitalize transition-all',
              filter === f ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="animate-pulse h-14 rounded-xl bg-white/5" />)}</div>
      ) : (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <div className="p-4 border-b border-white/8 flex items-center justify-between">
            <p className="font-bold text-sm">Promotion Records — {closedYear?.name}</p>
            <p className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No records match your search.</div>
            ) : filtered.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/3 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{h.students?.name}</p>
                  <p className="text-xs text-muted-foreground">{h.classes?.name}</p>
                </div>
                <span className="font-mono font-black text-sm shrink-0 tabular-nums">
                  {h.annual_average != null ? `${h.annual_average}/20` : '—'}
                </span>
                <DecisionPill d={h.decision} />
                {h.vp_note && (
                  <div className="hidden md:block max-w-[200px]">
                    <p className="text-xs text-muted-foreground italic truncate" title={h.vp_note}>"{h.vp_note}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VPYearClosedPage;
