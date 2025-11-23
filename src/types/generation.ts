import type { GenerationMode, OpenrouterMiddleoutType, ReasoningEffort } from '../constants';
import type { ApiModel, ChatCompletionSource } from './api';
import type { Character } from './character';
import type { ChatMetadata, ChatMessage } from './chat';
import type { MessageRole } from './common';
import type { Persona } from './persona';
import type { SamplerSettings, Settings } from './settings';
import type { Tokenizer } from './tokenizer';
import type { WorldInfoBook, WorldInfoEntry, WorldInfoSettings } from './world-info';

export { type ReasoningEffort, type MessageRole };

export interface ApiChatMessage {
  role: MessageRole;
  content: string;
}

export type ChatCompletionPayload = Partial<{
  stream: boolean;
  messages: ApiChatMessage[];
  model: string;
  chat_completion_source: string;
  max_tokens: number;
  temperature?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  top_p?: number;
  top_k?: number;
  top_a?: number;
  min_p?: number;
  stop?: string[];
  // TODO: logit_bias?: Record<string, number>;
  n?: number;
  include_reasoning?: boolean;
  seed?: number;
  max_completion_tokens?: number;
  reasoning_effort?: ReasoningEffort | string;

  // Claude-specific
  claude_use_sysprompt: boolean;
  assistant_prefill: string;

  // OpenRouter-specific
  use_fallback?: boolean;
  provider?: string[];
  allow_fallbacks?: boolean;
  middleout?: OpenrouterMiddleoutType;

  // Google-specific
  use_makersuite_sysprompt?: boolean;

  // Mistral-specific
  safe_prompt?: boolean;
}>;

export interface GenerationResponse {
  content: string;
  reasoning?: string;
}

export interface StreamedChunk {
  delta: string;
  reasoning?: string; // Full reasoning
}

export type BuildChatCompletionPayloadOptions = {
  samplerSettings: SamplerSettings;
  messages: ApiChatMessage[];
  model: string;
  source: ChatCompletionSource;
  providerSpecific: Settings['api']['providerSpecific'];
  playerName?: string;
  modelList?: ApiModel[];
};

export type GenerationContext = {
  generationId: string;
  mode: GenerationMode;
  characters: Character[];
  chatMetadata: ChatMetadata;
  history: ChatMessage[];
  persona: Persona;
  tokenizer: Tokenizer;
  settings: {
    sampler: SamplerSettings;
    source: ChatCompletionSource;
    model: string;
    providerSpecific: Settings['api']['providerSpecific'];
  };
  // Other relevant data available to the interceptor for read-only purposes or modification
  playerName: string;
} & { controller: AbortController };

export type PromptBuilderOptions = {
  generationId: string;
  characters: Character[];
  chatMetadata: ChatMetadata;
  chatHistory: ChatMessage[];
  worldInfo: WorldInfoSettings;
  books: WorldInfoBook[];
  samplerSettings: SamplerSettings;
  persona: Persona;
  tokenizer: Tokenizer;
};

export interface PromptTokenBreakdown {
  // System / Character / Persona
  systemTotal: number; // Total tokens in system message(s)
  description: number; // Estimated
  personality: number; // Estimated
  scenario: number; // Estimated
  examples: number; // Estimated
  persona: number; // Estimated
  worldInfo: number; // Estimated or Calculated

  // Conversation
  chatHistory: number;

  // Misc
  extensions: number;
  bias: number;

  // Totals
  promptTotal: number; // Grand total
  maxContext: number; // Context Limit
  padding: number; // Max context - max response tokens
}

export interface ItemizedPrompt {
  generationId: string;
  messageIndex: number; // Map to chat message index (the bot response)
  model: string;
  api: string;
  tokenizer: string;
  presetName: string;

  messages: ApiChatMessage[];
  breakdown: PromptTokenBreakdown;

  timestamp: number;

  worldInfoEntries: Record<string, WorldInfoEntry[]>;
}
