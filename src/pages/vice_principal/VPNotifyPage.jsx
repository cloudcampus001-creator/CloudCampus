import React, { useState } from 'react';
import { Bell, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const VPNotifyPage = ({ selectedClass }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    audience: 'class', // 'class' or 'specific_student' (simplified for now)
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass) {
        toast({ variant: "destructive", title: "No Class Selected", description: "Please select a class first." });
        return;
    }
    setLoading(true);

    try {
        const userName = localStorage.getItem('userName');
        const schoolId = localStorage.getItem('schoolId');

        // For 'class' audience, we target all parents of that class usually, or just a general notification linked to class ID
        // The notifications table schema uses target_type and target_id.
        // If target_type is 'class', target_id is the class ID.
        
        const { error } = await supabase.from('notifications').insert([{
            sender_name: userName,
            sender_role: 'vice_principal',
            title: formData.title,
            content: formData.content,
            target_type: 'class',
            target_id: parseInt(selectedClass),
            school_id: parseInt(schoolId),
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

        toast({
            title: "Notification Sent",
            description: "The notification has been dispatched successfully.",
            className: "bg-pink-500/10 border-pink-500/50 text-pink-500"
        });
        setFormData({ ...formData, title: '', content: '' });

    } catch (error) {
        console.error('Error sending notification:', error);
        toast({ variant: "destructive", title: "Error", description: "Failed to send notification." });
    } finally {
        setLoading(false);
    }
  };

  if (!selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <Bell className="w-16 h-16 mb-4 opacity-20" />
        <p>Please select a class to send notifications.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Notify - Vice Principal</title>
      </Helmet>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Send Notification</h1>
          <p className="text-muted-foreground">Broadcast messages to parents and students of the selected class.</p>
        </div>

        <Card className="glass border-t-4 border-t-pink-500">
          <CardHeader>
            <CardTitle>Compose Message</CardTitle>
            <CardDescription>Notifications will be sent immediately via the mobile app.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
               <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select defaultValue="class" disabled>
                      <SelectTrigger>
                          <SelectValue placeholder="Entire Class" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="class">Entire Class (Parents & Students)</SelectItem>
                      </SelectContent>
                  </Select>
               </div>
               
               <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                     placeholder="e.g., Upcoming Exam Schedule" 
                     value={formData.title}
                     onChange={e => setFormData({...formData, title: e.target.value})}
                     required
                  />
               </div>

               <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea 
                     placeholder="Write your message here..." 
                     className="min-h-[150px]"
                     value={formData.content}
                     onChange={e => setFormData({...formData, content: e.target.value})}
                     required
                  />
               </div>

               <Button 
                  type="submit" 
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white" 
                  disabled={loading}
               >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Notification
               </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default VPNotifyPage;