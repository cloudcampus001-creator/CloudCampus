import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import SearchableStudentSelect from '@/components/SearchableStudentSelect';

const NotifyPage = () => {
  const { toast } = useToast();

  const [loading,          setLoading]          = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [classes,          setClasses]          = useState([]);
  const [students,         setStudents]         = useState([]);
  const [notificationType, setNotificationType] = useState('individual');
  const [selectedClass,    setSelectedClass]    = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState('');
  const [formData,         setFormData]         = useState({ title: '', message: '' });

  const teacherId   = localStorage.getItem('userId');
  const schoolId    = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName') || 'Teacher';

  // Load teacher's classes on mount
  useEffect(() => { fetchTeacherClasses(); }, []);

  // Load students when class changes (only for individual mode)
  useEffect(() => {
    if (selectedClass && notificationType === 'individual') {
      fetchStudentsForClass(selectedClass);
    } else {
      setStudents([]);
      setSelectedStudent('');
    }
  }, [selectedClass, notificationType]);

  const fetchTeacherClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('timetables')
        .select('class_id, classes(id, name)')
        .eq('teacher_id', teacherId);
      if (error) throw error;

      const seen = new Set();
      const unique = [];
      data?.forEach(item => {
        if (item.classes && !seen.has(item.class_id)) {
          seen.add(item.class_id);
          unique.push(item.classes);
        }
      });
      setClasses(unique);
    } catch (err) { console.error(err); }
  };

  const fetchStudentsForClass = async (classId) => {
    setFetchingStudents(true);
    setSelectedStudent('');
    const { data, error } = await supabase
      .from('students')
      .select('matricule, name')
      .eq('class_id', classId)
      .order('name');
    if (error) console.error(error);
    setStudents(data || []);
    setFetchingStudents(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        sender_name: teacherName,
        sender_role: 'teacher',
        title:       formData.title,
        content:     formData.message,
        school_id:   parseInt(schoolId),
        expires_at:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (notificationType === 'all') {
        await Promise.all(
          classes.map(cls =>
            supabase.from('notifications').insert({
              ...payload,
              target_type:   'class',
              target_id:     cls.id,
              audience_type: 'parent',
              audience_id:   null,
            })
          )
        );
      } else if (notificationType === 'class') {
        if (!selectedClass) throw new Error('Select a class');
        await supabase.from('notifications').insert({
          ...payload,
          target_type:   'class',
          target_id:     parseInt(selectedClass),
          audience_type: 'parent',
          audience_id:   null,
        });
      } else {
        // individual
        if (!selectedStudent) throw new Error('Select a student');
        await supabase.from('notifications').insert({
          ...payload,
          target_type:        'class',
          target_id:          parseInt(selectedClass),
          audience_type:      'student',
          student_matricule:  selectedStudent,
          audience_id:        null,
        });
      }

      toast({ title: 'Success', description: 'Notification sent successfully' });
      setFormData({ title: '', message: '' });
      setSelectedClass('');
      setSelectedStudent('');
      setStudents([]);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to send notification' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Notify Parents - Teacher Dashboard</title></Helmet>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notify Parents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Recipient type toggle */}
              <div className="space-y-2">
                <Label>Recipient Type</Label>
                <div className="flex gap-2 p-1 bg-muted rounded-lg">
                  {['individual', 'class', 'all'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setNotificationType(type); setSelectedClass(''); setSelectedStudent(''); }}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                        notificationType === type
                          ? 'bg-background shadow text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type === 'all' ? 'All Classes' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class selector (hidden for 'all') */}
              {notificationType !== 'all' && (
                <div className="space-y-2">
                  <Label>Select Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Searchable + scrollable student picker (individual only) */}
              {notificationType === 'individual' && selectedClass && (
                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <SearchableStudentSelect
                    students={students}
                    value={selectedStudent}
                    onChange={setSelectedStudent}
                    loading={fetchingStudents}
                    placeholder="Search student by name or matricule…"
                  />
                </div>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Subject / Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Important Announcement"
                  required
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="message">Message Content</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Write your message here..."
                  className="min-h-[150px]"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send Notification
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default NotifyPage;
