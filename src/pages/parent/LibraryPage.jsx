/**
 * LibraryPage.jsx — Parent Portal
 * Fully redesigned: glassmorphism cards, book cover gradients,
 * search, filtering — no more hardcoded slate-900 colours.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Download, Search, BookMarked, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { cn } from '@/lib/utils';

/* ── deterministic cover gradient from title ─────────────── */
const GRADIENTS = [
  'from-blue-500 to-cyan-400',
  'from-purple-500 to-pink-400',
  'from-emerald-500 to-teal-400',
  'from-orange-500 to-amber-400',
  'from-indigo-500 to-violet-400',
  'from-rose-500 to-pink-400',
  'from-cyan-500 to-sky-400',
  'from-lime-500 to-green-400',
];
const gradientFor = (str = '') => GRADIENTS[str.charCodeAt(0) % GRADIENTS.length];

/* ── stagger animation ─────────────────────────────────────── */
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const LibraryPage = () => {
  const [books, setBooks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase.from('library_books').select('*')
        .eq('school_id', schoolId).order('created_at', { ascending: false });
      if (error) throw error;
      setBooks(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Helmet><title>School Library — CloudCampus</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-8">

        {/* ── Header ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              School Library
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {loading ? 'Loading resources…' : `${books.length} resource${books.length !== 1 ? 's' : ''} available`}
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search books…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 focus:border-blue-500/40 rounded-xl"
            />
          </div>
        </motion.div>

        {/* ── Loading ──────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading library…</span>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────── */}
        {!loading && books.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-4">
            <div className="p-5 rounded-3xl bg-blue-500/10">
              <BookOpen className="w-12 h-12 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Library is Empty</h2>
              <p className="text-muted-foreground text-sm mt-1">No books have been published yet. Check back soon!</p>
            </div>
          </motion.div>
        )}

        {/* ── No search results ────────────────────────────── */}
        {!loading && books.length > 0 && filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 flex flex-col items-center text-center gap-3">
            <BookMarked className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No books match "<strong>{search}</strong>"</p>
          </motion.div>
        )}

        {/* ── Book grid ─────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <motion.div variants={stagger} initial="hidden" animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((book) => (
              <motion.div key={book.id} variants={fadeUp}>
                <div className="glass rounded-2xl overflow-hidden hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group flex flex-col h-full">

                  {/* Cover */}
                  <div className="relative h-44 overflow-hidden shrink-0">
                    {book.cover_image_url ? (
                      <img src={book.cover_image_url} alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', gradientFor(book.title))}>
                        <BookOpen className="w-14 h-14 text-white/60" />
                      </div>
                    )}
                    {/* overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-base leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="text-sm text-muted-foreground mt-1">by {book.author}</p>
                      )}
                      {book.description && (
                        <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">{book.description}</p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => window.open(book.file_url, '_blank')}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => window.open(book.file_url, '_blank')}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 text-muted-foreground hover:text-blue-400 transition-all active:scale-95"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </>
  );
};

export default LibraryPage;
