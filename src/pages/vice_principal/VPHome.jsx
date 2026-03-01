import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Bell, Info, Users, Calendar } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';

const VPHome = ({ selectedClass }) => {
  const [notifications, setNotifications] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Notifications
        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .or(`target_type.eq.vice_principal,target_type.eq.school`)
          .order('created_at', { ascending: false })
          .limit(5);
        setNotifications(notifs || []);

        // Fetch Class Info if selected
        if (selectedClass) {
          const { data: cls } = await supabase
             .from('classes')
             .select('*, students(count)')
             .eq('id', selectedClass)
             .single();
          setClassInfo(cls);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedClass, schoolId]);

  return (
    <>
      <Helmet>
        <title>VP Overview - CloudCampus</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-white/10">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass border-l-4 border-l-pink-500">
             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium">Selected Class</CardTitle>
               <Users className="h-4 w-4 text-pink-500" />
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">{classInfo ? classInfo.name : 'None'}</div>
               <p className="text-xs text-muted-foreground">{classInfo?.students?.[0]?.count || 0} Students</p>
             </CardContent>
          </Card>
          {/* Add more stat cards here if needed */}
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Bell className="w-5 h-5 text-pink-500" /> Notifications
            </CardTitle>
            <CardDescription>Updates for Vice Principals</CardDescription>
          </CardHeader>
          <CardContent>
             {notifications.length === 0 ? (
               <p className="text-muted-foreground text-center py-4">No new notifications.</p>
             ) : (
               <div className="space-y-4">
                  {notifications.map(notif => (
                    <div key={notif.id} className="flex items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                       <div className="mt-1 p-2 rounded-full bg-pink-500/10">
                          <Info className="w-4 h-4 text-pink-500" />
                       </div>
                       <div>
                          <h4 className="font-semibold text-sm">{notif.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{notif.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                             <Badge variant="outline" className="text-[10px]">{notif.sender_role}</Badge>
                             <span className="text-[10px] text-muted-foreground">{new Date(notif.created_at).toLocaleDateString()}</span>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default VPHome;