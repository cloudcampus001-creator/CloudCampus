import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, FileDigit, Loader2, ArrowLeft, Cloud } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { saveSession } from '@/lib/sessionPersistence';

const ParentLoginPage = () => {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ studentName: '', matricule: '' });
  const [loading, setLoading] = useState(false);

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

      if (error || !student) {
        console.error("Parent login error:", error);
        throw new Error("Invalid Student Name or Matricule");
      }

      // ── Persistent session (5-day inactivity window) ───────────────────────
      saveSession({
        userRole:    'parent',
        userId:      student.matricule,   // matricule serves as parent's userId
        userName:    'Parent of ' + student.name,
        schoolId:    schoolId,
        classId:     student.class_id || '',
        studentName: student.name,
      });

      // Also persist the matricule for pages that read it directly
      localStorage.setItem('studentMatricule', student.matricule);

      toast({
        title: "Welcome!",
        description: `Logged in as parent of ${student.name}`,
        className: "bg-blue-500/10 border-blue-500/50 text-blue-500"
      });
      navigate('/dashboard/parent');

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Could not verify student details. Please check name and matricule."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Parent Login - CloudCampus</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background font-sans">
        <div className="absolute top-0 right-0 w-full h-full bg-grid-white/[0.02] -z-10" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-cyan-600/20 rounded-full blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="glass rounded-3xl p-8 shadow-2xl border-t border-white/10 relative overflow-hidden bg-card/50 backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />

            <div className="mb-8 text-center space-y-2">
              <div className="inline-block p-3 bg-blue-500/10 rounded-full mb-2">
                <Cloud className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">Parent Portal</h2>
              <p className="text-muted-foreground text-sm">Access your child's academic records</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label>Student's Name</Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    type="text" placeholder="e.g. John Doe"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-blue-500 transition-colors"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Matricule Number</Label>
                <div className="relative group">
                  <FileDigit className="absolute left-3 top-3 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    type="text" placeholder="e.g. MAT-2025-001"
                    className="pl-10 h-12 bg-background/50 border-white/10 focus:border-blue-500 transition-colors"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-lg font-semibold shadow-lg shadow-blue-500/20 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                {loading ? 'Verifying...' : 'Access Dashboard'}
              </Button>

              <div className="text-center pt-2">
                <Button type="button" variant="link" className="text-muted-foreground hover:text-blue-400" onClick={() => navigate(`/role-selection/${schoolId}`)}>
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

export default ParentLoginPage;
