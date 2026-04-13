/**
 * AdminHome.jsx  —  Administrator Dashboard
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users, Bell, Calendar, GraduationCap, UserCheck,
  AlertCircle, Trash2, Send, Loader2, ChevronDown,
  ChevronUp, Sparkles, TrendingUp, Plus, X, Radio,
  BookOpen, Shield, ChevronRight,
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

/* ── Skeleton ──────────────────────────────────────────── */
const Skel = ({ className }) => <div className={cn('animate-pulse rounded-2xl bg-white/5', className)} />;

/* ── Animated stat bar ─────────────────────────────────── */
const StatBar = ({ label, value, max, color, delay = 0 }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-muted-foreground">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <motion.div className="h-full rounded-full"
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
      </div>
    </div>
  );
};

/* ── Donut ring (pure CSS/SVG) ─────────────────────────── */
const DonutRing = ({ pct, color, label, value }) => {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="96" height="96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <motion.circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circ} strokeLinecap="round"
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.1, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black">{value}</span>
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
  );
};

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32 } } };

/* ═══════════════════════════════════════════════════════════ */
const AdminHome = () => {
  const { toast }   = useToast();
  const { t, lang } = useLanguage();
  const schoolId    = localStorage.getItem('schoolId');
  const userName    = localStorage.getItem('userName') || t('admin');

  const [stats,   setStats]   = useState({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, disciplineCases: 0 });
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications]     = useState([]);
  const [newNotif,      setNewNotif]           = useState({ title: '', content: '', target_type: 'school' });
  const [notifLoading,  setNotifLoading]       = useState(false);
  const [showForm,      setShowForm]           = useState(false);
  const [showBroadcasts,setShowBroadcasts]     = useState(false);

  // ─── PATCH 6: Year status state ──────────────────────────────────────────
  const [yearStatus, setYearStatus] = useState(null);

  /* ── fetch ── */
  useEffect(() => {
    if (schoolId) { fetchDashboardData(); fetchNotifications(); fetchYearStatus(); }
  }, [schoolId]);

  // ─── PATCH 6: Fetch current academic year ────────────────────────────────
  const fetchYearStatus = async () => {
    const { data } = await supabase
      .from('academic_years')
      .select('id, name, status, is_current, start_date, end_date')
      .eq('school_id', parseInt(schoolId))
      .eq('is_current', true)
      .limit(1)
      .single();
    if (data) setYearStatus(data);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [{ count: sc }, { count: tc }, { count: cc }, { count: dc }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId)),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId)),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId)),
        supabase.from('punishments').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId)),
      ]);
      setStats({ totalStudents: sc || 0, totalTeachers: tc || 0, totalClasses: cc || 0, disciplineCases: dc || 0 });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('school_id', parseInt(schoolId)).order('created_at', { ascending: false });
    setNotifications(data || []);
  };

  /* Realtime */
  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase.channel(`admin_notif_rt_${schoolId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        p => setNotifications(prev => [p.new, ...prev]))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [schoolId]);

  const handlePost = async (e) => {
    e.preventDefault(); setNotifLoading(true);
    try {
      const { error } = await supabase.from('notifications').insert([{
        sender_name: userName, sender_role: 'administrator',
        title: newNotif.title, content: newNotif.content,
        target_type: newNotif.target_type, school_id: parseInt(schoolId),
      }]);
      if (error) throw error;
      toast({ title: '✓ ' + t('notifPublished'), className: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' });
      setNewNotif({ title: '', content: '', target_type: 'school' });
      setShowForm(false);
      fetchNotifications();
    } catch { toast({ variant: 'destructive', title: t('error'), description: t('failedToPublish') }); }
    finally { setNotifLoading(false); }
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast({ title: t('deleted') });
    }
  };

  /* ── derived stats for visual ── */
  const greet  = lang === 'fr' ? t('welcomeBack') : t('welcomeBack');
  const dateStr = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' });

  const TARGET_OPTIONS = [
    { value: 'school',            label: t('targetGlobal') },
    { value: 'teacher',           label: t('targetTeachers') },
    { value: 'vice_principal',    label: t('targetVPs') },
    { value: 'discipline_master', label: t('targetDMs') },
  ];

  return (
    <>
      <Helmet><title>{t('administratorLabel')} · CloudCampus</title></Helmet>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8 pb-6">

        {/* ─── PATCH 6: Active Academic Year banner ──────────────────────── */}
        {yearStatus?.is_current && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-3 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3 mb-4">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-sm font-bold flex-1">
              Active Year: <span className="text-emerald-400">{yearStatus.name}</span>
            </p>
            <Link to="/dashboard/administrator/academic-year"
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              Manage <ChevronRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}

        {/* ── Greeting ── */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>{greet}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              {userName.split(' ')[0]} <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-violet-500">👋</span>
            </h1>
            <p className="text-muted-foreground text-sm">{t('adminHomeDesc')}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-muted-foreground shrink-0 self-start sm:self-auto">
            <Calendar className="h-3.5 w-3.5 text-indigo-400" />
            <span className="capitalize">{dateStr}</span>
          </div>
        </motion.div>

        {/* ── 4 KPI cards ── */}
        <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('kpiStudents'),   value: stats.totalStudents,   icon: Users,         from: '#6366f1', to: '#8b5cf6', sub: t('kpiEnrolled') },
            { label: t('kpiTeachers'),   value: stats.totalTeachers,   icon: GraduationCap, from: '#8b5cf6', to: '#a855f7', sub: t('kpiActiveStaff') },
            { label: t('kpiClasses'),    value: stats.totalClasses,    icon: BookOpen,      from: '#06b6d4', to: '#3b82f6', sub: t('kpiThisSchool') },
            { label: t('kpiDiscipline'), value: stats.disciplineCases, icon: AlertCircle,   from: '#f97316', to: '#ef4444', sub: t('kpiRecorded') },
          ].map(({ label, value, icon: Icon, from, to, sub }, i) => (
            <motion.div key={label} variants={fadeUp}>
              {loading ? <Skel className="h-28" /> : (
                <div className="glass rounded-2xl p-5 border border-white/8 hover:-translate-y-0.5 transition-all"
                  style={{ borderTop: `2px solid ${from}60` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${from}18`, border: `1px solid ${from}28` }}>
                      <Icon className="h-5 w-5" style={{ color: from }} />
                    </div>
                  </div>
                  <p className="text-2xl font-black">{value.toLocaleString()}</p>
                  <p className="text-sm font-semibold mt-0.5">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* ── Two-col: Analytics + Notifications ── */}
        <div className="grid lg:grid-cols-7 gap-6">

          {/* LEFT: School overview visual */}
          <motion.div variants={fadeUp} className="lg:col-span-4 space-y-5">

            {/* Distribution bars */}
            <div className="glass rounded-2xl p-6 border border-white/8">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="h-5 w-5 text-indigo-400" />
                <h3 className="font-black text-lg">{t('schoolDistribution')}</h3>
              </div>
              {loading ? (
                <div className="space-y-4">{[1,2,3,4].map(i => <Skel key={i} className="h-8" />)}</div>
              ) : (
                <div className="space-y-4">
                  <StatBar label={t('kpiStudents')}   value={stats.totalStudents}   max={stats.totalStudents} color="#6366f1" delay={0} />
                  <StatBar label={t('kpiTeachers')}   value={stats.totalTeachers}   max={stats.totalStudents} color="#8b5cf6" delay={0.1} />
                  <StatBar label={t('kpiClasses')}    value={stats.totalClasses}    max={stats.totalStudents} color="#06b6d4" delay={0.2} />
                  <StatBar label={t('kpiDiscipline')} value={stats.disciplineCases} max={Math.max(stats.totalStudents / 10, 1)} color="#f97316" delay={0.3} />
                </div>
              )}
            </div>

            {/* Ratio donuts */}
            <div className="glass rounded-2xl p-6 border border-white/8">
              <h3 className="font-black text-lg mb-5">{t('keyRatios')}</h3>
              {loading ? <Skel className="h-28" /> : (
                <div className="grid grid-cols-3 gap-4 justify-items-center">
                  <DonutRing
                    pct={stats.totalTeachers > 0 ? Math.min(100, Math.round((stats.totalTeachers / Math.max(stats.totalStudents / 20, 1)) * 100)) : 0}
                    color="#8b5cf6" label={t('teacherRatio')} value={stats.totalTeachers} />
                  <DonutRing
                    pct={stats.totalClasses > 0 ? Math.min(100, Math.round((stats.totalClasses / Math.max(stats.totalStudents / 30, 1)) * 100)) : 0}
                    color="#06b6d4" label={t('classCoverage')} value={stats.totalClasses} />
                  <DonutRing
                    pct={stats.totalStudents > 0 ? Math.min(100, Math.round((1 - stats.disciplineCases / stats.totalStudents) * 100)) : 100}
                    color="#22c55e" label={t('goodConduct')} value={`${stats.totalStudents > 0 ? Math.round((1 - stats.disciplineCases / stats.totalStudents) * 100) : 100}%`} />
                </div>
              )}
            </div>
          </motion.div>

          {/* RIGHT: Notification centre */}
          <motion.div variants={fadeUp} className="lg:col-span-3">
            <div className="glass rounded-2xl border border-indigo-500/25 overflow-hidden h-full flex flex-col"
              style={{ borderTop: '2px solid #6366f1' }}>

              {/* Header */}
              <div className="p-5 border-b border-white/8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
                      <Bell className="h-4.5 w-4.5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-black">{t('broadcastCentre')}</h3>
                      <p className="text-xs text-muted-foreground">{notifications.length} {t('broadcastTotal')}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowForm(v => !v); setShowBroadcasts(false); }}
                    className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                      showForm
                        ? 'bg-white/8 border-white/15 text-muted-foreground'
                        : 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300 hover:bg-indigo-500/20')}>
                    {showForm ? <X className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                    {showForm ? t('cancel') : t('broadcast')}
                  </button>
                </div>
              </div>

              {/* Compose form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <form onSubmit={handlePost} className="p-5 border-b border-white/8 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('targetLabel')}</Label>
                        <Select value={newNotif.target_type} onValueChange={v => setNewNotif({ ...newNotif, target_type: v })}>
                          <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-xl text-sm focus:border-indigo-500/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('vpNotifyTitleLabel')}</Label>
                        <Input placeholder="e.g. Emergency Staff Meeting"
                          className="h-10 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50"
                          value={newNotif.title} onChange={e => setNewNotif({ ...newNotif, title: e.target.value })} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('notifMessage')}</Label>
                        <Textarea placeholder={t('vpNotifyContentPlaceholder')}
                          className="min-h-[80px] bg-white/5 border-white/10 rounded-xl focus:border-indigo-500/50 text-sm resize-none"
                          value={newNotif.content} onChange={e => setNewNotif({ ...newNotif, content: e.target.value })} required />
                      </div>
                      <button type="submit" disabled={notifLoading}
                        className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 24px rgba(99,102,241,0.35)' }}>
                        {notifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {t('publishNotif')}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent broadcasts toggle */}
              <div className="p-4 border-b border-white/6">
                <button onClick={() => { setShowBroadcasts(v => !v); setShowForm(false); }}
                  className="w-full flex items-center justify-between text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <span>{t('recentBroadcasts')} ({notifications.length})</span>
                  {showBroadcasts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              <AnimatePresence>
                {showBroadcasts && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                    className="flex-1 overflow-y-auto max-h-[380px]">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
                        <Bell className="h-8 w-8 opacity-15" />
                        <p className="text-sm">{t('noBroadcasts')}</p>
                      </div>
                    ) : (
                      <div className="space-y-1 p-3">
                        {notifications.map(notif => (
                          <div key={notif.id}
                            className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-indigo-500/20 transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/12 border border-indigo-500/25 text-indigo-400">
                                  {notif.target_type.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(notif.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="font-semibold text-sm line-clamp-1">{notif.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{notif.content}</p>
                            </div>
                            <button onClick={() => handleDelete(notif.id)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Default collapsed state */}
              {!showForm && !showBroadcasts && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-indigo-400/50" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{t('broadcastCentre')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('broadcastHint')}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};

export default AdminHome;
