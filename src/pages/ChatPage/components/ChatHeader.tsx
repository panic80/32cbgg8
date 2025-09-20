import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Brain, Zap, Layers } from 'lucide-react';
import { EnhancedBackButton } from '@/components/ui/enhanced-back-button';
import { TripPlanner } from '@/components/TripPlanner';
import { HelpDialog } from '@/pages/ChatPage/components/HelpDialog';
import { WhatsNewModal } from '@/pages/ChatPage/components/WhatsNewModal';
import HowItWorksModal from '@/pages/ChatPage/components/HowItWorksModal';
import { WHATS_NEW_VERSION } from '@/pages/ChatPage/constants/whatsNew';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import LogoImage from '@/components/LogoImage';

interface ChatHeaderProps {
  theme: string;
  toggleTheme: () => void;
  modelMode: 'fast' | 'smart';
  setModelMode: (mode: 'fast' | 'smart') => void;
  onTripPlanSubmit: (plan: string) => void;
  shortAnswerMode: boolean;
  setShortAnswerMode: (value: boolean) => void;
  onExportMarkdown: () => void;
  onClearConversation: () => void;
  onInsertExample?: (text: string) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  theme,
  toggleTheme,
  modelMode,
  setModelMode,
  onTripPlanSubmit,
  shortAnswerMode,
  setShortAnswerMode,
  onExportMarkdown,
  onClearConversation,
  onInsertExample
}) => {
  const [showTripPlanner, setShowTripPlanner] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  // Track if there's unseen updates
  // We keep this local to the header since it owns the modal in this component
  const [lastSeenVersion, setLastSeenVersion] = useState<string>(() => {
    try {
      return JSON.parse(localStorage.getItem('whatsNewLastSeen') || '""');
    } catch {
      return '';
    }
  });
  const hasWhatsNew = lastSeenVersion !== WHATS_NEW_VERSION;
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (hasWhatsNew) {
      // Open once on load if there are unseen updates
      setShowWhatsNew(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
  <motion.header 
    className="border-b border-[var(--border)] bg-background/95 backdrop-blur sticky top-0 z-40 max-w-full overflow-hidden"
    initial={prefersReducedMotion ? undefined : { y: -100 }}
    animate={prefersReducedMotion ? undefined : { y: 0 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
  >
    <div className="h-14 px-2 sm:px-4 flex items-center justify-between max-w-full">
      <div className="flex items-center">
        <EnhancedBackButton to="/" label="Home" variant="minimal" size="sm" />
        <div className="h-6 w-px bg-border/50 mx-2 sm:mx-3" />
        <motion.div 
          className="mr-2 sm:mr-3 h-6 sm:h-7 md:h-8"
          whileHover={{ scale: 1.05 }}
        >
          <LogoImage fitParent className="h-full w-auto" />
        </motion.div>
        <span className="text-base sm:text-xl md:text-2xl font-bold text-foreground">
          32 CBG <span className="hidden sm:inline">Policy Assistant</span>
        </span>
      </div>
      <motion.div 
        className="flex items-center gap-2"
        initial={prefersReducedMotion ? undefined : { opacity: 0, x: 20 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <HamburgerMenu
          theme={theme}
          toggleTheme={toggleTheme}
          modelMode={modelMode}
          setModelMode={setModelMode}
          shortAnswerMode={shortAnswerMode}
          setShortAnswerMode={setShortAnswerMode}
          onTripPlannerOpen={() => setShowTripPlanner(true)}
          onWhatsNewOpen={() => setShowWhatsNew(true)}
          onHowItWorksOpen={() => setShowHowItWorks(true)}
          onHelpOpen={() => setShowHelp(true)}
          onExportMarkdown={onExportMarkdown}
          onClearConversation={onClearConversation}
          hasWhatsNew={hasWhatsNew}
        />
      </motion.div>
    </div>
  </motion.header>
  
  {/* Modals */}
  <TripPlanner 
    open={showTripPlanner}
    onOpenChange={setShowTripPlanner}
    onSubmit={(plan) => {
      onTripPlanSubmit(plan);
      setShowTripPlanner(false);
    }}
  />
  
  {/* What's New */}
  <WhatsNewModal
    open={showWhatsNew}
    onOpenChange={(open) => {
      if (!open) {
        try {
          localStorage.setItem('whatsNewLastSeen', JSON.stringify(WHATS_NEW_VERSION));
          setLastSeenVersion(WHATS_NEW_VERSION);
        } catch {}
      }
      setShowWhatsNew(open);
    }}
  />

  <HowItWorksModal
    open={showHowItWorks}
    onOpenChange={setShowHowItWorks}
  />
  
  <HelpDialog
    open={showHelp}
    onOpenChange={setShowHelp}
    onInsertExample={onInsertExample}
  />
  </>
  );
};
