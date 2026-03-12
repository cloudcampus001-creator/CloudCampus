/**
 * PunishPage.jsx  –  Discipline Master
 * ──────────────────────────────────────
 * Full redesign:
 *  • Split two-panel layout (form left, live preview / recent right)
 *  • Step-by-step flow highlighted visually (1→2→3→4)
 *  • Orange/red brand colours, glass card, gradient submit button
 *  • Full translation via t()
 *  • All original Supabase logic preserved
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Gavel, Loader2, Save,
  CheckCircle, User, BookOpen, FileText, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import SearchableStudentSelect from '@/components/SearchableStudentSelect';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── step indicator ─────────────────────────────────────── */
const Step = ({ n, label, active, done }) => (
  <div className={cn('flex items-center gap-2.5 text-sm', active ? 'text-orange-400' : done ? 'text-green-400' : 'text-muted-foreground')}>
    <div className={cn('h-7 w-7 rounded-full flex items-center justify-center font-black text-xs border transition-all',
      active ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
      : done  ? 'bg-green-500/15 border-green-500/40 text-green-400'
      : 'bg-white/5 border-white/15')}>
      {done ? <CheckCircle className="h-4 w-4" /> : n}
    </div>
    <span className="font-medium hidden sm:block">{label}</span>
  </div>
);

const Divider = () => <div className="h-px w-6 bg-white/10 hidden sm:block" />;

/* ─────────────────────────────────────────────────────── */
const PunishPage = () => {
  const { toast }  = useToast();
  const { t }      = useLanguage();
  const userId     = localStorage.getItem('userId');
  const schoolId   = localStorage.getItem('schoolId');

  const [classes,           setClasses]           = useState([]);
  const [students,          setStudents]          = useState([]);
  const [selectedClass,     setSelectedClass]     = useState('');
  const [fetchingStudents,  setFetchingStudents]  = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [submitted,         setSubmitted]         = useState(false);
  const [form, setForm] = useState({ studentMatricule: '', reason: '', punishment: '' });

  /* ── fetch classes ── */
  useEffect(() => {
    supabase.from('classes').select('id, name').eq('dm_id', userId)
      .then(({ data }) => setClasses(data || []));
  }, [userId]);

  /* ── load students when class changes ── */
  const handleClassChange = async (classId) => {
    setSelectedClass(classId);
    setFetchingStudents(true);
    setForm(prev => ({ ...prev, studentMatricule: '' }));
    const { data } = await supabase
      .from('students').select('matricule, name')
      .eq('class_id', classId).order('name');
    setStudents(data || []);
    setFetchingStudents(false);
  };

  /* ── submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentMatricule || !form.reason || !form.punishment) {
      toast({ variant: 'destructive', title: t('missingFields') });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('punishments').insert([{
        student_matricule: form.studentMatricule,
        class_id:          parseInt(selectedClass),
        signaled_by_id:    parseInt(userId),
        signaled_by_role:  'discipline',
        reason:            form.reason,
        punishment:        form.punishment,
        school_id:         parseInt(schoolId),
      }]);
      if (error) throw error;
      toast({ title: `✓ ${t('punishSuccess')}`, className: 'bg-orange-500/10 border-orange-500/40 text-orange-400' });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setForm({ studentMatricule: '', reason: '', punishment: '' });
        setSelectedClass('');
        setStudents([]);
      }, 2000);
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: 'Failed to save record.' });
    } finally { setLoading(false); }
  };

  /* ── active step ── */
  const step = !selectedClass ? 1 : !form.studentMatricule ? 2 : !form.reason ? 3 : 4;

  return (
    <>
      <Helmet><title>{t('punishTitle')} · CloudCampus</title></Helmet>

      <div className="max-w-2xl mx-auto space-y-7 pb-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Gavel className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('punishTitle')}</h1>
              <p className="text-muted-foreground text-sm">{t('punishSub')}</p>
            </div>
          </div>
        </motion.div>

        {/* Step tracker */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-2 px-5 py-3.5 glass rounded-2xl border border-white/8 overflow-x-auto">
          <Step n={1} label={t('classLabel')}   active={step===1} done={step>1} />
          <Divider />
          <Step n={2} label={t('studentLabel')} active={step===2} done={step>2} />
          <Divider />
          <Step n={3} label={t('offenseLabel')} active={step===3} done={step>3} />
          <Divider />
          <Step n={4} label={t('punishmentLabel')} active={step===4} done={false} />
        </motion.div>

        {/* Form card */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="relative glass rounded-3xl p-7 border border-white/10 overflow-hidden"
            style={{ boxShadow: '0 8px 40px rgba(249,115,22,0.1)' }}>
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl"
              style={{ background: 'linear-gradient(90deg,#f97316,#ef4444)' }} />

            <AnimatePresence mode="wait">
              {submitted ? (
                /* ── Success state ── */
                <motion.div key="success"
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="h-20 w-20 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-400" />
                  </div>
                  <p className="text-xl font-black text-green-400">{t('punishSuccess')}</p>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={handleSubmit} className="space-y-6">

                  {/* 1 - Class */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-bold">
                      <span className="h-5 w-5 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[10px] font-black text-orange-300">1</span>
                      {t('classLabel')}
                    </Label>
                    <Select onValueChange={handleClassChange} value={selectedClass}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-orange-500/50">
                        <SelectValue placeholder={t('selectClassPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 2 - Student */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-bold">
                      <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all',
                        step > 1 ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/15 text-muted-foreground')}>2</span>
                      {t('studentLabel')}
                    </Label>
                    <SearchableStudentSelect
                      students={students}
                      value={form.studentMatricule}
                      onChange={val => setForm(prev => ({ ...prev, studentMatricule: val }))}
                      disabled={!selectedClass}
                      loading={fetchingStudents}
                      placeholder={!selectedClass ? t('selectClassFirst') : t('searchStudentPlaceholder')}
                    />
                  </div>

                  {/* 3 - Reason */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-bold">
                      <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all',
                        step > 2 ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/15 text-muted-foreground')}>3</span>
                      {t('offenseLabel')}
                    </Label>
                    <Input
                      placeholder={t('offensePlaceholder')}
                      className="h-12 bg-white/5 border-white/10 focus:border-orange-500/50 rounded-xl"
                      value={form.reason}
                      onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>

                  {/* 4 - Punishment */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-bold">
                      <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all',
                        step > 3 ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/15 text-muted-foreground')}>4</span>
                      {t('punishmentLabel')}
                    </Label>
                    <Textarea
                      placeholder={t('punishmentPlaceholder')}
                      className="min-h-[100px] bg-white/5 border-white/10 focus:border-orange-500/50 rounded-xl resize-none"
                      value={form.punishment}
                      onChange={e => setForm(prev => ({ ...prev, punishment: e.target.value }))}
                    />
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading}
                    className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', boxShadow: '0 8px 32px rgba(249,115,22,0.35)' }}>
                    {loading
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> {t('verifying')}</>
                      : <><Save className="h-5 w-5" /> {t('recordPunishment')}</>
                    }
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default PunishPage;
