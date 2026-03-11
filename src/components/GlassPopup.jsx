/**
 * GlassPopup.jsx
 * iOS-style frosted-glass popup — soft blur, white/light feel,
 * smooth spring animation, tap-outside to dismiss.
 *
 * Variants:
 *  - "sheet"  → slides up from bottom (default, like iOS action sheet)
 *  - "dialog" → scales up from center (like iOS alert)
 *
 * Usage:
 *   <GlassPopup open={open} onClose={onClose} title="Details">
 *     <p>Content here</p>
 *   </GlassPopup>
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── sheet variant (slides from bottom) ─────────────── */
const sheetVariants = {
  initial: { y: '100%', opacity: 0.6 },
  animate: { y: 0, opacity: 1,
    transition: { type: 'spring', stiffness: 380, damping: 40, mass: 0.9 }
  },
  exit:    { y: '100%', opacity: 0,
    transition: { duration: 0.22, ease: 'easeIn' }
  },
};

/* ── dialog variant (scales from center) ────────────── */
const dialogVariants = {
  initial: { scale: 0.88, opacity: 0, y: 12 },
  animate: { scale: 1, opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 420, damping: 36 }
  },
  exit:    { scale: 0.92, opacity: 0, y: 8,
    transition: { duration: 0.18, ease: 'easeIn' }
  },
};

const GlassPopup = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  variant   = 'sheet',   // 'sheet' | 'dialog'
  maxWidth  = 'max-w-lg',
  className = '',
  showClose = true,
  footer,                // optional JSX for bottom action buttons
}) => {
  const isSheet  = variant === 'sheet';
  const motionV  = isSheet ? sheetVariants : dialogVariants;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────────── */}
          <motion.div
            key="glass-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[9990] bg-black/30 backdrop-blur-[3px]"
          />

          {/* ── Panel ────────────────────────────────────── */}
          <div className={cn(
            'fixed z-[9995] inset-x-0 flex justify-center',
            isSheet ? 'bottom-0 px-3 pb-safe' : 'inset-0 items-center px-4'
          )}
            style={ isSheet ? { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } : {} }
          >
            <motion.div
              key="glass-panel"
              variants={motionV}
              initial="initial"
              animate="animate"
              exit="exit"
              className={cn(
                'w-full overflow-hidden',
                /* iOS frosted glass */
                'bg-white/80 dark:bg-gray-950/85',
                'backdrop-blur-3xl',
                'border border-white/60 dark:border-white/10',
                'shadow-[0_20px_80px_rgba(0,0,0,0.25)]',
                isSheet ? 'rounded-3xl' : 'rounded-3xl',
                maxWidth,
                className
              )}
            >

              {/* drag handle (sheet only) */}
              {isSheet && (
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-9 h-1 rounded-full bg-black/15 dark:bg-white/20" />
                </div>
              )}

              {/* ── Header ───────────────────────────────── */}
              {(title || showClose) && (
                <div className="flex items-start justify-between px-6 pt-4 pb-3">
                  <div>
                    {title && (
                      <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
                    )}
                  </div>
                  {showClose && (
                    <button
                      onClick={onClose}
                      className="ml-4 p-2 rounded-full bg-black/6 dark:bg-white/10 hover:bg-black/12 dark:hover:bg-white/15 transition-colors shrink-0 mt-0.5"
                    >
                      <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  )}
                </div>
              )}

              {/* ── Divider ──────────────────────────────── */}
              {title && <div className="h-px bg-black/6 dark:bg-white/8 mx-5" />}

              {/* ── Content ──────────────────────────────── */}
              <div className="px-6 py-4">
                {children}
              </div>

              {/* ── Footer ───────────────────────────────── */}
              {footer && (
                <>
                  <div className="h-px bg-black/6 dark:bg-white/8 mx-5" />
                  <div className="px-5 py-4">
                    {footer}
                  </div>
                </>
              )}

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GlassPopup;
