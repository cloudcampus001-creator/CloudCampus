/**
 * TeacherNotificationsPage.jsx
 * ─────────────────────────────
 * Shows notifications sent to this teacher (school-wide or targeted).
 * The list updates live via Supabase Realtime — no page refresh needed.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Info, Calendar } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TeacherNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const teacherId = localStorage.getItem('userId');
  const schoolId  = localStorage.getItem('schoolId');

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('school_id', parseInt(schoolId))
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Keep: school-wide OR targeted to this teacher specifically
        const filtered = (data || []).filter(
          n =>
            n.target_type === 'school' ||
            (n.target_type === 'teacher' && String(n.target_id) === String(teacherId))
        );

        setNotifications(filtered);
      } catch (err) {
        console.error('Error fetching teacher notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    if (schoolId) fetchNotifications();
  }, [schoolId, teacherId]);

  // ── Realtime subscription — new notifications appear instantly ────────────
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`teacher_notif_page_${schoolId}_${teacherId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `school_id=eq.${parseInt(schoolId)}`,
        },
        (payload) => {
          const notif = payload.new;
          const isRelevant =
            notif.target_type === 'school' ||
            (notif.target_type === 'teacher' &&
              String(notif.target_id) === String(teacherId));

          if (isRelevant) {
            setNotifications(prev => [notif, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, teacherId]);

  return (
    <>
      <Helmet>
        <title>Notifications - Teacher Dashboard</title>
      </Helmet>

      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Announcements from school administration and management.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
            <Bell className="w-14 h-14 mb-4 opacity-20" />
            <h2 className="text-xl font-semibold mb-1">All Caught Up</h2>
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                          <Info className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle className="text-base leading-tight">{n.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {n.sender_role?.replace('_', ' ') || 'System'}
                            </Badge>
                            {n.sender_name && (
                              <span className="text-xs text-muted-foreground">
                                From: {n.sender_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {n.content}
                    </p>
                    {n.file_url && (
                      <a
                        href={n.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 text-sm font-medium text-primary hover:underline"
                      >
                        View Attachment
                      </a>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default TeacherNotificationsPage;
