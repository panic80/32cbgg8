import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';
import type { Message as ChatMessage } from '@/types/chat';
import { AnimatedButton } from '@/components/chat/AnimatedButton';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { AssistantTypingIndicator } from '@/components/chat/AssistantTypingIndicator';
import { useChatPullToRefresh } from '@/hooks/useChatPullToRefresh';
import { copyTextToClipboard } from '@/utils/clipboard';
import './ChatInterface.css';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  className?: string;
  assistant?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  className,
  assistant = 'assistant',
}) => {
  const [inputValue, setInputValue] = useState('');

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { isKeyboardVisible, keyboardHeight } = useMobileKeyboard();
  const { pullOffset, handleTouchStart, handleTouchMove, handleTouchEnd } = useChatPullToRefresh(
    messagesContainerRef,
  );

  //   // Detect user scroll position
  //   useEffect(() => {
  //     const handleScroll = () => {
  //       if (messagesContainerRef.current) {
  //         const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
  //         const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  //         setIsUserNearBottom(distanceFromBottom < 100);
  //       }
  //     };
  //
  //     const container = messagesContainerRef.current;
  //     container?.addEventListener('scroll', handleScroll);
  //     return () => container?.removeEventListener('scroll', handleScroll);
  //   }, []);

  //   // Auto-scroll to bottom when new messages arrive
  //   useEffect(() => {
  //     if (messagesContainerRef.current && isUserNearBottom) {
  //       messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  //     }
  //   }, [messages, isUserNearBottom]);
  //
  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInputFocus = useCallback(() => {
    //     setTimeout(() => {
    //       if (messagesContainerRef.current) {
    //         messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    //       }
    //     }, 300);
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await copyTextToClipboard(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  }, []);

  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Memoized message list for performance
  const messageList = useMemo(() => {
    return messages.map((message, index) => {
      const isUser = message.sender === 'user';
      const showAvatar = index === 0 || messages[index - 1].sender !== message.sender;

      return (
        <ChatMessageBubble
          key={message.id}
          message={message}
          assistantId={assistant}
          showAvatar={showAvatar}
          formatTimestamp={formatTime}
          onCopy={handleCopy}
        />
      );
    });
  }, [messages, assistant, formatTime, handleCopy]);

  return (
    <div className={cn('chat-interface', className)} data-keyboard-visible={isKeyboardVisible}>
      {/* Pull to refresh indicator */}
      {pullOffset > 20 && (
        <div className="pull-refresh-indicator" style={{ opacity: Math.min(pullOffset / 80, 1) }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </div>
      )}

      {/* Messages Container with mobile touch handlers */}
      <div
        ref={messagesContainerRef}
        className="messages-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${Math.min(pullOffset * 0.3, 20)}px)`,
          paddingBottom: isKeyboardVisible
            ? `calc(${keyboardHeight}px + var(--input-container-height) + 1rem)`
            : `calc(var(--input-container-height) + 1rem + env(safe-area-inset-bottom))`,
        }}
      >
        {messages.length === 0 && (
          <div className="welcome-message animate-fade-up">
            <div className="welcome-content glass rounded-xl p-8">
              <h2 className="h2 text-fluid-3xl mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Welcome to Chat Interface
              </h2>
              <p className="body-lg text-muted-foreground">
                This is a clean, professional chat interface for the Canadian Forces Travel
                Instructions Chatbot.
              </p>
            </div>
          </div>
        )}

        {messageList}

        {/* Typing Indicator */}
        <AssistantTypingIndicator isVisible={isLoading} />
      </div>

      {/* Input Area */}
      <div
        className="input-area"
        style={{
          bottom: isKeyboardVisible ? `${keyboardHeight}px` : '0',
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))`,
          transition: 'bottom 0.3s ease-out',
        }}
      >
        <div className="input-wrapper">
          <div className="input-field" style={{ touchAction: 'manipulation' }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={handleInputFocus}
              placeholder="Type your message..."
              className="message-input"
              disabled={isLoading}
              rows={1}
              style={{ fontSize: '16px' }}
            />

            <AnimatedButton
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              title="Send message"
              variant="default"
              size="sm"
              className="send-button"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </AnimatedButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
