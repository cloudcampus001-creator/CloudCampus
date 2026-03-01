
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-background/50 backdrop-blur-md flex items-center justify-center overflow-hidden group border border-primary/20 hover:border-primary transition-colors shadow-lg hover:shadow-primary/20"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode='wait'>
        {theme === 'light' ? (
          <motion.div
            key="sun"
            initial={{ y: 20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="h-5 w-5 md:h-6 md:w-6 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ y: 20, opacity: 0, rotate: 90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -20, opacity: 0, rotate: -90 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="h-5 w-5 md:h-6 md:w-6 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
}
