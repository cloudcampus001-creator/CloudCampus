/**
 * AdminSubjectsLibraryPage.jsx
 * src/pages/admin/AdminSubjectsLibraryPage.jsx
 *
 * Three sections in one page:
 *  1. Subject Catalogue  — add / delete school-wide subjects
 *  2. Coefficients       — assign a coefficient per subject per class
 *  3. School Library     — upload/manage textbooks that parents can access
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BookMarked, Plus, X, Loader2, Save, Book,
  Trash2, Library, Hash, School, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Helmet } from 'react-helmet';

const AdminSubjectsLibraryPage = () => {
  const { toast } = useToast();
  const schoolId = localStorage.getItem('schoolId');

  // ── 1. Subject Catalogue state ───────────────────────────────────────────
  const [subjects, setSubjects]         = useState([]);
  const [newSubject, setNewSubject]     = useState('');
  const [subjLoading, setSubjLoading]   = useState(true);
  const [addingSubj, setAddingSubj]     = useState(false);

  // ── 2. Coefficients state ────────────────────────────────────────────────
  const [classes, setClasses]             = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [coefficients, setCoefficients]   = useState({}); // { subjectName: coef }
  const [coefLoading, setCoefLoading]     = useState(false);
  const [savingCoef, setSavingCoef]       = useState(false);

  // ── 3. Library state ─────────────────────────────────────────────────────
  const [books, setBooks]             = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [showBookForm, setShowBookForm] = useState(false);
  const [savingBook, setSavingBook]     = useState(false);
  const [newBook, setNewBook]           = useState({
    title: '', author: '', subject: '', file_url: '', cover_image_url: '',
  });

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    fetchSubjects();
    fetchClasses();
    fetchBooks();
  }, [schoolId]);

  // When class selection changes → load existing coefficients
  useEffect(() => {
    if (!selectedClass) return;
    fetchCoefficients(selectedClass);
  }, [selectedClass]);

  // ─────────────────────────────────────────────────────────────────────────
  // SUBJECTS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchSubjects = async () => {
    setSubjLoading(true);
    const { data } = await supabase
      .from('school_subjects')
      .select('*')
      .eq('school_id', parseInt(schoolId))
      .order('name');
    setSubjects(data || []);
    setSubjLoading(false);
  };

  const handleAddSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Duplicate', description: 'Subject already exists.' });
      return;
    }
    setAddingSubj(true);
    try {
      const { data, error } = await supabase
        .from('school_subjects')
        .insert({ school_id: parseInt(schoolId), name })
        .select().single();
      if (error) throw error;
      setSubjects(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSubject('');
      toast({ title: 'Subject added', description: `"${name}" added to catalogue.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setAddingSubj(false);
    }
  };

  const handleDeleteSubject = async (id, name) => {
    const { error } = await supabase.from('school_subjects').delete().eq('id', id);
    if (!error) {
      setSubjects(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Removed', description: `"${name}" removed.` });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COEFFICIENTS
  // ─────────────────────────────────────────────────────────────────────────
  const fetchClasses = async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', parseInt(schoolId))
      .order('name');
    setClasses(data || []);
  };

  const fetchCoefficients = async (classId) => {
    setCoefLoading(true);
    const { data } = await supabase
      .from('subject_coefficients')
      .select('*')
      .eq('class_id', parseInt(classId));

    // Start with all school subjects defaulting to coefficient 1
    const coefMap = {};
    subjects.forEach(s => { coefMap[s.name] = '1'; });
    // Override with saved values
    (data || []).forEach(row => { coefMap[row.subject_name] = String(row.coefficient); });
    setCoefficients(coefMap);
    setCoefLoading(false);
  };

  const handleSaveCoefficients = async () => {
    if (!selectedClass) return;
    setSavingCoef(true);
    try {
      // Build upsert rows for all subjects that have a coefficient set
      const rows = Object.entries(coefficients)
        .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([subject_name, coef]) => ({
          school_id:    parseInt(schoolId),
          class_id:     parseInt(selectedClass),
          subject_name,
          coefficient:  parseFloat(coef),
        }));

      const { error } = await supabase
        .from('subject_coefficients')
        .upsert(rows, { onConflict: 'class_id,subject_name' });

      if (error) throw error;
      toast({ title: 'Coefficients saved', description: 'All coefficients updated for this class.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingCoef(false);
    }
  };

  const updateCoef = (subjectName, value) => {
    // Only allow numbers between 0 and 20
    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 20)) {
      setCoefficients(prev => ({ ...prev, [subjectName]: value }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LIBRARY
  // ─────────────────────────────────────────────────────────────────────────
  const fetchBooks = async () => {
    setBooksLoading(true);
    const { data } = await supabase
      .from('library_books')
      .select('*')
      .eq('school_id', parseInt(schoolId))
      .order('created_at', { ascending: false });
    setBooks(data || []);
    setBooksLoading(false);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!newBook.title.trim() || !newBook.file_url.trim()) {
      toast({ variant: 'destructive', title: 'Required fields', description: 'Title and file URL are required.' });
      return;
    }
    setSavingBook(true);
    try {
      const { data, error } = await supabase
        .from('library_books')
        .insert({
          school_id:       parseInt(schoolId),
          title:           newBook.title.trim(),
          author:          newBook.author.trim() || null,
          subject:         newBook.subject.trim() || null,
          file_url:        newBook.file_url.trim(),
          cover_image_url: newBook.cover_image_url.trim() || null,
        })
        .select().single();
      if (error) throw error;
      setBooks(prev => [data, ...prev]);
      setNewBook({ title: '', author: '', subject: '', file_url: '', cover_image_url: '' });
      setShowBookForm(false);
      toast({ title: 'Book added', description: `"${data.title}" added to library.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setSavingBook(false);
    }
  };

  const handleDeleteBook = async (id, title) => {
    const { error } = await supabase.from('library_books').delete().eq('id', id);
    if (!error) {
      setBooks(prev => prev.filter(b => b.id !== id));
      toast({ title: 'Removed', description: `"${title}" removed from library.` });
    }
  };

  const selectedClassName = classes.find(c => c.id.toString() === selectedClass)?.name || '';

  return (
    <>
      <Helmet><title>Subjects & Library — Admin</title></Helmet>

      <div className="space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects &amp; Library</h1>
          <p className="text-muted-foreground">
            Manage the school subject catalogue, per-class coefficients, and the digital library.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 — Subject Catalogue
        ══════════════════════════════════════════════════════════════ */}
        <Card className="glass border-t-4 border-t-violet-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-violet-500" />
              Subject Catalogue
            </CardTitle>
            <CardDescription>
              Define all subjects taught in your school. These appear as options when assigning
              subjects to classes and when creating timetable entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Mathematics, Physics, History…"
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubject(); } }}
                className="bg-background/50"
              />
              <Button
                onClick={handleAddSubject}
                disabled={addingSubj || !newSubject.trim()}
                className="bg-violet-600 hover:bg-violet-700 shrink-0"
              >
                {addingSubj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Add
              </Button>
            </div>

            {subjLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
            ) : subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 italic">
                No subjects yet. Type a name above and click Add.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {subjects.map(s => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full
                               bg-violet-500/15 border border-violet-500/30 text-sm font-medium text-violet-300"
                  >
                    {s.name}
                    <button
                      onClick={() => handleDeleteSubject(s.id, s.name)}
                      className="h-4 w-4 rounded-full flex items-center justify-center
                                 hover:bg-violet-500/40 transition-colors ml-0.5"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''} in catalogue
            </p>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — Coefficients per Class
        ══════════════════════════════════════════════════════════════ */}
        <Card className="glass border-t-4 border-t-indigo-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-500" />
              Subject Coefficients by Class
            </CardTitle>
            <CardDescription>
              Assign a coefficient (weighting) to each subject for a specific class.
              The same subject can have a different coefficient in different classes.
              Default is 1 if not set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Class selector */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Label className="text-sm font-medium shrink-0">Select Class:</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full sm:w-64 bg-background/50">
                  <SelectValue placeholder="Choose a class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClass && (
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                  <School className="w-3 h-3 mr-1" />{selectedClassName}
                </Badge>
              )}
            </div>

            {!selectedClass ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Select a class above to configure subject coefficients.
              </p>
            ) : coefLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                No subjects in catalogue yet. Add subjects above first.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {subjects.map(s => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between p-3 rounded-lg
                                 bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors"
                    >
                      <span className="text-sm font-medium truncate mr-3">{s.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground">Coef</span>
                        <Input
                          type="number"
                          className="w-16 h-8 text-center text-sm bg-background/50 px-1"
                          value={coefficients[s.name] ?? '1'}
                          onChange={e => updateCoef(s.name, e.target.value)}
                          step="0.5"
                          min="0"
                          max="20"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleSaveCoefficients}
                  disabled={savingCoef}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {savingCoef
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Save className="h-4 w-4 mr-2" />}
                  Save Coefficients for {selectedClassName}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 — School Library
        ══════════════════════════════════════════════════════════════ */}
        <Card className="glass border-t-4 border-t-emerald-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Library className="w-5 h-5 text-emerald-500" />
                  School Library
                </CardTitle>
                <CardDescription>
                  Upload textbooks and resources that parents and students can download.
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowBookForm(v => !v)}
                variant={showBookForm ? 'secondary' : 'default'}
                className={!showBookForm ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                size="sm"
              >
                {showBookForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {showBookForm ? 'Cancel' : 'Add Book'}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Add book form */}
            {showBookForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-4"
              >
                <h3 className="text-sm font-semibold text-emerald-400">New Textbook</h3>
                <form onSubmit={handleAddBook} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Title <span className="text-red-400">*</span></Label>
                      <Input
                        placeholder="e.g. Advanced Mathematics Vol. 1"
                        value={newBook.title}
                        onChange={e => setNewBook(p => ({ ...p, title: e.target.value }))}
                        className="bg-background/50"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Author</Label>
                      <Input
                        placeholder="e.g. P. Tchatchoua"
                        value={newBook.author}
                        onChange={e => setNewBook(p => ({ ...p, author: e.target.value }))}
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Subject</Label>
                      <Select
                        value={newBook.subject}
                        onValueChange={v => setNewBook(p => ({ ...p, subject: v }))}
                      >
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Choose subject…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {subjects.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Cover Image URL</Label>
                      <Input
                        placeholder="https://… (optional)"
                        value={newBook.cover_image_url}
                        onChange={e => setNewBook(p => ({ ...p, cover_image_url: e.target.value }))}
                        className="bg-background/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>File URL (PDF / Download Link) <span className="text-red-400">*</span></Label>
                    <Input
                      placeholder="https://…"
                      value={newBook.file_url}
                      onChange={e => setNewBook(p => ({ ...p, file_url: e.target.value }))}
                      className="bg-background/50"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={savingBook}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {savingBook
                      ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      : <Book className="h-4 w-4 mr-2" />}
                    Add to Library
                  </Button>
                </form>
              </motion.div>
            )}

            {/* Books list */}
            {booksLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : books.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Library className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No books in library yet. Click "Add Book" to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {books.map((book, idx) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between p-3 rounded-lg
                               bg-white/5 border border-white/10 hover:border-emerald-500/30
                               group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {book.cover_image_url ? (
                        <img
                          src={book.cover_image_url}
                          alt={book.title}
                          className="w-10 h-12 object-cover rounded shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-12 rounded bg-emerald-500/20 flex items-center justify-center shrink-0">
                          <Book className="w-5 h-5 text-emerald-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{book.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {book.author && (
                            <span className="text-xs text-muted-foreground truncate">{book.author}</span>
                          )}
                          {book.subject && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">{book.subject}</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <a
                        href={book.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-400
                                   hover:bg-emerald-500/10 transition-colors"
                        title="Open file"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteBook(book.id, book.title)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400
                                   hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {books.length} book{books.length !== 1 ? 's' : ''} in library
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminSubjectsLibraryPage;
