import { getRequestHeaders } from '../utils/api';
import type { ChatCompletionSource } from '../types';
import { chat_completion_sources } from '../types';

export interface ApiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionPayload {
  stream?: boolean;
  messages: ApiChatMessage[];
  model?: string;
  chat_completion_source?: string;
  max_tokens?: number;
  temperature?: number;
  // We can add other OpenAI params here as needed
}

export interface GenerationResponse {
  content: string;
  reasoning?: string;
}

function handleApiError(data: any): void {
  if (data?.error) {
    const errorMessage = data.error.message || data.error.type || 'An unknown API error occurred.';
    if (data.error.code === 'insufficient_quota') {
      throw new Error('You have exceeded your current quota. Please check your plan and billing details.');
    }
    throw new Error(errorMessage);
  }
}

function extractMessage(data: any, source: ChatCompletionSource): string {
  if (typeof data === 'string') {
    return data;
  }

  switch (source) {
    case chat_completion_sources.CLAUDE:
      return data?.content?.find((p: any) => p.type === 'text')?.text ?? '';
    case chat_completion_sources.OPENAI:
    case chat_completion_sources.OPENROUTER:
    // Fallback for most OpenAI-compatible APIs
    default:
      return (
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.text ??
        data?.results?.[0]?.output?.text ??
        data?.content?.[0]?.text ??
        ''
      );
  }
}

function extractReasoning(data: any, source: ChatCompletionSource): string | undefined {
  switch (source) {
    case chat_completion_sources.CLAUDE:
      return data?.content?.find((p: any) => p.type === 'thinking')?.thinking;
    case chat_completion_sources.OPENROUTER:
      return data?.choices?.[0]?.message?.reasoning;
    case chat_completion_sources.DEEPSEEK:
    case chat_completion_sources.XAI:
      return data?.choices?.[0]?.message?.reasoning_content;
    default:
      return undefined;
  }
}

export class ChatCompletionService {
  static async generate(payload: ChatCompletionPayload): Promise<GenerationResponse> {
    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
      cache: 'no-cache',
    });

    const responseData = await response.json().catch(() => ({ error: 'Failed to parse JSON response' }));

    if (!response.ok) {
      handleApiError(responseData);
      throw new Error(`Request failed with status ${response.status}`);
    }
    handleApiError(responseData);

    const source = payload.chat_completion_source as ChatCompletionSource;
    const messageContent = extractMessage(responseData, source);
    const reasoning = extractReasoning(responseData, source);

    return {
      content: messageContent,
      reasoning: reasoning,
    };
  }
}
