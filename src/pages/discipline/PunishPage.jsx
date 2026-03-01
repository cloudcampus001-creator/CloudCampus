import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Gavel, Loader2, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import SearchableStudentSelect from '@/components/SearchableStudentSelect';

const PunishPage = () => {
  const { toast } = useToast();
  const userId   = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  const [classes,          setClasses]          = useState([]);
  const [students,         setStudents]         = useState([]);
  const [selectedClass,    setSelectedClass]    = useState('');
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [loading,          setLoading]          = useState(false);
  const [formData,         setFormData]         = useState({
    studentMatricule: '',
    reason: '',
    punishment: '',
  });

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase.from('classes').select('id, name').eq('dm_id', userId);
      setClasses(data || []);
    };
    fetchClasses();
  }, [userId]);

  const handleClassChange = async (classId) => {
    setSelectedClass(classId);
    setFetchingStudents(true);
    setFormData(prev => ({ ...prev, studentMatricule: '' }));

    const { data } = await supabase
      .from('students')
      .select('matricule, name')
      .eq('class_id', classId)
      .order('name');

    setStudents(data || []);
    setFetchingStudents(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentMatricule || !formData.reason || !formData.punishment) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill all required fields.' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('punishments').insert([{
        student_matricule: formData.studentMatricule,
        class_id:          parseInt(selectedClass),
        signaled_by_id:    parseInt(userId),
        signaled_by_role:  'discipline',
        reason:            formData.reason,
        punishment:        formData.punishment,
        school_id:         parseInt(schoolId),
      }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Punishment recorded successfully.',
        className: 'bg-orange-500/10 border-orange-500/50 text-orange-500',
      });

      setFormData({ studentMatricule: '', reason: '', punishment: '' });
      setSelectedClass('');
      setStudents([]);
    } catch (err) {
      console.error('Error saving punishment:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save record.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Record Punishment - Discipline Master</title></Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record Punishment</h1>
          <p className="text-muted-foreground">Official record entry for student disciplinary actions.</p>
        </div>

        <Card className="glass border-t-4 border-t-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-red-500" />
              Disciplinary Form
            </CardTitle>
            <CardDescription>Enter details of the infraction and assigned punishment.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Class selector */}
              <div className="space-y-2">
                <Label>Class</Label>
                <Select onValueChange={handleClassChange} value={selectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Searchable + scrollable student picker */}
              <div className="space-y-2">
                <Label>Student</Label>
                <SearchableStudentSelect
                  students={students}
                  value={formData.studentMatricule}
                  onChange={(val) => setFormData(prev => ({ ...prev, studentMatricule: val }))}
                  disabled={!selectedClass}
                  loading={fetchingStudents}
                  placeholder={!selectedClass ? '— select a class first —' : 'Search student by name or matricule…'}
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Offense / Reason</Label>
                <Input
                  placeholder="e.g. Disruptive behavior, Late arrival"
                  value={formData.reason}
                  onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              {/* Punishment */}
              <div className="space-y-2">
                <Label>Punishment Details</Label>
                <Textarea
                  placeholder="e.g. 2 hours detention, Warning letter to parents"
                  className="min-h-[100px]"
                  value={formData.punishment}
                  onChange={e => setFormData(prev => ({ ...prev, punishment: e.target.value }))}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Record Punishment
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default PunishPage;
