import type {
  ChatMessage,
  Character,
  SettingsPath,
  WorldInfoEntry,
  ProcessedWorldInfo,
  WorldInfoOptions,
  PromtBuilderOptions,
  GenerationContext,
  Persona,
  WorldInfoBook,
} from '../types';
import { EventPriority } from '../types';
import type { ApiChatMessage, ChatCompletionPayload, GenerationResponse, StreamedChunk } from '../api/generation';

export interface ExtensionEventMap {
  // General Application Events
  'app:loaded': [];
  'chat:cleared': [];
  'chat:updated': [];
  'chat:entered': [character: Character, chatFile: string];
  'setting:changed': [path: SettingsPath, value: any, oldValue: any];

  // Message Events
  'message:created': [message: ChatMessage];
  'message:updated': [index: number, message: ChatMessage];
  'message:deleted': [index: number];

  // Character Events
  'character:created': [character: Character];
  'character:updated': [character: Character, changes: Partial<Character>];
  'character:deleted': [avatar: string]; // TODO: Since it is not exist, not used yet
  'character:imported': [character: Character];

  // Persona Events
  'persona:created': [persona: Persona]; // TODO: Since it is not exist, not used yet
  'persona:updated': [persona: Persona];
  'persona:deleted': [avatarId: string];
  'persona:activated': [persona: Persona | null];

  // World Info Events
  'world-info:book-created': [bookName: string];
  'world-info:book-updated': [book: WorldInfoBook];
  'world-info:book-deleted': [bookName: string];
  'world-info:book-renamed': [oldName: string, newName: string];
  'world-info:book-imported': [bookName: string];
  'world-info:entry-created': [bookName: string, entry: WorldInfoEntry];
  'world-info:entry-updated': [bookName: string, entry: WorldInfoEntry];
  'world-info:entry-deleted': [bookName: string, uid: number];

  // Generation Flow Events
  'generation:started': [];
  'generation:finished': [message: ChatMessage | null, error?: Error];
  'prompt:building-started': [options: PromtBuilderOptions];
  'prompt:built': [messages: ApiChatMessage[]];
  'world-info:processing-started': [options: WorldInfoOptions];
  'world-info:entry-activated': [entry: WorldInfoEntry];
  'world-info:processing-finished': [result: ProcessedWorldInfo];

  /**
   * Data Processing Events
   * Listeners for these events can modify the data object passed as the first argument.
   * They are fired sequentially and awaited by the core application.
   */
  'process:generation-context': [context: GenerationContext];
  'process:request-payload': [payload: ChatCompletionPayload];
  'process:response': [response: GenerationResponse, payload: ChatCompletionPayload];
  'process:stream-chunk': [chunk: StreamedChunk, payload: ChatCompletionPayload];
}

type EventName = keyof ExtensionEventMap;
type Listener<E extends EventName> = (...args: ExtensionEventMap[E]) => Promise<void> | void;

interface ListenerObject<E extends EventName> {
  listener: Listener<E>;
  priority: number;
}

class EventEmitter {
  private events: { [E in EventName]?: ListenerObject<E>[] } = {};

  on<E extends EventName>(
    eventName: E,
    listener: Listener<E>,
    priority: number | EventPriority = EventPriority.MEDIUM,
  ): () => void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    const listenerObject = { listener, priority };
    this.events[eventName]!.push(listenerObject);

    // Sort by priority (descending) after adding
    this.events[eventName]!.sort((a, b) => b.priority - a.priority);

    // Return an `off` function for easy cleanup
    return () => this.off(eventName, listener);
  }

  off<E extends EventName>(eventName: E, listener: Listener<E>): void {
    if (!this.events[eventName]) {
      return;
    }
    const index = this.events[eventName]!.findIndex((l) => l.listener === listener);
    if (index > -1) {
      this.events[eventName]!.splice(index, 1);
    }
  }

  async emit<E extends EventName>(eventName: E, ...args: ExtensionEventMap[E]): Promise<void> {
    const listeners = this.events[eventName];
    if (!listeners) {
      return;
    }
    for (const listenerObject of [...listeners]) {
      await listenerObject.listener(...args);
    }
  }
}

export const eventEmitter = new EventEmitter();
