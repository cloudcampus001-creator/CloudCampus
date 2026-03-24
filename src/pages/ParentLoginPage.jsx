/**
 * ParentLoginPage.jsx
 * SECURITY FIX: server-side auth via cloud-campus-auth Edge Function.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, FileDigit, Loader2, Cloud, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';

const FROM = '#3b82f6', TO = '#06b6d4', GLOW = 'rgba(59,130,246,0.28)';

const ParentLoginPage = () => {
  const { schoolId } = useParams();
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const { t }        = useLanguage();
  const [form, setForm]     = useState({ studentName: '', matricule: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cloud-campus-auth', {
        body: {
          role:        'parent',
          studentName: form.studentName,
          matricule:   form.matricule,
          schoolId:    String(schoolId),
        },
      });

      if (error || data?.error) throw new Error(data?.error || 'Login failed');

      const { session, userMeta } = data;

      const { error: sessionError } = await supabase.auth.setSession({
        access_token:  session.access_token,
        refresh_token: session.refresh_token,
      });
      if (sessionError) throw sessionError;

      saveSession({
        userRole:         userMeta.role,
        userId:           userMeta.userId,
        userName:         userMeta.userName,
        schoolId:         userMeta.schoolId,
        classId:          userMeta.classId,
        studentName:      userMeta.studentName,
        studentMatricule: userMeta.studentMatricule,
      });
      // Legacy key some dashboard pages read
      localStorage.setItem('studentMatricule', userMeta.studentMatricule);

      toast({
        title: '✓ ' + t('loginSuccess'),
        className: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
      });
      navigate('/dashboard/parent');

    } catch {
      toast({ variant: 'destructive', title: t('loginFailed'), description: t('invalidStudentDetails') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>{t('role_parent')} Login · CloudCampus</title></Helmet>
      <Shell from={FROM} to={TO} glow={GLOW} schoolId={schoolId} navigate={navigate} t={t}
        title={t('role_parent')} subtitle={t('portalTagParent')} iconBg="bg-blue-500/15"
        icon={<User className="h-7 w-7 text-blue-400" />}>
        <form onSubmit={handleLogin} className="space-y-5">
          <Field label={t('studentNameLabel')} icon={<User className="h-4 w-4" />}>
            <Input type="text" placeholder={t('studentNamePlaceholder')} required
              className="pl-10 h-12 bg-white/5 border-white/10 focus:border-blue-500/60 rounded-xl"
              value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
          </Field>
          <Field label={t('matriculeLabel')} icon={<FileDigit className="h-4 w-4" />}>
            <Input type="text" placeholder={t('matriculePlaceholder')} required
              className="pl-10 h-12 bg-white/5 border-white/10 focus:border-blue-500/60 rounded-xl"
              value={form.matricule} onChange={(e) => setForm({ ...form, matricule: e.target.value })} />
          </Field>
          <Btn loading={loading} label={t('accessDashboard')} loadingLabel={t('verifying')} from={FROM} to={TO} glow={GLOW} />
        </form>
      </Shell>
    </>
  );
};
export default ParentLoginPage;

function Shell({ from, to, glow, schoolId, navigate, t, title, subtitle, icon, iconBg, children }) {
  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[130px]" style={{ background: `${from}14` }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full blur-[130px]" style={{ background: `${to}10` }} />
      </div>
      <header className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg,${from},${to})`, boxShadow: `0 4px 16px ${glow}` }}>
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">Cloud<span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg,${from},${to})` }}>Campus</span></span>
        </div>
        <div className="flex items-center gap-2"><LanguageSwitcher /><ThemeToggle /></div>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: "easeOut" }} className="w-full max-w-md">
          <div className="relative glass rounded-3xl p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ boxShadow: `0 24px 64px ${glow}` }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl" style={{ background: `linear-gradient(90deg,${from},${to})` }} />
            <div className="mb-8 text-center space-y-3">
              <div className={"inline-flex p-4 rounded-2xl ring-1 ring-white/10 mb-1 " + iconBg}>{icon}</div>
              <h2 className="text-3xl font-black tracking-tight">{title}</h2>
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
            {children}
            <div className="text-center pt-5">
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 group" onClick={() => navigate(`/role-selection/${schoolId}`)}>
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />{t("backToRoles")}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
function Field({ label, icon, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">{icon}</div>
        {children}
      </div>
    </div>
  );
}
function Btn({ loading, label, loadingLabel, from, to, glow }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3.5 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
      style={{ background: `linear-gradient(135deg,${from},${to})`, boxShadow: `0 8px 32px ${glow}` }}>
      {loading ? <><Loader2 className="h-5 w-5 animate-spin" />{loadingLabel}</> : label}
    </button>
  );
}
