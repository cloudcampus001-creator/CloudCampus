/**
 * ParentNotificationsPage.jsx
 * Lists notifications relevant to this parent/student.
 * Realtime subscription ensures new notifications appear instantly.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Info, Calendar } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ParentNotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId          = localStorage.getItem('classId');
  const schoolId         = localStorage.getItem('schoolId');

  const isRelevant = (n) =>
    n.target_type === 'school' ||
    (n.target_type === 'class'  && String(n.target_id) === String(classId)) ||
    (n.target_type === 'parent' && String(n.target_id) === String(studentMatricule));

  // ── Initial fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications((data || []).filter(isRelevant));
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    if (schoolId) fetchNotifications();
  }, [schoolId, classId, studentMatricule]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;

    const channel = supabase
      .channel(`parent_notif_page_${schoolId}_${studentMatricule}`)
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
          if (isRelevant(notif)) {
            setNotifications(prev => [notif, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [schoolId, classId, studentMatricule]);

  return (
    <>
      <Helmet>
        <title>Notifications - Parent Portal</title>
      </Helmet>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Announcements from teachers and school administration.</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
            <Bell className="w-12 h-12 mb-4 opacity-20" />
            <p>No notifications found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              >
                <Card className="hover:border-indigo-500/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                          <Info className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{n.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px]">
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
                        className="inline-block mt-4 text-sm font-medium text-indigo-500 hover:underline"
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

export default ParentNotificationsPage;
