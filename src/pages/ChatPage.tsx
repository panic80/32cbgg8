import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Settings, Sparkles, Command as CommandIcon, Mic, Paperclip, Hash, AtSign, HelpCircle, Zap, ChevronDown, X, Database, MapIcon, Book, Minimize2, Search, Layers, Brain, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedButton } from '@/components/ui/animated-button';
import { EnhancedBackButton } from '@/components/ui/enhanced-back-button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton, SkeletonText, SkeletonChatMessage } from '@/components/ui/skeleton';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import SuggestionController from '@/components/SuggestionController';
import { useSuggestionVisibility } from '@/hooks/useSuggestionVisibility';
import { cn } from '@/lib/utils';
import { parseApiResponse } from '../utils/chatUtils';
import { getModelDisplayName, DEFAULT_MODEL_ID } from '../constants/models';
import { generateFollowUpQuestions } from '../services/followUpService';
import { Message, Source, FollowUpQuestion } from '@/types/chat';
import { SourcesDisplay } from '@/components/SourcesDisplay';
import { TripPlanner } from '@/components/TripPlanner';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { GlossaryModal } from '@/components/GlossaryModal';
import Logo from '@/components/Logo';
import { INLINE_COMMANDS } from './ChatPage/constants/commands';
import { WELCOME_SUGGESTIONS } from './ChatPage/constants/suggestions';
import { TypingIndicator } from './ChatPage/components/TypingIndicator';
import { BackgroundEffects } from './ChatPage/components/BackgroundEffects';
import { MessageActions } from './ChatPage/components/MessageActions';
import { EmptyState } from './ChatPage/components/EmptyState';
import { ChatHeader } from './ChatPage/components/ChatHeader';
import { ChatMessage } from './ChatPage/components/ChatMessage';
import { ChatInput } from './ChatPage/components/ChatInput';
import { HelpDialog } from './ChatPage/components/HelpDialog';
import { useLocalStorage } from './ChatPage/hooks/useLocalStorage';
import { useStreamingChat } from './ChatPage/hooks/useStreamingChat';
import { useTheme } from './ChatPage/hooks/useTheme';
import { useModelMode } from './ChatPage/hooks/useModelMode';
import { useDisclaimer } from './ChatPage/hooks/useDisclaimer';
import { useKeyboardShortcuts } from './ChatPage/hooks/useKeyboardShortcuts';
import { formatPlainTextToMarkdown } from './ChatPage/utils/formatting';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';


interface ChatPageProps {
  theme?: string;
  toggleTheme?: () => void;
}

/**
 * Enhanced Chat page with modern UI/UX improvements
 */
const ChatPage: React.FC<ChatPageProps> = ({ theme: propTheme, toggleTheme: propToggleTheme }) => {
  const [input, setInput] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState(getModelDisplayName(DEFAULT_MODEL_ID));
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showInlineCommand, setShowInlineCommand] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set());
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const [shortAnswerMode, setShortAnswerMode] = useLocalStorage('shortAnswerMode', false);
  // Model mode state for FAST/SMART toggle
  const [modelMode, setModelMode] = useState<'fast' | 'smart'>(() => {
    const savedModel = localStorage.getItem('selectedLLMModel');
    return savedModel === 'gpt-5-mini' ? 'smart' : 'fast';
  });
  // HYBRID_SEARCH_TOGGLE_START - Remove this entire block to disable hybrid search feature
  const [useHybridSearch, setUseHybridSearch] = useLocalStorage('useHybridSearch', false);
  // HYBRID_SEARCH_TOGGLE_END
  const [conversationId, setConversationId] = useState<string>('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showNewPill, setShowNewPill] = useState(false);
  // Simple windowing to reduce DOM nodes for long chats
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const suppressPillRef = useRef(false);
  // Track ChatInput height to position the new replies pill dynamically
  const [inputHeight, setInputHeight] = useState<number>(96);
  const [pillMargin, setPillMargin] = useState<number>(12);
  const location = useLocation();

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
  const suppressTimerRef = useRef<number | null>(null);
  
  // Use streaming chat hook
  const { messages, setMessages, pendingMessage, isLoading, retrievalStatus, handleStreamingChat } = useStreamingChat({
    conversationId,
    setConversationId,
    setCurrentModel,
    DEFAULT_MODEL_ID,
    useRAG,
    useHybridSearch,
    shortAnswerMode,
    modelMode
  });
  
  // Initialize suggestion visibility manager
  const suggestionManager = useSuggestionVisibility();

  const combinedMessages = useMemo(() => (
    pendingMessage ? [...messages, pendingMessage] : messages
  ), [messages, pendingMessage]);

  const startIndex = useMemo(
    () => Math.max(0, combinedMessages.length - visibleCount),
    [combinedMessages, visibleCount]
  );
  const visibleMessages = useMemo(
    () => combinedMessages.slice(startIndex),
    [combinedMessages, startIndex]
  );

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
  
  // Inline command suggestions
  const inlineCommands = INLINE_COMMANDS;

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

  // Simple, robust scroll-to-bottom with temporary suppression
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;
    // Suppress pill and scroll handling briefly to avoid bounce
    suppressPillRef.current = true;
    if (suppressTimerRef.current) {
      window.clearTimeout(suppressTimerRef.current);
    }
    const force = () => { viewport.scrollTop = viewport.scrollHeight; };
    force();
    requestAnimationFrame(() => { force(); });
    suppressTimerRef.current = window.setTimeout(() => {
      suppressPillRef.current = false;
    }, 400);
    setIsAtBottom(true);
    setShowNewPill(false);
  };

  // Track scroll position for "new messages" pill
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;
    let ticking = false;
    const onScroll = () => {
      if (suppressPillRef.current) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const distance = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
        const atBottom = distance <= 2; // tighter threshold to avoid flapping
        setIsAtBottom(atBottom);
        if (atBottom) setShowNewPill(false);
        ticking = false;
      });
    };
    onScroll();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll as any);
  }, []);

  // Show new messages pill when content changes and user is not at bottom
  useEffect(() => {
    if (!isAtBottom && messages.length > 0 && !suppressPillRef.current) {
      setShowNewPill(true);
    }
    if (isAtBottom) {
      setShowNewPill(false);
    }
  }, [messages, isAtBottom]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    showInlineCommand,
    selectedCommandIndex,
    inlineCommands,
    setCommandOpen,
    setSelectedCommandIndex,
    setInput,
    setShowInlineCommand,
    setShowHelpDialog
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

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showInlineCommand) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [showInlineCommand, handleSendMessage]);
  
  // Handle input changes with inline command detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Detect slash commands
    if (value.startsWith('/') && value.length > 1) {
      const command = value.toLowerCase();
      const hasMatch = inlineCommands.some(cmd => 
        cmd.command.toLowerCase().startsWith(command)
      );
      setShowInlineCommand(hasMatch);
      setCommandFilter(command);
    } else {
      setShowInlineCommand(false);
    }
  }, [inlineCommands]);
  
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


  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => toast.error('Copy failed'));
  }, []);

  const regenerateMessage = useCallback((id: string) => {
    // Simulate regeneration
    setIsLoading(true);
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === id 
          ? { ...msg, content: "This is a regenerated response with updated content." }
          : msg
      ));
      setIsLoading(false);
    }, 1500);
  }, []);

  // Export helpers
  const exportMarkdown = useCallback(() => {
    const lines: string[] = [];
    lines.push(`# Conversation${conversationId ? ' ' + conversationId : ''}`);
    lines.push('');
    messages.forEach(m => {
      const role = m.sender === 'user' ? 'User' : 'Assistant';
      lines.push(`## ${role} (${new Date(m.timestamp).toLocaleString()})`);
      lines.push('');
      const content = m.content.replace(/```/g, '\\`\\`\\`');
      lines.push(content);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation${conversationId ? '-' + conversationId : ''}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown');
  }, [conversationId, messages]);

  const exportJSON = useCallback(() => {
    const payload = { conversationId, messages };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation${conversationId ? '-' + conversationId : ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
            useHybridSearch={useHybridSearch}
            setUseHybridSearch={setUseHybridSearch}
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
                  <SkeletonChatMessage key={i} isUser={i % 2 === 0} />
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
                {combinedMessages.length > visibleCount && (
                  <div className="flex justify-center mb-4">
                    <button
                      className="px-3 py-1.5 rounded-full bg-[var(--background-secondary)] text-[var(--text)] text-xs border border-[var(--border)] hover:bg-[var(--background-tertiary)]"
                      onClick={() => setVisibleCount(c => Math.min(combinedMessages.length, c + 50))}
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
                <div ref={messagesEndRef} />
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
            commandFilter={commandFilter}
            selectedCommandIndex={selectedCommandIndex}
            setShowInlineCommand={setShowInlineCommand}
            shortAnswerMode={shortAnswerMode}
            setShortAnswerMode={setShortAnswerMode}
            setShowGlossaryModal={setShowGlossaryModal}
            setShowHelpDialog={setShowHelpDialog}
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
