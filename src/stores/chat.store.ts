import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChatMessage } from '../types';
import { usePromptStore } from './prompt.store';
import { useCharacterStore } from './character.store';
import { useUiStore } from './ui.store';
import { useApiStore } from './api.store';
import { fetchChat, saveChat as apiSaveChat } from '../api/chat';
import { getMessageTimeStamp, humanizedDateTime } from '../utils/date';
import { uuidv4 } from '../utils/common';
import { getFirstMessage } from '../utils/chat';
import { toast } from '../composables/useToast';
import i18n from '../i18n';
import { PromptBuilder } from '../utils/prompt-builder';
import { ChatCompletionService } from '../api/generation';
import { getThumbnailUrl } from '../utils/image';
import { default_user_avatar } from '../constants';

// TODO: Replace with a real API call to the backend for accurate tokenization
async function getTokenCount(text: string): Promise<number> {
  if (!text || typeof text !== 'string') return 0;
  // This is a very rough approximation. The backend will have a proper tokenizer.
  return Math.round(text.length / 4);
}

export const useChatStore = defineStore('chat', () => {
  const { t } = i18n.global;
  const chat = ref<Array<ChatMessage>>([]);
  const chatMetadata = ref<Record<string, any>>({});
  const chatCreateDate = ref<string | null>(null);
  const activeMessageEditIndex = ref<number | null>(null);
  const originalMessageContent = ref<string | null>(null);
  const chatSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
  const saveMetadataTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
  const isGenerating = ref(false);

  function getCurrentChatId() {
    // TODO: Integrate group store later
    const characterStore = useCharacterStore();
    return characterStore.activeCharacter?.chat;
  }

  async function saveChat() {
    const uiStore = useUiStore();
    if (uiStore.isChatSaving) {
      console.warn('Chat is already saving.');
      return;
    }

    const characterStore = useCharacterStore();
    const activeCharacter = characterStore.activeCharacter;
    if (!activeCharacter) {
      toast.error(t('chat.saveError'));
      return;
    }

    try {
      uiStore.isChatSaving = true;

      const chatToSave = [
        {
          user_name: uiStore.activePlayerName,
          character_name: activeCharacter.name,
          create_date: chatCreateDate.value,
          chat_metadata: chatMetadata.value,
        },
        ...chat.value,
      ];

      await apiSaveChat(activeCharacter, chatToSave);
      // TODO: Save token cache and itemized prompts
    } catch (error: any) {
      console.error('Failed to save chat:', error);
      toast.error(error.message || 'An unknown error occurred while saving the chat.');
    } finally {
      uiStore.isChatSaving = false;
    }
  }

  async function clearChat() {
    if (chatSaveTimeout.value) clearTimeout(chatSaveTimeout.value);
    if (saveMetadataTimeout.value) clearTimeout(saveMetadataTimeout.value);

    chat.value = [];
    chatMetadata.value = {};
    chatCreateDate.value = null;
    activeMessageEditIndex.value = null;
    chatSaveTimeout.value = null;
    saveMetadataTimeout.value = null;

    const promptStore = usePromptStore();
    promptStore.extensionPrompts = {};
    await promptStore.saveItemizedPrompts(getCurrentChatId());
    promptStore.itemizedPrompts = [];
  }

  async function refreshChat() {
    const characterStore = useCharacterStore();
    const activeCharacter = characterStore.activeCharacter;

    if (!activeCharacter) {
      console.error('refreshChat called with no active character');
      return;
    }

    // TODO: unshallow character logic if needed

    try {
      const response = await fetchChat(activeCharacter, chatMetadata.value);
      if (response.length > 0) {
        // Chat exists, load it
        const metadataItem = response.shift();
        chatCreateDate.value = metadataItem?.create_date ?? null;
        chatMetadata.value = metadataItem?.chat_metadata ?? {};
        chat.value = response;
      } else {
        // No chat exists, create a new one
        chatCreateDate.value = humanizedDateTime();
        chatMetadata.value = {};
        chat.value = [];

        const firstMessage = getFirstMessage(activeCharacter);
        if (firstMessage.mes) {
          chat.value.push(firstMessage);
          // Save the newly created chat to the server
          await saveChat();
        }
      }

      if (!chatMetadata.value['integrity']) {
        chatMetadata.value['integrity'] = uuidv4();
      }

      // TODO: getChatResult logic, which adds first message etc.

      const promptStore = usePromptStore();
      await promptStore.loadItemizedPrompts(getCurrentChatId());
    } catch (error) {
      console.error('Failed to refresh chat:', error);
      toast.error(t('chat.loadError'));
    }
  }

  async function generateResponse() {
    if (isGenerating.value) return;
    const characterStore = useCharacterStore();
    const apiStore = useApiStore();
    const activeCharacter = characterStore.activeCharacter;
    if (!activeCharacter) {
      console.error('generateResponse called without an active character.');
      return;
    }

    try {
      isGenerating.value = true;
      const genStarted = new Date().toISOString();
      // TODO: Show typing indicator

      const promptBuilder = new PromptBuilder(activeCharacter, chat.value);
      const messages = promptBuilder.build();
      if (messages.length === 0) {
        throw new Error(t('chat.generate.noPrompts'));
      }

      const payload = {
        messages,
        model: apiStore.activeModel,
        chat_completion_source: apiStore.oaiSettings.chat_completion_source,
        max_tokens: apiStore.oaiSettings.openai_max_tokens,
        temperature: apiStore.oaiSettings.temp_openai,
        stream: apiStore.oaiSettings.stream_openai, //TODO: Support streaming
      };

      const response = await ChatCompletionService.generate(payload);
      const genFinished = new Date().toISOString();

      const token_count = await getTokenCount(response.content);

      const botMessage: ChatMessage = {
        name: activeCharacter.name,
        is_user: false,
        mes: response.content,
        send_date: getMessageTimeStamp(),
        gen_started: genStarted,
        gen_finished: genFinished,
        extra: {
          reasoning: response.reasoning,
          token_count: token_count,
        },
      };

      chat.value.push(botMessage);
      await saveChat();
    } catch (error: any) {
      console.error('Failed to generate response:', error);
      toast.error(error.message || t('chat.generate.errorFallback'));
    } finally {
      isGenerating.value = false;
      // TODO: Hide typing indicator
    }
  }

  async function sendMessage(messageText: string) {
    if (!messageText.trim() || isGenerating.value) {
      return;
    }

    const uiStore = useUiStore();
    const userMessage: ChatMessage = {
      name: uiStore.activePlayerName || 'User',
      is_user: true,
      mes: messageText.trim(),
      send_date: getMessageTimeStamp(),
      force_avatar: getThumbnailUrl('persona', uiStore.activePlayerAvatar || default_user_avatar),
      extra: {},
    };

    chat.value.push(userMessage);
    await saveChat();

    generateResponse();
  }

  function startEditing(index: number) {
    if (index >= 0 && index < chat.value.length) {
      originalMessageContent.value = chat.value[index].mes;
      activeMessageEditIndex.value = index;
    }
  }

  function cancelEditing() {
    activeMessageEditIndex.value = null;
    originalMessageContent.value = null;
  }

  async function saveMessageEdit(newContent: string) {
    if (activeMessageEditIndex.value !== null) {
      chat.value[activeMessageEditIndex.value].mes = newContent;
      await saveChat();
      cancelEditing();
    }
  }

  return {
    chat,
    chatMetadata,
    chatCreateDate,
    activeMessageEditIndex,
    isGenerating,
    clearChat,
    refreshChat,
    saveChat,
    sendMessage,
    generateResponse,
    startEditing,
    cancelEditing,
    saveMessageEdit,
  };
});
