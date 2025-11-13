import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChatMessage } from '../types';
import { usePromptStore } from './prompt.store';
import { useCharacterStore } from './character.store';
import { useUiStore } from './ui.store';
import { fetchChat, saveChat as apiSaveChat } from '../api/chat';
import { humanizedDateTime } from '../utils/date';
import { uuidv4 } from '../utils/common';
import { getFirstMessage } from '../utils/chat';
import { toast } from '../composables/useToast';

export const useChatStore = defineStore('chat', () => {
  const chat = ref<Array<ChatMessage>>([]);
  const chatMetadata = ref<Record<string, any>>({});
  const chatCreateDate = ref<string | null>(null);
  const activeMessageEditIndex = ref<number | null>(null);
  const chatSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
  const saveMetadataTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

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
      toast.error('Cannot save: No active character selected.');
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
      // console.log('Using mocked chat data');
      // const mockResponse = [
      //   {
      //     create_date: 'November 13, 2025 3:16 AM',
      //     chat_metadata: { integrity: 'mock-integrity-uuid' },
      //   },
      //   {
      //     name: activeCharacter?.name ?? 'Character',
      //     mes: `*Oh, uh- ahem Hi there, I am ${activeCharacter?.name ?? 'Character'}.*`,
      //     send_date: 'November 13, 2025 3:16 AM',
      //     is_user: false,
      //     swipes: ['swipe1', 'swipe2', 'swipe3'],
      //     swipe_id: 0,
      //   },
      //   {
      //     name: 'User',
      //     mes: '"Hey"',
      //     send_date: 'November 13, 2025 3:16 AM',
      //     is_user: true,
      //     extra: { token_count: 5 },
      //   },
      //   {
      //     name: activeCharacter?.name ?? 'Character',
      //     mes: `He swallowed hard. Should’ve brought headphones—the clatter of plates and murmur of strangers itched under his skin. A bassline from the diner’s speakers throbbed in time with his pulse, some throwback track he’d heard his dad play years ago. His thumb tapped a silent rhythm against his thigh, counting beats. <q>"Just, uh. Waiting."</q> The lie tasted bitter. He wasn’t early; they were late. Again.`,
      //     send_date: 'November 13, 2025 3:16 AM',
      //     is_user: false,
      //     swipes: ['swipeA', 'swipeB'],
      //     swipe_id: 1,
      //     extra: { token_count: 188 },
      //   },
      // ];

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
      toast.error('Failed to load chat.');
    }
  }

  return {
    chat,
    chatMetadata,
    chatCreateDate,
    activeMessageEditIndex,
    chatSaveTimeout,
    saveMetadataTimeout,
    clearChat,
    refreshChat,
    saveChat,
  };
});
