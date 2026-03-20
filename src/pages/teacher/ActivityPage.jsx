/**
 * ActivityPage.jsx
 * Teacher live activity: e-Logbook + Attendance Register.
 *
 * Validation layers:
 *  1. Time window  — teacher must be in an active timetable period
 *  2. Geolocation  — teacher must be within school.geo_radius_meters
 *                    (skipped if school has no coordinates configured)
 *  3. Duplicate    — if a logbook entry already exists for this period today,
 *                    show the signed state instead of the blank form
 *                    (persists across refreshes — re-checked on every mount)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, UserCheck, UserX, Loader2, Clock, BookOpen,
  ClipboardList, MapPin, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Navigation, CheckCheck,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

/* ── Haversine distance (metres) ──────────────────────── */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a  =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Geo status banner ────────────────────────────────── */
const GeoStatusBanner = ({ status, distance, radius, onRetry, t }) => {
  if (status === 'not_configured' || status === 'idle') return null;

  const cfg = {
    checking: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: t('geoVerifying'),                                                               cls: 'bg-blue-500/10 border-blue-500/25 text-blue-400'   },
    verified: { icon: <CheckCircle2 className="h-4 w-4" />,          text: `${t('geoVerified')} · ${Math.round(distance ?? 0)} m`,                        cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' },
    failed:   { icon: <XCircle className="h-4 w-4" />,               text: `${t('geoFailed')} (${Math.round(distance ?? 0)} m / ${radius} m)`,    cls: 'bg-red-500/10 border-red-500/25 text-red-400'      },
    denied:   { icon: <AlertTriangle className="h-4 w-4" />,         text: t('geoDenied'),                cls: 'bg-amber-500/10 border-amber-500/25 text-amber-400' },
    error:    { icon: <AlertTriangle className="h-4 w-4" />,         text: t('geoError'),                          cls: 'bg-amber-500/10 border-amber-500/25 text-amber-400' },
  }[status] ?? null;

  if (!cfg) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className={cn('flex items-start gap-3 p-3.5 rounded-xl border text-sm', cfg.cls)}>
      <span className="shrink-0 mt-0.5">{cfg.icon}</span>
      <span className="flex-1 leading-snug">{cfg.text}</span>
      {(status === 'failed' || status === 'denied' || status === 'error') && (
        <button onClick={onRetry} className="shrink-0 flex items-center gap-1 text-[11px] font-bold opacity-70 hover:opacity-100 transition-opacity">
          <RefreshCw className="h-3 w-3" /> {t('geoRetry')}
        </button>
      )}
    </motion.div>
  );
};

/* ── Already-signed card ──────────────────────────────── */
const AlreadySignedCard = ({ entry, t }) => (
  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
    className="glass rounded-2xl p-6 border border-emerald-500/30 bg-emerald-500/5 space-y-5">
    {/* Header */}
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center shrink-0">
        <CheckCheck className="h-6 w-6 text-emerald-400" />
      </div>
      <div>
        <p className="font-black text-base text-emerald-400">{t('alreadySigned')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          {' · '}
          {new Date(entry.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>

    {/* Entry details */}
    <div className="p-4 rounded-xl bg-white/4 border border-white/8 space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">{t('topicTaught')}</p>
        <p className="font-semibold text-sm">{entry.topic}</p>
      </div>
      {entry.sub_topics && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">{t('subTopics')}</p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{entry.sub_topics}</p>
        </div>
      )}
    </div>

    {/* Status + geo */}
    <div className="flex items-center justify-between flex-wrap gap-2">
      <span className={cn(
        'text-xs font-bold px-3 py-1.5 rounded-full border',
        entry.status === 'completed' ? 'bg-green-500/15 text-green-400 border-green-500/25'
          : entry.status === 'viewed' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
          : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
      )}>
        {entry.status === 'completed' ? t('reviewedByVP') : entry.status === 'viewed' ? t('seenByVP') : t('pendingVPReview')}
      </span>
      {entry.geo_verified && (
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
          <Navigation className="h-3 w-3" /> {t('locationVerifiedBadge')}
        </span>
      )}
    </div>

    {/* VP comment */}
    {entry.vp_comment && (
      <div className="p-3.5 rounded-xl bg-blue-500/8 border border-blue-500/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">{t('vpComment')}</p>
        <p className="text-sm text-blue-200 leading-relaxed">{entry.vp_comment}</p>
      </div>
    )}
  </motion.div>
);

/* ═══════════════════════════════════════════════════════ */
const ActivityPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();

  const [loading,        setLoading]        = useState(true);
  const [currentClass,   setCurrentClass]   = useState(null);
  const [students,       setStudents]       = useState([]);
  const [absentStudents, setAbsentStudents] = useState(new Set());
  const [logData,        setLogData]        = useState({ topic: '', subTopics: '' });
  const [submittingLog,  setSubmittingLog]  = useState(false);
  const [submittingAtt,  setSubmittingAtt]  = useState(false);
  const [activeTab,      setActiveTab]      = useState('elog');

  // null = still loading | false = no entry found | object = entry found
  const [existingEntry,  setExistingEntry]  = useState(null);

  const [geoStatus,   setGeoStatus]   = useState('idle');
  const [geoDistance, setGeoDistance] = useState(null);
  const [schoolGeo,   setSchoolGeo]   = useState(null);

  const teacherId   = localStorage.getItem('userId');
  const schoolId    = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName');

  /* ── geolocation ────────────────────────────────────── */
  const checkGeo = useCallback((geo) => {
    if (!geo?.latitude || !geo?.longitude) { setGeoStatus('not_configured'); return; }
    if (!navigator.geolocation)            { setGeoStatus('denied');         return; }
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist   = haversineMeters(pos.coords.latitude, pos.coords.longitude, geo.latitude, geo.longitude);
        const radius = geo.geo_radius_meters ?? 300;
        setGeoDistance(dist);
        setGeoStatus(dist <= radius ? 'verified' : 'failed');
      },
      (err) => setGeoStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  /* ── main init ──────────────────────────────────────── */
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        /* 1. Active timetable period */
        const now         = new Date();
        const days        = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const currentDay  = days[now.getDay()];
        const currentTime =
          `${String(now.getHours()).padStart(2,'0')}:` +
          `${String(now.getMinutes()).padStart(2,'0')}:` +
          `${String(now.getSeconds()).padStart(2,'0')}`;

        const { data: timetable, error: ttErr } = await supabase
          .from('timetables').select('*, classes(id, name)')
          .eq('teacher_id', teacherId).eq('day_of_week', currentDay)
          .lte('start_time', currentTime).gte('end_time', currentTime)
          .maybeSingle();

        if (ttErr && ttErr.code !== 'PGRST116') throw ttErr;

        if (timetable) {
          setCurrentClass(timetable);

          /* 2. Students */
          const { data: sts } = await supabase
            .from('students').select('*').eq('class_id', timetable.class_id).order('name');
          setStudents(sts || []);

          /* 3. Check for existing logbook entry today for this class+subject+teacher
           *    Uses today's UTC boundaries so refresh never loses the state */
          const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

          const { data: existing } = await supabase
            .from('e_logbook_entries').select('*')
            .eq('teacher_id', parseInt(teacherId))
            .eq('class_id',   timetable.class_id)
            .eq('subject',    timetable.subject)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // maybeSingle() returns null when nothing found, or the row
          setExistingEntry(existing ?? false);
        } else {
          setExistingEntry(false);
        }

        /* 4. School geo */
        const { data: school } = await supabase
          .from('schools').select('latitude, longitude, geo_radius_meters')
          .eq('id', parseInt(schoolId)).maybeSingle();

        const geo = school?.latitude ? school : null;
        setSchoolGeo(geo);
        if (timetable) checkGeo(geo);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [teacherId, schoolId, checkGeo]);

  const toggleAbsence = (matricule) => {
    setAbsentStudents((prev) => {
      const next = new Set(prev);
      next.has(matricule) ? next.delete(matricule) : next.add(matricule);
      return next;
    });
  };

  const geoBlocking =
    schoolGeo?.latitude &&
    (geoStatus === 'failed' || geoStatus === 'denied' || geoStatus === 'error' || geoStatus === 'checking');

  /* ── submit log ─────────────────────────────────────── */
  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (geoBlocking) {
      toast({ variant: 'destructive', title: t('geoRequired') || 'Location required', description: t('geoRequiredDesc') || 'You must be at school to sign the logbook.' });
      return;
    }
    setSubmittingLog(true);
    try {
      const { data: newEntry, error } = await supabase
        .from('e_logbook_entries')
        .insert({
          teacher_id:   parseInt(teacherId),
          class_id:     currentClass.class_id,
          subject:      currentClass.subject,
          topic:        logData.topic,
          sub_topics:   logData.subTopics,
          status:       'pending',
          school_id:    parseInt(schoolId),
          teacher_name: teacherName,
          geo_verified: geoStatus === 'verified',
          created_at:   new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      toast({ title: `✓ ${t('success')}`, description: t('logSuccess') });
      setLogData({ topic: '', subTopics: '' });
      // switch to confirmed state immediately — no need to refresh
      setExistingEntry(newEntry);
    } catch {
      toast({ variant: 'destructive', title: t('error'), description: t('logError') });
    } finally {
      setSubmittingLog(false);
    }
  };

  /* ── submit attendance ──────────────────────────────── */
  const handleSubmitAttendance = async () => {
    if (geoBlocking) {
      toast({ variant: 'destructive', title: t('geoRequired') || 'Location required', description: t('geoRequiredDesc') || 'You must be at school to submit the register.' });
      return;
    }
    setSubmittingAtt(true);
    try {
      const absentees = Array.from(absentStudents);
      if (absentees.length > 0) {
        const { error } = await supabase.from('absences').insert(
          absentees.map((matricule) => ({
            student_matricule: matricule,
            class_id:          currentClass.class_id,
            teacher_id:        parseInt(teacherId),
            date:              new Date().toISOString().split('T')[0],
            hours:             1,
            status:            'unjustified',
            school_id:         parseInt(schoolId),
          })),
        );
        if (error) throw error;
      }
      toast({ title: `✓ ${t('success')}`, description: t('attendanceSuccess') });
      setAbsentStudents(new Set());
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: t('error'), description: t('error') });
    } finally {
      setSubmittingAtt(false);
    }
  };

  /* ── loading ────────────────────────────────────────── */
  if (loading) {
    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-48 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-14 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </PageTransition>
    );
  }

  /* ── no active class ────────────────────────────────── */
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

  /* ── main ───────────────────────────────────────────── */
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

          {/* Geo banner */}
          <GeoStatusBanner
            status={geoStatus}
            distance={geoDistance}
            radius={schoolGeo?.geo_radius_meters ?? 300}
            onRetry={() => checkGeo(schoolGeo)}
            t={t}
          />

          {/* Tabs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex gap-2 p-1 bg-white/4 border border-white/8 rounded-2xl w-fit">
            {[
              { id: 'elog',     label: t('eLogBook'),          icon: BookOpen      },
              { id: 'register', label: t('attendanceRegister'), icon: ClipboardList },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                )}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {/* small dot when logbook is already signed */}
                {tab.id === 'elog' && existingEntry && (
                  <span className="ml-0.5 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                )}
              </button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">

            {/* ── e-Log tab ───────────────────────────── */}
            {activeTab === 'elog' && (
              <motion.div key="elog"
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25 }}>

                {existingEntry ? (
                  /* Already submitted — show card */
                  <AlreadySignedCard entry={existingEntry} t={t} />
                ) : (
                  /* Form */
                  <div className="glass rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500/15">
                        <BookOpen className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <h2 className="font-bold text-base">{t('eLogBook')}</h2>
                        <p className="text-xs text-muted-foreground">
                          {currentClass.classes?.name} · {currentClass.subject}
                        </p>
                      </div>
                      {schoolGeo?.latitude && (
                        <div className="ml-auto shrink-0">
                          {geoStatus === 'verified'       && <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full"><Navigation className="h-3 w-3" /> {t('geoInRange')}</span>}
                          {geoStatus === 'checking'       && <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full"><Loader2 className="h-3 w-3 animate-spin" /> {t('geoLocating')}</span>}
                          {!['verified','checking','not_configured','idle'].includes(geoStatus) && <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full"><MapPin className="h-3 w-3" /> {t('geoOutOfRange')}</span>}
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSubmitLog} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('topicTaught')}</Label>
                        <Input value={logData.topic}
                          onChange={e => setLogData(p => ({ ...p, topic: e.target.value }))}
                          placeholder="e.g. Newton's Laws of Motion"
                          className="bg-white/5 border-white/10 focus:border-emerald-500/50 rounded-xl h-11" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">{t('subTopics')}</Label>
                        <Textarea value={logData.subTopics}
                          onChange={e => setLogData(p => ({ ...p, subTopics: e.target.value }))}
                          placeholder="e.g. First Law, Inertia, Examples…"
                          className="bg-white/5 border-white/10 focus:border-emerald-500/50 min-h-[100px] resize-none rounded-xl" />
                      </div>

                      <button type="submit" disabled={submittingLog || geoBlocking}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-60',
                          geoBlocking
                            ? 'bg-white/10 text-muted-foreground cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/25',
                        )}>
                        {submittingLog
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('submitting')}</>
                          : geoBlocking
                            ? <><MapPin className="h-4 w-4" /> {t('geoRequired') || 'Location required'}</>
                            : <><Send className="h-4 w-4" /> {t('signSendVP')}</>}
                      </button>
                    </form>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Attendance tab ───────────────────────── */}
            {activeTab === 'register' && (
              <motion.div key="register"
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}>
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
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => toggleAbsence(student.matricule)}
                          className={cn(
                            'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99]',
                            isAbsent ? 'bg-red-500/8 border-red-500/30' : 'bg-white/3 border-white/6 hover:bg-white/6 hover:border-white/12',
                          )}>
                          <div className="flex items-center gap-3">
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-colors', isAbsent ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/15 text-emerald-400')}>
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

                  <button onClick={handleSubmitAttendance} disabled={submittingAtt || geoBlocking}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-60',
                      geoBlocking
                        ? 'bg-white/10 text-muted-foreground cursor-not-allowed'
                        : absentStudents.size > 0
                          ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25',
                    )}>
                    {submittingAtt
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('submitting')}</>
                      : geoBlocking
                        ? <><MapPin className="h-4 w-4" /> {t('geoRequired') || 'Location required'}</>
                        : <><Send className="h-4 w-4" /> {t('submitAttendance')} ({absentStudents.size} {t('absent_count')})</>}
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
