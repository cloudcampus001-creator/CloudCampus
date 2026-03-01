
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-background/50 backdrop-blur-md flex items-center justify-center overflow-hidden group border border-primary/20 hover:border-primary transition-colors shadow-lg hover:shadow-primary/20"
          aria-label="Change language"
        >
          <Languages className="h-5 w-5 md:h-6 md:w-6 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background/90 backdrop-blur-xl border-primary/20 min-w-[150px]">
        <DropdownMenuItem 
          onClick={() => setLanguage('en')} 
          className={`cursor-pointer flex items-center justify-between p-3 ${language === 'en' ? 'bg-primary/10 text-primary font-bold' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🇬🇧</span> 
            <span>{t('english')}</span>
          </div>
          {language === 'en' && <Check className="w-4 h-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setLanguage('fr')} 
          className={`cursor-pointer flex items-center justify-between p-3 ${language === 'fr' ? 'bg-primary/10 text-primary font-bold' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🇫🇷</span> 
            <span>{t('french')}</span>
          </div>
          {language === 'fr' && <Check className="w-4 h-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
