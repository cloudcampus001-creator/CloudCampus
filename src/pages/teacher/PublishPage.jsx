
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Book, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Helmet } from 'react-helmet';

const PublishPage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [docType, setDocType] = useState('document');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');

  const teacherId = localStorage.getItem('userId');
  const schoolId = localStorage.getItem('schoolId');
  const teacherName = localStorage.getItem('userName') || 'Teacher';

  useEffect(() => {
    if (teacherId) {
      fetchClasses();
    } else {
      toast({ variant: "destructive", title: "Auth Error", description: "Please login again." });
    }
  }, [teacherId]);

  const fetchClasses = async () => {
    try {
      // Fetch classes from timetables to ensure we get active classes for this teacher
      const { data, error } = await supabase
        .from('timetables')
        .select('class_id, subject, classes(id, name)')
        .eq('teacher_id', teacherId); // teacher_id is now TEXT in DB, supporting both formats

      if (error) throw error;

      const uniqueClasses = [];
      const seen = new Set();
      data?.forEach(item => {
        if (item.classes && !seen.has(item.class_id)) {
          seen.add(item.class_id);
          uniqueClasses.push({ 
            id: item.classes.id, 
            name: item.classes.name, 
            defaultSubject: item.subject 
          });
        }
      });
      setClasses(uniqueClasses);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({ 
        variant: "destructive", 
        title: "Error loading classes", 
        description: "Could not retrieve your class list. Check console." 
      });
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Limit is 50MB."
        });
        return;
      }
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    
    if (!file || !selectedClass) {
      toast({ variant: "destructive", title: "Missing Info", description: "Class and File are required." });
      return;
    }

    setLoading(true);
    try {
      // 1. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50); 
      // Path: school_id/class_id/timestamp_filename
      const uniquePath = `${schoolId}/${selectedClass}/${Date.now()}_${sanitizedName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(uniquePath, file, {
            cacheControl: '3600',
            upsert: false
        });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(uniquePath);

      if (!publicUrl) throw new Error("Failed to generate public URL");

      // 2. Insert Record into Database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          class_id: parseInt(selectedClass),
          teacher_id: teacherId, 
          teacher_name: teacherName,
          subject: subject || 'General',
          file_name: fileName,
          file_url: publicUrl,
          document_type: docType,
          school_id: parseInt(schoolId),
          created_at: new Date().toISOString()
        });

      if (dbError) throw new Error(`Database record creation failed: ${dbError.message}`);

      // 3. Create Notification
      try {
        await supabase.from('notifications').insert({
            sender_name: teacherName,
            sender_role: 'teacher',
            title: `New ${docType.charAt(0).toUpperCase() + docType.slice(1)}: ${subject}`,
            content: `A new ${docType} "${fileName}" has been uploaded for ${subject}.`,
            target_type: 'class',
            target_id: parseInt(selectedClass),
            school_id: parseInt(schoolId),
            file_url: publicUrl,
            audience_type: 'parent',
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });
      } catch (notifyError) {
          console.warn("Notification skipped:", notifyError);
      }

      toast({ 
        title: "Success!", 
        description: "Document published and students notified.",
        className: "bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400"
      });
      
      setFile(null);
      setFileName('');
      
    } catch (error) {
      console.error('Publish Error:', error);
      toast({ 
        variant: "destructive", 
        title: "Failed to Publish", 
        description: error.message || "An unexpected error occurred."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Publish - Teacher Portal</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/20 text-primary">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-glow">Publish Center</h1>
            <p className="text-muted-foreground">Share materials with your students instantly</p>
          </div>
        </div>

        <Card className="glass overflow-hidden border-t-4 border-t-primary">
          <CardContent className="p-8">
            <form onSubmit={handlePublish} className="space-y-8">
              
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'document', label: 'Material', icon: FileText },
                  { id: 'assignment', label: 'Assignment', icon: Book },
                  { id: 'exam', label: 'Exam', icon: AlertCircle }
                ].map((type) => (
                  <motion.button
                    key={type.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDocType(type.id)}
                    className={`
                      relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all
                      ${docType === type.id 
                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]' 
                        : 'bg-secondary/30 border-transparent hover:bg-secondary/50 hover:border-primary/30'
                      }
                    `}
                  >
                    <type.icon className="w-8 h-8" />
                    <span className="font-semibold">{type.label}</span>
                    {docType === type.id && (
                      <div className="absolute top-3 right-3 text-primary">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Target Class</Label>
                  <Select value={selectedClass} onValueChange={(val) => {
                    setSelectedClass(val);
                    const cls = classes.find(c => c.id.toString() === val);
                    if (cls && cls.defaultSubject) setSubject(cls.defaultSubject);
                  }}>
                    <SelectTrigger className="h-12 bg-background/50 backdrop-blur-sm border-input/50">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subject / Title</Label>
                  <Input 
                    className="h-12 bg-background/50 backdrop-blur-sm border-input/50"
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics Ch. 5"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Upload File</Label>
                <div className={`
                  relative group border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden
                  ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5'}
                `}>
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 relative z-10">
                    <div className={`
                      w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                      ${file ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-secondary text-muted-foreground group-hover:scale-110'}
                    `}>
                      {file ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold">
                        {file ? fileName : "Drop your file here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Supports PDF, DOCX, Images (Max 50MB)"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all" 
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" /> Publishing...
                  </span>
                ) : (
                  "Publish Now"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default PublishPage;
