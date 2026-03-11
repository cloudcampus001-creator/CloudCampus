import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Upload, FileText, Shield, CheckCircle,
  Clock, Loader2, ChevronRight, Info
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { PunishSkeleton, StatCardSkeleton } from '@/components/Skeletons';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const DisciplinePage = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [absencesCount, setAbsencesCount]   = useState(0);
  const [punishments, setPunishments]       = useState([]);
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [submitting, setSubmitting]         = useState(false);
  const [formData, setFormData]             = useState({ message: '', file: null });
  const [fileName, setFileName]             = useState('');
  const [selectedPunish, setSelectedPunish] = useState(null);

  const studentMatricule = localStorage.getItem('studentMatricule');
  const parentName       = localStorage.getItem('userName');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');

  const STATUS_STYLE = {
    pending:  { label: t('statusPending'),  cls: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' },
    approved: { label: t('statusApproved'), cls: 'bg-green-500/15  text-green-500  border-green-500/30'  },
    rejected: { label: t('statusRejected'), cls: 'bg-red-500/15    text-red-400    border-red-500/30'    },
  };

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

  useEffect(() => { fetchData(); }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFormData(p => ({ ...p, file: f }));
    setFileName(f?.name || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let fileUrl = null;
      if (formData.file) {
        const ext  = formData.file.name.split('.').pop();
        const name = `${studentMatricule}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('justifications').upload(name, formData.file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('justifications').getPublicUrl(name);
        fileUrl = publicUrl;
      }
      const { data: cls } = await supabase.from('classes').select('dm_id').eq('id', classId).single();
      const { error } = await supabase.from('justifications').insert({
        student_matricule: studentMatricule, parent_id: studentMatricule,
        parent_name: parentName, class_id: classId, dm_id: cls?.dm_id,
        message: formData.message, file_url: fileUrl, status: 'pending', school_id: schoolId,
      });
      if (error) throw error;
      toast({ title: `✓ ${t('success')}`, description: t('submitSuccess') });
      setFormData({ message: '', file: null }); setFileName('');
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: t('submitError') });
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Helmet><title>{t('disciplineCentre')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              {t('disciplineCentre')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{t('disciplineDesc')}</p>
          </motion.div>

          {/* Absence stat */}
          {loading ? <StatCardSkeleton /> : (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
              <div className={cn(
                'glass rounded-2xl p-5 flex items-center gap-5',
                absencesCount > 0 ? 'border-l-4 border-l-red-500 bg-red-500/3' : 'border-l-4 border-l-green-500 bg-green-500/3'
              )}>
                <div className={cn('p-4 rounded-2xl', absencesCount > 0 ? 'bg-red-500/15' : 'bg-green-500/15')}>
                  {absencesCount > 0
                    ? <AlertTriangle className="h-7 w-7 text-red-400" />
                    : <CheckCircle   className="h-7 w-7 text-green-400" />}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{t('unjustifiedAbsenceHours')}</p>
                  <p className={cn('text-4xl font-black mt-0.5', absencesCount > 0 ? 'text-red-400' : 'text-green-400')}>
                    {absencesCount}<span className="text-2xl">h</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {absencesCount === 0 ? t('perfectAttendance') : t('submitJustificationHint')}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Justify form */}
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <div className="glass rounded-2xl p-6 h-full space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/15">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">{t('justifyAbsences')}</h2>
                    <p className="text-xs text-muted-foreground">{t('sentToDM')}</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('justificationMessage')}</Label>
                    <Textarea
                      value={formData.message}
                      onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                      className="bg-white/5 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 min-h-[110px] resize-none rounded-xl placeholder:text-muted-foreground/50"
                      placeholder={t('message') + '...'}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('attachDocument')}</Label>
                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/20 bg-white/3 hover:bg-white/5 hover:border-blue-500/40 transition-all cursor-pointer group">
                      <Upload className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors shrink-0" />
                      <span className="text-sm text-muted-foreground truncate">{fileName || t('attachFilePlaceholder')}</span>
                      <input type="file" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                    {submitting
                      ? <><Loader2 className="h-4 w-4 animate-spin" />{t('submitting')}</>
                      : <><Upload className="h-4 w-4" />{t('submit')}</>}
                  </button>
                </form>
              </div>
            </motion.div>

            {/* Punishments */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass rounded-2xl p-6 h-full space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/15">
                    <Shield className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">{t('conductRecords')}</h2>
                    <p className="text-xs text-muted-foreground">{t('tapForDetails')}</p>
                  </div>
                </div>
                {loading ? (
                  <div className="space-y-3">{[0,1,2].map(i => <PunishSkeleton key={i} />)}</div>
                ) : punishments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-green-500/10"><CheckCircle className="h-8 w-8 text-green-400" /></div>
                    <p className="font-semibold text-sm">{t('noPunishments')}</p>
                  </div>
                ) : (
                  <motion.div variants={stagger} initial="hidden" animate="visible"
                    className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {punishments.map((p) => (
                      <motion.div key={p.id} variants={fadeUp}>
                        <button onClick={() => setSelectedPunish(p)} className="w-full text-left glass rounded-xl p-4 border-l-2 border-l-orange-500/60 hover:bg-white/5 transition-colors group">
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-semibold text-sm leading-tight">{p.reason}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.punishment}</p>
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Justification history */}
          {!loading && justifications.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/15">
                    <Clock className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">{t('justificationHistory')}</h2>
                    <p className="text-xs text-muted-foreground">{justifications.length} {t('justifications').toLowerCase()}</p>
                  </div>
                </div>
                <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
                  {justifications.map((j) => {
                    const s = STATUS_STYLE[j.status] || STATUS_STYLE.pending;
                    return (
                      <motion.div key={j.id} variants={fadeUp}
                        className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed line-clamp-2">{j.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5">
                            {new Date(j.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={cn('text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0', s.cls)}>
                          {s.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </motion.div>
          )}

        </div>
      </PageTransition>

      {/* Glass popup — punishment detail */}
      <GlassPopup
        open={!!selectedPunish}
        onClose={() => setSelectedPunish(null)}
        title={t('conductRecord')}
        subtitle={selectedPunish ? new Date(selectedPunish.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        variant="dialog"
        maxWidth="max-w-sm"
      >
        {selectedPunish && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">{t('reason')}</p>
              <p className="text-sm text-gray-800 dark:text-white font-medium">{selectedPunish.reason}</p>
            </div>
            <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{t('punishment')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{selectedPunish.punishment}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-1">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{t('reportedBy')}: <span className="font-semibold capitalize">{selectedPunish.signaled_by_role?.replace('_', ' ')}</span></span>
            </div>
          </div>
        )}
      </GlassPopup>
    </>
  );
};

export default DisciplinePage;
