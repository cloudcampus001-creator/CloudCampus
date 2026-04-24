/**
 * ReportCardViewerModal.jsx  —  src/components/ReportCardViewerModal.jsx
 *
 * Internal viewer for HTML report cards — mirrors DocumentViewerModal style.
 * Renders the HTML as a blob URL inside an iframe (no source URL exposed).
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   htmlContent  string — raw HTML from buildCardHtml(autoPrint: false)
 *   title        string — e.g. "Bulletin — Séquence 1 · Form 3A"
 *   subtitle     string — e.g. student name
 *   canDownload  boolean — if true shows Print/PDF button (VP only)
 *   onDownload   () => void — called when VP clicks print; caller opens new window with autoPrint html
 */
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, AlertCircle, GraduationCap, Printer } from 'lucide-react';

export function ReportCardViewerModal({
  isOpen,
  onClose,
  htmlContent,
  title     = 'Bulletin de Notes',
  subtitle  = '',
  canDownload = false,
  onDownload  = null,
}) {
  const [blobUrl, setBlobUrl]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);
  const prevBlobUrl              = useRef(null);

  useEffect(() => {
    // Revoke previous blob URL to prevent memory leaks
    if (prevBlobUrl.current && prevBlobUrl.current.startsWith('blob:')) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }

    if (!isOpen || !htmlContent) {
      setBlobUrl(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      prevBlobUrl.current = url;
      setBlobUrl(url);
      setLoading(false);
    } catch (e) {
      setError(e.message || 'Impossible de charger le bulletin.');
      setLoading(false);
    }

    return () => {
      if (prevBlobUrl.current && prevBlobUrl.current.startsWith('blob:')) {
        URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }
    };
  }, [isOpen, htmlContent]);

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-5xl w-[96vw] h-[92vh] p-0 flex flex-col bg-slate-950 border-slate-800 text-slate-100 gap-0 shadow-2xl overflow-hidden outline-none"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <div className="p-2 bg-indigo-500/15 rounded-xl text-indigo-400 shrink-0 hidden sm:flex">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate text-slate-200">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canDownload && onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Imprimer / PDF</span>
              </button>
            )}
            <button
              onClick={handleClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Viewer canvas ── */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950/60">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <Loader2 className="h-10 w-10 text-indigo-400 animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-slate-300">Chargement du bulletin…</p>
                  <p className="text-xs text-slate-500">Préparation du document</p>
                </div>
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="text-center p-8 max-w-md bg-slate-900/50 rounded-2xl border border-slate-800"
              >
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Impossible d'afficher le bulletin</h3>
                <p className="text-slate-400 text-sm">{error}</p>
              </motion.div>
            ) : blobUrl ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="w-full h-full"
              >
                {/*
                  sandbox="allow-same-origin" — allows CSS/images to load
                  We intentionally omit allow-scripts so the auto-print
                  script doesn't fire inside the viewer iframe.
                  When the VP clicks "Imprimer", onDownload opens a NEW window
                  with autoPrint:true HTML instead.
                */}
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-none bg-white"
                  title="Bulletin de Notes"
                  sandbox="allow-same-origin"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReportCardViewerModal;
