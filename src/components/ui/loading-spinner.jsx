import React from 'react';
import { cn } from '@/lib/utils';

export const LoadingSpinner = ({ className, size = 40, text = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full gap-4 p-4">
      <div 
        className={cn(
          "animate-spin rounded-full border-4 border-primary/30 border-t-primary",
          className
        )}
        style={{ width: size, height: size }}
      />
      {text && <p className="text-muted-foreground text-sm font-medium animate-pulse">{text}</p>}
    </div>
  );
};

export const FullPageLoader = ({ text }) => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <LoadingSpinner size={60} text={text} />
  </div>
);