
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2, AlertCircle, FileText } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

export function DocumentViewerModal({ isOpen, onClose, doc }) {
  const [contentUrl, setContentUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset state when doc changes
    setContentUrl(null);
    setError(null);
    
    if (isOpen && doc?.file_url) {
      setLoading(true);
      
      // Securely fetch the document as a blob to hide the source URL and any tokens
      fetch(doc.file_url)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Failed to load document: ${res.statusText}`);
          const blob = await res.blob();
          // Create a local object URL (blob:...) which is secure and temporary
          const objectUrl = URL.createObjectURL(blob);
          setContentUrl(objectUrl);
        })
        .catch(err => {
          console.error("Secure viewer fetch failed:", err);
          setError(err);
          // Fallback: If secure fetch fails (e.g. CORS), we might still want to let them download it
          // But for "internal viewer" strictly, we show error or fallback UI
        })
        .finally(() => {
          setLoading(false);
        });
    }

    return () => {
      // Cleanup the blob URL to prevent memory leaks
      if (contentUrl && contentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(contentUrl);
      }
    };
  }, [isOpen, doc]);

  if (!doc) return null;

  // Determine file type for rendering
  const isPDF = doc.file_name?.toLowerCase().endsWith('.pdf') || doc.file_url?.toLowerCase().endsWith('.pdf') || doc.file_type === 'application/pdf';
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(doc.file_name) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(doc.file_url);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col bg-slate-950 border-slate-800 text-slate-100 gap-0 shadow-2xl overflow-hidden outline-none">
        
        {/* Header - Internal Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-10">
           <div className="flex items-center gap-3 overflow-hidden">
             <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 hidden sm:block">
                <FileText className="w-5 h-5" />
             </div>
             <div className="flex flex-col overflow-hidden">
               <h3 className="font-semibold text-sm md:text-base truncate text-slate-200">{doc.file_name}</h3>
               <span className="text-xs text-slate-500 truncate">{doc.subject} • {doc.teacher_name}</span>
             </div>
           </div>
           
           <div className="flex items-center gap-2 flex-shrink-0">
             {/* Download button still allows getting the file, but user explicitly asks for it */}
             <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                onClick={() => window.open(doc.file_url, '_blank')}
                title="Download Original File"
             >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
             </Button>
             
             <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block"></div>

             <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
                onClick={onClose}
             >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
             </Button>
           </div>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 bg-slate-950/50 relative flex items-center justify-center overflow-hidden">
           <AnimatePresence mode="wait">
             {loading ? (
                <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }} 
                   animate={{ opacity: 1 }} 
                   exit={{ opacity: 0 }}
                   className="flex flex-col items-center gap-4"
                >
                   <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                   <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-slate-300">Loading Securely</p>
                      <p className="text-xs text-slate-500">Decrypting and fetching content...</p>
                   </div>
                </motion.div>
             ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-8 max-w-md bg-slate-900/50 rounded-2xl border border-slate-800"
                >
                   <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                   <h3 className="text-lg font-medium text-white mb-2">Preview Unavailable</h3>
                   <p className="text-slate-400 mb-6 text-sm">
                     We couldn't load the secure preview for this document. It might be restricted or an unsupported format.
                   </p>
                   <Button onClick={() => window.open(doc.file_url, '_blank')} variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                     Try Opening Externally
                   </Button>
                </motion.div>
             ) : (
                <motion.div 
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex items-center justify-center bg-white/5"
                >
                    {isPDF ? (
                        <iframe 
                            src={`${contentUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                            className="w-full h-full border-none"
                            title="Secure PDF Viewer"
                        />
                    ) : isImage ? (
                        <img 
                            src={contentUrl} 
                            alt={doc.file_name} 
                            className="max-w-full max-h-full object-contain p-4 shadow-2xl"
                        />
                    ) : (
                       <div className="text-center p-8 bg-slate-900/50 rounded-2xl border border-slate-800">
                          <div className="mb-4 text-slate-500">
                             <FileText className="h-16 w-16 mx-auto opacity-50" />
                          </div>
                          <h3 className="text-lg font-medium text-slate-200 mb-2">No Preview Available</h3>
                          <p className="text-slate-400 mb-6 max-w-xs mx-auto text-sm">
                             This file type ({doc.file_name.split('.').pop()}) doesn't support secure in-app previewing.
                          </p>
                          <Button onClick={() => window.open(doc.file_url, '_blank')} className="bg-blue-600 hover:bg-blue-700 text-white">
                             <Download className="w-4 h-4 mr-2" />
                             Download File
                          </Button>
                       </div>
                    )}
                </motion.div>
             )}
           </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
