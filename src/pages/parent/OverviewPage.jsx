import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, BookOpen, MessageSquare, Bell, Calendar, 
  CheckCircle, AlertTriangle, Activity
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';

const OverviewPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    assignments: 0,
    unreadDocs: 0,
    absences: 0
  });
  const [loading, setLoading] = useState(true);
  
  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId = localStorage.getItem('classId');
  const schoolId = localStorage.getItem('schoolId');
  const studentName = localStorage.getItem('studentName');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Notifications (Display on Overview)
      // We fetch all relevant notifications for the school, then filter in JS for complex OR logic if needed, 
      // or use Supabase OR syntax.
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      // Filter for: Target School OR Target Class (student's class) OR Target Parent (student's matricule)
      const relevantNotifs = notifs?.filter(n => 
        n.target_type === 'school' ||
        (n.target_type === 'class' && n.target_id === parseInt(classId)) ||
        (n.target_type === 'parent' && n.target_id === parseInt(studentMatricule)) // Assuming matricule might be stored as int in target_id
      ) || [];
      
      setNotifications(relevantNotifs.slice(0, 5));

      // 2. Fetch Stats
      const { count: assignCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', parseInt(classId))
        .eq('document_type', 'assignment');
        
      const { data: absenceData } = await supabase
        .from('absences')
        .select('hours')
        .eq('student_matricule', studentMatricule)
        .eq('status', 'unjustified');
      const totalAbsence = absenceData?.reduce((acc, curr) => acc + curr.hours, 0) || 0;

      setStats({
        assignments: assignCount || 0,
        unreadDocs: 0,
        absences: totalAbsence
      });

    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <>
      <Helmet>
        <title>Parent Overview - CloudCampus</title>
      </Helmet>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-violet-500">
              Welcome back!
            </h1>
            <p className="text-muted-foreground">Here's what's happening with <span className="font-semibold text-foreground">{studentName}</span> today.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-white/10">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 md:grid-cols-3"
        >
          <motion.div variants={itemVariants}>
            <Card className="glass-hover border-l-4 border-l-indigo-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
                <FileText className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.assignments}</div>
                <p className="text-xs text-muted-foreground">Due this month</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="glass-hover border-l-4 border-l-pink-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Study Materials</CardTitle>
                <BookOpen className="h-4 w-4 text-pink-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">Check library for updates</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className={`glass-hover border-l-4 ${stats.absences > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unjustified Absence</CardTitle>
                {stats.absences > 0 ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.absences} hrs</div>
                <p className="text-xs text-muted-foreground">{stats.absences === 0 ? 'Perfect attendance!' : 'Requires attention'}</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-7">
          {/* Left Column: Notifications */}
          <Card className="md:col-span-4 glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-500" /> Latest Notifications
              </CardTitle>
              <CardDescription>Recent updates from the school administration.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                 {notifications.length === 0 ? (
                   <div className="text-center py-8 text-muted-foreground">
                     <p>No recent notifications.</p>
                   </div>
                 ) : (
                   notifications.map((n) => (
                     <motion.div 
                       key={n.id} 
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                     >
                        <div className="mt-1">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                            <Activity className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                             <h4 className="font-semibold text-sm">{n.title}</h4>
                             <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px] h-5">{n.sender_role}</Badge>
                            <span className="text-[10px] text-muted-foreground">From: {n.sender_name}</span>
                          </div>
                        </div>
                     </motion.div>
                   ))
                 )}
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Quick Actions or Chat Teaser */}
          <Card className="md:col-span-3 glass bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
            <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <MessageSquare className="w-5 h-5 text-purple-500" /> Class Discussion
               </CardTitle>
               <CardDescription>Quick check on recent messages.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center py-8 space-y-4">
               <div className="relative">
                 <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-30 animate-pulse"></div>
                 <div className="relative bg-card p-4 rounded-full">
                    <MessageSquare className="w-8 h-8 text-foreground" />
                 </div>
               </div>
               <div>
                 <h3 className="font-semibold">Join the conversation</h3>
                 <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">Connect with teachers and other parents in real-time.</p>
               </div>
               <Button 
                 onClick={() => navigate('/dashboard/parent/chat')}
                 className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
               >
                 Open Chat
               </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default OverviewPage;