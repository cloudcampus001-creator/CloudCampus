
/**
 * AdminAcademicYearPage.jsx
 * Polished Academic Year Engine — glassmorphism modals, smooth UX
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Plus, Layers, ListOrdered, GraduationCap,
  Settings2, Lock, CheckCircle2, AlertTriangle, Loader2,
  Trash2, X, Zap, CalendarClock, BookOpen, Trophy, Info,
  ToggleLeft, ToggleRight, Flag, Archive, ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/* ── Micro helpers ──────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const Skel    = ({ className }) => <div className={cn('animate-pulse rounded-2xl bg-white/5', className)} />;

const Badge = ({ color, children }) => {
  const map = {
    green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    red:    'bg-red-500/15 text-red-400 border-red-500/25',
    amber:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
    blue:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
    indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
    muted:  'bg-white/5 text-muted-foreground border-white/10',
    violet: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide', map[color] || map.muted)}>
      {children}
    </span>
  );
};

const TabBtn = ({ active, onClick, icon: Icon, label, count }) => (
  <button onClick={onClick}
    className={cn('flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
      active
        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent')}>
    <Icon className="h-4 w-4 shrink-0" />
    <span className="hidden sm:block">{label}</span>
    {count !== undefined && (
      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black',
        active ? 'bg-indigo-500/30 text-indigo-200' : 'bg-white/8 text-muted-foreground')}>
        {count}
      </span>
    )}
  </button>
);

/* ── Glassmorphism Modal ────────────────────────────────── */
const Modal = ({ open, onClose, title, icon: Icon, iconColor = 'indigo', children }) => (
  <AnimatePresence>
    {open && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        onClick={e => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="glass rounded-3xl p-6 w-full max-w-lg border border-white/15 shadow-2xl shadow-black/50 space-y-5"
          style={{ background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(24px)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-2xl flex items-center justify-center',
                iconColor === 'indigo' ? 'bg-indigo-500/20 border border-indigo-500/30' :
                iconColor === 'amber'  ? 'bg-amber-500/20  border border-amber-500/30'  :
                iconColor === 'red'    ? 'bg-red-500/20    border border-red-500/30'    :
                'bg-white/10 border border-white/15')}>
                <Icon className={cn('h-5 w-5',
                  iconColor === 'indigo' ? 'text-indigo-400' :
                  iconColor === 'amber'  ? 'text-amber-400'  :
                  iconColor === 'red'    ? 'text-red-400'    : 'text-foreground')} />
              </div>
              <p className="font-black text-base">{title}</p>
            </div>
            <button onClick={onClose}
              className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ConfirmModal = ({ open, title, description, danger, onConfirm, onCancel, loading }) => (
  <Modal open={open} onClose={onCancel} title={title} icon={AlertTriangle} iconColor={danger ? 'red' : 'amber'}>
    <p className="text-sm text-muted-foreground">{description}</p>
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
        Cancel
      </button>
      <button onClick={onConfirm} disabled={loading}
        className={cn('flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2',
          danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-black')}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirm
      </button>
    </div>
  </Modal>
);

const Field = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground/60">{hint}</p>}
  </div>
);

const Stepper = ({ value, onChange, min = 0, max = 100, suffix = '' }) => (
  <div className="flex items-center gap-2">
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center font-bold text-lg leading-none">−</button>
    <div className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 flex items-center font-mono font-bold text-sm min-w-[80px] justify-center">
      {value}{suffix}
    </div>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center font-bold text-lg leading-none">+</button>
  </div>
);

/* ═══════════════════ YEARS TAB ═══════════════════ */
const YearsTab = ({ schoolId, years, loading, onRefresh }) => {
  const { toast } = useToast();
  const [modalOpen,     setModalOpen]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [confirm,       setConfirm]       = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', start_date: '', end_date: '', year_end_deadline: '',
    promotion_threshold: 10, council_zone_min: 8, council_zone_max: 9.99,
    max_unjustified_hours: 30, mark_scale: 20,
  });

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast({ variant: 'destructive', title: 'Missing fields', description: 'Name, start date and end date are required.' }); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('academic_years').insert([{
        school_id: parseInt(schoolId), name: form.name,
        start_date: form.start_date, end_date: form.end_date,
        promotion_threshold: form.promotion_threshold, council_zone_min: form.council_zone_min,
        council_zone_max: form.council_zone_max, max_unjustified_hours: form.max_unjustified_hours,
        mark_scale: form.mark_scale, year_end_deadline: form.year_end_deadline || null,
      }]);
      if (error) throw error;
      toast({ title: '✅ Academic year created', description: `${form.name} is ready.` });
      setModalOpen(false);
      setForm({ name:'',start_date:'',end_date:'',year_end_deadline:'',promotion_threshold:10,council_zone_min:8,council_zone_max:9.99,max_unjustified_hours:30,mark_scale:20 });
      onRefresh();
    } catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setSaving(false); }
  };

  const setCurrent = async (year) => {
    setActionLoading(true);
    try {
      await supabase.from('academic_years').update({ is_current: false }).eq('school_id', parseInt(schoolId));
      const { error } = await supabase.from('academic_years').update({ is_current: true, status: 'open' }).eq('id', year.id);
      if (error) throw error;
      toast({ title: '🎯 Year activated', description: `${year.name} is now the current academic year.` });
      onRefresh();
    } catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setActionLoading(false); setConfirm(null); }
  };

  const closeYear = async (year) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('academic_years').update({ status: 'closed', is_current: false }).eq('id', year.id);
      if (error) throw error;
      toast({ title: '🔒 Year closed', description: `${year.name} archived. All users switched to year-end mode.` });
      onRefresh();
    } catch (e) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    finally { setActionLoading(false); setConfirm(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-lg">Academic Years</p>
          <p className="text-sm text-muted-foreground">One active year at a time — closing it triggers Year-End Mode for all users.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/30">
          <Plus className="h-4 w-4" /> New Year
        </button>
      </div>

      {/* CREATE MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Academic Year" icon={Calendar} iconColor="indigo">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <Field label="Year Name">
              <Input placeholder="e.g. 2024–2025" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date">
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} className="bg-white/5 border-white/10" />
              </Field>
              <Field label="End Date">
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} className="bg-white/5 border-white/10" />
              </Field>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/3 border border-white/8 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" /> Promotion Thresholds
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mark Scale">
                <select value={form.mark_scale} onChange={e => setForm(p => ({...p, mark_scale: parseInt(e.target.value)}))}
                  className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-sm px-3 font-bold">
                  <option value={20}>Out of 20</option>
                  <option value={100}>Out of 100</option>
                </select>
              </Field>
              <Field label={`Pass ≥ (/${form.mark_scale})`}>
                <Stepper value={form.promotion_threshold} onChange={v => setForm(p => ({...p, promotion_threshold: v}))} min={1} max={form.mark_scale} />
              </Field>
            </div>
            <Field label="Council Zone (VP deliberates this range)">
              <div className="flex items-center gap-3">
                <Stepper value={form.council_zone_min} onChange={v => setForm(p => ({...p, council_zone_min: v}))} min={0} max={form.mark_scale} />
                <span className="text-muted-foreground font-bold">–</span>
                <Stepper value={form.council_zone_max} onChange={v => setForm(p => ({...p, council_zone_max: v}))} min={0} max={form.mark_scale} />
              </div>
            </Field>
            <Field label="Max Unjustified Absence Hours (above = Excluded)">
              <Stepper value={form.max_unjustified_hours} onChange={v => setForm(p => ({...p, max_unjustified_hours: v}))} suffix="h" min={0} max={500} />
            </Field>
          </div>

          <Field label="Year-End Deadline (optional)" hint="Parents must choose enrollment by this date. After deadline, undecided students are auto-kept.">
            <Input type="date" value={form.year_end_deadline} onChange={e => setForm(p => ({...p, year_end_deadline: e.target.value}))} className="bg-white/5 border-white/10" />
          </Field>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Year
            </button>
          </div>
        </div>
      </Modal>

      {/* YEARS LIST */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <Skel key={i} className="h-36" />)}</div>
      ) : years.length === 0 ? (
        <div className="glass rounded-2xl p-14 text-center border border-white/8 space-y-3">
          <div className="h-16 w-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <Calendar className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="font-bold text-muted-foreground">No academic years yet</p>
          <p className="text-xs text-muted-foreground/60">Create your first year to get the school system started.</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
          {years.map(year => (
            <motion.div key={year.id} variants={fadeUp}
              className={cn('glass rounded-2xl p-5 border transition-all',
                year.is_current ? 'border-indigo-500/30 bg-indigo-500/5 shadow-lg shadow-indigo-500/10'
                : year.status === 'closed' ? 'border-white/5 opacity-60' : 'border-white/8')}>
              <div className="flex items-start gap-4">
                <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border',
                  year.is_current ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-white/5 border-white/10')}>
                  {year.is_current ? <Zap className="h-5 w-5 text-indigo-400" />
                   : year.status === 'closed' ? <Archive className="h-5 w-5 text-muted-foreground" />
                   : <Calendar className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-base">{year.name}</p>
                    {year.is_current && <Badge color="indigo">● Active</Badge>}
                    {year.status === 'closed' && <Badge color="muted">Archived</Badge>}
                    {!year.is_current && year.status === 'open' && <Badge color="amber">Standby</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{year.start_date} → {year.end_date}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">Pass: <span className="font-bold text-foreground">{year.promotion_threshold}/{year.mark_scale}</span></span>
                    <span className="text-xs text-muted-foreground">Council: <span className="font-bold text-foreground">{year.council_zone_min}–{year.council_zone_max}</span></span>
                    <span className="text-xs text-muted-foreground">Max abs: <span className="font-bold text-foreground">{year.max_unjustified_hours}h</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!year.is_current && year.status === 'open' && (
                    <button onClick={() => setConfirm({ type: 'activate', year })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 transition-all">
                      <Flag className="h-3 w-3" /> Activate
                    </button>
                  )}
                  {year.is_current && year.status === 'open' && (
                    <button onClick={() => setConfirm({ type: 'close', year })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all">
                      <Lock className="h-3 w-3" /> Close Year
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <ConfirmModal
        open={confirm?.type === 'activate'}
        title={`Activate ${confirm?.year?.name}?`}
        description="This will deactivate any currently running year. All school activity will be scoped to this year."
        onConfirm={() => setCurrent(confirm.year)} onCancel={() => setConfirm(null)} loading={actionLoading} />
      <ConfirmModal
        open={confirm?.type === 'close'}
        title={`Close ${confirm?.year?.name}?`}
        description="This archives the year and switches all dashboards to Year-End Mode. Ensure the VP has run all promotions first. This cannot be undone."
        danger onConfirm={() => closeYear(confirm.year)} onCancel={() => setConfirm(null)} loading={actionLoading} />
    </div>
  );
};

/* ═══════════════════ TERMS TAB ═══════════════════ */
const TermsTab = ({ schoolId, currentYear, terms, loading, onRefresh }) => {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });

  const handleCreate = async () => {
    if (!form.name) { toast({ variant:'destructive', title:'Term name required' }); return; }
    if (!currentYear) { toast({ variant:'destructive', title:'No active year', description:'Activate a year first.' }); return; }
    setSaving(true);
    try {
      const maxIdx = terms.length > 0 ? Math.max(...terms.map(t => t.term_index)) : 0;
      const { error } = await supabase.from('terms').insert([{
        academic_year_id: currentYear.id, school_id: parseInt(schoolId),
        name: form.name, term_index: maxIdx + 1,
        start_date: form.start_date || null, end_date: form.end_date || null,
      }]);
      if (error) throw error;
      toast({ title: '✅ Term created', description: `${form.name} added to ${currentYear.name}` });
      setForm({ name:'', start_date:'', end_date:'' });
      setModalOpen(false); onRefresh();
    } catch (e) { toast({ variant:'destructive', title:'Error', description: e.message }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (term) => {
    await supabase.from('terms').update({ is_active: !term.is_active }).eq('id', term.id);
    onRefresh();
  };

  const deleteTerm = async (id) => {
    setDeleting(id);
    const { error } = await supabase.from('terms').delete().eq('id', id);
    if (!error) { toast({ title: 'Term deleted' }); onRefresh(); }
    setDeleting(null);
  };

  if (!currentYear) return (
    <div className="glass rounded-2xl p-14 text-center border border-amber-500/15 bg-amber-500/5 space-y-3">
      <AlertTriangle className="h-10 w-10 text-amber-400/50 mx-auto" />
      <p className="font-bold">No active academic year</p>
      <p className="text-sm text-muted-foreground">Go to the Years tab and activate a year first.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-lg">Terms</p>
          <p className="text-sm text-muted-foreground">Editing: <span className="font-bold text-indigo-400">{currentYear.name}</span></p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/30">
          <Plus className="h-4 w-4" /> Add Term
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Term" icon={Layers} iconColor="indigo">
        <div className="space-y-4">
          <Field label="Term Name">
            <Input placeholder="e.g. Trimestre 1, Semester 1, Term 1 — free text"
              value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date (optional)">
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} className="bg-white/5 border-white/10" />
            </Field>
            <Field label="End Date (optional)">
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} className="bg-white/5 border-white/10" />
            </Field>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white transition-all flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Term
            </button>
          </div>
        </div>
      </Modal>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skel key={i} className="h-20" />)}</div>
      ) : terms.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/8 space-y-2">
          <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-bold text-muted-foreground">No terms yet</p>
          <p className="text-xs text-muted-foreground/60">Add your first term (trimester, semester, etc.)</p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
          {terms.map((term, idx) => (
            <motion.div key={term.id} variants={fadeUp}
              className={cn('glass rounded-2xl p-4 border flex items-center gap-4 transition-all',
                term.is_active ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/8')}>
              <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border',
                term.is_active ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-muted-foreground')}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{term.name}</p>
                {(term.start_date || term.end_date) && (
                  <p className="text-xs text-muted-foreground mt-0.5">{term.start_date || '?'} → {term.end_date || '?'}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge color={term.is_active ? 'green' : 'muted'}>{term.is_active ? 'Active' : 'Inactive'}</Badge>
                <button onClick={() => toggleActive(term)}
                  className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                  {term.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                </button>
                <button onClick={() => deleteTerm(term.id)} disabled={deleting === term.id}
                  className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/15 border border-white/10 flex items-center justify-center transition-all">
                  {deleting === term.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

/* ═══════════════════ SEQUENCES TAB ═══════════════════ */
const SequencesTab = ({ schoolId, currentYear, terms, sequences, loading, onRefresh }) => {
  const { toast }   = useToast();
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [actionId,     setActionId]     = useState(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });

  useEffect(() => { if (terms.length > 0 && !selectedTerm) setSelectedTerm(terms[0].id); }, [terms]);

  const termSeqs = sequences.filter(s => s.term_id === selectedTerm).sort((a,b) => a.sequence_index - b.sequence_index);

  const handleCreate = async () => {
    if (!form.name || !selectedTerm) return;
    setSaving(true);
    try {
      const existing = sequences.filter(s => s.term_id === selectedTerm);
      const maxIdx = existing.length > 0 ? Math.max(...existing.map(s => s.sequence_index)) : 0;
      const { error } = await supabase.from('sequences').insert([{
        term_id: selectedTerm, academic_year_id: currentYear.id,
        school_id: parseInt(schoolId), name: form.name,
        sequence_index: maxIdx + 1, start_date: form.start_date || null,
        end_date: form.end_date || null, status: 'upcoming',
      }]);
      if (error) throw error;
      toast({ title: '✅ Sequence created', description: form.name });
      setForm({ name:'', start_date:'', end_date:'' });
      setModalOpen(false); onRefresh();
    } catch (e) { toast({ variant:'destructive', title:'Error', description: e.message }); }
    finally { setSaving(false); }
  };

  const cycleStatus = async (seq) => {
    const next = seq.status === 'upcoming' ? 'open' : seq.status === 'open' ? 'closed' : 'upcoming';
    setActionId(seq.id);
    if (next === 'open') {
      await supabase.from('sequences').update({ status: 'closed' })
        .eq('school_id', parseInt(schoolId)).eq('academic_year_id', currentYear.id).eq('status', 'open');
    }
    await supabase.from('sequences').update({ status: next }).eq('id', seq.id);
    onRefresh(); setActionId(null);
  };

  const statusCfg = {
    upcoming: { color: 'amber',  label: 'Upcoming', nextLabel: 'Open Now',  nextClass: 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25' },
    open:     { color: 'green',  label: 'Open ✏️',  nextLabel: 'Close',     nextClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
    closed:   { color: 'muted',  label: 'Closed',   nextLabel: 'Reopen',    nextClass: 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10' },
  };

  if (!currentYear) return (
    <div className="glass rounded-2xl p-14 text-center border border-amber-500/15 bg-amber-500/5">
      <AlertTriangle className="h-10 w-10 text-amber-400/50 mx-auto mb-3" />
      <p className="font-bold">No active academic year</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-lg">Sequences</p>
          <p className="text-sm text-muted-foreground">Opening a sequence allows teachers to enter marks. Only one open at a time.</p>
        </div>
      </div>

      {terms.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center border border-white/8">
          <p className="font-bold text-muted-foreground">Create terms first, then add sequences inside them.</p>
        </div>
      ) : (
        <>
          {/* Term pills */}
          <div className="flex flex-wrap gap-2">
            {terms.map(term => (
              <button key={term.id} onClick={() => setSelectedTerm(term.id)}
                className={cn('px-4 py-2 rounded-xl text-sm font-bold border transition-all',
                  selectedTerm === term.id
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/8')}>
                {term.name}
                <span className="ml-2 opacity-50 text-xs">({sequences.filter(s => s.term_id === term.id).length})</span>
              </button>
            ))}
          </div>

          {selectedTerm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                  {terms.find(t => t.id === selectedTerm)?.name}
                </p>
                <button onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 transition-all">
                  <Plus className="h-3.5 w-3.5" /> Add Sequence
                </button>
              </div>

              <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sequence" icon={ListOrdered} iconColor="indigo">
                <div className="space-y-4">
                  <Field label="Sequence Name" hint='e.g. "Séquence 1", "Composition", "Evaluation 1" — free text'>
                    <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start Date"><Input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))} className="bg-white/5 border-white/10" /></Field>
                    <Field label="End Date"><Input type="date" value={form.end_date} onChange={e => setForm(p => ({...p, end_date: e.target.value}))} className="bg-white/5 border-white/10" /></Field>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
                    <button onClick={handleCreate} disabled={saving}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white transition-all flex items-center justify-center gap-2">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create
                    </button>
                  </div>
                </div>
              </Modal>

              {loading ? (
                <div className="space-y-2">{[1,2].map(i => <Skel key={i} className="h-16" />)}</div>
              ) : termSeqs.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center border border-white/8">
                  <p className="text-muted-foreground text-sm">No sequences yet in this term.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {termSeqs.map(seq => {
                    const cfg = statusCfg[seq.status] || statusCfg.upcoming;
                    return (
                      <motion.div key={seq.id} layout
                        className={cn('glass rounded-xl px-4 py-3 border flex items-center gap-4 transition-all',
                          seq.status === 'open' ? 'border-emerald-500/25 bg-emerald-500/5 shadow-lg shadow-emerald-500/5' : 'border-white/8')}>
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                          seq.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-muted-foreground')}>
                          {seq.sequence_index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{seq.name}</p>
                          {(seq.start_date || seq.end_date) && <p className="text-xs text-muted-foreground">{seq.start_date} → {seq.end_date}</p>}
                        </div>
                        <Badge color={cfg.color}>{cfg.label}</Badge>
                        <button onClick={() => cycleStatus(seq)} disabled={actionId === seq.id}
                          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all', cfg.nextClass)}>
                          {actionId === seq.id ? <Loader2 className="h-3 w-3 animate-spin" /> : cfg.nextLabel}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════ CLASS LEVELS TAB ═══════════════════ */
const ClassLevelsTab = ({ schoolId, levels, loading, onRefresh }) => {
  const { toast }  = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [form, setForm] = useState({ name: '', cycle: '', is_terminal: false });

  const handleCreate = async () => {
    if (!form.name) { toast({ variant:'destructive', title:'Level name required' }); return; }
    setSaving(true);
    try {
      const maxIdx = levels.length > 0 ? Math.max(...levels.map(l => l.level_index)) : 0;
      const { error } = await supabase.from('class_levels').insert([{
        school_id: parseInt(schoolId), name: form.name,
        level_index: maxIdx + 1, cycle: form.cycle || null, is_terminal: form.is_terminal,
      }]);
      if (error) throw error;
      toast({ title: '✅ Level added', description: `${form.name} added to the ladder.` });
      setForm({ name:'', cycle:'', is_terminal:false });
      setModalOpen(false); onRefresh();
    } catch (e) { toast({ variant:'destructive', title:'Error', description: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-lg">Class Levels</p>
          <p className="text-sm text-muted-foreground">Define your school's progression ladder. Order controls promotion direction.</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/30">
          <Plus className="h-4 w-4" /> Add Level
        </button>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Class Level" icon={GraduationCap} iconColor="indigo">
        <div className="space-y-4">
          <Field label="Level Name" hint='e.g. "Form 1", "6ème", "Year 7", "Terminale"'>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="bg-white/5 border-white/10" placeholder="Form 1" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cycle">
              <select value={form.cycle} onChange={e => setForm(p => ({...p, cycle: e.target.value}))}
                className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-sm px-3">
                <option value="">None</option>
                <option value="BEPC">BEPC</option>
                <option value="BAC">BAC</option>
              </select>
            </Field>
            <Field label="End of Cycle?" hint="Generates certificate on completion">
              <button type="button" onClick={() => setForm(p => ({...p, is_terminal: !p.is_terminal}))}
                className={cn('flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-bold border w-full transition-all',
                  form.is_terminal ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-muted-foreground')}>
                <Trophy className="h-4 w-4" /> {form.is_terminal ? 'Yes' : 'No'}
              </button>
            </Field>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition-all">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-500 to-violet-500 hover:opacity-90 text-white transition-all flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add Level
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/15">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300/80">
          Levels are ordered by index. Promoted students move to the next level up. Terminal levels trigger automatic completion certificates (BEPC after Form 4, BAC after Terminale).
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skel key={i} className="h-16" />)}</div>
      ) : levels.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/8 space-y-2">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-bold text-muted-foreground">No levels yet</p>
          <p className="text-xs text-muted-foreground/60">Build your progression ladder: Form 1 → Form 7, etc.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {levels.sort((a,b) => a.level_index - b.level_index).map((level, idx) => (
            <div key={level.id} className="relative flex items-stretch gap-4">
              {/* Connector */}
              <div className="flex flex-col items-center w-11 shrink-0">
                <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm border z-10',
                  level.is_terminal ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400')}>
                  {idx + 1}
                </div>
                {idx < levels.length - 1 && <div className="w-px flex-1 bg-white/8 my-1" />}
              </div>
              {/* Card */}
              <div className={cn('glass flex-1 mb-2 rounded-2xl px-4 py-3 border flex items-center gap-3',
                level.is_terminal ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/8')}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{level.name}</p>
                    {level.cycle && <Badge color="indigo">{level.cycle}</Badge>}
                    {level.is_terminal && <Badge color="amber"><Trophy className="h-2.5 w-2.5" /> Certificate</Badge>}
                  </div>
                </div>
                <button onClick={async () => {
                  setDeleting(level.id);
                  await supabase.from('class_levels').delete().eq('id', level.id);
                  onRefresh(); setDeleting(null);
                }} disabled={deleting === level.id}
                  className="h-8 w-8 rounded-lg bg-white/5 hover:bg-red-500/15 border border-white/10 flex items-center justify-center transition-all shrink-0">
                  {deleting === level.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════ MAIN PAGE ═══════════════════ */
const AdminAcademicYearPage = () => {
  const schoolId = localStorage.getItem('schoolId');
  const [tab,       setTab]     = useState('years');
  const [years,     setYears]   = useState([]);
  const [terms,     setTerms]   = useState([]);
  const [sequences, setSeqs]    = useState([]);
  const [levels,    setLevels]  = useState([]);
  const [loading,   setLoading] = useState(true);

  const currentYear = years.find(y => y.is_current) || null;

  const fetchAll = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const sid = parseInt(schoolId);
      const [{ data: yr }, { data: tr }, { data: sq }, { data: lv }] = await Promise.all([
        supabase.from('academic_years').select('*').eq('school_id', sid).order('created_at', { ascending: false }),
        supabase.from('terms').select('*').eq('school_id', sid).order('term_index'),
        supabase.from('sequences').select('*').eq('school_id', sid).order('sequence_index'),
        supabase.from('class_levels').select('*').eq('school_id', sid).order('level_index'),
      ]);
      setYears(yr || []); setTerms(tr || []); setSeqs(sq || []); setLevels(lv || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const currentYearTerms = terms.filter(t => t.academic_year_id === currentYear?.id);
  const currentYearSeqs  = sequences.filter(s => s.academic_year_id === currentYear?.id);
  const openSeq          = currentYearSeqs.find(s => s.status === 'open');

  const tabs = [
    { key: 'years',     icon: Calendar,      label: 'Years',        count: years.length },
    { key: 'terms',     icon: Layers,        label: 'Terms',        count: currentYearTerms.length },
    { key: 'sequences', icon: ListOrdered,   label: 'Sequences',    count: currentYearSeqs.length },
    { key: 'levels',    icon: GraduationCap, label: 'Levels',       count: levels.length },
  ];

  return (
    <>
      <Helmet><title>Academic Year Engine — CloudCampus</title></Helmet>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-2xl font-black flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center">
              <CalendarClock className="h-5 w-5 text-indigo-400" />
            </div>
            Academic Year Engine
          </h1>
          <p className="text-muted-foreground text-sm pl-14">Configure the school calendar — years, terms, sequences and progression.</p>
        </motion.div>

        {/* Status bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 border border-white/8 flex flex-wrap items-center gap-3">
          <div className={cn('h-2.5 w-2.5 rounded-full', currentYear ? 'bg-emerald-400 animate-pulse' : 'bg-white/20')} />
          <span className="text-sm font-bold">{currentYear ? currentYear.name : 'No active year'}</span>
          {currentYear && <Badge color={currentYear.status === 'open' ? 'green' : 'red'}>{currentYear.status}</Badge>}
          {currentYear && openSeq && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <Badge color="green">✏️ {openSeq.name} open for marks</Badge>
            </>
          )}
          {currentYear && !openSeq && currentYear.status === 'open' && (
            <>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-xs text-muted-foreground">No sequence open — teachers cannot enter marks</span>
            </>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <TabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}
              icon={t.icon} label={t.label} count={t.count} />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {tab === 'years'     && <YearsTab      schoolId={schoolId} years={years} loading={loading} onRefresh={fetchAll} />}
            {tab === 'terms'     && <TermsTab      schoolId={schoolId} currentYear={currentYear} terms={currentYearTerms} loading={loading} onRefresh={fetchAll} />}
            {tab === 'sequences' && <SequencesTab  schoolId={schoolId} currentYear={currentYear} terms={currentYearTerms} sequences={currentYearSeqs} loading={loading} onRefresh={fetchAll} />}
            {tab === 'levels'    && <ClassLevelsTab schoolId={schoolId} levels={levels} loading={loading} onRefresh={fetchAll} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
};

export default AdminAcademicYearPage;
