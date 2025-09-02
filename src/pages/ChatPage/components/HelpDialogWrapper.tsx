import React, { useState, useEffect } from 'react';
import { HelpDialogClassic } from './HelpDialogClassic';
import { HelpDialogEnhanced } from './HelpDialogEnhanced';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ToggleLeft, ToggleRight, Sparkles, FileText } from 'lucide-react';

interface HelpDialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogVersion = 'classic' | 'enhanced';

export const HelpDialogWrapper: React.FC<HelpDialogWrapperProps> = ({ open, onOpenChange }) => {
  const [version, setVersion] = useState<DialogVersion>(() => {
    // Load saved preference from localStorage
    const saved = localStorage.getItem('helpModalVersion');
    return (saved as DialogVersion) || 'enhanced';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Save preference to localStorage whenever it changes
    localStorage.setItem('helpModalVersion', version);
  }, [version]);

  const handleToggleVersion = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setVersion(prev => prev === 'classic' ? 'enhanced' : 'classic');
      setIsTransitioning(false);
    }, 150);
  };

  // Clone the dialog component and add the toggle button to its header
  const DialogComponent = version === 'classic' ? HelpDialogClassic : HelpDialogEnhanced;

  return (
    <>
      <AnimatePresence mode="wait">
        {!isTransitioning && (
          <motion.div
            key={version}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <DialogComponent open={open} onOpenChange={onOpenChange} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toggle button - only show when dialog is open */}
      {open && !isTransitioning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-4 right-20 z-[60]"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleVersion}
            className="flex items-center gap-2 bg-[var(--card)] border-[var(--border)] hover:bg-[var(--background-secondary)] shadow-lg"
          >
            {version === 'classic' ? (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Switch to Enhanced</span>
                <Sparkles className="w-3 h-3 text-[var(--primary)]" />
              </>
            ) : (
              <>
                <ToggleRight className="w-4 h-4 text-[var(--primary)]" />
                <span className="hidden sm:inline">Switch to Classic</span>
                <FileText className="w-3 h-3" />
              </>
            )}
          </Button>
          
          {/* Version indicator badge */}
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs text-[var(--text-secondary)] bg-[var(--background-secondary)] px-2 py-0.5 rounded-full whitespace-nowrap"
            >
              {version === 'enhanced' ? 'Enhanced View' : 'Classic View'}
            </motion.div>
          </div>
        </motion.div>
      )}
    </>
  );
};

// Export a hook for other components to check/set the version if needed
export const useHelpDialogVersion = () => {
  const [version, setVersion] = useState<DialogVersion>(() => {
    const saved = localStorage.getItem('helpModalVersion');
    return (saved as DialogVersion) || 'enhanced';
  });

  const updateVersion = (newVersion: DialogVersion) => {
    setVersion(newVersion);
    localStorage.setItem('helpModalVersion', newVersion);
  };

  return { version, updateVersion };
};