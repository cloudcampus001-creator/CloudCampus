import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, FileDigit, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

const ROLE = {
  label:      'Parent Portal',
  subtitle:   "Access your child's academic records",
  gradFrom:   '#3b82f6',
  gradTo:     '#22d3ee',
  glowColor:  'rgba(59,130,246,0.25)',
  blobColor1: 'rgba(59,130,246,0.15)',
  blobColor2: 'rgba(34,211,238,0.12)',
  focusClass: 'focus:border-blue-500',
  iconFocus:  'group-focus-within:text-blue-400',
  btnShadow:  'shadow-blue-500/30',
  backHover:  'hover:text-blue-400',
  toastClass: 'bg-blue-500/10 border-blue-500/50 text-blue-400',
  emoji:      '👨‍👩‍👧',
};

const ParentLoginPage = () => {
  const { schoolId } = useParams();
  const navigate     = useNavigate();
  const { toast }    = useToast();
  const [formData, setFormData] = useState({ studentName: '', matricule: '' });
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .ilike('name', formData.studentName)
        .eq('matricule', formData.matricule)
        .eq('school_id', parseInt(schoolId))
        .single();

      if (error || !student) throw new Error('Invalid Student Name or Matricule');

      saveSession({
        userRole:    'parent',
        userId:      student.matricule,
        userName:    'Parent of ' + student.name,
        schoolId:    schoolId,
        classId:     student.class_id || '',
        studentName: student.name,
      });
      localStorage.setItem('studentMatricule', student.matricule);

      toast({ title: 'Welcome!', description: `Logged in as parent of ${student.name}`, className: ROLE.toastClass });
      navigate('/dashboard/parent');
    } catch {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Could not verify student details. Please check name and matricule.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Parent Login — CloudCampus</title></Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">
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
          <div className="relative bg-card/50 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ROLE.gradFrom}, ${ROLE.gradTo})` }} />

            <div className="relative px-8 pt-8 pb-6 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-[0.07]" style={{ background: `radial-gradient(ellipse at top, ${ROLE.gradFrom}, transparent 70%)` }} />
              <div className="relative z-10 inline-flex items-center justify-center mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg text-3xl relative"
                  style={{ background: `linear-gradient(135deg, ${ROLE.gradFrom}, ${ROLE.gradTo})`, boxShadow: `0 8px 24px ${ROLE.glowColor}` }}
                >
                  {ROLE.emoji}
                  <span className="absolute -top-1.5 -right-1.5 bg-background border border-white/10 rounded-full p-0.5">
                    <User className="w-3 h-3 text-blue-400" />
                  </span>
                </div>
              </div>
              <h2 className="relative z-10 text-2xl font-extrabold tracking-tight">{ROLE.label}</h2>
              <p className="relative z-10 text-sm text-muted-foreground mt-1">{ROLE.subtitle}</p>
            </div>

            <div className="h-px bg-white/5 mx-6" />

            <div className="px-8 py-6">
              {/* Helper hint */}
              <div className="mb-5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300/80 leading-relaxed">
                💡 Enter your <strong>child's name and matricule</strong> number to access their dashboard.
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student's Full Name</Label>
                  <div className="relative group">
                    <User className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="text" placeholder="e.g. John Doe"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.studentName}
                      onChange={e => setFormData({ ...formData, studentName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matricule Number</Label>
                  <div className="relative group">
                    <FileDigit className={`absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60 transition-colors ${ROLE.iconFocus}`} />
                    <Input
                      type="text" placeholder="e.g. MAT-2025-001"
                      className={`pl-10 h-11 bg-background/40 border-white/10 ${ROLE.focusClass} transition-colors rounded-xl`}
                      value={formData.matricule}
                      onChange={e => setFormData({ ...formData, matricule: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className={`w-full h-11 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${ROLE.btnShadow} hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed`}
                  style={{ background: `linear-gradient(135deg, ${ROLE.gradFrom}, ${ROLE.gradTo})` }}
                >
                  {loading ? <><Loader2 className="animate-spin h-4 w-4" /> Verifying…</> : 'Access Dashboard'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <Button type="button" variant="ghost" size="sm"
                  className={`text-muted-foreground ${ROLE.backHover} hover:bg-white/5 rounded-xl text-xs`}
                  onClick={() => navigate(`/role-selection/${schoolId}`)}>
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

export default ParentLoginPage;
