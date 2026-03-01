import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, BookOpen, Clock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';

const TeacherHomePage = () => {
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState([]);
  const [stats, setStats] = useState({
    classesCount: 0,
    pendingLogs: 0,
  });

  const teacherId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[new Date().getDay()];

      // Fetch Timetable
      const { data: timetableData, error: timetableError } = await supabase
        .from('timetables')
        .select('*, classes(name)')
        .eq('teacher_id', teacherId)
        .eq('day_of_week', currentDay)
        .order('start_time');

      if (timetableError) throw timetableError;
      setTimetable(timetableData || []);

      // Fetch Pending Logs (simple count for now)
      // Assuming pending logs are for classes that happened but have no entry
      // This logic can be complex, for now we'll mock or check recent entries vs schedule
      // Let's check e_logbook_entries where status = 'pending' if that exists, or just mock for visual
      const { count: logsCount } = await supabase
        .from('e_logbook_entries')
        .select('*', { count: 'exact' })
        .eq('teacher_id', teacherId)
        .eq('status', 'pending');

      setStats({
        classesCount: timetableData?.length || 0,
        pendingLogs: logsCount || 0
      });

    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Home - Teacher Dashboard</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <h1 className="text-3xl font-bold">Teacher Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Classes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.classesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending e-Logs</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingLogs}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Timetable</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground text-center py-8">Loading timetable...</div>
            ) : timetable.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">No classes scheduled for today.</div>
            ) : (
              <div className="space-y-4">
                {timetable.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-full">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{slot.classes?.name}</p>
                        <p className="text-sm text-muted-foreground">{slot.subject}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default TeacherHomePage;