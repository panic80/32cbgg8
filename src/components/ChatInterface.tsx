import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useMobileKeyboard } from '../hooks/useMobileKeyboard';
import './ChatInterface.css';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  isFormatted?: boolean;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  className?: string;
  assistant?: string;
}

const AnimatedButton = ({ children, className, ...props }: any) => (
  <Button
    className={cn(
      'transition-colors duration-200 ease-out',
      'focus:ring-2 focus:ring-primary/20',
      className
    )}
    {...props}
  >
    {children}
  </Button>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading = false,
  className,
  assistant = 'assistant'
}) => {
  const [inputValue, setInputValue] = useState('');
  const [pullOffset, setPullOffset] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { isKeyboardVisible, keyboardHeight } = useMobileKeyboard();

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

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputFocus = useCallback(() => {
//     setTimeout(() => {
//       if (messagesContainerRef.current) {
//         messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
//       }
//     }, 300);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }, []);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Mobile touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (messagesContainerRef.current?.scrollTop === 0) {
      setTouchStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPulling && messagesContainerRef.current?.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;
      
      if (diff > 0) {
        setPullOffset(Math.min(diff, 100));
        if (diff > 80) {
          // Trigger refresh action
        }
      }
    }
  }, [isPulling, touchStartY]);

  const handleTouchEnd = useCallback(() => {
    setIsPulling(false);
    setPullOffset(0);
  }, []);

  // Memoized message list for performance
  const messageList = useMemo(() => {
    return messages.map((message, index) => {
      const isUser = message.sender === 'user';
      const showAvatar = index === 0 || messages[index - 1].sender !== message.sender;
      
      return (
        <div
          key={message.id}
          className={`message-wrapper ${isUser ? 'user-message' : 'assistant-message'}`}
        >
          {showAvatar && !isUser && (
            <div className="message-avatar">
              <div className="avatar assistant-avatar">
                <span>CF</span>
              </div>
            </div>
          )}
          <div className={isUser ? "message-bubble user-bubble bg-primary text-primary-foreground animate-fade-up" : "assistant-plain-content"}>
            <div className="message-content">
              {message.sender === assistant && message.isFormatted ? (
                <MarkdownRenderer>{message.content}</MarkdownRenderer>
              ) : (
                message.content
              )}
            </div>
            
            <div className="message-meta">
              <span className="timestamp">{formatTime(message.timestamp)}</span>
              {message.status && (
                <span className="status-indicator">
                  {message.status === 'sending' && '⏳'}
                  {message.status === 'sent' && '✓'}
                  {message.status === 'delivered' && '✓✓'}
                  {message.status === 'error' && '⚠️'}
                </span>
              )}
              <button
                className="copy-button p-1 hover:bg-muted rounded transition-colors"
                onClick={() => copyToClipboard(message.content)}
                title="Copy message"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
          </div>

          {showAvatar && isUser && (
            <div className="message-avatar">
              <div className="avatar user-avatar">
                <span>You</span>
              </div>
            </div>
          )}
        </div>
      );
    });
  }, [messages, formatTime, copyToClipboard, assistant]);

  return (
    <div className={cn('chat-interface', className)} data-keyboard-visible={isKeyboardVisible}>
      {/* Pull to refresh indicator */}
      {pullOffset > 20 && (
        <div 
          className="pull-refresh-indicator"
          style={{ opacity: Math.min(pullOffset / 80, 1) }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
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
          paddingBottom: isKeyboardVisible ? `calc(${keyboardHeight}px + var(--input-container-height) + 1rem)` : `calc(var(--input-container-height) + 1rem + env(safe-area-inset-bottom))`
        }}
      >
        {messages.length === 0 && (
          <div className="welcome-message animate-fade-up">
            <div className="welcome-content glass rounded-xl p-8">
              <h2 className="h2 text-fluid-3xl mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Welcome to Chat Interface
              </h2>
              <p className="body-lg text-muted-foreground">
                This is a clean, professional chat interface for the Canadian Forces Travel Instructions Chatbot.
              </p>
            </div>
          </div>
        )}

        {messageList}

        {/* Typing Indicator */}
        {isLoading && (
          <div className="message-wrapper assistant-message">
            <div className="message-avatar">
              <div className="avatar assistant-avatar">
                <span>CF</span>
              </div>
            </div>
            <div className="assistant-plain-content">
              <div className="typing-indicator">
                <div className="typing-dot animate-typing-dot-bounce"></div>
                <div className="typing-dot animate-typing-dot-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="typing-dot animate-typing-dot-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div 
        className="input-area"
        style={{
          bottom: isKeyboardVisible ? `${keyboardHeight}px` : '0',
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))`,
          transition: 'bottom 0.3s ease-out'
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
