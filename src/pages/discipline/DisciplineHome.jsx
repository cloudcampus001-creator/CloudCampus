import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Calendar, AlertTriangle, CheckSquare, Loader2, FileText, Info } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const DisciplineHome = () => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    pendingJustifications: 0,
    registersReviewed: 0,
    punishmentsIssued: 0
  });
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch Notifications (Targeting School or Discipline Masters)
      const { data: notifs, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', parseInt(schoolId))
        .or(`target_type.eq.school,target_type.eq.discipline_master,target_type.eq.staff`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (notifError) console.error('Error fetching notifications:', notifError);
      setNotifications(notifs || []);

      // Fetch quick stats (Simulated for now or simple counts)
      const { count: justCount } = await supabase
        .from('justifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('dm_id', userId);
      
      // Registers count requires deeper query, simplification for dashboard
      // Punishments count
      const { count: punishCount } = await supabase
        .from('punishments')
        .select('id', { count: 'exact', head: true })
        .eq('signaled_by_id', userId)
        .eq('signaled_by_role', 'discipline');

      setStats({
        pendingJustifications: justCount || 0,
        registersReviewed: 24, // Placeholder or derived from logbook query
        punishmentsIssued: punishCount || 0
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <>
      <Helmet>
        <title>Discipline Overview - CloudCampus</title>
      </Helmet>
      
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Overview of discipline activities and alerts.</p>
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
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <motion.div variants={itemVariants}>
            <Card className="glass-hover border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Justifications Pending</CardTitle>
                <FileText className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "-" : stats.pendingJustifications}</div>
                <p className="text-xs text-muted-foreground">Requires review</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="glass-hover border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Registers Reviewed</CardTitle>
                <CheckSquare className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.registersReviewed}</div>
                <p className="text-xs text-muted-foreground">This week</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="glass-hover border-l-4 border-l-red-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Punishments Issued</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "-" : stats.punishmentsIssued}</div>
                <p className="text-xs text-muted-foreground">Total recorded</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 glass">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Updates from School Administration</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p>No new notifications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notif) => (
                    <div key={notif.id} className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/30 transition-colors">
                      <div className="mt-1 p-2 rounded-full bg-orange-500/10">
                        <Info className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium leading-none">{notif.title}</p>
                          <span className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{notif.content}</p>
                        <div className="flex items-center gap-2 pt-2">
                          <Badge variant="secondary" className="text-[10px]">{notif.sender_role}</Badge>
                          <span className="text-[10px] text-muted-foreground">From: {notif.sender_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-3 glass border-orange-500/20 bg-orange-500/5">
             <CardHeader>
               <CardTitle className="text-orange-500">Quick Actions</CardTitle>
               <CardDescription>Common tasks for Discipline Masters</CardDescription>
             </CardHeader>
             <CardContent className="grid gap-2">
                <a href="/dashboard/discipline/punishments" className="flex items-center p-3 rounded-md bg-background/50 hover:bg-orange-500 hover:text-white transition-all group">
                  <AlertTriangle className="w-5 h-5 mr-3 text-orange-500 group-hover:text-white" />
                  <span className="font-medium">Record Punishment</span>
                </a>
                <a href="/dashboard/discipline/justifications" className="flex items-center p-3 rounded-md bg-background/50 hover:bg-blue-500 hover:text-white transition-all group">
                  <FileText className="w-5 h-5 mr-3 text-blue-500 group-hover:text-white" />
                  <span className="font-medium">Review Justifications</span>
                </a>
                <a href="/dashboard/discipline/registers" className="flex items-center p-3 rounded-md bg-background/50 hover:bg-purple-500 hover:text-white transition-all group">
                  <CheckSquare className="w-5 h-5 mr-3 text-purple-500 group-hover:text-white" />
                  <span className="font-medium">Check Registers</span>
                </a>
             </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default DisciplineHome;