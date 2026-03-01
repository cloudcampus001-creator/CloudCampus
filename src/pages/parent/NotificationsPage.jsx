import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const studentMatricule = localStorage.getItem('studentMatricule');
  const classId = localStorage.getItem('classId');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('school_id', schoolId)
        .or(`target_type.eq.school,target_type.eq.class,target_type.eq.parent`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const filtered = data.filter(notif => 
        notif.target_type === 'school' ||
        (notif.target_type === 'class' && notif.target_id === parseInt(classId)) ||
        (notif.target_type === 'parent' && notif.target_id === studentMatricule)
      );

      setNotifications(filtered);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Notifications - Parent Dashboard</title>
        <meta name="description" content="View all notifications and announcements from your child's school" />
      </Helmet>

      <div className="p-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-6">Notifications</h1>

          {loading ? (
            <div className="text-center text-slate-400 py-12">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-800">
              <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">All Caught Up!</h2>
              <p className="text-slate-400">You have no new notifications.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-900/50 backdrop-blur-xl rounded-xl p-6 border border-slate-800 hover:border-indigo-600/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">{notification.title}</h3>
                      <p className="text-slate-400 mb-2">{notification.content}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>From: {notification.sender_name} ({notification.sender_role})</span>
                        <span>•</span>
                        <span>{new Date(notification.created_at).toLocaleDateString()}</span>
                      </div>
                      {notification.file_url && (
                        <a
                          href={notification.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-3 text-indigo-400 hover:text-indigo-300 underline"
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default NotificationsPage;