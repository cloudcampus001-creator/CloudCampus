import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, BookOpen, Download, Search, Eye, Calendar, User, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import PageTransition from '@/components/PageTransition';
import { DocSkeleton } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const card    = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32 } } };

const DocsPage = () => {
  const { t } = useLanguage();
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDoc, setSelectedDoc] = useState(null);

  const classId = localStorage.getItem('classId');

  const TABS = [
    { id: 'all',        label: t('allFiles')    },
    { id: 'document',   label: t('notesSlides') },
    { id: 'assignment', label: t('assignments') },
  ];

  useEffect(() => {
    if (!classId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('documents').select('*')
          .eq('class_id', parseInt(classId)).order('created_at', { ascending: false });
        setDocs(data || []);
      } finally { setLoading(false); }
    })();
  }, [classId]);

  const isAssignment = (d) => d.document_type === 'assignment' || d.document_type === 'exam';

  const filtered = docs.filter(d => {
    const matchSearch =
      d.file_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.subject?.toLowerCase().includes(search.toLowerCase());
    const matchTab =
      activeTab === 'all'        ? true :
      activeTab === 'assignment' ? isAssignment(d) :
      d.document_type === 'document';
    return matchSearch && matchTab;
  });

  return (
    <>
      <Helmet><title>{t('documents')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                {t('studyMaterials')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {loading ? t('loading') : `${docs.length} ${t('documents').toLowerCase()}`}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('searchFilesSubjects')}
                className="pl-9 bg-white/5 border-white/10 focus:border-blue-500/40 rounded-xl h-10" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex gap-2 p-1 bg-white/4 border border-white/8 rounded-2xl w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}>
                {tab.label}
                {!loading && (
                  <span className={cn('ml-2 text-[10px]', activeTab === tab.id ? 'text-white/70' : 'text-muted-foreground')}>
                    {tab.id === 'all'        ? docs.length :
                     tab.id === 'assignment' ? docs.filter(isAssignment).length :
                     docs.filter(d => d.document_type === 'document').length}
                  </span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Skeletons */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0,1,2,3,4,5].map(i => <DocSkeleton key={i} />)}
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl p-16 flex flex-col items-center text-center gap-4">
              <div className="p-5 rounded-3xl bg-blue-500/10"><FileText className="h-10 w-10 text-blue-400" /></div>
              <div>
                <h2 className="font-bold text-base">
                  {search ? `${t('searchNoResults')} "${search}"` : t('noFilesYet')}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{t('teacherNoUpload')}</p>
              </div>
            </motion.div>
          )}

          {/* Grid */}
          {!loading && filtered.length > 0 && (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((doc) => (
                <motion.div key={doc.id} variants={card}>
                  <div
                    className={cn(
                      'glass rounded-2xl p-4 flex gap-4 group cursor-pointer',
                      'hover:border-blue-500/20 hover:bg-white/4 transition-all duration-200 active:scale-[0.99]',
                      isAssignment(doc) ? 'border-l-2 border-l-orange-500/50' : 'border-l-2 border-l-blue-500/50'
                    )}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className={cn('p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-105',
                      isAssignment(doc) ? 'bg-orange-500/15' : 'bg-blue-500/15')}>
                      {isAssignment(doc)
                        ? <BookOpen className="h-5 w-5 text-orange-400" />
                        : <FileText  className="h-5 w-5 text-blue-400"   />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate group-hover:text-blue-400 transition-colors">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.subject}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{doc.teacher_name}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setSelectedDoc(doc); }}
                        className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors" title={t('previewDoc')}>
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); window.open(doc.file_url, '_blank'); }}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors" title={t('download')}>
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

        </div>
      </PageTransition>

      <DocumentViewerModal isOpen={!!selectedDoc} onClose={() => setSelectedDoc(null)} doc={selectedDoc} />
    </>
  );
};

export default DocsPage;
