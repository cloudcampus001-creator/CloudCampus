import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Download } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';

const LibraryPage = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const schoolId = localStorage.getItem('schoolId');

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase
        .from('library_books')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBooks(data || []);
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>School Library - Parent Dashboard</title>
        <meta name="description" content="Access digital textbooks and library resources" />
      </Helmet>

      <div className="p-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-8">School Library</h1>

          {loading ? (
            <div className="text-center text-slate-400 py-12">Loading library...</div>
          ) : books.length === 0 ? (
            <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-800">
              <Book className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">The Library is Empty</h2>
              <p className="text-slate-400">No textbooks have been published by the admin yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-900/50 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-800 hover:border-indigo-600/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-600/20"
                >
                  {book.cover_image_url && (
                    <img
                      src={book.cover_image_url}
                      alt={book.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{book.title}</h3>
                    {book.author && (
                      <p className="text-sm text-slate-400 mb-4">by {book.author}</p>
                    )}
                    <Button
                      onClick={() => window.open(book.file_url, '_blank')}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default LibraryPage;