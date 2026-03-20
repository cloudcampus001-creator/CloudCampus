/**
 * AdminSubjectsLibraryPage.jsx
 *
 * Section 1 — Subject Catalogue  (unchanged logic)
 * Section 2 — Subject Coefficients  (unchanged logic)
 * Section 3 — School Library  (REBUILT FROM SCRATCH)
 *
 * Library changes vs old version:
 *  - Storage bucket fixed: 'library_books' (underscore)
 *  - description + file_size + download_count columns
 *  - Search bar + subject filter in admin list
 *  - Delete removes storage files (best-effort)
 *  - Responsive book list with cover thumbnail, size badge
 *
 * SQL (run once in Supabase):
 *   ALTER TABLE library_books
 *     ADD COLUMN IF NOT EXISTS description    TEXT,
 *     ADD COLUMN IF NOT EXISTS file_size      BIGINT,
 *     ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked, Plus, X, Loader2, Save, BookOpen,
  Trash2, Library, Hash, ExternalLink,
  Upload, FileText, Image as ImageIcon, CheckCircle2,
  Search, Filter, Download,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const BUCKET = 'library_books';

const fmtSize = (bytes) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const GRADIENTS = [
  'from-blue-500 to-cyan-400', 'from-purple-500 to-pink-400',
  'from-emerald-500 to-teal-400', 'from-orange-500 to-amber-400',
  'from-indigo-500 to-violet-400', 'from-rose-500 to-pink-400',
];
const gradientFor = (s = '') => GRADIENTS[(s.charCodeAt(0) || 0) % GRADIENTS.length];

const SectionHeader = ({ icon: Icon, title, desc, color }) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
    <div>
      <h2 className="font-black text-lg">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </div>
);

const FileDropZone = ({ accept, label, hint, file, onFile, disabled }) => {
  const ref = useRef();
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (disabled) return; const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      onClick={() => !disabled && ref.current?.click()}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        over ? 'border-emerald-500/60 bg-emerald-500/8'
          : file ? 'border-green-500/40 bg-green-500/6'
          : 'border-white/15 hover:border-white/25 hover:bg-white/4',
      )}>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      {file ? (
        <>
          <CheckCircle2 className="h-7 w-7 text-green-400" />
          <p className="text-sm font-semibold text-green-400 text-center truncate max-w-full px-4">{file.name}</p>
          <p className="text-xs text-muted-foreground">{fmtSize(file.size)}</p>
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

const UploadBar = ({ progress }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>Uploading…</span><span>{progress}%</span>
    </div>
    <div className="h-2 rounded-full bg-white/8 overflow-hidden">
      <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
        animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
    </div>
  </div>
);

const EMPTY_BOOK = { title: '', author: '', subject: '', description: '', file_url: '' };

const AdminSubjectsLibraryPage = () => {
  const { toast } = useToast();
  const { t }     = useLanguage();
  const schoolId  = localStorage.getItem('schoolId');
  const sid       = parseInt(schoolId, 10);

  // Subjects
  const [subjects,    setSubjects]    = useState([]);
  const [newSubject,  setNewSubject]  = useState('');
  const [subjLoading, setSubjLoading] = useState(true);
  const [addingSubj,  setAddingSubj]  = useState(false);

  // Coefficients
  const [classes,       setClasses]       = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [coefficients,  setCoefficients]  = useState({});
  const [coefLoading,   setCoefLoading]   = useState(false);
  const [savingCoef,    setSavingCoef]    = useState(false);

  // Library
  const [books,          setBooks]          = useState([]);
  const [booksLoading,   setBooksLoading]   = useState(true);
  const [showBookForm,   setShowBookForm]   = useState(false);
  const [savingBook,     setSavingBook]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bookFile,       setBookFile]       = useState(null);
  const [coverFile,      setCoverFile]      = useState(null);
  const [newBook,        setNewBook]        = useState(EMPTY_BOOK);
  const [libSearch,      setLibSearch]      = useState('');
  const [libFilter,      setLibFilter]      = useState('all');
  const [deletingId,     setDeletingId]     = useState(null);

  useEffect(() => {
    if (!schoolId) return;
    fetchSubjects(); fetchClasses(); fetchBooks();
  }, [schoolId]);

  useEffect(() => { if (selectedClass) fetchCoefficients(selectedClass); }, [selectedClass, subjects]);

  /* ── subjects ── */
  const fetchSubjects = async () => {
    setSubjLoading(true);
    const { data } = await supabase.from('school_subjects').select('*').eq('school_id', sid).order('name');
    setSubjects(data || []); setSubjLoading(false);
  };

  const handleAddSubject = async () => {
    const name = newSubject.trim(); if (!name) return;
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ variant: 'destructive', title: t('duplicate'), description: t('subjectAlreadyExists') }); return;
    }
    setAddingSubj(true);
    try {
      const { data, error } = await supabase.from('school_subjects').insert({ school_id: sid, name }).select().single();
      if (error) throw error;
      setSubjects(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSubject(''); toast({ title: '✓ ' + t('subjectAdded') });
    } catch (err) { toast({ variant: 'destructive', title: t('error'), description: err.message }); }
    finally { setAddingSubj(false); }
  };

  const handleDeleteSubject = async (id, name) => {
    const { error } = await supabase.from('school_subjects').delete().eq('id', id);
    if (!error) { setSubjects(prev => prev.filter(s => s.id !== id)); toast({ title: `"${name}" ${t('subjectRemoved')}` }); }
  };

  /* ── coefficients ── */
  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').eq('school_id', sid).order('name');
    setClasses(data || []);
  };

  const fetchCoefficients = async (classId) => {
    setCoefLoading(true);
    const { data } = await supabase.from('subject_coefficients').select('*').eq('class_id', parseInt(classId));
    const m = {}; subjects.forEach(s => { m[s.name] = '1'; });
    (data || []).forEach(r => { m[r.subject_name] = String(r.coefficient); });
    setCoefficients(m); setCoefLoading(false);
  };

  const handleSaveCoefficients = async () => {
    if (!selectedClass) return; setSavingCoef(true);
    try {
      const rows = Object.entries(coefficients).filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([subject_name, coef]) => ({ school_id: sid, class_id: parseInt(selectedClass), subject_name, coefficient: parseFloat(coef) }));
      const { error } = await supabase.from('subject_coefficients').upsert(rows, { onConflict: 'class_id,subject_name' });
      if (error) throw error;
      toast({ title: '✓ ' + t('save'), className: 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400' });
    } catch (err) { toast({ variant: 'destructive', title: t('error'), description: err.message }); }
    finally { setSavingCoef(false); }
  };

  /* ── library: fetch ── */
  const fetchBooks = useCallback(async () => {
    setBooksLoading(true);
    const { data, error } = await supabase.from('library_books').select('*').eq('school_id', sid).order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: t('error'), description: error.message });
    setBooks(data || []); setBooksLoading(false);
  }, [sid]);

  /* ── library: upload helper ── */
  const uploadToBucket = async (file, folder) => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 60);
    const path = `${folder}/${sid}_${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: urlData.publicUrl, path };
  };

  /* ── library: add book ── */
  const handleAddBook = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!newBook.title.trim()) { toast({ variant: 'destructive', title: t('titleRequired') }); return; }
    if (!bookFile && !newBook.file_url.trim()) { toast({ variant: 'destructive', title: t('fileRequired'), description: t('fileRequiredDesc') }); return; }

    setSavingBook(true); setUploadProgress(5);
    try {
      let fileUrl  = newBook.file_url.trim();
      let coverUrl = null;
      let fileSize = null;

      if (bookFile) {
        setUploadProgress(20);
        const r = await uploadToBucket(bookFile, 'pdfs');
        fileUrl = r.url; fileSize = bookFile.size;
        setUploadProgress(65);
      }
      if (coverFile) {
        const r = await uploadToBucket(coverFile, 'covers');
        coverUrl = r.url; setUploadProgress(85);
      }
      setUploadProgress(90);

      const { data, error } = await supabase.from('library_books').insert({
        school_id: sid,
        title:           newBook.title.trim(),
        author:          newBook.author.trim()      || null,
        subject:         newBook.subject            || null,
        description:     newBook.description.trim() || null,
        file_url:        fileUrl,
        cover_image_url: coverUrl,
        file_size:       fileSize,
        download_count:  0,
      }).select().single();

      if (error) throw error;
      setUploadProgress(100);
      setBooks(prev => [data, ...prev]);
      setNewBook(EMPTY_BOOK); setBookFile(null); setCoverFile(null);
      setShowBookForm(false);
      toast({ title: '✓ ' + t('bookPublished'), className: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' });
    } catch (err) {
      toast({ variant: 'destructive', title: t('uploadFailed'), description: err.message });
    } finally {
      setSavingBook(false); setTimeout(() => setUploadProgress(0), 800);
    }
  };

  /* ── library: delete book + storage ── */
  const handleDeleteBook = async (book) => {
    setDeletingId(book.id);
    try {
      const { error } = await supabase.from('library_books').delete().eq('id', book.id);
      if (error) throw error;
      const tryRemove = async (url) => {
        if (!url) return;
        try {
          const marker = `/${BUCKET}/`;
          const idx = url.indexOf(marker);
          if (idx !== -1) await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(idx + marker.length))]);
        } catch (_) {}
      };
      await tryRemove(book.file_url);
      await tryRemove(book.cover_image_url);
      setBooks(prev => prev.filter(b => b.id !== book.id));
      toast({ title: `"${book.title}" deleted` });
    } catch (err) {
      toast({ variant: 'destructive', title: t('error'), description: err.message });
    } finally { setDeletingId(null); }
  };

  const selectedClassName = classes.find(c => c.id.toString() === selectedClass)?.name || '';
  const bookSubjects = ['all', ...Array.from(new Set(books.map(b => b.subject).filter(Boolean))).sort()];
  const filteredBooks = books.filter(b => {
    const q = libSearch.toLowerCase();
    const matchSearch = !q || b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q) || b.description?.toLowerCase().includes(q);
    const matchFilter = libFilter === 'all' || b.subject === libFilter;
    return matchSearch && matchFilter;
  });

  return (
    <>
      <Helmet><title>{t('subjectsLibraryTitle')} · Admin</title></Helmet>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-8 pb-6 max-w-4xl">

        <motion.div variants={fadeUp}>
          <h1 className="text-3xl font-black tracking-tight">{t('subjectsLibraryTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subjectsLibraryDesc')}</p>
        </motion.div>

        {/* ═══ Subjects ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-violet-500/20" style={{ borderTop: '2px solid #8b5cf650' }}>
          <SectionHeader icon={BookMarked} title={t('subjectCatalogue')} color="#8b5cf6" desc={t('subjectCatalogueDesc')} />
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

        {/* ═══ Coefficients ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-indigo-500/20" style={{ borderTop: '2px solid #6366f150' }}>
          <SectionHeader icon={Hash} title={t('subjectCoefficients')} color="#6366f1" desc={t('subjectCoefficientsDesc')} />
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

        {/* ═══ Library ═══ */}
        <motion.div variants={fadeUp} className="glass rounded-2xl p-6 border border-emerald-500/20" style={{ borderTop: '2px solid #22c55e50' }}>

          <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
            <SectionHeader icon={Library} title={t('schoolLibraryAdminTitle')} color="#22c55e" desc={t('schoolLibraryAdminDesc')} />
            <button
              onClick={() => { setShowBookForm(v => !v); if (showBookForm) { setNewBook(EMPTY_BOOK); setBookFile(null); setCoverFile(null); } }}
              className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all shrink-0 mt-0.5',
                showBookForm ? 'bg-white/8 border-white/15 text-muted-foreground' : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/20')}>
              {showBookForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showBookForm ? t('cancel') : t('addBook')}
            </button>
          </div>

          {/* Add book form */}
          <AnimatePresence>
            {showBookForm && (
              <motion.div key="book-form"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                className="overflow-hidden mb-6">
                <div className="p-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 space-y-5">
                  <h3 className="font-black text-emerald-400 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> {t('newTextbook')}
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('titleLabel')} <span className="text-red-400">*</span></Label>
                      <Input placeholder="e.g. Advanced Mathematics Vol. 1"
                        className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40"
                        value={newBook.title} onChange={e => setNewBook(p => ({ ...p, title: e.target.value }))} />
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
                    <Select value={newBook.subject || "__none__"} onValueChange={v => setNewBook(p => ({ ...p, subject: v === "__none__" ? "" : v }))}>
                      <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl">
                        <SelectValue placeholder="— none —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— none —</SelectItem>
                        {subjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description (optional)</Label>
                    <Textarea placeholder="Short description of the book content…"
                      className="bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40 resize-none min-h-[72px]"
                      value={newBook.description} onChange={e => setNewBook(p => ({ ...p, description: e.target.value }))} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400" /> {t('pdfFileLabel')} <span className="text-red-400">*</span>
                    </Label>
                    <FileDropZone accept=".pdf,application/pdf" label={t('dropPDF')} hint={t('pdfHint')}
                      file={bookFile} onFile={f => { setBookFile(f); setNewBook(p => ({ ...p, file_url: '' })); }} disabled={savingBook} />
                    {bookFile ? (
                      <button type="button" onClick={() => setBookFile(null)}
                        className="text-xs text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                        <X className="h-3 w-3" /> Remove file
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-white/8" />
                          <span className="text-xs text-muted-foreground">{t('orPasteURL')}</span>
                          <div className="h-px flex-1 bg-white/8" />
                        </div>
                        <Input placeholder={t('externalPDFLink')}
                          className="h-11 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40 font-mono text-xs"
                          value={newBook.file_url} onChange={e => setNewBook(p => ({ ...p, file_url: e.target.value }))} />
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-emerald-400" /> {t('coverImageLabel')}
                    </Label>
                    <FileDropZone accept="image/*" label={t('dropCoverImage')} hint={t('coverHint')}
                      file={coverFile} onFile={setCoverFile} disabled={savingBook} />
                    {coverFile && (
                      <button type="button" onClick={() => setCoverFile(null)}
                        className="text-xs text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                        <X className="h-3 w-3" /> Remove cover
                      </button>
                    )}
                  </div>

                  {savingBook && uploadProgress > 0 && <UploadBar progress={uploadProgress} />}

                  <button type="button" onClick={handleAddBook} disabled={savingBook}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)', boxShadow: '0 6px 20px rgba(34,197,94,0.25)' }}>
                    {savingBook
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('uploading')}</>
                      : <><Upload className="h-4 w-4" /> {t('publishToLibrary')}</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search + filter */}
          {!booksLoading && books.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Search books, authors…" value={libSearch} onChange={e => setLibSearch(e.target.value)}
                  className="pl-9 h-10 bg-white/5 border-white/10 rounded-xl focus:border-emerald-500/40 text-sm" />
                {libSearch && (
                  <button onClick={() => setLibSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {bookSubjects.length > 2 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={libFilter} onValueChange={setLibFilter}>
                    <SelectTrigger className="h-10 w-[160px] bg-white/5 border-white/10 rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bookSubjects.map(s => (
                        <SelectItem key={s} value={s}>{s === 'all' ? 'All subjects' : s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Book list */}
          {booksLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="animate-pulse h-20 rounded-2xl bg-white/5" />)}</div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Library className="h-12 w-12 opacity-15 mb-3" />
              <p className="text-sm font-medium">{t('noBooksPublished')}</p>
              <p className="text-xs opacity-60 mt-1">Click "Add Book" above to get started.</p>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="h-8 w-8 opacity-20 mb-2" />
              <p className="text-sm">No books match your search.</p>
            </div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
              {filteredBooks.map(book => (
                <motion.div key={book.id} variants={fadeUp}
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-white/8 hover:border-emerald-500/25 bg-white/3 hover:bg-white/5 transition-all duration-200">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title}
                      className="w-10 h-14 object-cover rounded-xl shrink-0 border border-white/10" />
                  ) : (
                    <div className={cn('w-10 h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br', gradientFor(book.title))}>
                      <BookOpen className="h-5 w-5 text-white/70" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{book.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {book.author && <span className="text-xs text-muted-foreground truncate">{book.author}</span>}
                      {book.subject && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 font-semibold shrink-0">{book.subject}</span>
                      )}
                      {book.file_size && (
                        <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtSize(book.file_size)}</span>
                      )}
                    </div>
                    {book.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 opacity-70">{book.description}</p>
                    )}
                  </div>
                  {(book.download_count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Download className="h-3 w-3" /><span>{book.download_count}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={book.file_url} target="_blank" rel="noopener noreferrer"
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title="Open PDF">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => handleDeleteBook(book)} disabled={deletingId === book.id}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-60">
                      {deletingId === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            {filteredBooks.length === books.length
              ? `${books.length} ${books.length !== 1 ? t('booksCount') : t('bookCount')} ${t('inCatalogue')}`
              : `${filteredBooks.length} / ${books.length} books`}
          </p>
        </motion.div>
      </motion.div>
    </>
  );
};

export default AdminSubjectsLibraryPage;
