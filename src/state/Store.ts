import { atom } from 'nanostores';
import localforage from 'localforage';
import Bowser from 'bowser';

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
  data?: { alternate_greetings?: string[] } & Record<string, any>;
}

export interface Group {
  disabled_members?: Array<string>;
  chats: string[];
  members: Array<Character['name']>;
  past_metadata?: Record<string, any>;
  id: string;
  chat_id: string;
}

export interface Tag {
  id: string;
  name: string;
  folder_type?: string;
  filter_state?: string;
  sort_order?: number;
  color?: string;
  color2?: string;
  create_date?: number;
  is_hidden_on_character_card?: boolean;
  action?: Function;
  class?: string;
  icon?: string;
  title?: string;
}

export interface Entity {
  item: Character | Tag | Group;
  id: string | number;
  type: 'character' | 'tag' | 'group';
  entities?: Entity[];
  hidden?: number;
  isUseless?: boolean;
}

export interface ChatMessage {
  send_date?: string;
  name: string;
  mes: string;
  gen_started?: string;
  gen_finished?: string;
  is_user?: boolean;
  is_system?: boolean;
  force_avatar?: string;
  original_avatar?: string;
  swipes?: string[];
  swipe_info?: Record<string, any>;
  swipe_id?: number;
  extra?: {
    reasoning?: string;
    reasoning_duration?: number;
    reasoning_type?: string;
    display_text?: string;
    reasoning_display_text?: string;
    tool_invocations?: any[];
    append_title?: boolean;
    title?: string;
    isSmallSys?: boolean;
    token_count?: number;
  } & Record<string, any>;
}

export interface ExtensionPrompt {
  value: string;
  position: number;
  depth: number;
  scan: boolean;
  filter: () => boolean | Promise<boolean>;
}
export interface CreateSave {
  name: string;
  description: string;
  creator_notes: string;
  post_history_instructions: string;
  character_version: string;
  system_prompt: string;
  tags: string;
  creator: string;
  personality: string;
  first_message: string;
  avatar: FileList | null;
  scenario: string;
  mes_example: string;
  world: string;
  talkativeness: number;
  alternate_greetings: any[];
  depth_prompt_prompt: string;
  depth_prompt_depth: number;
  depth_prompt_role: string;
  extensions: Record<string, any>;
  extra_books: any[];
}

export type MenuType = 'character_edit' | 'characters' | 'settings' | 'create' | 'group_chats';

export const SendOnEnterOptions = {
  DISABLED: -1,
  AUTO: 0,
  ENABLED: 1,
} as const;

export const DebounceTimeout = {
  QUICK: 100,
  SHORT: 200,
  STANDARD: 300,
  RELAXED: 1000,
  EXTENDED: 5000,
} as const;

export const RegexPlacement = {
  /**
   * @deprecated MD Display is deprecated. Do not use.
   */
  MD_DISPLAY: 0,
  USER_INPUT: 1,
  AI_OUTPUT: 2,
  SLASH_COMMAND: 3,
  // 4 - sendAs (legacy)
  WORLD_INFO: 5,
  REASONING: 6,
} as const;

export const TAG_FOLDER_TYPES = {
  OPEN: {
    icon: '✔',
    class: 'folder_open',
    fa_icon: 'fa-folder-open',
    tooltip: 'Open Folder (Show all characters even if not selected)',
    color: 'green',
    size: '1',
  },
  CLOSED: {
    icon: '👁',
    class: 'folder_closed',
    fa_icon: 'fa-eye-slash',
    tooltip: 'Closed Folder (Hide all characters unless selected)',
    color: 'lightgoldenrodyellow',
    size: '0.7',
  },
  NONE: { icon: '✕', class: 'no_folder', tooltip: 'No Folder', color: 'red', size: '1' },
} as const;

export const DEFAULT_SAVE_EDIT_TIMEOUT = DebounceTimeout.RELAXED;

export type ThumbnailType = 'bg' | 'avatar' | 'persona';

export const default_avatar = 'img/ai4.png';
export const ANIMATION_DURATION_DEFAULT = 125;
export let animation_duration = ANIMATION_DURATION_DEFAULT;
export let animation_easing = 'ease-in-out';

export const token = atom<string | null>(null);

export const characters = atom<Array<Character>>([]);
export const groups = atom<Array<Group>>([]);
export const worldNames = atom<Array<string>>([]);

export const activeCharacterIndex = atom<number | null>(null);
export const activeGroupId = atom<string | null>(null);
export const activeMessageEditIndex = atom<number | null>(null);
export const activeCharacterName = atom<string | null>(null);
export const activePlayerName = atom<string>('User');

export const isChatSaving = atom<boolean>(false);
export const isGroupGenerating = atom<boolean>(false);
export const isDeleteMode = atom<boolean>(false);
export const isSendPress = atom<boolean>(false);

export const chatMetadata = atom<Record<string, any>>({});
export const chat = atom<Array<ChatMessage>>([]);
export const chatCreateDate = atom<string | null>(null);
export const favoriteCharacterChecked = atom<boolean>(false);

export const selectedButton = atom<MenuType | null>(null);
export const menuType = atom<MenuType | null>(null);

export const talkativeness_default = 0.5;
export const depth_prompt_depth_default = 4;
export const depth_prompt_role_default = 'system';
export const createSave = atom<CreateSave>({
  name: '',
  description: '',
  creator_notes: '',
  post_history_instructions: '',
  character_version: '',
  system_prompt: '',
  tags: '',
  creator: '',
  personality: '',
  first_message: '',
  avatar: null,
  scenario: '',
  mes_example: '',
  world: '',
  talkativeness: talkativeness_default,
  alternate_greetings: [],
  depth_prompt_prompt: '',
  depth_prompt_depth: depth_prompt_depth_default,
  depth_prompt_role: depth_prompt_role_default,
  extensions: {},
  extra_books: [],
});

export const extensionPrompts = atom<Record<string, ExtensionPrompt>>({});

const promptStorage = localforage.createInstance({ name: 'SillyTavern_Prompts' });
// TODO: Define a type
export const itemizedPrompts = atom<Array<any>>([]);

export const chatSaveTimeout = atom<ReturnType<typeof setTimeout> | null>(null);
export const saveMetadataTimeout = atom<ReturnType<typeof setTimeout> | null>(null);

export const powerUser = atom<{
  external_media_forbidden_overrides: Array<string>;
  external_media_allowed_overrides: Array<string>;
  forbid_external_media: boolean;
  world_import_dialog: boolean;
  send_on_enter: number;
  never_resize_avatars: boolean;
}>({
  world_import_dialog: true,
  send_on_enter: SendOnEnterOptions.AUTO,
  never_resize_avatars: false,
  external_media_forbidden_overrides: [],
  external_media_allowed_overrides: [],
  forbid_external_media: false,
});

export const cropData = atom<any>(null);

/**
 * Saves the itemized prompts for a chat.
 */
export async function saveItemizedPrompts(chatId?: string) {
  try {
    if (!chatId) {
      return;
    }

    await promptStorage.setItem(chatId, itemizedPrompts);
  } catch {
    console.log('Error saving itemized prompts for chat', chatId);
  }
}

export async function loadItemizedPrompts(chatId?: string) {
  try {
    if (!chatId) {
      itemizedPrompts.set([]);
      return;
    }

    // @ts-ignore
    itemizedPrompts.set(await promptStorage.getItem(chatId));

    if (!itemizedPrompts) {
      // @ts-ignore
      itemizedPrompts.set([]);
    }
  } catch {
    console.log('Error loading itemized prompts for chat', chatId);
    itemizedPrompts.set([]);
  }
}

export function shouldSendOnEnter() {
  const resolvedPowerUser = powerUser.get();

  switch (resolvedPowerUser.send_on_enter) {
    case SendOnEnterOptions.DISABLED:
      return false;
    case SendOnEnterOptions.AUTO:
      return !isMobile();
    case SendOnEnterOptions.ENABLED:
      return true;
  }
}

/**
 * Checks if the device is a mobile device.
 * @returns {boolean} - True if the device is a mobile device, false otherwise.
 */
export function isMobile() {
  const mobileTypes = ['mobile', 'tablet'];

  const result = getParsedUA();
  if (!result || !result.platform || !result.platform.type) {
    return false;
  }
  return mobileTypes.includes(result.platform.type);
}

/**
 * DON'T OPTIMIZE, don't change this to a const or let, it needs to be a var.
 */
var parsedUA: Bowser.Parser.ParsedResult | null = null;

export function getParsedUA() {
  if (!parsedUA) {
    try {
      parsedUA = Bowser.parse(navigator.userAgent);
    } catch {
      // In case the user agent is an empty string or Bowser can't parse it for some other reason
    }
  }

  return parsedUA;
}
