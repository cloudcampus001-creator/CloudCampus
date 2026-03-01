
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, BookOpen, Download, Search, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';

const DocsPage = () => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  const classId = localStorage.getItem('classId');

  useEffect(() => {
    if (classId) fetchDocs();
  }, [classId]);

  const fetchDocs = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('class_id', parseInt(classId))
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocs(data || []);
    } catch (error) {
      console.error('Error fetching docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = docs.filter(doc => 
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const DocList = ({ type }) => {
    const items = filteredDocs.filter(d => 
      type === 'all' ? true : type === 'assignment' ? (d.document_type === 'assignment' || d.document_type === 'exam') : d.document_type === 'document'
    );

    if (items.length === 0) {
      return (
        <div className="text-center py-20 text-muted-foreground">
          <p>No documents found.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((doc, idx) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card 
              className="p-4 glass-hover group cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-300" 
              onClick={() => setSelectedDoc(doc)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${doc.document_type === 'document' ? 'bg-blue-500/20 text-blue-500' : 'bg-orange-500/20 text-orange-500'}`}>
                  {doc.document_type === 'document' ? <FileText className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate group-hover:text-primary transition-colors">{doc.file_name}</h4>
                  <p className="text-sm text-muted-foreground">{doc.subject} • {doc.teacher_name}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      setSelectedDoc(doc);
                    }}
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(doc.file_url, '_blank');
                    }}
                  >
                    <Download className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Documents - Student Portal</title>
      </Helmet>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-glow">Study Materials</h1>
            <p className="text-muted-foreground">Access all your course documents and assignments</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search docs..." 
              className="pl-9 bg-card/50 backdrop-blur-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full md:w-auto bg-card/50 backdrop-blur-sm p-1 rounded-xl border border-white/5">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Files</TabsTrigger>
            <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Notes & Slides</TabsTrigger>
            <TabsTrigger value="assignments" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Assignments</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="all"><DocList type="all" /></TabsContent>
            <TabsContent value="notes"><DocList type="document" /></TabsContent>
            <TabsContent value="assignments"><DocList type="assignment" /></TabsContent>
          </div>
        </Tabs>

        {/* Secure Internal Document Viewer */}
        <DocumentViewerModal 
          isOpen={!!selectedDoc} 
          onClose={() => setSelectedDoc(null)} 
          doc={selectedDoc} 
        />
      </div>
    </>
  );
};

export default DocsPage;
