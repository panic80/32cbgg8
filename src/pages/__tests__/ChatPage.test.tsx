import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import ChatPage from '../ChatPage';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '' }),
}));

const setMessagesMock = vi.fn();
const handleStreamingChatMock = vi.fn().mockResolvedValue(undefined);
const scrollToBottomMock = vi.fn();
const setCommandOpenMock = vi.fn();

vi.mock('../ChatPage/hooks', () => ({
  useLocalStorage: () => [false, vi.fn()],
  useModelMode: vi.fn(),
  useDisclaimer: () => ({
    showDisclaimer: false,
    setShowDisclaimer: vi.fn(),
  }),
  useCommandPalette: () => ({
    commandOpen: false,
    setCommandOpen: setCommandOpenMock,
    showInlineCommand: false,
    setShowInlineCommand: vi.fn(),
    selectedCommandIndex: 0,
    handleInputChange: vi.fn(),
    handleKeyPress: vi.fn(),
    commands: [],
  }),
  useStreamingChat: () => ({
    messages: [],
    setMessages: setMessagesMock,
    pendingMessage: null,
    isLoading: false,
    retrievalStatus: null,
    handleStreamingChat: handleStreamingChatMock,
  }),
  useMessageWindow: () => ({
    combinedMessages: [],
    visibleMessages: [],
    startIndex: 0,
    canShowMore: false,
    showMore: vi.fn(),
  }),
  useScrollBehavior: () => ({
    isAtBottom: true,
    showNewPill: false,
    scrollToBottom: scrollToBottomMock,
  }),
  useChatTheme: vi.fn(),
  useMessageOperations: () => ({
    copyMessage: vi.fn(),
    regenerateMessage: vi.fn(),
  }),
}));

vi.mock('../ChatPage/components/BackgroundEffects', () => ({
  BackgroundEffects: () => <div data-testid="background-effects" />,
}));

vi.mock('../ChatPage/components/ChatHeader', () => ({
  ChatHeader: () => <div data-testid="chat-header">Header</div>,
}));

vi.mock('../ChatPage/components/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">Input</div>,
}));

vi.mock('../ChatPage/components/ChatMessage', () => ({
  ChatMessage: () => <div data-testid="chat-message">Message</div>,
}));

vi.mock('../ChatPage/components/HelpDialog', () => ({
  HelpDialog: () => <div data-testid="help-dialog" />,
}));

vi.mock('../ChatPage/components/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Ready to chat</div>,
}));

vi.mock('../ChatPage/components/TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

vi.mock('../ChatPage/components/ChatCommandPalette', () => ({
  ChatCommandPalette: () => <div data-testid="command-palette" />,
}));

vi.mock('../ChatPage/components/ChatMessagesPanel', () => ({
  ChatMessagesPanel: () => <div data-testid="messages-panel" />,
}));

describe('ChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat layout scaffolding', () => {
    render(<ChatPage />);

    expect(screen.getByTestId('chat-header')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });
});
