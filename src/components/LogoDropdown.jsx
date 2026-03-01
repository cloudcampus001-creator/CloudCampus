import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { Bot, Info, Mail } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export const LogoDropdown = ({ children }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="cursor-pointer select-none hover:opacity-80 transition-opacity outline-none">
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 z-[60]">
        <DropdownMenuLabel>CloudCampus Platform</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/cloud-ai')} className="cursor-pointer bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-500 font-medium">
          <Bot className="mr-2 h-4 w-4" />
          <span>{t('cloudAI') || 'Cloud AI'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/about')} className="cursor-pointer">
          <Info className="mr-2 h-4 w-4" />
          <span>{t('aboutUs') || 'About Us'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/contact')} className="cursor-pointer">
          <Mail className="mr-2 h-4 w-4" />
          <span>{t('contactUs') || 'Contact Us'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};