import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, UserCheck, UserX, Loader2, Clock, BookOpen, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

const TABS = ['elog', 'register'];

const ActivityPage = () => {
  const { toast }  = useToast();
  const { t }      = useLanguage();
  const [loading, setLoading]                   = useState(true);
  const [currentClass, setCurrentClass]         = useState(null);
  const [students, setStudents]                 = useState([]);
  const [absentStudents, setAbsentStudents]     = useState(new Set());
  const [logData, setLogData]                   = useState({ topic: '', subTopics: '' });
  const [submittingLog, setSubmittingLog]       = useState(false);
  const [submittingAtt, setSubmittingAtt]       = useState(false);
  const [activeTab, setActiveTab]               = useState('elog');

  const teacherId   = localStorage.getItem('userId');
  const schoolId    = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName');

  useEffect(() => {
    const fetchCurrentClass = async () => {
      try {
        setLoading(true);
        const now  = new Date();
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const currentDay  = days[now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

        const { data, error } = await supabase
          .from('timetables').select('*, classes(id, name)')
          .eq('teacher_id', teacherId).eq('day_of_week', currentDay)
          .lte('start_time', currentTime).gte('end_time', currentTime).maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setCurrentClass(data);
          const { data: sts } = await supabase.from('students').select('*').eq('class_id', data.class_id).order('name');
          setStudents(sts || []);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchCurrentClass();
  }, [teacherId]);

  const toggleAbsence = (matricule) => {
    setAbsentStudents(prev => {
      const next = new Set(prev);
      next.has(matricule) ? next.delete(matricule) : next.add(matricule);
      return next;
    });
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    setSubmittingLog(true);
    try {
      const { error } = await supabase.from('e_logbook_entries').insert({
        teacher_id: parseInt(teacherId), class_id: currentClass.class_id,
        subject: currentClass.subject, topic: logData.topic,
        sub_topics: logData.subTopics, status: 'pending',
        school_id: parseInt(schoolId), teacher_name: teacherName,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: `✓ ${t('success')}`, description: t('logSuccess') });
      setLogData({ topic: '', subTopics: '' });
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: t('logError') });
    } finally { setSubmittingLog(false); }
  };

  const handleSubmitAttendance = async () => {
    setSubmittingAtt(true);
    try {
      const absentees = Array.from(absentStudents);
      if (absentees.length > 0) {
        const { error } = await supabase.from('absences').insert(
          absentees.map(matricule => ({
            student_matricule: matricule, class_id: currentClass.class_id,
            teacher_id: parseInt(teacherId),
            date: new Date().toISOString().split('T')[0],
            hours: 1, status: 'unjustified', school_id: parseInt(schoolId),
          }))
        );
        if (error) throw error;
      }
      toast({ title: `✓ ${t('success')}`, description: t('attendanceSuccess') });
      setAbsentStudents(new Set());
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: t('error'), description: t('error') });
    } finally { setSubmittingAtt(false); }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-48 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </PageTransition>
    );
  }

  if (!currentClass) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-5">
          <div className="p-6 rounded-3xl bg-white/5">
            <Clock className="h-12 w-12 text-muted-foreground opacity-40" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t('noActiveClass')}</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">{t('noActiveClassDesc')}</p>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <>
      <Helmet><title>{t('liveActivityTitle')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              {t('liveActivityTitle')}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <p className="text-sm font-semibold text-emerald-400">
                {currentClass.classes?.name} · {currentClass.subject}
              </p>
              <span className="text-xs text-muted-foreground">
                {currentClass.start_time?.slice(0,5)} – {currentClass.end_time?.slice(0,5)}
              </span>
            </div>
          </motion.div>

          {/* Tab switcher */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex gap-2 p-1 bg-white/4 border border-white/8 rounded-2xl w-fit">
            {[
              { id: 'elog',     label: t('eLogBook'),          icon: BookOpen      },
              { id: 'register', label: t('attendanceRegister'), icon: ClipboardList },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">

            {/* ── e-Log ─────────────────────────────── */}
            {activeTab === 'elog' && (
              <motion.div key="elog"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}>
                <div className="glass rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/15">
                      <BookOpen className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base">{t('eLogBook')}</h2>
                      <p className="text-xs text-muted-foreground">{currentClass.classes?.name} · {currentClass.subject}</p>
                    </div>
                  </div>
                  <form onSubmit={handleSubmitLog} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('topicTaught')}</Label>
                      <Input
                        value={logData.topic}
                        onChange={e => setLogData(p => ({ ...p, topic: e.target.value }))}
                        placeholder="e.g. Newton's Laws of Motion"
                        className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('subTopics')}</Label>
                      <Textarea
                        value={logData.subTopics}
                        onChange={e => setLogData(p => ({ ...p, subTopics: e.target.value }))}
                        placeholder="e.g. First Law, Inertia, Examples…"
                        className="bg-white/5 border-white/10 focus:border-emerald-500/50 min-h-[100px] resize-none rounded-xl"
                      />
                    </div>
                    <button type="submit" disabled={submittingLog}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                      {submittingLog
                        ? <><Loader2 className="h-4 w-4 animate-spin" />{t('submitting')}</>
                        : <><Send className="h-4 w-4" />{t('signSendVP')}</>}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ── Attendance ────────────────────────── */}
            {activeTab === 'register' && (
              <motion.div key="register"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}>
                <div className="glass rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-teal-500/15">
                        <ClipboardList className="h-5 w-5 text-teal-400" />
                      </div>
                      <div>
                        <h2 className="font-bold text-base">{t('attendanceRegister')}</h2>
                        <p className="text-xs text-muted-foreground">{t('attendanceNote')}</p>
                      </div>
                    </div>
                    {absentStudents.size > 0 && (
                      <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/25">
                        {absentStudents.size} {t('absent_count')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {students.map((student, idx) => {
                      const isAbsent = absentStudents.has(student.matricule);
                      return (
                        <motion.div key={student.matricule}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                          onClick={() => toggleAbsence(student.matricule)}
                          className={cn(
                            'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99]',
                            isAbsent
                              ? 'bg-red-500/8 border-red-500/30'
                              : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12'
                          )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                              isAbsent ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                            )}>
                              {isAbsent ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.matricule}</p>
                            </div>
                          </div>
                          <span className={cn('text-xs font-semibold', isAbsent ? 'text-red-400' : 'text-emerald-400')}>
                            {isAbsent ? t('absent') : t('present')}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleSubmitAttendance}
                    disabled={submittingAtt}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-60',
                      absentStudents.size > 0
                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    )}>
                    {submittingAtt
                      ? <><Loader2 className="h-4 w-4 animate-spin" />{t('submitting')}</>
                      : <><Send className="h-4 w-4" />{t('submitAttendance')} ({absentStudents.size} {t('absent_count')})</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PageTransition>
    </>
  );
};

export default ActivityPage;
