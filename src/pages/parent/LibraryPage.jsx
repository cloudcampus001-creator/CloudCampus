/**
 * LibraryPage.jsx — Parent portal
 *
 * Features (rebuilt from scratch):
 *  - Beautiful card grid with cover art / gradient fallbacks
 *  - List / Grid view toggle
 *  - Subject filter pills
 *  - Live search (title, author, description)
 *  - Download count incremented on each download
 *  - File size badge
 *  - GlassPopup book detail sheet with description
 *  - Skeleton loading states
 *  - "Featured" highlight on the newest book
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Download, Search, ExternalLink,
  User, X, LayoutGrid, List, BookMarked, Tag,
  FileText, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { BookSkeleton } from '@/components/Skeletons';

/* ── colour presets ───────────────────────────────────────── */
const GRADIENTS = [
  ['#3b82f6', '#06b6d4'], ['#8b5cf6', '#ec4899'],
  ['#10b981', '#14b8a6'], ['#f97316', '#f59e0b'],
  ['#6366f1', '#8b5cf6'], ['#f43f5e', '#ec4899'],
  ['#06b6d4', '#0ea5e9'], ['#84cc16', '#22c55e'],
];
const colorsFor = (s = '') => GRADIENTS[(s.charCodeAt(0) || 0) % GRADIENTS.length];

/* ── animation presets ───────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

/* ── helpers ─────────────────────────────────────────────── */
const fmtSize = (bytes) => {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/* ── skeleton row (for list view) ───────────────────────── */
const RowSkeleton = () => (
  <div className="animate-pulse flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
    <div className="w-10 h-14 rounded-xl bg-white/10 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 bg-white/10 rounded-full w-1/2" />
      <div className="h-2.5 bg-white/6 rounded-full w-1/4" />
    </div>
    <div className="w-20 h-8 rounded-xl bg-white/8 shrink-0" />
  </div>
);

/* ══════════════════════════════════════════════════════════ */
const LibraryPage = () => {
  const { t } = useLanguage();
  const schoolId = localStorage.getItem('schoolId');

  const [books,      setBooks]    = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [search,     setSearch]   = useState('');
  const [subject,    setSubject]  = useState('all');
  const [viewMode,   setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selected,   setSelected] = useState(null);
  const [downloading,setDownloading] = useState(null);

  /* ── fetch books ─────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('library_books').select('*')
          .eq('school_id', parseInt(schoolId, 10))
          .order('created_at', { ascending: false });
        if (!error) setBooks(data || []);
      } finally { setLoading(false); }
    })();
  }, [schoolId]);

  /* ── increment download count ─────────────────────────── */
  const handleDownload = useCallback(async (book) => {
    setDownloading(book.id);
    try {
      window.open(book.file_url, '_blank');
      // Increment in background — non-critical
      await supabase.from('library_books')
        .update({ download_count: (book.download_count || 0) + 1 })
        .eq('id', book.id);
      setBooks(prev => prev.map(b => b.id === book.id
        ? { ...b, download_count: (b.download_count || 0) + 1 }
        : b
      ));
    } finally {
      setTimeout(() => setDownloading(null), 600);
    }
  }, []);

  /* ── derived ─────────────────────────────────────────── */
  const allSubjects = ['all', ...Array.from(new Set(books.map(b => b.subject).filter(Boolean))).sort()];

  const filtered = books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.title?.toLowerCase().includes(q)
      || b.author?.toLowerCase().includes(q)
      || b.description?.toLowerCase().includes(q);
    const matchSubject = subject === 'all' || b.subject === subject;
    return matchSearch && matchSubject;
  });

  const [featured, ...rest] = filtered;

  /* ── render ──────────────────────────────────────────── */
  return (
    <>
      <Helmet><title>{t('schoolLibrary')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-7 pb-8">

          {/* ── Header ─────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                {t('schoolLibrary')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {loading ? t('loading') : `${books.length} ${books.length !== 1 ? t('booksCount') : t('bookCount')}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t('searchBooksAuthors')}
                  className="pl-9 bg-white/5 border-white/10 focus:border-blue-500/40 rounded-xl h-10" />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* View mode */}
              <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-xl gap-0.5 shrink-0">
                {[['grid', LayoutGrid], ['list', List]].map(([id, Icon]) => (
                  <button key={id} onClick={() => setViewMode(id)}
                    className={cn('p-1.5 rounded-lg transition-all',
                      viewMode === id ? 'bg-blue-500/20 text-blue-400' : 'text-muted-foreground hover:text-foreground')}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Subject filter pills ────────────────────── */}
          {!loading && allSubjects.length > 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="flex gap-2 flex-wrap">
              {allSubjects.map(s => (
                <button key={s} onClick={() => setSubject(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200',
                    subject === s
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent shadow-md shadow-blue-500/25'
                      : 'bg-white/4 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/8',
                  )}>
                  {s !== 'all' && <Tag className="h-3 w-3" />}
                  {s === 'all' ? t('all') : s}
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Loading skeletons ───────────────────────── */}
          {loading && (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[0,1,2,3,4,5].map(i => <BookSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-3">{[0,1,2,3].map(i => <RowSkeleton key={i} />)}</div>
            )
          )}

          {/* ── Empty library ───────────────────────────── */}
          {!loading && books.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-5 rounded-3xl bg-blue-500/10"><BookOpen className="h-12 w-12 text-blue-400" /></div>
              <div>
                <h2 className="font-bold text-lg">{t('libraryEmpty')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('libraryEmptyDesc')}</p>
              </div>
            </motion.div>
          )}

          {/* ── No search results ───────────────────────── */}
          {!loading && books.length > 0 && filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl p-12 flex flex-col items-center text-center gap-3">
              <BookMarked className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('noBooksMatch')} "<strong>{search}</strong>"
              </p>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              GRID VIEW
          ════════════════════════════════════════════ */}
          {!loading && filtered.length > 0 && viewMode === 'grid' && (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((book, idx) => {
                const [c1, c2] = colorsFor(book.title);
                const isFeatured = idx === 0 && !search && subject === 'all';
                return (
                  <motion.div key={book.id} variants={fadeUp}
                    className={cn(
                      'glass rounded-2xl overflow-hidden transition-all duration-300 group flex flex-col h-full cursor-pointer active:scale-[0.99]',
                      isFeatured
                        ? 'border border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/15 sm:col-span-2 lg:col-span-1'
                        : 'hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/8',
                    )}
                    onClick={() => setSelected(book)}>

                    {/* Cover */}
                    <div className="relative h-44 overflow-hidden shrink-0">
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                          <BookOpen className="h-14 w-14 text-white/40" />
                        </div>
                      )}

                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        {isFeatured && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500 text-white shadow-lg shadow-blue-500/40">
                            NEW
                          </span>
                        )}
                        {book.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-black/40 backdrop-blur-sm text-white border border-white/20">
                            {book.subject}
                          </span>
                        )}
                      </div>

                      {/* Download count */}
                      {(book.download_count || 0) > 0 && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold bg-black/40 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/15">
                          <Download className="h-2.5 w-2.5" />
                          {book.download_count}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                          {book.title}
                        </h3>
                        {book.author && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-2.5 w-2.5 shrink-0" /> {book.author}
                          </p>
                        )}
                        {book.description && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed opacity-70">
                            {book.description}
                          </p>
                        )}
                      </div>

                      {/* Meta footer */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {book.file_size && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <FileText className="h-2.5 w-2.5" /> {fmtSize(book.file_size)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={e => { e.stopPropagation(); handleDownload(book); }}
                          disabled={downloading === book.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-70"
                          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 4px 12px ${c1}40` }}>
                          <Download className="h-3.5 w-3.5" />
                          {downloading === book.id ? 'Opening…' : t('download')}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(book); }}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 text-muted-foreground hover:text-blue-400 transition-all active:scale-95"
                          title={t('bookDetails')}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              LIST VIEW
          ════════════════════════════════════════════ */}
          {!loading && filtered.length > 0 && viewMode === 'list' && (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
              {filtered.map(book => {
                const [c1, c2] = colorsFor(book.title);
                return (
                  <motion.div key={book.id} variants={fadeUp}
                    className="group flex items-center gap-4 p-4 rounded-2xl border border-white/8 hover:border-blue-500/25 bg-white/3 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                    onClick={() => setSelected(book)}>

                    {/* Cover thumbnail */}
                    {book.cover_image_url ? (
                      <img src={book.cover_image_url} alt={book.title}
                        className="w-10 h-14 object-cover rounded-xl shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-10 h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                        <BookOpen className="h-5 w-5 text-white/60" />
                      </div>
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-blue-400 transition-colors">{book.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {book.author && <span className="text-xs text-muted-foreground truncate">{book.author}</span>}
                        {book.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold shrink-0">
                            {book.subject}
                          </span>
                        )}
                        {book.file_size && (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtSize(book.file_size)}</span>
                        )}
                      </div>
                      {book.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 opacity-70">{book.description}</p>
                      )}
                    </div>

                    {/* Download count */}
                    {(book.download_count || 0) > 0 && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Download className="h-3 w-3" />
                        <span>{book.download_count}</span>
                      </div>
                    )}

                    {/* Download button */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(book); }}
                      disabled={downloading === book.id}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-70"
                      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                      <Download className="h-3.5 w-3.5" />
                      {downloading === book.id ? '…' : t('download')}
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

        </div>
      </PageTransition>

      {/* ── Book detail popup ────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <GlassPopup
            open={!!selected}
            onClose={() => setSelected(null)}
            title={selected.title}
            subtitle={selected.author ? `${t('author')}: ${selected.author}` : undefined}
            variant="sheet"
            maxWidth="max-w-sm"
            footer={(
              <button
                onClick={() => { handleDownload(selected); }}
                disabled={downloading === selected.id}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-70"
                style={{ background: `linear-gradient(135deg, ${colorsFor(selected.title)[0]}, ${colorsFor(selected.title)[1]})` }}>
                <Download className="h-4 w-4" />
                {downloading === selected.id ? 'Opening…' : t('download')}
              </button>
            )}>
            <div className="space-y-4">
              {/* Cover */}
              <div className="w-full h-44 rounded-2xl overflow-hidden">
                {selected.cover_image_url ? (
                  <img src={selected.cover_image_url} alt={selected.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${colorsFor(selected.title)[0]}, ${colorsFor(selected.title)[1]})` }}>
                    <BookOpen className="h-16 w-16 text-white/40" />
                  </div>
                )}
              </div>

              {/* Subject badge */}
              {selected.subject && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Tag className="h-3 w-3" /> {selected.subject}
                </span>
              )}

              {/* Description */}
              {selected.description && (
                <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/4">
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{selected.description}</p>
                </div>
              )}

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-2">
                {selected.author && (
                  <div className="p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">{t('author')}</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{selected.author}</p>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">{t('addedOn')}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{fmtDate(selected.created_at)}</p>
                </div>
                {selected.file_size && (
                  <div className="p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Size</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{fmtSize(selected.file_size)}</p>
                  </div>
                )}
                {(selected.download_count || 0) > 0 && (
                  <div className="p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Downloads</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{selected.download_count}</p>
                  </div>
                )}
              </div>
            </div>
          </GlassPopup>
        )}
      </AnimatePresence>
    </>
  );
};

export default LibraryPage;
