import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, User, Loader2, ArrowLeft, Cloud } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

const TeacherLoginPage = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: '', id: '' });
  const [loading, setLoading] = useState(false);

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

      if (error || !teacher) throw new Error("Invalid Teacher Name or ID");

      // ── Persistent session (5-day inactivity window) ───────────────────────
      saveSession({
        userRole: 'teacher',
        userId:   teacher.id,
        userName: teacher.name,
        schoolId: schoolId,
      });

      toast({
        title: "Welcome back!",
        description: `Logged in as ${teacher.name}`,
        className: "bg-purple-500/10 border-purple-500/50 text-purple-500"
      });
      navigate('/dashboard/teacher');

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid credentials. Please check your Name and ID."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Teacher Login - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">
        <div className="absolute top-0 right-0 w-full h-full bg-grid-white/[0.02] -z-10" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-pink-600/20 rounded-full blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-3xl p-8 shadow-2xl border-t border-white/10 relative overflow-hidden bg-card/50 backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

            <div className="mb-8 text-center space-y-2">
              <div className="inline-block p-3 bg-purple-500/10 rounded-full mb-2">
                <Cloud className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Teacher Portal</h2>
              <p className="text-muted-foreground text-sm">Manage classes and curriculum</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                  <Input
                    type="text" placeholder="e.g. Mr. Smith"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-purple-500 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Teacher ID</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-purple-500 transition-colors" />
                  <Input
                    type="number" placeholder="e.g. 1001"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-purple-500 transition-colors"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg font-semibold shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                {loading ? 'Verifying...' : 'Login'}
              </Button>

              <div className="text-center pt-2">
                <Button type="button" variant="link" className="text-muted-foreground hover:text-purple-400" onClick={() => navigate(`/role-selection/${schoolId}`)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Roles
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default TeacherLoginPage;
