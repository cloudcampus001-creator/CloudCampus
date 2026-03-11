import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Download, Search, ExternalLink, User, X, BookMarked } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Input } from '@/components/ui/input';
import { Helmet } from 'react-helmet';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/PageTransition';
import GlassPopup from '@/components/GlassPopup';
import { BookSkeleton } from '@/components/Skeletons';

const GRADIENTS = [
  'from-blue-500 to-cyan-400',    'from-purple-500 to-pink-400',
  'from-emerald-500 to-teal-400', 'from-orange-500 to-amber-400',
  'from-indigo-500 to-violet-400','from-rose-500 to-pink-400',
  'from-cyan-500 to-sky-400',     'from-lime-500 to-green-400',
];
const gradientFor = (s = '') => GRADIENTS[s.charCodeAt(0) % GRADIENTS.length];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp  = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const LibraryPage = () => {
  const { t } = useLanguage();
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('library_books').select('*')
          .eq('school_id', schoolId).order('created_at', { ascending: false });
        setBooks(data || []);
      } finally { setLoading(false); }
    })();
  }, [schoolId]);

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Helmet><title>{t('schoolLibrary')} — CloudCampus</title></Helmet>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                {t('schoolLibrary')}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {loading ? t('loading') : `${books.length} ${t('documents').toLowerCase()}`}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('searchBooksAuthors')}
                className="pl-9 bg-white/5 border-white/10 focus:border-blue-500/40 rounded-xl h-10" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Skeletons */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0,1,2,3,4,5].map(i => <BookSkeleton key={i} />)}
            </div>
          )}

          {/* Empty library */}
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

          {/* No search results */}
          {!loading && books.length > 0 && filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-2xl p-12 flex flex-col items-center text-center gap-3">
              <BookMarked className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noBooksMatch')} "<strong>{search}</strong>"</p>
            </motion.div>
          )}

          {/* Book grid */}
          {!loading && filtered.length > 0 && (
            <motion.div variants={stagger} initial="hidden" animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((book) => (
                <motion.div key={book.id} variants={fadeUp}>
                  <div
                    className="glass rounded-2xl overflow-hidden hover:border-blue-500/25 hover:shadow-lg hover:shadow-blue-500/8 transition-all duration-300 group flex flex-col h-full cursor-pointer active:scale-[0.99]"
                    onClick={() => setSelected(book)}
                  >
                    {/* Cover */}
                    <div className="relative h-44 overflow-hidden shrink-0">
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className={cn('w-full h-full bg-gradient-to-br flex items-center justify-center', gradientFor(book.title))}>
                          <BookOpen className="h-14 w-14 text-white/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Info */}
                    <div className="p-5 flex flex-col flex-1 gap-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-sm leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">{book.title}</h3>
                        {book.author && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-2.5 w-2.5" />{book.author}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={e => { e.stopPropagation(); window.open(book.file_url, '_blank'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95">
                          <Download className="h-3.5 w-3.5" /> {t('download')}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(book); }}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/30 text-muted-foreground hover:text-blue-400 transition-all active:scale-95"
                          title={t('bookDetails')}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

        </div>
      </PageTransition>

      {/* Glass popup — book detail */}
      <GlassPopup
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected?.author ? `${t('author')}: ${selected.author}` : undefined}
        variant="sheet"
        maxWidth="max-w-sm"
        footer={
          selected && (
            <button onClick={() => window.open(selected.file_url, '_blank')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]">
              <Download className="h-4 w-4" /> {t('download')}
            </button>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Cover preview */}
            <div className={cn('w-full h-40 rounded-2xl overflow-hidden',
              !selected.cover_image_url && `bg-gradient-to-br ${gradientFor(selected.title)} flex items-center justify-center`)}>
              {selected.cover_image_url
                ? <img src={selected.cover_image_url} alt={selected.title} className="w-full h-full object-cover" />
                : <BookOpen className="h-16 w-16 text-white/50" />}
            </div>
            {/* Description */}
            {selected.description && (
              <div className="p-4 rounded-2xl bg-black/3 dark:bg-white/4">
                <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{selected.description}</p>
              </div>
            )}
            {/* Meta */}
            <div className="flex gap-3">
              {selected.author && (
                <div className="flex-1 p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">{t('author')}</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{selected.author}</p>
                </div>
              )}
              <div className="flex-1 p-3 rounded-xl bg-black/3 dark:bg-white/4 text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">{t('addedOn')}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {new Date(selected.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}
      </GlassPopup>
    </>
  );
};

export default LibraryPage;
