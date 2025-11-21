import type { MessageRole } from './common';

export interface Character {
  fav?: boolean | string;
  create_date?: string;
  talkativeness?: number;
  name: string;
  avatar: string; // unique avatar filename
  description?: string;
  first_mes?: string;
  scenario?: string;
  personality?: string;
  mes_example?: string;
  tags?: string[];
  creatorcomment?: string;
  json_data?: string;
  chat?: string;
  shallow?: boolean;
  data?: {
    alternate_greetings?: string[];
    creator_notes?: string;
    creator?: string;
    character_version?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    depth_prompt?: {
      prompt: string;
      depth: number;
      role: MessageRole;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } & Record<string, any>;
}
