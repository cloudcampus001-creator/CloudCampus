import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Bell, Loader2, CheckCircle, AlertCircle,
  Book, Send, ArrowLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import SearchableStudentSelect from '@/components/SearchableStudentSelect';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

/* ─── tiny helpers ──────────────────────────────────────── */
const fadeIn  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32 } } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const PublishPage = () => {
  const { t }     = useLanguage();
  const { toast } = useToast();

  /* ── which mode: null | 'document' | 'notification' ─── */
  const [mode, setMode] = useState(null);

  /* ── shared ─────────────────────────────────────────── */
  const [classes, setClasses]               = useState([]);
  const [loading, setLoading]               = useState(false);

  /* ── document form ───────────────────────────────────── */
  const [docType,        setDocType]        = useState('document');
  const [selectedClass,  setSelectedClass]  = useState('');
  const [subject,        setSubject]        = useState('');
  const [file,           setFile]           = useState(null);
  const [fileName,       setFileName]       = useState('');

  /* ── notification form ───────────────────────────────── */
  const [notifType,      setNotifType]      = useState('individual'); // individual | class | all
  const [notifClass,     setNotifClass]     = useState('');
  const [students,       setStudents]       = useState([]);
  const [fetchingStuds,  setFetchingStuds]  = useState(false);
  const [selectedStudent,setSelectedStudent]= useState('');
  const [notifTitle,     setNotifTitle]     = useState('');
  const [notifMessage,   setNotifMessage]   = useState('');

  const teacherId   = localStorage.getItem('userId');
  const schoolId    = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName') || 'Teacher';

  /* ── load teacher's classes ─────────────────────────── */
  useEffect(() => {
    if (!teacherId) return;
    supabase.from('timetables').select('class_id, subject, classes(id, name)').eq('teacher_id', teacherId)
      .then(({ data }) => {
        const seen = new Set(), unique = [];
        data?.forEach(item => {
          if (item.classes && !seen.has(item.class_id)) {
            seen.add(item.class_id);
            unique.push({ id: item.classes.id, name: item.classes.name, defaultSubject: item.subject });
          }
        });
        setClasses(unique);
      });
  }, [teacherId]);

  /* ── students when notif class changes ─────────────── */
  useEffect(() => {
    if (notifClass && notifType === 'individual') {
      setFetchingStuds(true);
      setSelectedStudent('');
      supabase.from('students').select('matricule, name').eq('class_id', notifClass).order('name')
        .then(({ data }) => { setStudents(data || []); setFetchingStuds(false); });
    } else {
      setStudents([]); setSelectedStudent('');
    }
  }, [notifClass, notifType]);

  /* ────────────────────────────────────────────────────── */
  /*  PUBLISH DOCUMENT                                      */
  /* ────────────────────────────────────────────────────── */
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      toast({ variant: 'destructive', title: t('error'), description: t('fileTooLarge') }); return;
    }
    setFile(f); setFileName(f.name);
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!file || !selectedClass) {
      toast({ variant: 'destructive', title: t('error'), description: 'Class and file are required.' }); return;
    }
    setLoading(true);
    try {
      const sanitized  = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
      const uniquePath = `${schoolId}/${selectedClass}/${Date.now()}_${sanitized}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(uniquePath, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(uniquePath);
      const { error: dbErr } = await supabase.from('documents').insert({
        class_id: parseInt(selectedClass), teacher_id: teacherId, teacher_name: teacherName,
        subject: subject || 'General', file_name: fileName, file_url: publicUrl,
        document_type: docType, school_id: parseInt(schoolId), created_at: new Date().toISOString(),
      });
      if (dbErr) throw new Error(dbErr.message);
      // auto-notification (non-critical)
      try {
        await supabase.from('notifications').insert({
          sender_name: teacherName, sender_role: 'teacher',
          title: `New ${docType}: ${subject || fileName}`,
          content: `A new ${docType} "${fileName}" has been uploaded for ${subject || 'your class'}.`,
          target_type: 'class', target_id: parseInt(selectedClass),
          school_id: parseInt(schoolId), file_url: publicUrl, audience_type: 'parent',
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } catch {} // non-critical — don't block publish on notification failure
      toast({ title: `✓ ${t('success')}`, description: t('publishSuccess') });
      setFile(null); setFileName(''); setSelectedClass(''); setSubject('');
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message || t('publishError') });
    } finally { setLoading(false); }
  };

  /* ────────────────────────────────────────────────────── */
  /*  SEND NOTIFICATION                                     */
  /* ────────────────────────────────────────────────────── */
  const handleNotify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        sender_name: teacherName, sender_role: 'teacher',
        title: notifTitle, content: notifMessage,
        school_id: parseInt(schoolId),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      if (notifType === 'all') {
        await Promise.all(classes.map(cls =>
          supabase.from('notifications').insert({ ...payload, target_type: 'class', target_id: cls.id, audience_type: 'parent', audience_id: null })
        ));
      } else if (notifType === 'class') {
        if (!notifClass) throw new Error('Select a class');
        await supabase.from('notifications').insert({ ...payload, target_type: 'class', target_id: parseInt(notifClass), audience_type: 'parent', audience_id: null });
      } else {
        if (!selectedStudent) throw new Error('Select a student');
        await supabase.from('notifications').insert({ ...payload, target_type: 'class', target_id: parseInt(notifClass), audience_type: 'student', student_matricule: selectedStudent, audience_id: null });
      }
      toast({ title: `✓ ${t('success')}`, description: t('notifSent') });
      setNotifTitle(''); setNotifMessage(''); setNotifClass(''); setSelectedStudent(''); setStudents([]);
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message || t('notifError') });
    } finally { setLoading(false); }
  };

  /* ────────────────────────────────────────────────────── */
  const DOC_TYPES = [
    { id: 'document',   label: t('material'),    icon: FileText     },
    { id: 'assignment', label: t('assignment'),  icon: Book         },
    { id: 'exam',       label: t('exam'),        icon: AlertCircle  },
  ];
  const NOTIF_TYPES = [
    { id: 'individual', label: t('individual')   },
    { id: 'class',      label: t('wholeClass')   },
    { id: 'all',        label: t('allMyClasses') },
  ];

  return (
    <>
      <Helmet><title>{t('publishCenter')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-8">

          {/* ── Header ──────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4">
            {mode && (
              <button onClick={() => setMode(null)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                {t('publishCenter')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('publishCenterDesc')}</p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">

            {/* ── CHOOSER ────────────────────────────── */}
            {!mode && (
              <motion.div key="chooser" variants={stagger} initial="hidden" animate="visible" exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}>
                <motion.p variants={fadeIn} className="text-sm font-semibold text-muted-foreground mb-4">
                  {t('publishWhat')}
                </motion.p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Document card */}
                  <motion.button variants={fadeIn} onClick={() => setMode('document')}
                    className="group relative overflow-hidden glass rounded-2xl p-8 text-left border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-300 active:scale-[0.98]">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-emerald-500/15 group-hover:bg-emerald-500/25 w-fit transition-colors mb-5">
                        <Upload className="h-7 w-7 text-emerald-400" />
                      </div>
                      <h2 className="font-bold text-xl mb-1">{t('publishDocument')}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t('publishDocumentDesc')}</p>
                      <div className="flex items-center gap-1.5 mt-5 text-emerald-400 text-sm font-semibold">
                        {t('upload')} <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.button>

                  {/* Notification card */}
                  <motion.button variants={fadeIn} onClick={() => setMode('notification')}
                    className="group relative overflow-hidden glass rounded-2xl p-8 text-left border border-white/10 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all duration-300 active:scale-[0.98]">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-teal-500/15 group-hover:bg-teal-500/25 w-fit transition-colors mb-5">
                        <Bell className="h-7 w-7 text-teal-400" />
                      </div>
                      <h2 className="font-bold text-xl mb-1">{t('publishNotification')}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t('publishNotificationDesc')}</p>
                      <div className="flex items-center gap-1.5 mt-5 text-teal-400 text-sm font-semibold">
                        {t('notify')} <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── DOCUMENT FORM ───────────────────────── */}
            {mode === 'document' && (
              <motion.div key="doc-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28 }}>
                <div className="glass rounded-2xl p-7 space-y-6 border-t-2 border-t-emerald-500/60">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/15">
                      <Upload className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{t('publishDocument')}</h2>
                      <p className="text-xs text-muted-foreground">{t('publishDocumentDesc')}</p>
                    </div>
                  </div>

                  {/* Doc type pills */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('documentType')}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {DOC_TYPES.map(dt => (
                        <button key={dt.id} type="button" onClick={() => setDocType(dt.id)}
                          className={cn(
                            'relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97]',
                            docType === dt.id
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                              : 'bg-white/3 border-white/8 text-muted-foreground hover:bg-white/6 hover:border-white/15'
                          )}>
                          <dt.icon className="h-5 w-5" />
                          <span className="text-xs font-semibold">{dt.label}</span>
                          {docType === dt.id && (
                            <span className="absolute top-2 right-2">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handlePublish} className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('targetClass')}</Label>
                        <Select value={selectedClass} onValueChange={(val) => {
                          setSelectedClass(val);
                          const cls = classes.find(c => c.id.toString() === val);
                          if (cls?.defaultSubject) setSubject(cls.defaultSubject);
                        }}>
                          <SelectTrigger className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11">
                            <SelectValue placeholder={t('selectClass')} />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('subjectTitle')}</Label>
                        <Input value={subject} onChange={e => setSubject(e.target.value)}
                          className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11"
                          placeholder="e.g. Mathematics Ch. 5" />
                      </div>
                    </div>

                    {/* Drop zone */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('uploadFile')}</Label>
                      <label className={cn(
                        'relative flex flex-col items-center justify-center py-12 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 group text-center',
                        file
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-white/15 hover:border-emerald-500/40 hover:bg-emerald-500/3'
                      )}>
                        <input type="file" onChange={handleFileChange} className="hidden"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                        <div className={cn(
                          'p-4 rounded-2xl mb-4 transition-all duration-300 group-hover:scale-105',
                          file ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-white/8'
                        )}>
                          {file
                            ? <CheckCircle className="h-7 w-7 text-white" />
                            : <Upload className="h-7 w-7 text-muted-foreground" />}
                        </div>
                        <p className="font-semibold">{file ? fileName : t('uploadFileDrop')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : t('uploadFileSupport')}
                        </p>
                      </label>
                    </div>

                    <button type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-base shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                      {loading
                        ? <><Loader2 className="h-5 w-5 animate-spin" />{t('publishing')}</>
                        : <><Upload className="h-5 w-5" />{t('publishNow')}</>}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ── NOTIFICATION FORM ───────────────────── */}
            {mode === 'notification' && (
              <motion.div key="notif-form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28 }}>
                <div className="glass rounded-2xl p-7 space-y-6 border-t-2 border-t-teal-500/60">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-teal-500/15">
                      <Bell className="h-5 w-5 text-teal-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{t('publishNotification')}</h2>
                      <p className="text-xs text-muted-foreground">{t('publishNotificationDesc')}</p>
                    </div>
                  </div>

                  <form onSubmit={handleNotify} className="space-y-5">
                    {/* Recipient type */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('recipientType')}</Label>
                      <div className="flex gap-2 p-1 bg-white/4 border border-white/8 rounded-2xl">
                        {NOTIF_TYPES.map(type => (
                          <button key={type.id} type="button"
                            onClick={() => { setNotifType(type.id); setNotifClass(''); setSelectedStudent(''); }}
                            className={cn(
                              'flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200',
                              notifType === type.id
                                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            )}>
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Class selector */}
                    {notifType !== 'all' && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('classLabel')}</Label>
                        <Select value={notifClass} onValueChange={setNotifClass}>
                          <SelectTrigger className="bg-white/5 border-white/10 focus:border-teal-500/50 rounded-xl h-11">
                            <SelectValue placeholder={t('selectClass')} />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Student picker */}
                    {notifType === 'individual' && notifClass && (
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('selectStudent')}</Label>
                        <SearchableStudentSelect
                          students={students} value={selectedStudent} onChange={setSelectedStudent}
                          loading={fetchingStuds} placeholder="Search by name or matricule…" />
                      </div>
                    )}

                    {/* Title + message */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('notifTitle')}</Label>
                      <Input value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
                        className="bg-white/5 border-white/10 focus:border-teal-500/50 rounded-xl h-11"
                        placeholder="Important Announcement" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">{t('notifMessage')}</Label>
                      <Textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                        className="bg-white/5 border-white/10 focus:border-teal-500/50 min-h-[130px] resize-none rounded-xl"
                        placeholder={t('notifMessagePlaceholder')} required />
                    </div>

                    <button type="submit" disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-base shadow-xl shadow-teal-500/25 transition-all active:scale-[0.98] disabled:opacity-60">
                      {loading
                        ? <><Loader2 className="h-5 w-5 animate-spin" />{t('submitting')}</>
                        : <><Send className="h-5 w-5" />{t('sendNotification')}</>}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </PageTransition>
    </>
  );
};

export default PublishPage;
