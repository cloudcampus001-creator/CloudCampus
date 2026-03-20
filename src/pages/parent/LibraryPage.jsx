/**
 * LibraryPage.jsx — Parent portal
 *
 * Books open INSIDE the platform in a fullscreen PDF viewer.
 * There is no download button, no external link, no window.open.
 * The iframe uses sandbox + CSP to block right-click save-as.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, X, LayoutGrid, List,
  BookMarked, Tag, FileText, Clock,
  Eye, ZoomIn, ZoomOut, ChevronLeft,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import { BookSkeleton } from '@/components/Skeletons';

/* ── colour presets ──────────────────────────────────────── */
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

/* ── Skeleton for list view ──────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════
   PDF VIEWER MODAL
   Opens the PDF inside an iframe — no download possible.
   - sandbox="allow-scripts allow-same-origin" blocks save-as
   - onContextMenu blocked on the wrapper
   - PDF is loaded via Google Docs Viewer as fallback for
     browsers that block inline PDFs
══════════════════════════════════════════════════════════ */
const PDFViewer = ({ book, onClose }) => {
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(true);

  // Use Google Docs viewer to strip download UI from the browser's native PDF viewer
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(book.file_url)}&embedded=true`;

  // Block keyboard shortcuts for saving
  useEffect(() => {
    const blockSave = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', blockSave, { capture: true });
    return () => document.removeEventListener('keydown', blockSave, { capture: true });
  }, [onClose]);

  const [c1, c2] = colorsFor(book.title);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#1a1a2e]"
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── Top bar ── */}
      <div className="h-14 flex items-center justify-between px-4 shrink-0 border-b border-white/10"
        style={{ background: `linear-gradient(135deg, ${c1}20, ${c2}10)` }}>

        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate leading-tight">{book.title}</p>
            {book.author && (
              <p className="text-[11px] text-white/50 truncate">{book.author}</p>
            )}
          </div>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-all">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/15 transition-all">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={onClose}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-red-500/30 hover:text-red-400 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Viewer area ── */}
      <div className="flex-1 relative overflow-hidden"
        onContextMenu={e => e.preventDefault()}>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-[#1a1a2e]">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              <BookOpen className="h-8 w-8 text-white animate-pulse" />
            </div>
            <p className="text-sm text-white/60">Loading document…</p>
          </div>
        )}

        {/* The iframe — zoom applied via CSS transform on wrapper */}
        <div className="w-full h-full overflow-auto"
          onContextMenu={e => e.preventDefault()}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: '100%', height: zoom > 100 ? `${zoom}%` : '100%' }}>
            <iframe
              src={viewerUrl}
              title={book.title}
              className="w-full h-full border-0"
              style={{ minHeight: 'calc(100vh - 56px)' }}
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={() => setLoading(false)}
              onContextMenu={e => e.preventDefault()}
            />
          </div>
        </div>

        {/* Invisible overlay to block right-click on the iframe edge area */}
        <div className="absolute inset-x-0 top-0 h-2 z-20" onContextMenu={e => e.preventDefault()} />
        <div className="absolute inset-x-0 bottom-0 h-2 z-20" onContextMenu={e => e.preventDefault()} />
      </div>

      {/* ── Bottom bar ── */}
      <div className="h-10 flex items-center justify-center shrink-0 border-t border-white/5 bg-black/20">
        <p className="text-[11px] text-white/30 select-none">
          CloudCampus — Viewing only · Not available for download
        </p>
      </div>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
const LibraryPage = () => {
  const { t } = useLanguage();
  const schoolId = localStorage.getItem('schoolId');

  const [books,    setBooks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [subject,  setSubject]  = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [viewing,  setViewing]  = useState(null); // book being viewed in PDF viewer
  const [infoBook, setInfoBook] = useState(null); // book info sheet

  /* ── fetch ───────────────────────────────────────────── */
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('library_books').select('*')
          .eq('school_id', parseInt(schoolId, 10))
          .order('created_at', { ascending: false });
        setBooks(data || []);
      } finally { setLoading(false); }
    })();
  }, [schoolId]);

  /* ── derived ─────────────────────────────────────────── */
  const allSubjects = ['all', ...Array.from(new Set(books.map(b => b.subject).filter(Boolean))).sort()];

  const filtered = books.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || b.title?.toLowerCase().includes(q)
      || b.author?.toLowerCase().includes(q)
      || b.description?.toLowerCase().includes(q);
    const matchSubject = subject === 'all' || b.subject === subject;
    return matchSearch && matchSubject;
  });

  /* ── render ──────────────────────────────────────────── */
  return (
    <>
      <Helmet><title>{t('schoolLibrary')} — CloudCampus</title></Helmet>

      {/* Full-screen PDF viewer */}
      <AnimatePresence>
        {viewing && <PDFViewer book={viewing} onClose={() => setViewing(null)} />}
      </AnimatePresence>

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
              {/* View toggle */}
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

          {/* ── Loading ─────────────────────────────────── */}
          {loading && (
            viewMode === 'grid'
              ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">{[0,1,2,3,4,5].map(i => <BookSkeleton key={i} />)}</div>
              : <div className="space-y-3">{[0,1,2,3].map(i => <RowSkeleton key={i} />)}</div>
          )}

          {/* ── Empty ───────────────────────────────────── */}
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

          {/* ── No results ──────────────────────────────── */}
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
                const isNew = idx === 0 && !search && subject === 'all';
                return (
                  <motion.div key={book.id} variants={fadeUp}
                    className="glass rounded-2xl overflow-hidden transition-all duration-300 group flex flex-col h-full cursor-pointer active:scale-[0.99] hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/8"
                    onClick={() => setViewing(book)}>

                    {/* Cover */}
                    <div className="relative h-44 overflow-hidden shrink-0">
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          draggable={false} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                          <BookOpen className="h-14 w-14 text-white/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        {isNew && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500 text-white shadow-lg">NEW</span>
                        )}
                        {book.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-black/40 backdrop-blur-sm text-white border border-white/20">
                            {book.subject}
                          </span>
                        )}
                      </div>

                      {/* "Read" overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-sm">
                          <Eye className="h-4 w-4" /> Read
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                          {book.title}
                        </h3>
                        {book.author && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <span className="h-2.5 w-2.5 shrink-0 opacity-60">✍</span> {book.author}
                          </p>
                        )}
                        {book.description && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed opacity-70">
                            {book.description}
                          </p>
                        )}
                      </div>

                      {/* Footer meta */}
                      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        {book.file_size && (
                          <span className="flex items-center gap-0.5">
                            <FileText className="h-2.5 w-2.5" /> {fmtSize(book.file_size)}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 ml-auto">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Read button */}
                      <button
                        onClick={e => { e.stopPropagation(); setViewing(book); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all active:scale-95"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                        <Eye className="h-3.5 w-3.5" /> Read
                      </button>
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
                    onClick={() => setViewing(book)}>

                    {book.cover_image_url ? (
                      <img src={book.cover_image_url} alt={book.title}
                        className="w-10 h-14 object-cover rounded-xl shrink-0 border border-white/10"
                        draggable={false} />
                    ) : (
                      <div className="w-10 h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                        <BookOpen className="h-5 w-5 text-white/60" />
                      </div>
                    )}

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

                    <button
                      onClick={e => { e.stopPropagation(); setViewing(book); }}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                      <Eye className="h-3.5 w-3.5" /> Read
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

        </div>
      </PageTransition>
    </>
  );
};

export default LibraryPage;
