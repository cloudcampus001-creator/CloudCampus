import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Upload, FileText, Shield } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const DisciplinePage = () => {
  const { toast } = useToast();
  const [absencesCount, setAbsencesCount] = useState(0);
  const [punishments, setPunishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    message: '',
    file: null,
  });

  const studentMatricule = localStorage.getItem('studentMatricule');
  const parentName = localStorage.getItem('userName');
  const classId = localStorage.getItem('classId');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    fetchDisciplineData();
  }, []);

  const fetchDisciplineData = async () => {
    try {
      const { data: absences, error: absencesError } = await supabase
        .from('absences')
        .select('hours')
        .eq('student_matricule', studentMatricule)
        .eq('status', 'unjustified');

      if (absencesError) throw absencesError;

      const totalHours = absences.reduce((sum, abs) => sum + abs.hours, 0);
      setAbsencesCount(totalHours);

      const { data: punishmentsData, error: punishmentsError } = await supabase
        .from('punishments')
        .select('*')
        .eq('student_matricule', studentMatricule)
        .order('created_at', { ascending: false });

      if (punishmentsError) throw punishmentsError;
      setPunishments(punishmentsData || []);
    } catch (error) {
      console.error('Error fetching discipline data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setFormData({ ...formData, file: e.target.files[0] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let fileUrl = null;

      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const fileName = `${studentMatricule}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('justifications')
          .upload(fileName, formData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('justifications')
          .getPublicUrl(fileName);

        fileUrl = publicUrl;
      }

      const { data: classData } = await supabase
        .from('classes')
        .select('dm_id')
        .eq('id', classId)
        .single();

      const { error: insertError } = await supabase
        .from('justifications')
        .insert({
          student_matricule: studentMatricule,
          parent_id: studentMatricule,
          parent_name: parentName,
          class_id: classId,
          dm_id: classData?.dm_id,
          message: formData.message,
          file_url: fileUrl,
          status: 'pending',
          school_id: schoolId,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Justification submitted successfully',
      });

      setFormData({ message: '', file: null });
    } catch (error) {
      console.error('Error submitting justification:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to submit justification',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Discipline Center - Parent Dashboard</title>
        <meta name="description" content="Manage absences and view discipline records" />
      </Helmet>

      <div className="p-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-6">Discipline Center</h1>

          <div className="bg-gradient-to-br from-red-600/20 to-orange-600/20 backdrop-blur-xl rounded-2xl p-6 border border-red-600/30 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-red-600/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Unjustified Absence Hours</h2>
                <p className="text-4xl font-bold text-red-400">{absencesCount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-800"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FileText className="w-7 h-7 text-blue-400" />
                Justify Absences
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="message" className="text-slate-300">
                    Justification Message
                  </Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-2 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 min-h-32"
                    placeholder="Explain the reason for absence..."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="file" className="text-slate-300">
                    Upload File (Optional)
                  </Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={handleFileChange}
                    className="mt-2 bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Justification'}
                </Button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-800"
            >
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Shield className="w-7 h-7 text-orange-400" />
                Punishment Review
              </h2>

              {loading ? (
                <p className="text-slate-400">Loading punishments...</p>
              ) : punishments.length === 0 ? (
                <p className="text-slate-400">No punishments on record</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {punishments.map((punishment) => (
                    <div
                      key={punishment.id}
                      className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white">{punishment.reason}</h3>
                        <span className="text-xs text-slate-500">
                          {new Date(punishment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{punishment.punishment}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Signaled by: {punishment.signaled_by_role}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default DisciplinePage;