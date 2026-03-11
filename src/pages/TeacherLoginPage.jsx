import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Lock, User, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

/* ── Role Identity ───────────────────────────────────────────────────
   Teacher = Emerald / Teal
   Matches: TeacherDashboard, RoleSelectionPage
──────────────────────────────────────────────────────────────────── */
const ROLE = {
  label:      'Teacher Portal',
  subtitle:   'Manage classes, lessons & student marks',
  gradFrom:   '#10b981', // emerald-500
  gradTo:     '#14b8a6', // teal-500
  glowColor:  'rgba(16,185,129,0.25)',
  blobColor1: 'rgba(16,185,129,0.15)',
  blobColor2: 'rgba(20,184,166,0.12)',
  focusClass: 'focus:border-emerald-500',
  iconFocus:  'group-focus-within:text-emerald-400',
  btnShadow:  'shadow-emerald-500/30',
  backHover:  'hover:text-emerald-400',
  toastClass: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
  emoji:      '📖',
};

const TeacherLoginPage = () => {
  const { schoolId } = useParams();
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const [formData, setFormData] = useState({ name: '', id: '' });
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: teacher, error } = await supabase
        .from('teachers')
        .select('*')
        .ilike('name', formData.name)
        .eq('id', parseInt(formData.id))
        .eq('school_id', parseInt(schoolId))
        .single();

      if (error || !teacher) throw new Error('Invalid Teacher Name or ID');

      saveSession({
        userRole: 'teacher',
        userId:   teacher.id,
        userName: teacher.name,
        schoolId: schoolId,
      });

      toast({ title: 'Welcome back!', description: `Logged in as ${teacher.name}`, className: ROLE.toastClass });
      navigate('/dashboard/teacher');
    } catch {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid credentials. Please check your Name and ID.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Teacher Login — CloudCampus</title></Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">

        {/* Ambient blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[130px]" style={{ background: ROLE.blobColor1 }} />
          <div className="absolute bottom-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full blur-[120px]" style={{ background: ROLE.blobColor2 }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="w-full max-w-md"
        >
          <div className="relative bg-card/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

            {/* Top gradient bar */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ROLE.gradFrom}, ${ROLE.gradTo})` }} />

            {/* Role hero panel */}
            <div className="relative px-8 pt-8 pb-6 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-[0.07]" style={{ background: `radial-gradient(ellipse at top, ${ROLE.gradFrom}, transparent 70%)` }} />

              <div className="relative z-10 inline-flex items-center justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-3xl relative"
                  style={{ background: `linear-gradient(135deg, ${ROLE.gradFrom}, ${ROLE.gradTo})`, boxShadow: `0 8px 24px ${ROLE.glowColor}` }}
                >
                  {ROLE.emoji}
                  <span className="absolute -top-1.5 -right-1.5 bg-background border border-white/10 rounded-full p-0.5">
                    <GraduationCap className="w-3 h-3 text-emerald-400" />
                  </span>
                </div>
              </div>

              <h2 className="relative z-10 text-2xl font-extrabold tracking-tight">{ROLE.label}</h2>
              <p className="relative z-10 text-sm text-muted-foreground mt-1">{ROLE.subtitle}</p>
            </div>

            <div className="h-px bg-white/5 mx-6" />

            <div className="px-8 py-6">
              <form onSubmit={handleLogin} className="space-y-5">

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <div className="relative group">
                    <User className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="text" placeholder="e.g. Mr. Smith"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Teacher ID</Label>
                  <div className="relative group">
                    <Lock className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="number" placeholder="e.g. 1001"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.id}
                      onChange={e => setFormData({ ...formData, id: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className={`w-full h-11 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${ROLE.btnShadow} hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed`}
                  style={{ background: `linear-gradient(135deg, ${ROLE.gradFrom}, ${ROLE.gradTo})` }}
                >
                  {loading ? <><Loader2 className="animate-spin h-4 w-4" /> Verifying…</> : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Button
                  type="button" variant="ghost" size="sm"
                  className={`text-muted-foreground ${ROLE.backHover} hover:bg-white/5 rounded-xl text-xs`}
                  onClick={() => navigate(`/role-selection/${schoolId}`)}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Roles
                </Button>
              </div>
            </div>

            <div className="px-8 pb-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/40">
              <Sparkles className="w-3 h-3" />
              <span>Secured by CloudCampus · Axion Enterprise</span>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default TeacherLoginPage;
