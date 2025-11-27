import { debounce } from 'lodash-es';
import { defineStore } from 'pinia';
import { computed, nextTick, ref, watch } from 'vue';
import { saveChat as apiSaveChat, fetchChat, saveChat } from '../api/chat';
import { useChatGeneration } from '../composables/useChatGeneration';
import { useStrictI18n } from '../composables/useStrictI18n';
import {
  DEFAULT_SAVE_EDIT_TIMEOUT,
  EventPriority,
  GenerationMode,
  GroupGenerationHandlingMode,
  GroupReplyStrategy,
} from '../constants';
import {
  POPUP_RESULT,
  POPUP_TYPE,
  type Character,
  type ChatHeader,
  type ChatInfo,
  type ChatMessage,
  type ChatMetadata,
  type FullChat,
} from '../types';
import { getCharacterDifferences } from '../utils/character';
import { getFirstMessage } from '../utils/chat';
import { uuidv4 } from '../utils/commons';
import { eventEmitter } from '../utils/extensions';
import { useCharacterStore } from './character.store';
import { usePersonaStore } from './persona.store';
import { usePopupStore } from './popup.store';
import { usePromptStore } from './prompt.store';
import { useSettingsStore } from './settings.store';
import { useUiStore } from './ui.store';

export type ChatStoreState = {
  messages: ChatMessage[];
  metadata: ChatMetadata;
};

export type ChatMessageEditState = {
  index: number;
  originalContent: string;
};

export type SelectionModeType = 'free' | 'range';

export const useChatStore = defineStore('chat', () => {
  const activeChat = ref<ChatStoreState | null>(null);
  const activeChatFile = ref<string | null>(null);
  const activeMessageEditState = ref<ChatMessageEditState | null>(null);
  const isChatLoading = ref(false);
  const chatInfos = ref<ChatInfo[]>([]);
  const recentChats = ref<ChatInfo[]>([]);
  const autoModeTimer = ref<ReturnType<typeof setTimeout> | null>(null);

  // Selection Mode State
  const isSelectionMode = ref(false);
  const selectionModeType = ref<SelectionModeType>('free');
  const selectedMessageIndices = ref<Set<number>>(new Set());

  const uiStore = useUiStore();
  const personaStore = usePersonaStore();
  const characterStore = useCharacterStore();
  const promptStore = usePromptStore();
  const settingsStore = useSettingsStore();
  const popupStore = usePopupStore();
  const { t } = useStrictI18n();

  const chatsMetadataByCharacterAvatars = computed(() => {
    const mapping: Record<string, ChatInfo[]> = {};
    for (const chatInfo of chatInfos.value) {
      for (const memberAvatar of chatInfo.chat_metadata.members || []) {
        if (!mapping[memberAvatar]) {
          mapping[memberAvatar] = [];
        }
        mapping[memberAvatar].push(chatInfo);
      }
    }
    return mapping;
  });

  const isGroupChat = computed(() => {
    return activeChat.value && (activeChat.value.metadata.members?.length ?? 0) > 1;
  });

  const groupConfig = computed(() => {
    if (!activeChat.value) return null;

    // Initialize defaults if missing
    if (!activeChat.value.metadata.group) {
      activeChat.value.metadata.group = {
        config: {
          replyStrategy: GroupReplyStrategy.NATURAL_ORDER,
          handlingMode: GroupGenerationHandlingMode.SWAP,
          allowSelfResponses: false,
          autoMode: 0,
        },
        members: {},
      };
      // Sync members list status
      activeChat.value.metadata.members?.forEach((avatar) => {
        if (activeChat.value!.metadata.group) {
          activeChat.value!.metadata.group.members[avatar] = { muted: false };
        }
      });
    }
    return activeChat.value.metadata.group;
  });

  async function syncSwipeToMes(messageIndex: number, swipeIndex: number) {
    if (!activeChat.value || messageIndex < 0 || messageIndex >= activeChat.value.messages.length) return;

    const message = activeChat.value.messages[messageIndex];
    if (!message || !Array.isArray(message.swipes) || swipeIndex < 0 || swipeIndex >= message.swipes.length) {
      return;
    }

    message.swipe_id = swipeIndex;
    message.mes = message.swipes[swipeIndex];

    const swipeInfo = message.swipe_info?.[swipeIndex];
    if (swipeInfo) {
      message.send_date = swipeInfo.send_date;
      message.gen_started = swipeInfo.gen_started;
      message.gen_finished = swipeInfo.gen_finished;
      message.extra = { ...swipeInfo.extra };
    }

    if (message.extra) {
      delete message.extra.display_text;
      delete message.extra.reasoning_display_text;
    }
    await nextTick();
    await eventEmitter.emit('message:updated', messageIndex, message);
    saveChatDebounced();
  }

  function stopAutoModeTimer() {
    if (autoModeTimer.value) {
      clearTimeout(autoModeTimer.value);
      autoModeTimer.value = null;
    }
  }

  const { isGenerating, generateResponse, abortGeneration, sendMessage } = useChatGeneration({
    activeChat,
    groupConfig,
    syncSwipeToMes,
    stopAutoModeTimer,
  });

  const saveChatDebounced = debounce(async () => {
    if (!activeChat.value || !activeChatFile.value) {
      return;
    }

    try {
      uiStore.isChatSaving = true;
      const chatToSave: FullChat = [
        {
          chat_metadata: activeChat.value.metadata,
        },
        ...activeChat.value.messages,
      ];
      await apiSaveChat(activeChatFile.value, chatToSave);

      await promptStore.saveItemizedPrompts(activeChatFile.value);
      const chatInfo = chatInfos.value.find((c) => c.file_name === activeChatFile.value);
      if (chatInfo) {
        chatInfo.chat_metadata = activeChat.value.metadata;
      }
      const recentChatInfo = recentChats.value.find((c) => c.file_name === activeChatFile.value);
      if (recentChatInfo) {
        recentChatInfo.chat_metadata = activeChat.value.metadata;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to save chat:', err);
    } finally {
      uiStore.isChatSaving = false;
    }
  }, DEFAULT_SAVE_EDIT_TIMEOUT);

  eventEmitter.on(
    'generation:finished',
    async () => {
      saveChatDebounced();
    },
    EventPriority.HIGH,
  );

  eventEmitter.on(
    'message:created',
    async () => {
      saveChatDebounced();
    },
    EventPriority.HIGH,
  );

  eventEmitter.on(
    'message:deleted',
    async () => {
      saveChatDebounced();
    },
    EventPriority.HIGH,
  );

  eventEmitter.on(
    'character:deleted',
    async (avatar: string) => {
      const isThereOnlyCharacter =
        activeChat.value?.metadata.members?.length === 1 && activeChat.value.metadata.members[0] === avatar;
      if (isThereOnlyCharacter) {
        await clearChat(true);
      }
    },
    EventPriority.HIGH,
  );

  // Listen for character updates that affect chat (e.g., first message changed)
  eventEmitter.on(
    'character:first-message-updated',
    async (avatar: string, charData: Character) => {
      if (
        activeChat.value?.messages.length === 1 &&
        !activeChat.value.messages[0].is_user &&
        activeChat.value.messages[0].original_avatar === avatar
      ) {
        const updatedChar = { ...characterStore.characters.find((c) => c.avatar === avatar), ...charData } as Character;
        const newFirstMessageDetails = getFirstMessage(updatedChar);
        if (newFirstMessageDetails) {
          await updateMessageObject(0, {
            mes: newFirstMessageDetails.mes,
            swipes: newFirstMessageDetails.swipes,
            swipe_id: newFirstMessageDetails.swipe_id,
            swipe_info: newFirstMessageDetails.swipe_info,
          });
        }
      }
    },
    EventPriority.HIGH,
  );

  watch(
    () => isGenerating.value,
    (generating) => {
      if (!generating && groupConfig.value?.config.autoMode && groupConfig.value.config.autoMode > 0) {
        startAutoModeTimer();
      } else {
        stopAutoModeTimer();
      }
    },
  );

  watch(
    () => activeChat.value?.metadata.members,
    (newMembers) => {
      if (newMembers) {
        characterStore.setActiveCharacterAvatars(newMembers);
      } else {
        characterStore.setActiveCharacterAvatars([]);
      }
    },
    { immediate: true, deep: true },
  );

  function startAutoModeTimer() {
    stopAutoModeTimer();
    if (!groupConfig.value?.config.autoMode) return;

    autoModeTimer.value = setTimeout(() => {
      generateResponse(GenerationMode.NEW);
    }, groupConfig.value.config.autoMode * 1000);
  }

  async function clearChat(recreateFirstMessage = false) {
    isChatLoading.value = true;

    saveChatDebounced.cancel();
    if (activeChat.value) {
      activeChat.value.messages = [];
    }

    activeChatFile.value = null;
    activeChat.value = null;

    promptStore.extensionPrompts = {};
    promptStore.itemizedPrompts = [];

    // Reset selection mode on clear
    isSelectionMode.value = false;
    selectionModeType.value = 'free';
    selectedMessageIndices.value.clear();

    if (activeChatFile.value) {
      promptStore.clearUserTyping(activeChatFile.value);
    }

    await nextTick();
    await eventEmitter.emit('chat:cleared');

    if (recreateFirstMessage && characterStore.activeCharacters.length > 0) {
      const activeCharacter = characterStore.activeCharacters[0];
      if (activeCharacter) {
        activeChat.value = {
          metadata: {
            members: [activeCharacter.avatar],
            integrity: uuidv4(),
          },
          messages: [],
        };
      }
    }

    isChatLoading.value = false;
  }

  async function setActiveChatFile(chatFile: string) {
    if (activeChatFile.value === chatFile) return;
    activeChat.value = null;
    activeChatFile.value = null;
    saveChatDebounced.cancel();

    // Reset selection mode on chat switch
    isSelectionMode.value = false;
    selectionModeType.value = 'free';
    selectedMessageIndices.value.clear();

    isChatLoading.value = true;

    try {
      const response = await fetchChat(chatFile);
      if (response.length > 0) {
        const metadataItem = response.shift() as ChatHeader;
        activeChatFile.value = chatFile;
        activeChat.value = {
          metadata: metadataItem.chat_metadata,
          messages: response as ChatMessage[],
        };
      }

      if (activeChatFile.value) {
        for (const character of characterStore.activeCharacters) {
          const changes = getCharacterDifferences(character, { ...character, chat: activeChatFile.value });
          if (changes) {
            await characterStore.updateAndSaveCharacter(character.avatar, changes);
          }
        }

        await promptStore.loadItemizedPrompts(activeChatFile.value);

        // Persona Switching Logic
        const meta = activeChat.value!.metadata;
        if (meta.active_persona) {
          await personaStore.setActivePersona(meta.active_persona);
        } else if (activeChat.value!.metadata.members?.length === 1) {
          const charAvatar = activeChat.value!.metadata.members[0];
          const linkedPersona = personaStore.getLinkedPersona(charAvatar);
          if (linkedPersona) {
            await personaStore.setActivePersona(linkedPersona.avatarId);
          } else if (settingsStore.settings.persona.defaultPersonaId) {
            await personaStore.setActivePersona(settingsStore.settings.persona.defaultPersonaId);
          }
        } else if (settingsStore.settings.persona.defaultPersonaId) {
          await personaStore.setActivePersona(settingsStore.settings.persona.defaultPersonaId);
        }

        await nextTick();
        await eventEmitter.emit('chat:entered', activeChatFile.value as string);
      }
    } catch (error) {
      console.error('Failed to refresh chat:', error);
      throw error;
    } finally {
      isChatLoading.value = false;
    }
  }

  async function createNewChatForCharacter(avatar: string, chatName: string) {
    const character = characterStore.characters.find((c) => c.avatar === avatar);
    if (!character) {
      throw new Error('Character not found for creating new chat.');
    }

    try {
      isChatLoading.value = true;

      const filename = uuidv4();
      const fullFilename = `${filename}.jsonl`;

      const firstMessage = getFirstMessage(character);
      activeChat.value = {
        metadata: {
          members: [character.avatar],
          integrity: uuidv4(),
          promptOverrides: { scenario: '' },
          name: chatName,
        },
        messages: firstMessage && firstMessage.mes ? [firstMessage] : [],
      };
      const fullChat: FullChat = [{ chat_metadata: activeChat.value.metadata }, ...activeChat.value.messages];
      await saveChat(filename, fullChat);
      characterStore.updateAndSaveCharacter(character.avatar, { chat: filename });

      activeChatFile.value = filename;
      const cInfo: ChatInfo = {
        chat_metadata: activeChat.value.metadata,
        chat_items: activeChat.value.messages.length,
        file_id: filename,
        file_name: fullFilename,
        file_size: JSON.stringify(fullChat).length,
        last_mes: Date.now(),
        mes: firstMessage?.mes || '',
      };
      chatInfos.value.push(cInfo);
      recentChats.value.push(cInfo);

      await nextTick();
      await eventEmitter.emit('chat:entered', filename);
      if (firstMessage?.mes) {
        await eventEmitter.emit('message:created', firstMessage);
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      throw error;
    } finally {
      isChatLoading.value = false;
    }
  }

  async function updateChatName(fileId: string, newName: string) {
    const chatInfo = chatInfos.value.find((c) => c.file_id === fileId);
    if (!chatInfo) return;

    if (activeChatFile.value === fileId && activeChat.value) {
      activeChat.value.metadata.name = newName;
      chatInfo.chat_metadata.name = newName;
      saveChatDebounced();
    } else {
      const response = await fetchChat(fileId);
      if (response.length > 0) {
        const metadataItem = response[0] as ChatHeader;
        metadataItem.chat_metadata.name = newName;
        await saveChat(fileId, response as FullChat);
        chatInfo.chat_metadata.name = newName;
      }
    }
  }

  async function toggleChatPersona(personaId: string): Promise<'added' | 'removed' | undefined> {
    if (!activeChat.value) return;

    let result: 'added' | 'removed';
    if (activeChat.value.metadata.active_persona === personaId) {
      delete activeChat.value.metadata.active_persona;
      result = 'removed';
    } else {
      activeChat.value.metadata.active_persona = personaId;
      result = 'added';
    }
    saveChatDebounced();
    return result;
  }

  async function syncPersonaName(personaId: string, newName: string): Promise<number> {
    if (!activeChat.value) return 0;

    let updatedCount = 0;
    const messages = activeChat.value.messages;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.original_avatar === personaId && msg.name !== newName) {
        msg.name = newName;
        updatedCount++;
        await eventEmitter.emit('message:updated', i, msg);
      }
    }

    if (updatedCount > 0) {
      saveChatDebounced();
    }
    return updatedCount;
  }

  function toggleMemberMute(avatar: string) {
    if (!activeChat.value?.metadata.group) return;
    const member = activeChat.value.metadata.group.members[avatar];
    if (member) {
      member.muted = !member.muted;
      saveChatDebounced();
    }
  }

  async function addMember(avatar: string) {
    if (!activeChat.value) return;
    if (activeChat.value.metadata.members?.includes(avatar)) return;

    activeChat.value.metadata.members?.push(avatar);

    if (!activeChat.value.metadata.group) {
      activeChat.value.metadata.group = {
        config: {
          replyStrategy: GroupReplyStrategy.NATURAL_ORDER,
          handlingMode: GroupGenerationHandlingMode.SWAP,
          allowSelfResponses: false,
          autoMode: 0,
        },
        members: {},
      };
    }
    if (!activeChat.value.metadata.group.members[avatar]) {
      activeChat.value.metadata.group.members[avatar] = { muted: false };
    }

    saveChatDebounced();
  }

  async function removeMember(avatar: string) {
    if (!activeChat.value) return;
    const index = activeChat.value.metadata.members?.indexOf(avatar) ?? -1;
    if (index > -1) {
      activeChat.value.metadata.members?.splice(index, 1);
      if (activeChat.value.metadata.group?.members[avatar]) {
        delete activeChat.value.metadata.group.members[avatar];
      }
      saveChatDebounced();
    }
  }

  function startEditing(index: number) {
    if (!activeChat.value || index < 0 || index >= activeChat.value.messages.length) return;
    activeMessageEditState.value = {
      index,
      originalContent: activeChat.value.messages[index].mes,
    };
  }

  function cancelEditing() {
    activeMessageEditState.value = null;
  }

  async function saveMessageEdit(newContent: string, newReasoning?: string) {
    if (activeMessageEditState.value !== null && activeChat.value) {
      const index = activeMessageEditState.value.index;
      const message = activeChat.value.messages[index];
      message.mes = newContent;
      if (message.extra) {
        delete message.extra.display_text;
        delete message.extra.reasoning_display_text;
      }

      if (typeof newReasoning === 'string' && newReasoning.trim() !== '') {
        if (!message.extra) message.extra = {};
        message.extra.reasoning = newReasoning;
      } else {
        if (message.extra) {
          delete message.extra.reasoning;
        }
      }

      if (message.swipes && typeof message.swipe_id === 'number' && message.swipes[message.swipe_id] !== undefined) {
        message.swipes[message.swipe_id] = newContent;
      }

      const swipeInfo = message.swipe_info?.[message.swipe_id ?? 0];
      if (swipeInfo) {
        if (!swipeInfo.extra) swipeInfo.extra = {};
        if (typeof newReasoning === 'string' && newReasoning.trim() !== '') {
          swipeInfo.extra.reasoning = newReasoning;
        } else {
          delete swipeInfo.extra.reasoning;
        }
      }

      cancelEditing();
      await nextTick();
      await eventEmitter.emit('message:updated', index, message);
      saveChatDebounced();
    }
  }

  async function updateMessageObject(index: number, updates: Partial<ChatMessage>): Promise<void> {
    if (!activeChat.value || index < 0 || index >= activeChat.value.messages.length) {
      console.warn(`[ChatStore] updateMessageObject: index ${index} out of bounds.`);
      return;
    }
    const message = activeChat.value.messages[index];
    Object.assign(message, updates);

    if (updates.mes !== undefined) {
      if (message.swipes && typeof message.swipe_id === 'number' && message.swipes[message.swipe_id] !== undefined) {
        message.swipes[message.swipe_id] = updates.mes;
      }
    }

    await nextTick();
    await eventEmitter.emit('message:updated', index, message);
    saveChatDebounced();
  }

  async function swipeMessage(messageIndex: number, direction: 'left' | 'right') {
    if (!activeChat.value || messageIndex < 0 || messageIndex >= activeChat.value.messages.length) return;
    const message = activeChat.value.messages[messageIndex];
    if (!message || !Array.isArray(message.swipes)) return;

    let currentSwipeId = message.swipe_id ?? 0;
    const swipeCount = message.swipes.length;

    if (direction === 'left') {
      currentSwipeId = (currentSwipeId - 1 + swipeCount) % swipeCount;
      await syncSwipeToMes(messageIndex, currentSwipeId);
    } else {
      if (currentSwipeId < swipeCount - 1) {
        currentSwipeId++;
        await syncSwipeToMes(messageIndex, currentSwipeId);
      } else {
        await generateResponse(GenerationMode.ADD_SWIPE);
      }
    }
  }

  async function deleteMessage(index: number) {
    if (!activeChat.value || index < 0 || index >= activeChat.value.messages.length) return;
    activeChat.value.messages.splice(index, 1);
    if (activeMessageEditState.value?.index === index) {
      cancelEditing();
    }
    await nextTick();
    await eventEmitter.emit('message:deleted', [index]);
  }

  function toggleSelectionMode() {
    isSelectionMode.value = !isSelectionMode.value;
    // Reset selection state when entering/exiting
    selectedMessageIndices.value.clear();
    selectionModeType.value = 'free'; // Default to free mode
  }

  function setSelectionType(type: SelectionModeType) {
    selectionModeType.value = type;
    selectedMessageIndices.value.clear();
  }

  function toggleMessageSelection(index: number) {
    if (!isSelectionMode.value) return;

    if (selectionModeType.value === 'range') {
      // Range Mode: Select from index to end of chat
      selectedMessageIndices.value.clear();
      if (activeChat.value) {
        const len = activeChat.value.messages.length;
        for (let i = index; i < len; i++) {
          selectedMessageIndices.value.add(i);
        }
      }
    } else {
      // Free Mode: Toggle individual message
      if (selectedMessageIndices.value.has(index)) {
        selectedMessageIndices.value.delete(index);
      } else {
        selectedMessageIndices.value.add(index);
      }
    }
  }

  function selectAllMessages() {
    if (!activeChat.value) return;
    selectedMessageIndices.value.clear();
    activeChat.value.messages.forEach((_, idx) => selectedMessageIndices.value.add(idx));
  }

  function deselectAllMessages() {
    selectedMessageIndices.value.clear();
  }

  async function deleteSelectedMessages() {
    if (!activeChat.value || selectedMessageIndices.value.size === 0) return;

    // Collect targets based on current selection
    // Note: If we are in 'Free' mode, we might want to also delete the next message
    // (typical user expectation for deleting a user query + bot response).
    // If in 'Range' mode, the user sees exactly what is selected.

    const targets = new Set<number>();
    const maxIndex = activeChat.value.messages.length - 1;

    for (const idx of selectedMessageIndices.value) {
      targets.add(idx);
      // Logic from requirements: "Messages that user's selected and next one is deleted."
      // We apply this generally, as it covers the most common use case.
      // In Range mode (to bottom), this is redundant but harmless.
      if (idx + 1 <= maxIndex) {
        targets.add(idx + 1);
      }
    }

    const indicesToDelete = Array.from(targets).sort((a, b) => b - a); // Descending order to prevent index shift issues during splice

    const { result } = await popupStore.show({
      title: t('chat.delete.confirmBulkTitle'),
      content: t('chat.delete.confirmBulkContent', { count: indicesToDelete.length }),
      type: POPUP_TYPE.CONFIRM,
    });

    if (result === POPUP_RESULT.AFFIRMATIVE) {
      // Remove them
      for (const idx of indicesToDelete) {
        if (idx >= 0 && idx < activeChat.value.messages.length) {
          activeChat.value.messages.splice(idx, 1);
        }
      }

      // Cleanup
      selectedMessageIndices.value.clear();
      isSelectionMode.value = false;
      cancelEditing();

      await nextTick();
      await eventEmitter.emit('message:deleted', indicesToDelete);
    }
  }

  async function deleteSwipe(messageIndex: number, swipeIndex: number) {
    if (!activeChat.value || messageIndex < 0 || messageIndex >= activeChat.value.messages.length) return;
    const message = activeChat.value.messages[messageIndex];
    if (
      !message ||
      !Array.isArray(message.swipes) ||
      message.swipes.length <= 1 ||
      swipeIndex < 0 ||
      swipeIndex >= message.swipes.length
    ) {
      throw new Error('cannot_delete_last_swipe');
    }

    message.swipes.splice(swipeIndex, 1);
    if (Array.isArray(message.swipe_info)) {
      message.swipe_info.splice(swipeIndex, 1);
    }

    const newSwipeId = Math.min(swipeIndex, message.swipes.length - 1);
    await syncSwipeToMes(messageIndex, newSwipeId);
  }

  function moveMessage(index: number, direction: 'up' | 'down') {
    if (!activeChat.value || index < 0 || index >= activeChat.value.messages.length) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= activeChat.value.messages.length) return;

    [activeChat.value.messages[index], activeChat.value.messages[newIndex]] = [
      activeChat.value.messages[newIndex],
      activeChat.value.messages[index],
    ];

    if (activeMessageEditState.value) {
      if (activeMessageEditState.value.index === index) {
        activeMessageEditState.value.index = newIndex;
      } else if (activeMessageEditState.value.index === newIndex) {
        activeMessageEditState.value.index = index;
      }
    }
    saveChatDebounced();
  }

  return {
    activeChat,
    chatInfos,
    recentChats,
    activeMessageEditState,
    isGenerating,
    isChatLoading,
    activeChatFile,
    isGroupChat,
    groupConfig,
    chatsMetadataByCharacterAvatars,
    // Selection Mode
    isSelectionMode,
    selectionModeType,
    selectedMessageIndices,
    toggleSelectionMode,
    setSelectionType,
    toggleMessageSelection,
    selectAllMessages,
    deselectAllMessages,
    deleteSelectedMessages,
    // Actions
    clearChat,
    sendMessage,
    generateResponse,
    abortGeneration,
    startEditing,
    cancelEditing,
    saveMessageEdit,
    updateMessageObject,
    deleteMessage,
    deleteSwipe,
    swipeMessage,
    moveMessage,
    setActiveChatFile,
    createNewChatForCharacter,
    toggleMemberMute,
    addMember,
    removeMember,
    toggleChatPersona,
    syncPersonaName,
    updateChatName,
    syncSwipeToMes,
    saveChatDebounced,
  };
});
