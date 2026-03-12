/**
 * AdminSubjectsLibraryPage.jsx
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, Plus, X, Loader2, Save, Book,
  Trash2, Library, Hash, School, ExternalLink,
  Upload, FileText, Image, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

/* ── Gradient section header ── */
const SectionHeader = ({ icon: Icon, title, desc, color }) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
    <div>
      <h2 className="font-black text-lg">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </div>
);

/* ── File drop zone ── */
const FileDropZone = ({ accept, label, hint, file, onFile }) => {
  const ref = useRef();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      className={cn('relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
        over ? 'border-indigo-500/60 bg-indigo-500/8' : file ? 'border-green-500/40 bg-green-500/6' : 'border-white/15 hover:border-white/25 hover:bg-white/4')}>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      {file ? (
        <>
          <CheckCircle2 className="h-7 w-7 text-green-400" />
          <p className="text-sm font-semibold text-green-400 text-center truncate max-w-full px-4">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </>
      ) : (
        <>
          <Upload className="h-7 w-7 text-muted-foreground" />
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════ */
const AdminSubjectsLibraryPage = () => {
  const { toast }   = useToast();
  const { t }       = useLanguage();
  const schoolId    = localStorage.getItem('schoolId');

  /* Subjects */
  const [subjects,   setSubjects]   = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [subjLoading,setSubjLoading]= useState(true);
  const [addingSubj, setAddingSubj] = useState(false);

  /* Coefficients */
  const [classes,        setClasses]        = useState([]);
  const [selectedClass,  setSelectedClass]  = useState('');
  const [coefficients,   setCoefficients]   = useState({});
  const [coefLoading,    setCoefLoading]    = useState(false);
  const [savingCoef,     setSavingCoef]     = useState(false);

  /* Library */
  const [books,         setBooks]         = useState([]);
  const [booksLoading,  setBooksLoading]  = useState(true);
  const [showBookForm,  setShowBookForm]  = useState(false);
  const [savingBook,    setSavingBook]    = useState(false);
  const [uploadProgress,setUploadProgress]= useState(0);
  const [bookFile,      setBookFile]      = useState(null);
  const [coverFile,     setCoverFile]     = useState(null);
  const [newBook, setNewBook] = useState({ title: '', author: '', subject: '', file_url: '', cover_image_url: '' });

  /* ── Init ── */
  useEffect(() => {
    if (!schoolId) return;
    fetchSubjects(); fetchClasses(); fetchBooks();
  }, [schoolId]);

  useEffect(() => { if (selectedClass) fetchCoefficients(selectedClass); }, [selectedClass]);

  /* ── Subjects ── */
  const fetchSubjects = async () => {
    setSubjLoading(true);
    const { data } = await supabase.from('school_subjects').select('*').eq('school_id', parseInt(schoolId)).order('name');
    setSubjects(data || []);
    setSubjLoading(false);
  };

  const handleAddSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ variant: 'destructive', title: t('duplicate'), description: t('subjectAlreadyExists') }); return;
    }
    setAddingSubj(true);
    try {
      const { data, error } = await supabase.from('school_subjects').insert({ school_id: parseInt(schoolId), name }).select().single();
      if (error) throw error;
      setSubjects(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSubject('');
      toast({ title: '✓ ' + t('subjectAdded') });
    } catch (err) { toast({ variant: 'destructive', title: t('error'), description: err.message }); }
    finally { setAddingSubj(false); }
  };

  const handleDeleteSubject = async (id, name) => {
    const { error } = await supabase.from('school_subjects').delete().eq('id', id);
    if (!error) { setSubjects(prev => prev.filter(s => s.id !== id)); toast({ title: `"${name}" ${t('subjectRemoved')}` }); }
  };

  /* ── Coefficients ── */
  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').eq('school_id', parseInt(schoolId)).order('name');
    setClasses(data || []);
  };

  const fetchCoefficients = async (classId) => {
    setCoefLoading(true);
    const { data } = await supabase.from('subject_coefficients').select('*').eq('class_id', parseInt(classId));
    const coefMap = {};
    subjects.forEach(s => { coefMap[s.name] = '1'; });
    (data || []).forEach(row => { coefMap[row.subject_name] = String(row.coefficient); });
    setCoefficients(coefMap);
    setCoefLoading(false);
  };

  const handleSaveCoefficients = async () => {
    if (!selectedClass) return;
    setSavingCoef(true);
    try {
      const rows = Object.entries(coefficients)
        .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([subject_name, coef]) => ({ school_id: parseInt(schoolId), class_id: parseInt(selectedClass), subject_name, coefficient: parseFloat(coef) }));
      const { error } = await supabase.from('subject_coefficients').upsert(rows, { onConflict: 'class_id,subject_name' });
      if (error) throw error;
      toast({ title: '✓ ' + t('save'), className: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' });
    } catch (err) { toast({ variant: 'destructive', title: t('error'), description: err.message }); }
    finally { setSavingCoef(false); }
  };

  /* ── Library ── */
  const fetchBooks = async () => {
    setBooksLoading(true);
    const { data } = await supabase.from('library_books').select('*').eq('school_id', parseInt(schoolId)).order('created_at', { ascending: false });
    setBooks(data || []);
    setBooksLoading(false);
  };

  const uploadFile = async (file, folder) => {
    const ext   = file.name.split('.').pop();
    const path  = `${folder}/${schoolId}_${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('library-books').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('library-books').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!newBook.title.trim()) {
      toast({ variant: 'destructive', title: t('titleRequired') }); return;
    }
    if (!bookFile && !newBook.file_url.trim()) {
      toast({ variant: 'destructive', title: t('fileRequired'), description: t('fileRequiredDesc') }); return;
    }
    setSavingBook(true);
    setUploadProgress(10);
    try {
      let fileUrl = newBook.file_url.trim();
      let coverUrl = newBook.cover_image_url.trim();

      if (bookFile) {
        setUploadProgress(30);
        fileUrl = await uploadFile(bookFile, 'pdfs');
        setUploadProgress(70);
      }
      if (coverFile) {
        coverUrl = await uploadFile(coverFile, 'covers');
        setUploadProgress(85);
      }

      const { data, error } = await supabase.from('library_books').insert({
        school_id: parseInt(schoolId),
        title:           newBook.title.trim(),
        author:          newBook.author.trim() || null,
        subject:         newBook.subject.trim() || null,
        file_url:        fileUrl,
        cover_image_url: coverUrl || null,
      }).select().single();

      if (error) throw error;
      setUploadProgress(100);
      setBooks(prev => [data, ...prev]);
      setNewBook({ title: '', author: '', subject: '', file_url: '', cover_image_url: '' });
      setBookFile(null); setCoverFile(null);
      setShowBookForm(false);
      toast({ title: '✓ ' + t('bookPublished'), className: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' });
    } catch (err) { toast({ variant: 'destructive', title: t('uploadFailed'), description: err.message }); }
    finally { setSavingBook(false); setUploadProgress(0); }
  };

  const handleDeleteBook = async (id, title) => {
    const { error } = await supabase.from('library_books').delete().eq('id', id);
    if (!error) { setBooks(prev => prev.filter(b => b.id !== id)); toast({ title: `"${title}" ${t('subjectRemoved')}` }); }
  };

  const selectedClassName = classes.find(c => c.id.toString() === selectedClass)?.name || '';

  return (
    <>
      <Helmet><title>{t('subjectsLibraryTitle')} · Admin</title></Helmet>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8 pb-6 max-w-4xl">

        {/* Page header */}
        <motion.div variants={fadeUp}>
          <h1 className="text-3xl font-black tracking-tight">{t('subjectsLibraryTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subjectsLibraryDesc')}</p>
        </motion.div>

        {/* ═══ SECTION 1: Subject Catalogue ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-violet-500/20"
          style={{ borderTop: '2px solid #8b5cf650' }}>
          <SectionHeader icon={BookMarked} title={t('subjectCatalogue')} color="#8b5cf6"
            desc={t('subjectCatalogueDesc')} />
          <div className="flex gap-2 mb-5">
            <Input placeholder={t('subjectInputPlaceholder')}
              className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-violet-500/50"
              value={newSubject} onChange={e => setNewSubject(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubject(); } }} />
            <button onClick={handleAddSubject} disabled={addingSubj || !newSubject.trim()}
              className="px-4 h-11 rounded-xl font-bold text-sm text-white flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)' }}>
              {addingSubj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('add')}
            </button>
          </div>
          {subjLoading ? (
            <div className="flex gap-2 flex-wrap">{[1,2,3,4].map(i => <div key={i} className="animate-pulse h-8 w-24 rounded-full bg-white/5" />)}</div>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">{t('noSubjectsAddFirst')}</p>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <motion.div key={s.id} variants={fadeUp}
                  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: '#8b5cf615', border: '1px solid #8b5cf630', color: '#c4b5fd' }}>
                  {s.name}
                  <button onClick={() => handleDeleteSubject(s.id, s.name)}
                    className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-violet-500/30 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            {subjects.length} {subjects.length !== 1 ? t('subjectsCount') : t('subjectCount')} {t('inCatalogue')}
          </p>
        </motion.div>

        {/* ═══ SECTION 2: Coefficients ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-indigo-500/20"
          style={{ borderTop: '2px solid #6366f150' }}>
          <SectionHeader icon={Hash} title={t('subjectCoefficients')} color="#6366f1"
            desc={t('subjectCoefficientsDesc')} />
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-5">
            <span className="text-sm font-semibold shrink-0 text-muted-foreground">{t('selectClassLabel')}</span>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="h-11 w-full sm:w-64 bg-white/5 border-white/10 rounded-xl">
                <SelectValue placeholder={t('chooseClassPlaceholder')} />
              </SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!selectedClass ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">{t('configureCoefficients')}</p>
          ) : coefLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">{t('noSubjectsAddFirst')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                {subjects.map(s => (
                  <div key={s.name} className="flex items-center justify-between p-3 rounded-xl bg-white/4 border border-white/8 hover:border-indigo-500/25 transition-colors">
                    <span className="text-sm font-medium truncate mr-2">{s.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input type="number" className="w-16 h-8 text-center text-sm bg-white/5 border-white/10 rounded-lg px-1"
                        value={coefficients[s.name] ?? '1'}
                        onChange={e => { const v = e.target.value; if (v === '' || (parseFloat(v) >= 0 && parseFloat(v) <= 20)) setCoefficients(p => ({ ...p, [s.name]: v })); }}
                        step="0.5" min="0" max="20" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveCoefficients} disabled={savingCoef}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.25)' }}>
                {savingCoef ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('saveFor')} {selectedClassName}
              </button>
            </>
          )}
        </motion.div>

        {/* ═══ SECTION 3: Library ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-emerald-500/20"
          style={{ borderTop: '2px solid #22c55e50' }}>
          <div className="flex items-start justify-between mb-5">
            <SectionHeader icon={Library} title={t('schoolLibraryAdminTitle')} color="#22c55e"
              desc={t('schoolLibraryAdminDesc')} />
            <button onClick={() => setShowBookForm(v => !v)}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shrink-0 mt-0.5',
                showBookForm ? 'bg-white/8 border-white/15 text-muted-foreground' : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20')}>
              {showBookForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showBookForm ? t('cancel') : t('addBook')}
            </button>
          </div>

          {/* Add book form */}
          <AnimatePresence>
            {showBookForm && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                onSubmit={handleAddBook}
                className="overflow-hidden mb-6">
                <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-4">
                  <h3 className="font-black text-emerald-400 flex items-center gap-2"><Book className="h-4 w-4" /> {t('newTextbook')}</h3>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('titleLabel')} <span className="text-red-400">*</span></Label>
                      <Input placeholder="e.g. Advanced Mathematics Vol. 1"
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40"
                        value={newBook.title} onChange={e => setNewBook(p => ({ ...p, title: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('authorLabel')}</Label>
                      <Input placeholder="e.g. P. Tchatchoua"
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40"
                        value={newBook.author} onChange={e => setNewBook(p => ({ ...p, author: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('subjectSelectLabel')}</Label>
                    <Select value={newBook.subject} onValueChange={v => setNewBook(p => ({ ...p, subject: v }))}>
                      <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl"><SelectValue placeholder={t('chooseClassPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— {t('selectNone')} —</SelectItem>
                        {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* PDF upload */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400" /> {t('pdfFileLabel')} <span className="text-red-400">*</span>
                    </Label>
                    <FileDropZone accept=".pdf,application/pdf" label={t('dropPDF')}
                      hint={t('pdfHint')} file={bookFile} onFile={setBookFile} />
                    {!bookFile && (
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/8" />
                        <span className="text-xs text-muted-foreground">{t('orPasteURL')}</span>
                        <div className="h-px flex-1 bg-white/8" />
                      </div>
                    )}
                    {!bookFile && (
                      <Input placeholder={t('externalPDFLink')}
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40"
                        value={newBook.file_url} onChange={e => setNewBook(p => ({ ...p, file_url: e.target.value }))} />
                    )}
                  </div>

                  {/* Cover upload */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5 text-emerald-400" /> {t('coverImageLabel')}
                    </Label>
                    <FileDropZone accept="image/*" label={t('dropCoverImage')}
                      hint={t('coverHint')} file={coverFile} onFile={setCoverFile} />
                  </div>

                  {/* Progress bar */}
                  {savingBook && uploadProgress > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t('uploading')}</span><span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-emerald-500"
                          animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }} />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={savingBook}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)', boxShadow: '0 6px 20px rgba(34,197,94,0.25)' }}>
                    {savingBook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {savingBook ? t('uploading') : t('publishToLibrary')}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Books list */}
          {booksLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="animate-pulse h-16 rounded-2xl bg-white/5" />)}</div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Library className="h-12 w-12 opacity-15 mb-3" />
              <p className="text-sm">{t('noBooksPublished')}</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
              {books.map(book => (
                <motion.div key={book.id} variants={fadeUp}
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-white/8 hover:border-emerald-500/25 bg-white/3 hover:bg-white/5 transition-all">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title}
                      className="w-10 h-12 object-cover rounded-xl shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-10 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Book className="h-5 w-5 text-emerald-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{book.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {book.author && <span className="text-xs text-muted-foreground truncate">{book.author}</span>}
                      {book.subject && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 font-semibold shrink-0">
                          {book.subject}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={book.file_url} target="_blank" rel="noopener noreferrer"
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      title={t('openNewTab')}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => handleDeleteBook(book.id, book.title)}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            {books.length} {books.length !== 1 ? t('booksCount') : t('bookCount')} {t('inCatalogue')}
          </p>
        </motion.div>
      </motion.div>
    </>
  );
};

export default AdminSubjectsLibraryPage;
