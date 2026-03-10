/**
 * DisciplinePage.jsx  — Parent Portal
 * Fully redesigned: uses the platform's glass/theme system,
 * no more hardcoded slate-900 colours.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Upload, FileText, Shield, CheckCircle,
  Clock, Loader2, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ── status helpers ──────────────────────────────────────── */
const STATUS = {
  pending:  { label: 'Pending',  color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/15  text-green-400  border-green-500/30'  },
  rejected: { label: 'Rejected', color: 'bg-red-500/15    text-red-400    border-red-500/30'    },
};

const stagger = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const DisciplinePage = () => {
  const { toast } = useToast();
  const [absencesCount, setAbsencesCount] = useState(0);
  const [punishments, setPunishments]     = useState([]);
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData]   = useState({ message: '', file: null });
  const [fileName, setFileName]   = useState('');

  const studentMatricule = localStorage.getItem('studentMatricule');
  const parentName       = localStorage.getItem('userName');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [absRes, punRes, jusRes] = await Promise.all([
        supabase.from('absences').select('hours').eq('student_matricule', studentMatricule).eq('status', 'unjustified'),
        supabase.from('punishments').select('*').eq('student_matricule', studentMatricule).order('created_at', { ascending: false }),
        supabase.from('justifications').select('*').eq('student_matricule', studentMatricule).order('created_at', { ascending: false }),
      ]);
      setAbsencesCount((absRes.data || []).reduce((s, a) => s + a.hours, 0));
      setPunishments(punRes.data || []);
      setJustifications(jusRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFormData(prev => ({ ...prev, file }));
    setFileName(file?.name || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let fileUrl = null;
      if (formData.file) {
        const ext = formData.file.name.split('.').pop();
        const name = `${studentMatricule}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('justifications').upload(name, formData.file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('justifications').getPublicUrl(name);
        fileUrl = publicUrl;
      }
      const { data: classData } = await supabase.from('classes').select('dm_id').eq('id', classId).single();
      const { error } = await supabase.from('justifications').insert({
        student_matricule: studentMatricule, parent_id: studentMatricule, parent_name: parentName,
        class_id: classId, dm_id: classData?.dm_id, message: formData.message,
        file_url: fileUrl, status: 'pending', school_id: schoolId,
      });
      if (error) throw error;
      toast({ title: '✓ Submitted', description: 'Your justification was sent to the Discipline Master.' });
      setFormData({ message: '', file: null }); setFileName('');
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit. Please try again.' });
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Helmet><title>Discipline Centre — CloudCampus</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Page header ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
            Discipline Centre
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage absences, justifications and monitor discipline records.</p>
        </motion.div>

        {/* ── Stat banner ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className={cn(
            'glass rounded-2xl p-5 flex items-center gap-5',
            absencesCount > 0
              ? 'border-l-4 border-l-red-500 bg-red-500/5'
              : 'border-l-4 border-l-green-500 bg-green-500/5'
          )}>
            <div className={cn('p-4 rounded-2xl', absencesCount > 0 ? 'bg-red-500/15' : 'bg-green-500/15')}>
              {absencesCount > 0
                ? <AlertTriangle className="w-7 h-7 text-red-400" />
                : <CheckCircle className="w-7 h-7 text-green-400" />}
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Unjustified Absence Hours</p>
              <p className={cn('text-4xl font-black mt-0.5', absencesCount > 0 ? 'text-red-400' : 'text-green-400')}>
                {absencesCount}h
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {absencesCount === 0 ? '🎉 Perfect — no unjustified absences on record!' : 'Submit a justification below to address these hours.'}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Justify form ──────────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="glass rounded-2xl p-6 h-full space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/15">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Justify Absences</h2>
                  <p className="text-xs text-muted-foreground">Sent directly to the Discipline Master</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Justification Message</Label>
                  <Textarea
                    value={formData.message}
                    onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                    className="bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 min-h-[120px] resize-none rounded-xl placeholder:text-muted-foreground/50"
                    placeholder="Explain the reason for the absence in detail…"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Supporting Document <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/20 bg-white/3 hover:bg-white/5 hover:border-blue-500/40 transition-all cursor-pointer group">
                    <Upload className="w-4 h-4 text-muted-foreground group-hover:text-blue-400 transition-colors shrink-0" />
                    <span className="text-sm text-muted-foreground truncate">{fileName || 'Click to attach a file (PDF, image, etc.)'}</span>
                    <input type="file" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>

                <Button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</> : <><Upload className="w-4 h-4 mr-2" />Submit Justification</>}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* ── Punishments list ──────────────────────────── */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="glass rounded-2xl p-6 h-full space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/15">
                  <Shield className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Punishment Records</h2>
                  <p className="text-xs text-muted-foreground">{punishments.length} record{punishments.length !== 1 ? 's' : ''} on file</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading…</span>
                </div>
              ) : punishments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <div className="p-4 rounded-2xl bg-green-500/10">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="font-semibold text-sm">No punishments on record</p>
                  <p className="text-xs text-muted-foreground">Keep up the great behaviour! 🎉</p>
                </div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="visible"
                  className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                  {punishments.map((p) => (
                    <motion.div key={p.id} variants={fadeUp}
                      className="glass rounded-xl p-4 border-l-2 border-l-orange-500/60 hover:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold text-sm leading-tight">{p.reason}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5">{p.punishment}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">By: {p.signaled_by_role}</p>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Justification history ─────────────────────────── */}
        {justifications.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Justification History</h2>
                  <p className="text-xs text-muted-foreground">All submissions you've made</p>
                </div>
              </div>
              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
                {justifications.map((j) => (
                  <motion.div key={j.id} variants={fadeUp}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed line-clamp-2">{j.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {new Date(j.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0', STATUS[j.status]?.color || STATUS.pending.color)}>
                      {STATUS[j.status]?.label || j.status}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default DisciplinePage;
