import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, Lock, User, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

/* ── Role Identity ───────────────────────────────────────────────────
   Admin = Indigo / Violet
   Matches: AdminDashboard, RoleSelectionPage
──────────────────────────────────────────────────────────────────── */
const ROLE = {
  label:      'Administrator',
  subtitle:   'Full school configuration & control',
  gradFrom:   '#6366f1', // indigo-500
  gradTo:     '#8b5cf6', // violet-500
  glowColor:  'rgba(99,102,241,0.25)',
  blobColor1: 'rgba(99,102,241,0.18)',
  blobColor2: 'rgba(139,92,246,0.15)',
  accent:     'indigo',
  focusClass: 'focus:border-indigo-500',
  iconFocus:  'group-focus-within:text-indigo-400',
  btnShadow:  'shadow-indigo-500/30',
  backHover:  'hover:text-indigo-400',
  emoji:      '🛡️',
};

const AdministratorLoginPage = () => {
  const navigate    = useNavigate();
  const { schoolId } = useParams();
  const { toast }   = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: admin, error } = await supabase
        .from('administrators')
        .select('*')
        .eq('name', formData.name)
        .eq('school_id', parseInt(schoolId))
        .single();

      if (error || !admin) throw new Error('Invalid Credentials');
      if (admin.password_hash !== formData.password) throw new Error('Invalid Credentials');

      saveSession({
        userRole: 'administrator',
        userId:   admin.id,
        userName: admin.name,
        schoolId: schoolId,
      });

      toast({ title: 'Welcome back!', description: `Logged in as ${admin.name}`, className: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' });
      navigate('/dashboard/administrator');
    } catch {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Admin Login — CloudCampus</title></Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">

        {/* Ambient blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[130px]" style={{ background: ROLE.blobColor1 }} />
          <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[120px]" style={{ background: ROLE.blobColor2 }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="w-full max-w-md"
        >
          {/* Card */}
          <div className="relative bg-card/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

            {/* Top gradient bar */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ROLE.gradFrom}, ${ROLE.gradTo})` }} />

            {/* Role hero panel */}
            <div className="relative px-8 pt-8 pb-6 text-center overflow-hidden">
              {/* Faint gradient wash */}
              <div className="absolute inset-0 opacity-[0.07]" style={{ background: `radial-gradient(ellipse at top, ${ROLE.gradFrom}, transparent 70%)` }} />

              {/* Role icon */}
              <div className="relative z-10 inline-flex items-center justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-3xl relative"
                  style={{ background: `linear-gradient(135deg, ${ROLE.gradFrom}, ${ROLE.gradTo})`, boxShadow: `0 8px 24px ${ROLE.glowColor}` }}
                >
                  {ROLE.emoji}
                  {/* Sparkle badge */}
                  <span className="absolute -top-1.5 -right-1.5 bg-background border border-white/10 rounded-full p-0.5">
                    <Key className="w-3 h-3 text-indigo-400" />
                  </span>
                </div>
              </div>

              <h2 className="relative z-10 text-2xl font-extrabold tracking-tight">{ROLE.label}</h2>
              <p className="relative z-10 text-sm text-muted-foreground mt-1">{ROLE.subtitle}</p>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5 mx-6" />

            {/* Form */}
            <div className="px-8 py-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Username</Label>
                  <div className="relative group">
                    <User className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="text" placeholder="Enter admin name"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</Label>
                  <div className="relative group">
                    <Lock className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="password" placeholder="Enter password"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
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

            {/* CloudCampus footer brand */}
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

export default AdministratorLoginPage;
