import { useState } from 'react';
import { getModelDisplayName } from '@/constants/models';

// Step 5.2: Define hook interface
interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isFormatted?: boolean;
  sources?: Source[];
  followUpQuestions?: FollowUpQuestion[];
  modelMode?: 'fast' | 'smart';
}

interface Source {
  text: string;
  reference: string;
}

interface FollowUpQuestion {
  id: string;
  question: string;
  category: string;
  icon?: any;
}

interface UseStreamingChatOptions {
  conversationId: string | null;
  setConversationId: (id: string) => void;
  setCurrentModel: (model: string) => void;
  DEFAULT_MODEL_ID: string;
  useRAG: boolean;
  useHybridSearch: boolean;
  shortAnswerMode: boolean;
  modelMode: 'fast' | 'smart';
}

export const useStreamingChat = ({
  conversationId,
  setConversationId,
  setCurrentModel,
  DEFAULT_MODEL_ID,
  useRAG,
  useHybridSearch,
  shortAnswerMode,
  modelMode
}: UseStreamingChatOptions) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleStreamingChat = async (messageText: string) => {
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText,
      sender: 'user',
      timestamp: Date.now(),
      modelMode: modelMode,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = messageText;
    setIsLoading(true);

    // Create a temporary message to hold streaming content
    const messageId = (Date.now() + 1).toString();
    let streamingContent = '';
    let sources: Source[] = [];
    let followUpQuestions: FollowUpQuestion[] = [];
    let retrievalStatus = '';
    let lastUpdateTs = 0;
    const throttleMs = 120;
    let scheduledFrame = false;

    try {
      // Check if this is a Trip Planner message - always use gpt-5-mini for Trip Planner
      const isTripPlannerMessage = messageText.startsWith('📋 **Trip Plan Request**');
      
      // Get selected model from localStorage or use gpt-5-mini for Trip Planner
      const userSelectedModel = localStorage.getItem('selectedLLMModel') || DEFAULT_MODEL_ID;
      const selectedModel = isTripPlannerMessage ? 'gpt-5-mini' : userSelectedModel;
      const selectedProvider = localStorage.getItem('selectedLLMProvider') || 'openai';
      
      // Only update display if NOT a Trip Planner message (keep user's display unchanged)
      if (!isTripPlannerMessage) {
        const displayModel = getModelDisplayName(selectedModel);
        setCurrentModel(displayModel);
      }
      
      // Use SSE streaming endpoint
      const endpoint = '/api/v2/chat/stream';
      
      // Create request body
      const requestBody = JSON.stringify({
        message: currentInput,
        model: selectedModel,
        provider: selectedProvider,
        useRAG: useRAG,
        shortAnswerMode: shortAnswerMode,
        // HYBRID_SEARCH_TOGGLE_START
        useHybridSearch: useHybridSearch,
        // HYBRID_SEARCH_TOGGLE_END
        conversationId: conversationId,
        chatHistory: messages.slice(-10).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      });

      // Use fetch with streaming response
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Streaming service error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      // Process SSE stream with buffering for incomplete messages
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]' || data === '') continue;

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case 'retrieval_start':
                  retrievalStatus = 'Searching documents...';
                  // Show retrieval status - REMOVED per user request
                  break;

                case 'retrieval_complete':
                  retrievalStatus = '';
                  // Clear retrieval status - REMOVED per user request
                  break;

                case 'sources':
                  sources = (event.sources || []).map((source: any) => ({
                    text: source.content || source.text || '',
                    reference: source.source || source.reference || source.title || ''
                  }));
                  break;

                case 'generation_start':
                  // Start showing the actual response
                  break;

                case 'token':
                  if (event.content) {
                    streamingContent += event.content;
                    const now = Date.now();
                    if ((now - lastUpdateTs > throttleMs) && !scheduledFrame) {
                      scheduledFrame = true;
                      requestAnimationFrame(() => {
                        // Update message with streaming content (throttled to ~1/frame)
                        setMessages(prev => {
                          const newMessages = [...prev];
                          const existingIndex = newMessages.findIndex(msg => msg.id === messageId);
                          const markdownPattern = /```|\n\s*#|\*\*|\n\s*[-*+]\s|<[^>]+>/;
                          const isMarkdown = markdownPattern.test(streamingContent);
                          const streamingMessage: Message = {
                            id: messageId,
                            content: streamingContent,
                            sender: 'assistant',
                            timestamp: Date.now(),
                            isFormatted: isMarkdown,
                            sources: sources.length > 0 ? sources : undefined,
                          };
                          if (existingIndex >= 0) {
                            newMessages[existingIndex] = streamingMessage;
                          } else {
                            newMessages.push(streamingMessage);
                          }
                          return newMessages;
                        });
                        lastUpdateTs = Date.now();
                        scheduledFrame = false;
                      });
                    }
                  }
                  break;

                case 'metadata':
                  // Update conversation ID if provided
                  if (event.conversation_id && !conversationId) {
                    setConversationId(event.conversation_id);
                  }
                  
                  // Handle follow-up questions from metadata
                  if (event.follow_up_questions && Array.isArray(event.follow_up_questions)) {
                    followUpQuestions = event.follow_up_questions.map((q: any, index: number) => ({
                      id: `${messageId}-fu-${index}`,
                      question: q.question || q,
                      category: q.category || 'general',
                      icon: q.icon,
                    }));
                  }
                  break;

                case 'complete':
                  // Finalize the message with all metadata
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const existingIndex = newMessages.findIndex(msg => msg.id === messageId);
                    
                    const markdownPattern = /```|\n\s*#|\*\*|\n\s*[-*+]\s|<[^>]+>/;
                    const isMarkdown = markdownPattern.test(streamingContent);
                    
                  const finalMessage: Message = {
                    id: messageId,
                    content: streamingContent.trim(),
                    sender: 'assistant',
                    timestamp: Date.now(),
                    isFormatted: isMarkdown,
                    sources: sources.length > 0 ? sources : undefined,
                    followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
                    modelMode: modelMode,
                  };

                    if (existingIndex >= 0) {
                      newMessages[existingIndex] = finalMessage;
                    }
                    
                    return newMessages;
                  });
                  break;

                case 'error':
                  console.error('Streaming error event:', event);
                  throw new Error(event.message || 'Streaming error occurred');
              }
            } catch (parseError) {
              // Only log actual parsing errors, not empty data
              if (data && data !== '') {
                console.error('Error parsing SSE event:', parseError, 'Data:', data.substring(0, 100));
              }
            }
          }
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error with streaming chat:', error);
      
      // Remove any temporary messages
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `Sorry, I encountered an error while processing your request. Please try again. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'assistant',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    }
  };

  return {
    messages,
    setMessages,
    isLoading,
    handleStreamingChat
  };
};
