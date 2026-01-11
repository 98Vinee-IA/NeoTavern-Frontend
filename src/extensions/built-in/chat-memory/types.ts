export interface ChatMemoryRecord {
  bookName: string;
  entryUid: number;
  range: [number, number];
  timestamp: number;
}

export interface ChatMemoryMetadata {
  memories: ChatMemoryRecord[];
}

export interface MemoryMessageExtra {
  summarized: boolean;
  original_is_system?: boolean;
}

export interface ExtensionSettings {
  connectionProfile?: string;
  prompt: string;
  autoHideMessages: boolean;
  lastLorebook?: string;
}

export const EXTENSION_KEY = 'core.chat-memory';

export const DEFAULT_PROMPT = `# Task: Summarize Conversation

You are an expert editor. Your task is to summarize the provided conversation segment concisely.
Focus on key events, decisions, and facts that should be remembered for the future.

## Text to Summarize
\`\`\`
{{text}}
\`\`\`

## Instructions
1. Summarize the text.
2. Your response **must** only contain the summary, enclosed in a single markdown code block.

Example format:
\`\`\`
The user and the character met at the tavern. They discussed...
\`\`\``;
