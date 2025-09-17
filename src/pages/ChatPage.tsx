import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SkeletonChatMessage } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getModelDisplayName, DEFAULT_MODEL_ID } from '../constants/models';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { GlossaryModal } from '@/components/GlossaryModal';
import { TypingIndicator } from './ChatPage/components/TypingIndicator';
import { BackgroundEffects } from './ChatPage/components/BackgroundEffects';
import { EmptyState } from './ChatPage/components/EmptyState';
import { ChatHeader } from './ChatPage/components/ChatHeader';
import { ChatMessage } from './ChatPage/components/ChatMessage';
import { ChatInput } from './ChatPage/components/ChatInput';
import { HelpDialog } from './ChatPage/components/HelpDialog';
import {
  useCommandPalette,
  useDisclaimer,
  useLocalStorage,
  useMessageOperations,
  useModelMode,
  useScrollBehavior,
  useStreamingChat,
  useTheme,
  useMessageWindow,
} from './ChatPage/hooks';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { exportConversationAsMarkdown, exportConversationAsJSON } from '@/utils/exportConversation';


interface ChatPageProps {
  theme?: string;
  toggleTheme?: () => void;
}

/**
 * Enhanced Chat page with modern UI/UX improvements
 */
const ChatPage: React.FC<ChatPageProps> = ({ theme: propTheme, toggleTheme: propToggleTheme }) => {
  const [input, setInput] = useState('');
  const [currentModel, setCurrentModel] = useState(getModelDisplayName(DEFAULT_MODEL_ID));
  const [isRecording, setIsRecording] = useState(false);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [useRAG] = useState(true);
  const [shortAnswerMode, setShortAnswerMode] = useLocalStorage('shortAnswerMode', false);
  // Model mode state for FAST/SMART toggle
  const [modelMode, setModelMode] = useState<'fast' | 'smart'>(() => {
    const savedModel = localStorage.getItem('selectedLLMModel');
    return savedModel === 'gpt-5-mini' ? 'smart' : 'fast';
  });
  const [conversationId, setConversationId] = useState<string>('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Track ChatInput height to position the new replies pill dynamically
  const [inputHeight, setInputHeight] = useState<number>(96);
  const pillMargin = 12;
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.removeItem('useHybridSearch');
    } catch (error) {
      console.warn('Failed to remove legacy useHybridSearch flag', error);
    }
  }, []);

  // Measure ChatInput (fixed footer) height with ResizeObserver
  useEffect(() => {
    const el = document.querySelector('[data-chat-input]') as HTMLElement | null;
    if (!el) return;
    const measure = () => {
      setInputHeight(el.getBoundingClientRect().height || 96);
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Use streaming chat hook
  const { messages, setMessages, pendingMessage, isLoading, retrievalStatus, handleStreamingChat } = useStreamingChat({
    conversationId,
    setConversationId,
    setCurrentModel,
    DEFAULT_MODEL_ID,
    useRAG,
    shortAnswerMode,
    modelMode
  });
  
  const {
    combinedMessages,
    visibleMessages,
    startIndex,
    canShowMore: canShowMoreMessages,
    showMore: showMoreMessages,
  } = useMessageWindow({ messages, pendingMessage });

  // Prefill input from query param ?q=
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const q = params.get('q');
      if (q && q.trim().length > 0) {
        setInput(q.trim());
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  
  // Motion values removed to fix flickering issue
  
  // Use theme from props or fall back to local detection for standalone usage
  const theme = propTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);
  
  // Apply theme changes
  useTheme(theme, propTheme);
  
  // Mouse movement handler removed to fix flickering issue

  // Handle model mode changes
  useModelMode(modelMode, setCurrentModel);

  // Handle disclaimer display
  const { showDisclaimer, setShowDisclaimer } = useDisclaimer();

  // Use provided toggle function or create a no-op if not provided
  const toggleTheme = propToggleTheme || (() => {
    
  });

  const {
    isAtBottom,
    showNewPill,
    scrollToBottom,
  } = useScrollBehavior({
    scrollAreaRef,
    messages,
  });

  const handleSendMessage = useCallback(async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
    if (!messageToSend || isLoading) return;
    
    if (!messageText) setInput(''); // Only clear input if not from follow-up question
    
    // Scroll to bottom when user sends a message
    setTimeout(scrollToBottom, 100);
    
    // Use the streaming chat hook
    await handleStreamingChat(messageToSend);
  }, [input, isLoading, handleStreamingChat]);

  const {
    commandOpen,
    setCommandOpen,
    showInlineCommand,
    setShowInlineCommand,
    selectedCommandIndex,
    handleInputChange,
    handleKeyPress,
    commands: inlineCommandOptions,
  } = useCommandPalette({
    setInput,
    onSubmit: handleSendMessage,
    setShowHelpDialog,
  });

  // Toggle message collapse
  const toggleMessageCollapse = useCallback((messageId: string) => {
    setCollapsedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);
  
  // Handle voice input
  const handleVoiceInput = useCallback(() => {
    setIsRecording(!isRecording);
    // In a real implementation, this would use the Web Speech API
    if (!isRecording) {
      // Start recording
      console.log('Starting voice recording...');
    } else {
      // Stop recording
      console.log('Stopping voice recording...');
    }
  }, [isRecording]);

  const handleFollowUpClick = useCallback((question: string) => {
    setInput(question);
    handleSendMessage(question);
    setInput("");
  }, [handleSendMessage]);

  const handleTripPlanSubmit = useCallback((tripPlan: string) => {
    // Send the trip plan as a message
    handleSendMessage(tripPlan);
  }, [handleSendMessage]);

  const handleAcceptDisclaimer = useCallback(() => {
    // Just close the modal - visit count is already tracked
    setShowDisclaimer(false);
  }, [setShowDisclaimer]);

  const { copyMessage, regenerateMessage } = useMessageOperations({ setMessages });

  // Export helpers
  const exportMarkdown = useCallback(() => {
    exportConversationAsMarkdown(messages, conversationId);
    toast.success('Exported as Markdown');
  }, [conversationId, messages]);

  const exportJSON = useCallback(() => {
    exportConversationAsJSON(messages, conversationId);
    toast.success('Exported as JSON');
  }, [conversationId, messages]);


  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId('');
    toast.success('Conversation cleared');
  }, []);

  return (
    <TooltipProvider>
      {/* Disclaimer Modal */}
      <DisclaimerModal 
        open={showDisclaimer}
        onAccept={handleAcceptDisclaimer}
      />
      
      <GlossaryModal
        open={showGlossaryModal}
        onOpenChange={setShowGlossaryModal}
      />

      <div className="flex h-screen bg-[var(--background)] text-[var(--text)] relative overflow-x-hidden overflow-y-hidden">

        {/* Static Background Elements (motion removed to fix flickering) */}
        <BackgroundEffects />
        
        {/* Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => setInput("TD claim requirements")}>
                <Sparkles className="mr-2 h-4 w-4" />
                TD claim requirements
              </CommandItem>
              <CommandItem onSelect={() => setInput("LTA eligibility")}>
                <Sparkles className="mr-2 h-4 w-4" />
                LTA eligibility
              </CommandItem>
              <CommandItem onSelect={() => setInput("Travel authorization")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Travel authorization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Main Content - Full Width */}
        <div className="flex-1 flex flex-col relative w-full">
          {/* Enhanced Header */}
          <ChatHeader
            theme={theme}
            toggleTheme={toggleTheme}
            modelMode={modelMode}
            setModelMode={setModelMode}
            onTripPlanSubmit={handleTripPlanSubmit}
            shortAnswerMode={shortAnswerMode}
            setShortAnswerMode={setShortAnswerMode}
            onExportMarkdown={exportMarkdown}
            onExportJSON={exportJSON}
            onClearConversation={clearConversation}
            onInsertExample={(q) => setInput(q)}
          />

          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 relative">
            {isInitialLoading ? (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20 sm:pb-24 space-y-8">
                {[...Array(3)].map((_, i) => (
                  <SkeletonChatMessage
                    key={i}
                    variant={i % 2 === 0 ? 'sent' : 'received'}
                  />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <EmptyState 
                onSuggestionClick={(title) => {
                  setInput(title);
                  // Focus is now handled inside ChatInput component
                  handleSendMessage(title);
                  setInput("");
                }}
              />
            ) : (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-20 sm:pb-24">
                {/* Show older messages loader when windowed */}
                {canShowMoreMessages && (
                  <div className="flex justify-center mb-4">
                    <button
                      className="px-3 py-1.5 rounded-full bg-[var(--background-secondary)] text-[var(--text)] text-xs border border-[var(--border)] hover:bg-[var(--background-tertiary)]"
                      onClick={showMoreMessages}
                    >
                      Show earlier messages
                    </button>
                  </div>
                )}
                <AnimatePresence>
                  {visibleMessages.map((message, idx) => {
                    const messageIndex = startIndex + idx;
                    const prev = combinedMessages[messageIndex - 1];
                    const showDate = !prev || new Date(prev.timestamp).toDateString() !== new Date(message.timestamp).toDateString();
                    return (
                      <React.Fragment key={message.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-xs px-3 py-1 rounded-full bg-[var(--background-secondary)] text-[var(--text-secondary)]">
                              {new Date(message.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        <ChatMessage
                          message={message}
                          messageIndex={messageIndex}
                          isCollapsed={collapsedMessages.has(message.id)}
                          onToggleCollapse={() => toggleMessageCollapse(message.id)}
                          onCopy={() => copyMessage(message.content)}
                          onRegenerate={() => regenerateMessage(message.id)}
                          onVoice={() => handleVoiceInput()}
                          currentModel={currentModel}
                          modelMode={message.modelMode || modelMode}
                          isLoading={isLoading}
                          isLatestMessage={messageIndex === combinedMessages.length - 1}
                          onFollowUpClick={handleFollowUpClick}
                        />
                      </React.Fragment>
                    );
                  })}
                </AnimatePresence>
                {isLoading && !pendingMessage && (
                  <motion.div 
                    className="mr-4 sm:mr-8 lg:mr-12 mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    {/* Mode Indicator */}
                    <motion.div 
                      className="flex items-center gap-2 mb-3 ml-12"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        modelMode === 'smart' 
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" 
                          : "bg-green-500/10 text-green-500 border border-green-500/20"
                      )}>
                        {modelMode === 'smart' ? (
                          <>
                            <Sparkles size={12} />
                            <span>Smart Mode</span>
                          </>
                        ) : (
                          <>
                            <Zap size={12} />
                            <span>Fast Mode</span>
                          </>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {modelMode === 'smart' 
                          ? "Detailed answers but slower. Select Fast mode in the menu for quicker responses."
                          : "Quick responses. Select Smart mode in the menu for detailed answers."}
                      </span>
                    </motion.div>
                    
                    <div className="flex gap-4 justify-start">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-[var(--border)] shadow-lg">
                          <AvatarFallback className="bg-[var(--primary)] text-white font-semibold">
                            P
                          </AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <Card className="glass border border-[var(--border)] backdrop-blur-xl">
                          <CardContent className="p-6">
                            <TypingIndicator />
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>

          <AnimatePresence>
            {retrievalStatus && (
              <motion.div
                key="retrieval-status"
                className="absolute left-0 right-0 flex justify-center pointer-events-none"
                style={{
                  bottom: Math.max(Math.round(inputHeight) + pillMargin + 48, 128),
                  zIndex: 70,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--card)]/95 border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-md backdrop-blur">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" />
                  <span>{retrievalStatus}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New messages pill */}
          {!isAtBottom && showNewPill && (
            <div
              className="absolute left-0 right-0 flex justify-center pointer-events-none"
              style={{
                // Keep clear of ChatInput using dynamic height + margin; include safe-area via ChatInput padding
                bottom: Math.max(Math.round(inputHeight) + pillMargin, 88),
                // Ensure it renders above the ChatInput (zIndex 50)
                zIndex: 60,
              }}
            >
              <button
                className="pointer-events-auto px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-xs shadow-md"
                onClick={() => { scrollToBottom(); }}
              >
                Jump to bottom
              </button>
            </div>
          )}

          

          {/* Enhanced Input Area */}
          <ChatInput
            input={input}
            setInput={setInput}
            handleInputChange={handleInputChange}
            handleKeyPress={handleKeyPress}
            handleSendMessage={handleSendMessage}
            isLoading={isLoading}
            showInlineCommand={showInlineCommand}
            selectedCommandIndex={selectedCommandIndex}
            setShowInlineCommand={setShowInlineCommand}
            commands={inlineCommandOptions}
            currentModel={currentModel}
            
          />
        </div>
      </div>

      {/* Help Dialog */}
      <HelpDialog
        open={showHelpDialog}
        onOpenChange={setShowHelpDialog}
        onInsertExample={(q) => {
          setInput(q);
        }}
      />
    </TooltipProvider>
  );
};

export default ChatPage;
