import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

const RegisterReviewPage = () => {
  const { toast } = useToast();
  const userId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  // State
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({}); // Map: matricule -> totalHours
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Classes on Mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('*')
          .eq('dm_id', parseInt(userId)) // Ensure ID matches type
          .eq('school_id', parseInt(schoolId))
          .order('name');

        if (error) throw error;
        setClasses(data || []);
        
        // Auto-select first class if available
        if (data && data.length > 0) {
          setSelectedClass(data[0].id.toString());
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, [userId, schoolId]);

  // 2. Fetch Students & Absences when Class or Date changes
  useEffect(() => {
    if (selectedClass) {
      fetchDailyRegister();
    }
  }, [selectedClass, selectedDate]);

  const fetchDailyRegister = async () => {
    setLoading(true);
    try {
      // A. Get Students
      const { data: studentsData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', parseInt(selectedClass))
        .eq('school_id', parseInt(schoolId))
        .order('name');

      if (studentError) throw studentError;

      // B. Get Absences for this DATE
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      const { data: absenceData, error: absenceError } = await supabase
        .from('absences')
        .select('*')
        .eq('class_id', parseInt(selectedClass))
        .eq('date', dateString);

      if (absenceError) throw absenceError;

      // C. Aggregate Absences (Sum hours per student)
      const attendanceMap = {};
      
      // Initialize all students with 0 hours
      studentsData.forEach(s => {
        attendanceMap[s.matricule] = { hours: 0, count: 0, status: 'present' };
      });

      // Sum up the hours from DB
      absenceData.forEach(record => {
        if (attendanceMap[record.student_matricule]) {
          attendanceMap[record.student_matricule].hours += Number(record.hours);
          attendanceMap[record.student_matricule].count += 1;
          attendanceMap[record.student_matricule].status = 'absent';
        }
      });

      setStudents(studentsData || []);
      setAttendanceData(attendanceMap);

    } catch (error) {
      console.error('Fetch error:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load register." });
    } finally {
      setLoading(false);
    }
  };

  // Helper: Change Date
  const changeDate = (days) => {
    setSelectedDate(prev => addDays(prev, days));
  };

  // Action: Manually adjust absence (Add 1 Hour / Reset)
  const adjustAbsence = async (student, action) => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const currentHours = attendanceData[student.matricule]?.hours || 0;

    try {
      if (action === 'add') {
        // Insert a 1-hour absence record
        const { error } = await supabase.from('absences').insert({
          student_matricule: student.matricule,
          class_id: parseInt(selectedClass),
          date: dateString,
          hours: 1, // Default increment
          status: 'unjustified',
          school_id: parseInt(schoolId),
          teacher_id: null // Null because DM entered it manually
        });
        if (error) throw error;
        
        // Optimistic Update
        setAttendanceData(prev => ({
          ...prev,
          [student.matricule]: { 
            ...prev[student.matricule], 
            hours: currentHours + 1,
            status: 'absent'
          }
        }));

      } else if (action === 'clear') {
        // Remove ALL records for this student on this day
        const { error } = await supabase.from('absences')
          .delete()
          .eq('student_matricule', student.matricule)
          .eq('class_id', parseInt(selectedClass))
          .eq('date', dateString);

        if (error) throw error;

        // Optimistic Update
        setAttendanceData(prev => ({
          ...prev,
          [student.matricule]: { 
            ...prev[student.matricule], 
            hours: 0,
            status: 'present'
          }
        }));
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  };

  // Filter students for search
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Daily Register - Discipline</title>
      </Helmet>

      <div className="space-y-6 max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Daily Register Review</h1>
            <p className="text-muted-foreground">View total absences per student for specific days.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-white/10 shadow-sm">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center font-medium">
              <CalendarIcon className="w-4 h-4 text-orange-500" />
              {isSameDay(selectedDate, new Date()) ? "Today" : format(selectedDate, 'EEE, MMM dd')}
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} disabled={isSameDay(selectedDate, new Date())}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Controls Bar */}
        <Card className="glass border-t-4 border-t-orange-500">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-64">
              <Select value={selectedClass || ''} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="relative w-full md:flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search student name..." 
                className="pl-9" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Main List Area */}
        <div className="flex-1 overflow-hidden bg-card/30 rounded-xl border border-white/10 backdrop-blur-sm relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a class to view the register.</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 space-y-2">
              {filteredStudents.map(student => {
                const data = attendanceData[student.matricule] || { hours: 0 };
                const isAbsent = data.hours > 0;

                return (
                  <div 
                    key={student.matricule} 
                    className={`
                      flex items-center justify-between p-4 rounded-lg border transition-all
                      ${isAbsent 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10'}
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                        ${isAbsent ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}
                      `}>
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium">{student.name}</h3>
                        <p className="text-xs text-muted-foreground">{student.matricule}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className={`text-sm font-bold ${isAbsent ? 'text-red-500' : 'text-green-500'}`}>
                          {isAbsent ? `${data.hours} hrs Absent` : "Present"}
                        </span>
                        {isAbsent && <p className="text-[10px] text-muted-foreground">Total records: {data.count}</p>}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 w-8 p-0 border-dashed hover:border-orange-500 hover:text-orange-500"
                          title="Add 1 Hour Absence"
                          onClick={() => adjustAbsence(student, 'add')}
                        >
                          +
                        </Button>
                        {isAbsent && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500"
                            onClick={() => adjustAbsence(student, 'clear')}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RegisterReviewPage;