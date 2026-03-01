import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, UserCheck, UserX, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';

const ActivityPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentClass, setCurrentClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [absentStudents, setAbsentStudents] = useState(new Set());
  const [logData, setLogData] = useState({ topic: '', subTopics: '' });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  const teacherId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName');

  useEffect(() => {
    fetchCurrentClass();
  }, []);

  const fetchCurrentClass = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[now.getDay()];
      
      // Format current time as HH:MM:SS
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}:${seconds}`;

      // Find active class based on current time and day
      const { data: timetableData, error } = await supabase
        .from('timetables')
        .select('*, classes(id, name)')
        .eq('teacher_id', teacherId)
        .eq('day_of_week', currentDay)
        .lte('start_time', currentTime)
        .gte('end_time', currentTime)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error

      if (timetableData) {
        setCurrentClass(timetableData);
        fetchStudents(timetableData.class_id);
      } else {
        setCurrentClass(null);
      }
    } catch (error) {
      console.error('Error fetching active class:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId) => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('name');
    
    if (error) {
      console.error('Error fetching students:', error);
    } else {
      setStudents(data || []);
    }
  };

  const toggleAbsence = (matricule) => {
    setAbsentStudents(prev => {
      const next = new Set(prev);
      if (next.has(matricule)) {
        next.delete(matricule);
      } else {
        next.add(matricule);
      }
      return next;
    });
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    setSubmittingLog(true);
    try {
      const { error } = await supabase
        .from('e_logbook_entries')
        .insert({
          teacher_id: parseInt(teacherId),
          class_id: currentClass.class_id,
          subject: currentClass.subject,
          topic: logData.topic,
          sub_topics: logData.subTopics,
          status: 'pending', // As per request, signed by teacher then arrives to VP (pending state)
          school_id: parseInt(schoolId),
          created_at: new Date().toISOString(),
          teacher_name: teacherName
        });

      if (error) throw error;

      toast({ title: 'Success', description: 'E-Log signed and sent to Vice Principal.' });
      setLogData({ topic: '', subTopics: '' });
    } catch (error) {
      console.error('Error submitting log:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit e-log' });
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleSubmitAttendance = async () => {
  setSubmittingAttendance(true);
  try {
    const absentees = Array.from(absentStudents);
    if (absentees.length > 0) {
      const absencesToInsert = absentees.map(matricule => ({
        student_matricule: matricule,
        class_id: currentClass.class_id,
        teacher_id: parseInt(teacherId),
        // Ensure this is YYYY-MM-DD
        date: new Date().toISOString().split('T')[0], 
        hours: 1,
        status: 'unjustified',
        school_id: parseInt(schoolId)
      }));

      const { error } = await supabase
        .from('absences')
        .insert(absencesToInsert);
      
      if (error) throw error;
    }
    toast({ title: 'Success', description: 'Attendance register submitted' });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setSubmittingAttendance(false);
  }
};

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading active class...</div>;
  }

  if (!currentClass) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="bg-secondary/20 p-6 rounded-full mb-4">
          <Clock className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Active Class</h2>
        <p className="text-muted-foreground max-w-md">
          You don't have any scheduled classes at this time. The activity page only activates during your scheduled periods.
        </p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Live Activity - Teacher Dashboard</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Live Activity</h1>
            <p className="text-primary font-medium flex items-center gap-2 mt-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              {currentClass.classes.name} - {currentClass.subject}
            </p>
          </div>
        </div>

        <Tabs defaultValue="elog" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="elog">e-Log Book</TabsTrigger>
            <TabsTrigger value="register">Attendance Register</TabsTrigger>
          </TabsList>

          <TabsContent value="elog">
            <Card>
              <CardHeader>
                <CardTitle>Sign e-Log for {currentClass.classes.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitLog} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic Taught</Label>
                    <Input
                      id="topic"
                      value={logData.topic}
                      onChange={(e) => setLogData({ ...logData, topic: e.target.value })}
                      placeholder="e.g., Newton's Laws of Motion"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtopics">Sub-topics Dealt With</Label>
                    <Textarea
                      id="subtopics"
                      value={logData.subTopics}
                      onChange={(e) => setLogData({ ...logData, subTopics: e.target.value })}
                      placeholder="e.g., First Law, Inertia, Examples"
                      className="min-h-[100px]"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submittingLog}>
                    {submittingLog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Sign & Send to VP
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Register</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Click on a student to mark them as absent (highlighted in red).
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                    {students.map((student) => {
                      const isAbsent = absentStudents.has(student.matricule);
                      return (
                        <div
                          key={student.matricule}
                          onClick={() => toggleAbsence(student.matricule)}
                          className={`
                            flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all
                            ${isAbsent 
                              ? 'bg-destructive/10 border-destructive/50' 
                              : 'bg-card hover:bg-accent border-border'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAbsent ? 'bg-destructive/20 text-destructive' : 'bg-primary/10 text-primary'}`}>
                              {isAbsent ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.matricule}</p>
                            </div>
                          </div>
                          <div className="text-sm font-medium">
                            {isAbsent ? <span className="text-destructive">Absent</span> : <span className="text-green-600 dark:text-green-400">Present</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button 
                    onClick={handleSubmitAttendance} 
                    className="w-full" 
                    disabled={submittingAttendance}
                    variant={absentStudents.size > 0 ? "destructive" : "default"}
                  >
                    {submittingAttendance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit Attendance ({absentStudents.size} Absent)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </>
  );
};

export default ActivityPage;