import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, XCircle, ExternalLink, Download, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Helmet } from 'react-helmet';

const JustificationsPage = () => {
  const { toast } = useToast();
  const userId = localStorage.getItem('userId');
  
  const [justifications, setJustifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJustification, setSelectedJustification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchJustifications();
  }, []);

  const fetchJustifications = async () => {
    try {
      // Fetch justifications for this DM
      const { data, error } = await supabase
        .from('justifications')
        .select('*, students(name, matricule)')
        .eq('dm_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJustifications(data || []);
    } catch (error) {
      console.error('Error loading justifications:', error);
      toast({ variant: "destructive", title: "Error", description: "Could not load justifications." });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (status) => {
    if (!selectedJustification) return;
    setActionLoading(true);
    
    try {
      const { error } = await supabase
        .from('justifications')
        .update({ status })
        .eq('id', selectedJustification.id);

      if (error) throw error;

      toast({
        title: status === 'approved' ? "Approved" : "Rejected",
        description: `Justification has been ${status}.`,
        className: status === 'approved' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
      });

      // Optimistic update
      setJustifications(prev => prev.map(j => j.id === selectedJustification.id ? { ...j, status } : j));
      setIsModalOpen(false);

    } catch (error) {
      console.error('Error updating status:', error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update status." });
    } finally {
      setActionLoading(false);
    }
  };

  const openReview = (justification) => {
    setSelectedJustification(justification);
    setIsModalOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Justifications - Discipline Master</title>
      </Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Absence Justifications</h1>
          <p className="text-muted-foreground">Review and approve parental justifications for student absences.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {justifications.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>No justifications found.</p>
              </div>
            ) : (
              justifications.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="glass h-full hover:border-orange-500/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge variant={item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'destructive'} className="uppercase text-[10px]">
                          {item.status || 'pending'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <CardTitle className="text-lg mt-2">{item.students?.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Parent: {item.parent_name}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-white/5 p-3 rounded-md text-sm italic">
                        "{item.message}"
                      </div>
                      
                      {item.file_url && (
                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => window.open(item.file_url, '_blank')}>
                           <Download className="w-3 h-3" /> View Attachment
                        </Button>
                      )}

                      {item.status === 'pending' && (
                        <Button 
                           className="w-full bg-orange-500 hover:bg-orange-600 text-white" 
                           onClick={() => openReview(item)}
                        >
                          Review Case
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review Justification</DialogTitle>
              <DialogDescription>
                Decide whether to accept this reason for absence.
              </DialogDescription>
            </DialogHeader>
            {selectedJustification && (
              <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <h4 className="font-medium text-sm">Student Details</h4>
                   <div className="text-sm text-muted-foreground">
                     <p>Name: {selectedJustification.students?.name}</p>
                     <p>Matricule: {selectedJustification.students?.matricule}</p>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <h4 className="font-medium text-sm">Reason Provided</h4>
                   <p className="text-sm bg-secondary/50 p-3 rounded-md">{selectedJustification.message}</p>
                 </div>
                 <div className="bg-yellow-500/10 p-3 rounded-md text-xs text-yellow-600 flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Approving this will validate the absence. You may need to manually adjust the hours in the Register Review if specific hours need deduction.</span>
                 </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleAction('rejected')} disabled={actionLoading}>
                <XCircle className="w-4 h-4 mr-2" /> Reject
              </Button>
              <Button className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAction('approved')} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default JustificationsPage;