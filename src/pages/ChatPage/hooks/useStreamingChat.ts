import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { SetStateAction } from 'react';
import { getModelDisplayName } from '@/constants/models';
import type { Message, Source, FollowUpQuestion } from '@/types/chat';

interface UseStreamingChatOptions {
  conversationId: string | null;
  setConversationId: (id: string) => void;
  setCurrentModel: (model: string) => void;
  DEFAULT_MODEL_ID: string;
  useRAG: boolean;
  shortAnswerMode: boolean;
  modelMode: 'fast' | 'smart';
}

interface StreamingState {
  messages: Message[];
  pendingMessage: Message | null;
  isLoading: boolean;
  retrievalStatus: string | null;
}

type MessagesUpdater = SetStateAction<Message[]>;

type StreamingAction =
  | { type: 'SET_MESSAGES'; updater: MessagesUpdater }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_PENDING'; message: Message | null }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_RETRIEVAL_STATUS'; status: string | null }
  | { type: 'FINALIZE_MESSAGE'; message: Message };

const initialState: StreamingState = {
  messages: [],
  pendingMessage: null,
  isLoading: false,
  retrievalStatus: null,
};

const streamingReducer = (state: StreamingState, action: StreamingAction): StreamingState => {
  switch (action.type) {
    case 'SET_MESSAGES': {
      const nextMessages = typeof action.updater === 'function'
        ? (action.updater as (prev: Message[]) => Message[])(state.messages)
        : action.updater;
      return {
        ...state,
        messages: nextMessages,
        pendingMessage: nextMessages.length === 0 ? null : state.pendingMessage,
      };
    }
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };
    case 'SET_PENDING':
      return {
        ...state,
        pendingMessage: action.message,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.value,
      };
    case 'SET_RETRIEVAL_STATUS':
      return {
        ...state,
        retrievalStatus: action.status,
      };
    case 'FINALIZE_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
        pendingMessage: null,
        isLoading: false,
        retrievalStatus: null,
      };
    default:
      return state;
  }
};

const markdownPattern = /```|\n\s*#|\*\*|\n\s*[-*+]\s|<[^>]+>/;

const toSources = (eventSources: any[] = []): Source[] =>
  eventSources.map(source => ({
    text: source.content || source.text || '',
    reference: source.source || source.reference || source.title || '',
  }));

const toFollowUps = (messageId: string, items: any[] = []): FollowUpQuestion[] =>
  items.map((item, index) => ({
    id: `${messageId}-fu-${index}`,
    question: item.question || item,
    category: item.category || 'general',
    icon: item.icon,
  }));

export const useStreamingChat = ({
  conversationId,
  setConversationId,
  setCurrentModel,
  DEFAULT_MODEL_ID,
  useRAG,
  shortAnswerMode,
  modelMode,
}: UseStreamingChatOptions) => {
  const [state, dispatch] = useReducer(streamingReducer, initialState);
  const { messages, pendingMessage, isLoading, retrievalStatus } = state;

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<Message | null>(null);
  const rafIdRef = useRef<number | null>(null);

const flushPendingMessage = useCallback(() => {
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);
  }
    if (!pendingMessageRef.current) return;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (pendingMessageRef.current) {
        dispatch({ type: 'SET_PENDING', message: { ...pendingMessageRef.current } });
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const setMessages = useCallback((updater: MessagesUpdater) => {
    dispatch({ type: 'SET_MESSAGES', updater });
  }, []);

  const handleStreamingChat = useCallback(async (messageText: string) => {
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: 'user',
      timestamp: Date.now(),
      modelMode,
    };

    dispatch({ type: 'ADD_MESSAGE', message: userMessage });
    const currentInput = messageText;
    dispatch({ type: 'SET_LOADING', value: true });
    dispatch({ type: 'SET_RETRIEVAL_STATUS', status: 'Contacting retrieval service...' });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    pendingMessageRef.current = null;
    dispatch({ type: 'SET_PENDING', message: null });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const messageId = (Date.now() + 1).toString();
    let streamingContent = '';
    let sources: Source[] = [];
    let followUpQuestions: FollowUpQuestion[] = [];

    try {
      const isTripPlannerMessage = messageText.startsWith('📋 **Trip Plan Request**');
      const userSelectedModel = localStorage.getItem('selectedLLMModel') || DEFAULT_MODEL_ID;
      const selectedModel = isTripPlannerMessage ? 'gpt-5-mini' : userSelectedModel;
      const historyLimit = selectedModel === 'gpt-5-mini' ? 6 : 10;
      const selectedProvider = localStorage.getItem('selectedLLMProvider') || 'openai';

      if (!isTripPlannerMessage) {
        const displayModel = getModelDisplayName(selectedModel);
        setCurrentModel(displayModel);
      }

      const endpoint = '/api/v2/chat/stream';
      const requestBody = JSON.stringify({
        message: currentInput,
        model: selectedModel,
        provider: selectedProvider,
        useRAG,
        shortAnswerMode,
        conversationId,
        chatHistory: messages.slice(-historyLimit).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Streaming service error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      pendingMessageRef.current = {
        id: messageId,
        content: '',
        sender: 'assistant',
        timestamp: Date.now(),
        sources: undefined,
        followUpQuestions: undefined,
        modelMode,
      };
      dispatch({ type: 'SET_PENDING', message: { ...pendingMessageRef.current } });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]' || data === '') continue;

          try {
            const event = JSON.parse(data);
            switch (event.type) {
              case 'retrieval_start':
                dispatch({ type: 'SET_RETRIEVAL_STATUS', status: 'Searching trusted sources...' });
                break;
              case 'retrieval_complete':
                dispatch({ type: 'SET_RETRIEVAL_STATUS', status: 'Preparing answer...' });
                break;
              case 'sources':
                sources = toSources(event.sources);
                if (pendingMessageRef.current) {
                  pendingMessageRef.current.sources = sources.length > 0 ? sources : undefined;
                  flushPendingMessage();
                } else if (sources.length > 0) {
                  dispatch({
                    type: 'SET_MESSAGES',
                    updater: prev => {
                      if (prev.length === 0) return prev;
                      const updated = [...prev];
                      const lastIndex = updated.length - 1;
                      updated[lastIndex] = { ...updated[lastIndex], sources };
                      return updated;
                    },
                  });
                }
                break;
              case 'token':
                if (event.content) {
                  dispatch({ type: 'SET_RETRIEVAL_STATUS', status: 'Generating answer...' });
                  streamingContent += event.content;
                  if (pendingMessageRef.current) {
                    pendingMessageRef.current.content = streamingContent;
                    pendingMessageRef.current.isFormatted = markdownPattern.test(streamingContent);
                    flushPendingMessage();
                  }
                }
                break;
              case 'metadata':
                if (event.conversation_id && !conversationId) {
                  setConversationId(event.conversation_id);
                }
                if (event.follow_up_questions && Array.isArray(event.follow_up_questions)) {
                  followUpQuestions = toFollowUps(messageId, event.follow_up_questions);
                  if (pendingMessageRef.current) {
                    pendingMessageRef.current.followUpQuestions = followUpQuestions.length > 0 ? followUpQuestions : undefined;
                    flushPendingMessage();
                  } else if (followUpQuestions.length > 0) {
                    dispatch({
                      type: 'SET_MESSAGES',
                      updater: prev => {
                        if (prev.length === 0) return prev;
                        const updated = [...prev];
                        const lastIndex = updated.length - 1;
                        updated[lastIndex] = { ...updated[lastIndex], followUpQuestions };
                        return updated;
                      },
                    });
                  }
                }
                break;
              case 'complete': {
                const finalMessage: Message = {
                  id: messageId,
                  content: streamingContent.trim(),
                  sender: 'assistant',
                  timestamp: Date.now(),
                  isFormatted: markdownPattern.test(streamingContent),
                  sources: sources.length > 0 ? sources : undefined,
                  followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
                  modelMode,
                };
                dispatch({ type: 'FINALIZE_MESSAGE', message: finalMessage });
                pendingMessageRef.current = null;
                break;
              }
              case 'error':
                console.error('Streaming error event:', event);
                throw new Error(event.message || 'Streaming error occurred');
              default:
                break;
            }
          } catch (parseError) {
            if (data && data !== '') {
              console.error('Error parsing SSE event:', parseError, 'Data:', data.substring(0, 100));
            }
          }
        }
      }

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      pendingMessageRef.current = null;
      dispatch({ type: 'SET_PENDING', message: null });
      dispatch({ type: 'SET_LOADING', value: false });
      dispatch({ type: 'SET_RETRIEVAL_STATUS', status: null });
    } catch (error) {
      console.error('Error with streaming chat:', error);

      if (error instanceof DOMException && error.name === 'AbortError') {
        dispatch({ type: 'SET_LOADING', value: false });
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        pendingMessageRef.current = null;
        dispatch({ type: 'SET_PENDING', message: null });
        dispatch({ type: 'SET_RETRIEVAL_STATUS', status: null });
        return;
      }

      pendingMessageRef.current = null;
      dispatch({ type: 'SET_PENDING', message: null });
      dispatch({ type: 'SET_RETRIEVAL_STATUS', status: null });

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `Sorry, I encountered an error while processing your request. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_MESSAGE', message: errorMessage });
      dispatch({ type: 'SET_LOADING', value: false });

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [
    conversationId,
    setConversationId,
    setCurrentModel,
    DEFAULT_MODEL_ID,
    useRAG,
    shortAnswerMode,
    modelMode,
    messages,
    isLoading,
    flushPendingMessage,
  ]);

  return {
    messages,
    setMessages,
    pendingMessage,
    isLoading,
    retrievalStatus,
    handleStreamingChat,
  };
};

export default useStreamingChat;
