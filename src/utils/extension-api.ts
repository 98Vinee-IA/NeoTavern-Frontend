import { set } from 'lodash-es';
import { useChatStore } from '../stores/chat.store';
import { useSettingsStore } from '../stores/settings.store';
import { useCharacterStore } from '../stores/character.store';
import { toast } from '../composables/useToast';
import {
  ChatCompletionService,
  type ChatCompletionPayload,
  type GenerationResponse,
  type StreamedChunk,
} from '../api/generation';
import type { Character, ChatMessage, Settings, SettingsPath } from '../types';
import type { ValueForPath } from '../types/utils';
import { eventEmitter } from './event-emitter';

/**
 * The public API exposed to extensions.
 * This facade provides controlled access to the application's state and actions,
 * ensuring stability and preventing extensions from breaking on internal refactors.
 */
export const extensionAPI = {
  /**
   * Functions related to chat management.
   */
  chat: {
    /**
     * Sends a message to the current chat as the user and triggers an AI response.
     * @param messageText The content of the message to send.
     * @returns A promise that resolves when the message is sent and generation begins.
     */
    sendMessage: (messageText: string): Promise<void> => {
      // We get the store instance inside the function call to ensure Pinia is initialized.
      return useChatStore().sendMessage(messageText);
    },

    /**
     * Gets the entire chat history for the active chat.
     * @returns A deep copy of the chat messages array to prevent direct state mutation.
     */
    getHistory: (): ChatMessage[] => {
      return JSON.parse(JSON.stringify(useChatStore().chat));
    },

    /**
     * Aborts any ongoing AI message generation.
     */
    abortGeneration: (): void => {
      useChatStore().abortGeneration();
    },
  },

  /**
   * Functions for interacting with the AI generation service.
   */
  generation: {
    /**
     * A direct, low-level interface to the chat completion service.
     * Use this for custom generation logic.
     * @param payload The payload for the generation request. See `ChatCompletionPayload`.
     * @param signal An optional AbortSignal to cancel the request.
     * @returns A Promise that resolves to a GenerationResponse or a stream generator function.
     */
    generate: (
      payload: ChatCompletionPayload,
      signal?: AbortSignal,
    ): Promise<GenerationResponse | (() => AsyncGenerator<StreamedChunk>)> => {
      return ChatCompletionService.generate(payload, signal);
    },
  },

  /**
   * Functions for reading and writing application settings.
   */
  settings: {
    /**
     * Retrieves a setting value in a type-safe way.
     * @param path The dot-notation path to the setting (e.g., 'chat.sendOnEnter').
     * @returns The value of the setting.
     */
    get: <P extends SettingsPath>(path: P): ValueForPath<Settings, P> => {
      return useSettingsStore().getSetting(path);
    },

    /**
     * Updates a single setting value. Triggers a debounced save.
     * @param path The dot-notation path to the setting.
     * @param value The new value to set, which must match the setting's type.
     */
    set: <P extends SettingsPath>(path: P, value: ValueForPath<Settings, P>): void => {
      useSettingsStore().setSetting(path, value);
    },

    /**
     * Updates multiple settings at once. This is more efficient as it triggers only one debounced save.
     * @param updates An object where keys are dot-notation setting paths and values are the new settings.
     */
    setMultiple: (updates: { [P in SettingsPath]?: ValueForPath<Settings, P> }): void => {
      const store = useSettingsStore();
      Object.entries(updates).forEach(([path, value]) => {
        // Use lodash's `set` to apply each update to the reactive settings object without saving yet.
        set(store.settings, path, value);
      });
      // Trigger a single debounced save after all changes are applied.
      store.saveSettingsDebounced();
    },

    /**
     * Manually triggers an immediate save of all settings.
     * This flushes any pending debounced save operations.
     */
    save: (): void => {
      const store = useSettingsStore();
      if (store.saveSettingsDebounced.flush) {
        store.saveSettingsDebounced.flush();
      }
    },
  },

  /**
   * Functions related to the current character.
   */
  character: {
    /**
     * Gets the currently active character object.
     * @returns A deep copy of the active character, or null if none is active.
     */
    getActive: (): Character | null => {
      const character = useCharacterStore().activeCharacter;
      // Return a deep copy to prevent direct mutation from extensions.
      return character ? JSON.parse(JSON.stringify(character)) : null;
    },
  },

  /**
   * General UI utility functions.
   */
  ui: {
    /**
     * Displays a toast notification.
     * @param message The message to display.
     * @param type The type of toast ('success', 'info', 'warning', 'error'). Defaults to 'info'.
     */
    showToast: (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      toast[type](message);
    },
  },

  /**
   * Application-level event bus for extensions.
   */
  events: {
    on: eventEmitter.on.bind(eventEmitter),
    off: eventEmitter.off.bind(eventEmitter),
    emit: eventEmitter.emit.bind(eventEmitter),
  },
};

// We freeze the API object and its top-level properties to prevent extensions from modifying them.
Object.freeze(extensionAPI);
Object.keys(extensionAPI).forEach((key) => Object.freeze(extensionAPI[key as keyof typeof extensionAPI]));

// Export the type of the API for our own project's internal use.
export type ExtensionAPI = typeof extensionAPI;
