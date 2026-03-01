import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, Lock, User, Loader2, ArrowLeft, Cloud } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

const AdministratorLoginPage = () => {
  const navigate = useNavigate();
  const { schoolId } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
  });

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

      if (error || !admin) throw new Error("Invalid Credentials");
      if (admin.password_hash !== formData.password) throw new Error("Invalid Credentials");

      // ── Persistent session (5-day inactivity window) ───────────────────────
      saveSession({
        userRole:  'administrator',
        userId:    admin.id,
        userName:  admin.name,
        schoolId:  schoolId,
      });

      toast({
        title: 'Success',
        description: 'Administrator Login Successful',
        className: "bg-red-500/10 border-red-500/50 text-red-500"
      });
      navigate('/dashboard/administrator');

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Login - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">
        <div className="absolute top-0 right-0 w-full h-full bg-grid-white/[0.02] -z-10" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-red-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-orange-600/20 rounded-full blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-3xl p-8 shadow-2xl border-t border-white/10 relative overflow-hidden bg-card/50 backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />

            <div className="mb-8 text-center space-y-2">
              <div className="inline-block p-3 bg-red-500/10 rounded-full mb-2">
                <Cloud className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">System Admin</h2>
              <p className="text-muted-foreground text-sm">Full System Access</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Admin Username</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                  <Input
                    type="text"
                    placeholder="Enter admin name"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-red-500 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-red-500 transition-colors" />
                  <Input
                    type="password"
                    placeholder="Enter password"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-red-500 transition-colors"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg font-semibold shadow-lg shadow-red-500/20 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 transition-all" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                {loading ? 'Verifying...' : 'Login'}
              </Button>

              <div className="text-center pt-2">
                <Button type="button" variant="link" className="text-muted-foreground hover:text-red-400" onClick={() => navigate(`/role-selection/${schoolId}`)}>
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

export default AdministratorLoginPage;
