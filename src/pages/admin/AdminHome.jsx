import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, BookOpen, Bell, Calendar, TrendingUp, Activity,
  GraduationCap, UserCheck, AlertCircle, Trash2, Send, Loader2
} from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const AdminHome = () => {
  const { toast } = useToast();
  const schoolId = localStorage.getItem('schoolId');

  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, attendanceRate: 0, disciplineCases: 0 });
  const [attendanceData, setAttendanceData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications]     = useState([]);
  const [newNotification, setNewNotification] = useState({ title: '', content: '', target_type: 'school' });
  const [notifLoading, setNotifLoading]       = useState(false);


  useEffect(() => {
    if (schoolId) {
      fetchDashboardData();
      fetchNotifications();
    }
  }, [schoolId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { count: studentCount }   = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId));
      const { count: teacherCount }   = await supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId));
      const { count: classCount }     = await supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId));
      const { count: disciplineCount }= await supabase.from('punishments').select('*', { count: 'exact', head: true }).eq('school_id', parseInt(schoolId));
      setStats({ totalStudents: studentCount || 0, totalTeachers: teacherCount || 0, totalClasses: classCount || 0, attendanceRate: 94.5, disciplineCases: disciplineCount || 0 });
      setAttendanceData([{ name: 'Mon', rate: 96 }, { name: 'Tue', rate: 94 }, { name: 'Wed', rate: 95 }, { name: 'Thu', rate: 92 }, { name: 'Fri', rate: 97 }]);
      setPerformanceData([{ name: 'Grade A', value: 35, color: '#4ade80' }, { name: 'Grade B', value: 45, color: '#60a5fa' }, { name: 'Grade C', value: 15, color: '#facc15' }, { name: 'Grade F', value: 5, color: '#f87171' }]);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase.from('notifications').select('*').eq('school_id', parseInt(schoolId)).order('created_at', { ascending: false });
    if (!error) setNotifications(data || []);
  };

  // Realtime: new notifications appear in the list the moment they are sent
  useEffect(() => {
    if (!schoolId) return;
    const channel = supabase
      .channel(`admin_notif_rt_${schoolId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `school_id=eq.${parseInt(schoolId)}` },
        (payload) => setNotifications(prev => [payload.new, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId]);

  const handlePostNotification = async (e) => {
    e.preventDefault(); setNotifLoading(true);
    try {
      const userName = localStorage.getItem('userName');
      const { error } = await supabase.from('notifications').insert([{ sender_name: userName, sender_role: 'administrator', title: newNotification.title, content: newNotification.content, target_type: newNotification.target_type, school_id: parseInt(schoolId) }]);
      if (error) throw error;
      toast({ title: 'Notification Published', description: `Sent to ${newNotification.target_type.replace('_', ' ')}s.`, className: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-500' });
      setNewNotification({ title: '', content: '', target_type: 'school' });
      fetchNotifications();
    } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Failed to publish.' }); }
    finally { setNotifLoading(false); }
  };

  const handleDeleteNotification = async (id) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) { toast({ title: 'Deleted' }); setNotifications(prev => prev.filter(n => n.id !== id)); }
  };

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <>
      <Helmet><title>Admin Dashboard - CloudCampus</title></Helmet>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">School Overview</h1>
            <p className="text-muted-foreground">Real-time performance metrics and administrative controls.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-white/10">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* KPI Cards */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'indigo', sub: 'Enrolled this academic year' },
            { label: 'Teaching Staff', value: stats.totalTeachers, icon: GraduationCap, color: 'violet', sub: 'Active teachers' },
            { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: UserCheck, color: 'green', sub: 'Average weekly attendance' },
            { label: 'Discipline Cases', value: stats.disciplineCases, icon: AlertCircle, color: 'red', sub: 'Recorded incidents' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <motion.div key={label} variants={itemVariants}>
              <Card className={`glass border-l-4 border-l-${color}-500`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className={`h-4 w-4 text-${color}-500`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{loading ? '—' : value}</div>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>


        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-7">
          <div className="md:col-span-4 space-y-6">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-500" /> Attendance Trends</CardTitle>
                <CardDescription>Daily attendance percentage for the current week.</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[80, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                      <Line type="monotone" dataKey="rate" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="performance" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/30">
                <TabsTrigger value="performance">Academic Performance</TabsTrigger>
                <TabsTrigger value="staff">Staff Performance</TabsTrigger>
              </TabsList>
              <TabsContent value="performance">
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" /> Grade Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center">
                    <div className="h-[200px] w-[200px] relative mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={performanceData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {performanceData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                        <span className="text-2xl font-bold">3.4</span>
                        <span className="text-xs text-muted-foreground">Avg GPA</span>
                      </div>
                    </div>
                    <div className="space-y-2 w-1/2 pl-4">
                      {performanceData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span>{item.name}</span></div>
                          <span className="font-mono font-bold">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="staff">
                <Card className="glass">
                  <CardHeader><CardTitle>Top Performing Staff</CardTitle><CardDescription>Based on logbook completion and resource uploads.</CardDescription></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">{i}</div>
                            <div><p className="font-medium text-sm">Teacher {String.fromCharCode(64 + i)}</p><p className="text-xs text-muted-foreground">Mathematics Dept</p></div>
                          </div>
                          <div className="text-right"><p className="text-sm font-bold text-green-400">98%</p><p className="text-[10px] text-muted-foreground">Efficiency</p></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Notifications */}
          <div className="md:col-span-3">
            <Card className="glass border-t-4 border-t-indigo-500 h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-500" /> Notification Center</CardTitle>
                <CardDescription>Broadcast messages to school stakeholders.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-6">
                <form onSubmit={handlePostNotification} className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={newNotification.target_type} onValueChange={val => setNewNotification({ ...newNotification, target_type: val })}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="school">Global (Everyone)</SelectItem>
                        <SelectItem value="teacher">Teachers Only</SelectItem>
                        <SelectItem value="parent">Parents Only</SelectItem>
                        <SelectItem value="vice_principal">Vice Principals</SelectItem>
                        <SelectItem value="discipline_master">Discipline Masters</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input placeholder="e.g. Emergency Staff Meeting" className="bg-background/50" value={newNotification.title} onChange={e => setNewNotification({ ...newNotification, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea placeholder="Type your notification here..." className="min-h-[100px] bg-background/50" value={newNotification.content} onChange={e => setNewNotification({ ...newNotification, content: e.target.value })} required />
                  </div>
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={notifLoading}>
                    {notifLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Send className="mr-2 w-4 h-4" />} Publish Notification
                  </Button>
                </form>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Broadcasts</h3>
                  {notifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No active notifications.</p>
                  ) : notifications.map(notif => (
                    <div key={notif.id} className="group flex items-start justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-indigo-500/30 transition-all">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase bg-indigo-500/10 text-indigo-400 border-indigo-500/20">{notif.target_type.replace('_', ' ')}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="font-medium text-sm line-clamp-1">{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notif.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteNotification(notif.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminHome;
