import { z } from 'zod';

const trimmedString = (field, min = 1) =>
  z
    .string({
      required_error: `${field} is required.`,
      invalid_type_error: `${field} must be a string.`,
    })
    .transform((value) => value.trim())
    .refine((value) => value.length >= min, `${field} must be a non-empty string.`);

const optionalTrimmedString = (field) =>
  z
    .string({
      invalid_type_error: `${field} must be a string.`,
    })
    .transform((value) => value.trim())
    .optional();

export const geminiGenerationSchema = z.object({
  prompt: trimmedString('Prompt'),
});

export const standardChatSchema = z.object({
  message: trimmedString('Message'),
  model: trimmedString('Model'),
  provider: trimmedString('Provider'),
});

export const ragChatSchema = z.object({
  message: trimmedString('Message'),
  model: optionalTrimmedString('Model'),
  provider: optionalTrimmedString('Provider'),
  chatHistory: z.array(z.any()).optional(),
  conversationId: optionalTrimmedString('Conversation ID'),
  useRAG: z.boolean().optional(),
  audience: optionalTrimmedString('Audience'),
});

export const streamingChatSchema = ragChatSchema.extend({
  shortAnswerMode: z.boolean().optional(),
  useHybridSearch: z.boolean().optional(),
  reasoningEffort: optionalTrimmedString('Reasoning effort'),
  responseVerbosity: optionalTrimmedString('Response verbosity'),
});
