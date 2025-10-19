import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getModelDisplayName, DEFAULT_MODEL_ID } from '../constants/models';
import { DisclaimerModal } from '@/components/DisclaimerModal';
import { BackgroundEffects } from './ChatPage/components/BackgroundEffects';
import { ChatHeader } from './ChatPage/components/ChatHeader';
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
import { exportConversationAsMarkdown } from '@/utils/exportConversation';
import { ChatCommandPalette } from './ChatPage/components/ChatCommandPalette';
import { ChatMessagesPanel } from './ChatPage/components/ChatMessagesPanel';

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
  const [useRAG] = useState(true);
  const [shortAnswerMode, setShortAnswerMode] = useLocalStorage('shortAnswerMode', false);
  // Model mode state for FAST/SMART toggle
  const [modelMode, setModelMode] = useState<'fast' | 'smart'>(() => {
    const savedModel = localStorage.getItem('selectedLLMModel');
    return savedModel === 'gpt-5-mini' ? 'smart' : 'fast';
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHighlight, setMenuHighlight] = useState<'none' | 'model' | 'short'>('none');
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

  useEffect(() => {
    try {
      const legacyModel = localStorage.getItem('selectedLLMModel');
      if (legacyModel === 'gpt-4.1-mini') {
        localStorage.setItem('selectedLLMModel', 'gpt-4.1');
      }
    } catch (error) {
      console.warn('Failed to migrate legacy model preference', error);
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
  const { messages, setMessages, pendingMessage, isLoading, retrievalStatus, handleStreamingChat } =
    useStreamingChat({
      conversationId,
      setConversationId,
      setCurrentModel,
      DEFAULT_MODEL_ID,
      useRAG,
      shortAnswerMode,
      modelMode,
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
  const theme =
    propTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

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

  const triggerMenu = useCallback(
    (highlight: 'model' | 'short') => {
      setMenuHighlight(highlight);
      setMenuOpen(true);
    },
    [],
  );

  const handleModePillClick = useCallback(() => triggerMenu('model'), [triggerMenu]);
  const handleShortAnswerPillClick = useCallback(() => triggerMenu('short'), [triggerMenu]);

  useEffect(() => {
    if (!menuOpen && menuHighlight !== 'none') {
      setMenuHighlight('none');
    }
  }, [menuOpen, menuHighlight]);

  useEffect(() => {
    if (menuHighlight !== 'none') {
      const timer = setTimeout(() => setMenuHighlight('none'), 1500);
      return () => clearTimeout(timer);
    }
  }, [menuHighlight]);

  // Handle disclaimer display
  const { showDisclaimer, setShowDisclaimer } = useDisclaimer();

  // Use provided toggle function or create a no-op if not provided
  const toggleTheme = propToggleTheme || (() => {});

  const { isAtBottom, showNewPill, scrollToBottom } = useScrollBehavior({
    scrollAreaRef,
    messages,
  });

  const handleSendMessage = useCallback(
    async (messageText?: string) => {
      const messageToSend = messageText || input.trim();
      if (!messageToSend || isLoading) return;

      if (!messageText) setInput(''); // Only clear input if not from follow-up question

      // Scroll to bottom when user sends a message
      setTimeout(scrollToBottom, 100);

      // Use the streaming chat hook
      await handleStreamingChat(messageToSend);
    },
    [input, isLoading, handleStreamingChat],
  );

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

  const handleSuggestionSelect = useCallback(
    (title: string) => {
      setInput(title);
      handleSendMessage(title);
      setInput('');
    },
    [handleSendMessage],
  );

  // Toggle message collapse
  const toggleMessageCollapse = useCallback((messageId: string) => {
    setCollapsedMessages((prev) => {
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

  const handleFollowUpClick = useCallback(
    (question: string) => {
      setInput(question);
      handleSendMessage(question);
      setInput('');
    },
    [handleSendMessage],
  );

  const handleTripPlanSubmit = useCallback(
    (tripPlan: string) => {
      // Send the trip plan as a message
      handleSendMessage(tripPlan);
    },
    [handleSendMessage],
  );

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

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId('');
    toast.success('Conversation cleared');
  }, []);

  return (
    <TooltipProvider>
      {/* Disclaimer Modal */}
      <DisclaimerModal open={showDisclaimer} onAccept={handleAcceptDisclaimer} />

      <div className="flex h-screen bg-[var(--background)] text-[var(--text)] relative overflow-x-hidden overflow-y-hidden">
        {/* Static Background Elements (motion removed to fix flickering) */}
        <BackgroundEffects />

        {/* Command Palette */}
        <ChatCommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onCommandSelect={setInput}
        />

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
            onClearConversation={clearConversation}
            onInsertExample={(q) => setInput(q)}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            highlightModelMode={menuHighlight === 'model'}
            highlightShortAnswers={menuHighlight === 'short'}
          />

          <ChatMessagesPanel
            scrollAreaRef={scrollAreaRef}
            isInitialLoading={isInitialLoading}
            messages={messages}
            visibleMessages={visibleMessages}
            combinedMessages={combinedMessages}
            startIndex={startIndex}
            canShowMoreMessages={canShowMoreMessages}
            showMoreMessages={showMoreMessages}
            collapsedMessages={collapsedMessages}
            onToggleCollapse={toggleMessageCollapse}
            onCopyMessage={copyMessage}
            onRegenerateMessage={regenerateMessage}
            onVoiceAction={handleVoiceInput}
            currentModel={currentModel}
            modelMode={modelMode}
            shortAnswerMode={shortAnswerMode}
            isLoading={isLoading}
            pendingMessage={pendingMessage}
            onFollowUpClick={handleFollowUpClick}
            onSuggestionSelect={handleSuggestionSelect}
            retrievalStatus={retrievalStatus}
            inputHeight={inputHeight}
            pillMargin={pillMargin}
            isAtBottom={isAtBottom}
            showNewPill={showNewPill}
            scrollToBottom={scrollToBottom}
            onModePillClick={handleModePillClick}
            onShortAnswerPillClick={handleShortAnswerPillClick}
          />

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
