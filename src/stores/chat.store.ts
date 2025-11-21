import { defineStore } from 'pinia';
import { computed, nextTick, ref, watch } from 'vue';
import { debounce } from 'lodash-es';
import {
  type ChatMessage,
  type ChatMetadata,
  type SwipeInfo,
  type GenerationContext,
  type GenerationResponse,
  type StreamedChunk,
  type ItemizedPrompt,
  type PromptTokenBreakdown,
  type FullChat,
  type ChatHeader,
  type ChatInfo,
} from '../types';
import { usePromptStore } from './prompt.store';
import { useCharacterStore } from './character.store';
import { useUiStore } from './ui.store';
import { useApiStore } from './api.store';
import { fetchChat, saveChat as apiSaveChat, saveChat } from '../api/chat';
import { getMessageTimeStamp } from '../utils/date';
import { uuidv4 } from '@/utils/common';
import { getFirstMessage } from '../utils/chat';
import { toast } from '../composables/useToast';
import { useStrictI18n } from '../composables/useStrictI18n';
import { PromptBuilder } from '../utils/prompt-builder';
import { buildChatCompletionPayload, ChatCompletionService } from '../api/generation';
import { getThumbnailUrl } from '../utils/image';
import { default_user_avatar, DEFAULT_SAVE_EDIT_TIMEOUT, GenerationMode } from '../constants';
import { useSettingsStore } from './settings.store';
import { usePersonaStore } from './persona.store';
import { eventEmitter } from '../utils/event-emitter';
import { ApiTokenizer } from '../api/tokenizer';

export type ChatStoreState = {
  messages: ChatMessage[];
  metadata: ChatMetadata;
};

export type ChatMessageEditState = {
  index: number;
  originalContent: string;
};

export const useChatStore = defineStore('chat', () => {
  const { t } = useStrictI18n();
  const activeChat = ref<ChatStoreState | null>(null);
  const activeChatFile = ref<string | null>(null);
  const activeMessageEditState = ref<ChatMessageEditState | null>(null);

  const isGenerating = ref(false);
  const generationController = ref<AbortController | null>(null);
  const isChatLoading = ref(false); // Prevents watcher from saving during initialization
  const chatInfos = ref<ChatInfo[]>([]);

  const uiStore = useUiStore();
  const personaStore = usePersonaStore();
  const characterStore = useCharacterStore();
  const promptStore = usePromptStore();

  const chatsMetadataByCharacterAvatars = computed(() => {
    const mapping: Record<string, ChatInfo[]> = {};
    for (const chatInfo of chatInfos.value) {
      for (const memberAvatar of chatInfo.chat_metadata.members) {
        if (!mapping[memberAvatar]) {
          mapping[memberAvatar] = [];
        }
        mapping[memberAvatar].push(chatInfo);
      }
    }
    return mapping;
  });

  const saveChatDebounced = debounce(async () => {
    if (!activeChat.value || !activeChatFile.value) {
      console.error('Debounced save failed: No active character or chat file.');
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

      // Save itemized prompts
      await promptStore.saveItemizedPrompts(activeChatFile.value);
      const chatInfo = chatInfos.value.find((c) => c.file_name === activeChatFile.value)?.chat_metadata;
      if (chatInfo) {
        chatInfo.chat_metadata = activeChat.value.metadata;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to save chat:', error);
      toast.error(error.message || 'An unknown error occurred while saving the chat.');
    } finally {
      uiStore.isChatSaving = false;
    }
  }, DEFAULT_SAVE_EDIT_TIMEOUT);

  watch(
    [activeChat],
    () => {
      // Emit event for UI reactivity
      nextTick(async () => {
        await eventEmitter.emit('chat:updated', activeChatFile.value as string);
      });

      // Trigger debounced save if not loading
      if (!isChatLoading.value && activeChat.value) {
        saveChatDebounced();
      }
    },
    { deep: true },
  );

  async function clearChat(recreateFirstMessage = false) {
    if (!activeChat.value) return;
    isChatLoading.value = true;

    saveChatDebounced.cancel();
    activeChat.value.messages = [];

    if (!recreateFirstMessage) {
      activeChatFile.value = null;
    }

    promptStore.extensionPrompts = {};
    if (activeChatFile.value) {
      await promptStore.saveItemizedPrompts(activeChatFile.value);
    }
    promptStore.itemizedPrompts = [];

    await nextTick();
    await eventEmitter.emit('chat:cleared');

    // Send the first message of first active character
    if (recreateFirstMessage && characterStore.activeCharacters.length > 0) {
      const activeCharacter = characterStore.activeCharacters[0];
      if (activeCharacter) {
        const firstMessage = getFirstMessage(activeCharacter);
        if (firstMessage?.mes) {
          activeChat.value.messages.push(firstMessage);
          await nextTick();
          await eventEmitter.emit('message:created', firstMessage);
        }
      }
    }

    isChatLoading.value = false;

    // Manually trigger a save if a new first message was created.
    if (recreateFirstMessage && activeChat.value.messages.length > 0) {
      saveChatDebounced();
    }
  }

  async function setActiveChatFile(chatFile: string) {
    if (activeChatFile.value === chatFile) return;
    await clearChat(false);

    // TODO: unshallow character logic if needed
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
          await characterStore.updateAndSaveCharacter(character.avatar, { chat: chatFile });
        }

        await promptStore.loadItemizedPrompts(activeChatFile.value);
        await nextTick();
        await eventEmitter.emit('chat:entered', activeChatFile.value as string);
      }
    } catch (error) {
      console.error('Failed to refresh chat:', error);
      toast.error(t('chat.loadError'));
    } finally {
      isChatLoading.value = false;
    }
  }

  async function createNewChatForCharacter(avatar: string, filename: string) {
    const character = characterStore.characters.find((c) => c.avatar === avatar);
    if (!character) {
      throw new Error('Character not found for creating new chat.');
    }

    try {
      isChatLoading.value = true;
      const firstMessage = getFirstMessage(character);
      activeChat.value = {
        metadata: { members: [character.avatar], integrity: uuidv4() },
        messages: firstMessage && firstMessage.mes ? [firstMessage] : [],
      };
      const fullChat: FullChat = [{ chat_metadata: activeChat.value.metadata }, ...activeChat.value.messages];
      await saveChat(filename, fullChat);
      characterStore.updateAndSaveCharacter(character.avatar, { chat: filename });
      activeChatFile.value = filename;
      chatInfos.value.push({
        chat_metadata: activeChat.value.metadata,
        chat_items: activeChat.value.messages.length,
        file_id: filename,
        file_name: `${filename}.jsonl`,
        file_size: JSON.stringify(fullChat).length,
        last_mes: Date.now(),
        mes: firstMessage?.mes || '',
      });

      await nextTick();
      await eventEmitter.emit('chat:entered', filename);
      if (firstMessage?.mes) {
        await eventEmitter.emit('message:created', firstMessage);
      }
    } catch (error) {
      console.error('Failed to create new chat:', error);
      toast.error(t('chat.createError'));
    } finally {
      isChatLoading.value = false;
    }
  }

  function abortGeneration() {
    if (generationController.value) {
      generationController.value.abort();
      isGenerating.value = false;
      generationController.value = null;
    }
  }

  async function generateResponse(mode: GenerationMode) {
    if (isGenerating.value) return;

    const startController = new AbortController();
    await eventEmitter.emit('generation:started', startController);
    if (startController.signal.aborted) {
      console.log(`Generation aborted by extension (generation:started). Reason: ${startController.signal.reason}`);
      return;
    }

    if (generationController.value) {
      generationController.value.abort();
    }
    generationController.value = new AbortController();

    const characterStore = useCharacterStore();
    const apiStore = useApiStore();
    const settingsStore = useSettingsStore();
    const promptStore = usePromptStore();

    // TODO: Group chat support
    const activeCharacter = characterStore.activeCharacters[0];
    if (!activeCharacter) {
      console.error('generateResponse called without an active character.');
      return;
    }

    let generatedMessage: ChatMessage | null = null;
    let generationError: Error | undefined;

    const activeChatMessages = activeChat.value?.messages || [];
    try {
      isGenerating.value = true;
      const genStarted = new Date().toISOString();
      let lastMessage = activeChatMessages.length > 0 ? activeChatMessages[activeChatMessages.length - 1] : null;
      const chatHistoryForPrompt = [...activeChatMessages];

      if (mode === GenerationMode.REGENERATE) {
        if (lastMessage && !lastMessage.is_user) {
          chatHistoryForPrompt.pop();
          activeChatMessages.pop();
          lastMessage = activeChatMessages.length > 0 ? activeChatMessages[activeChatMessages.length - 1] : null;
        }
      } else if (mode === GenerationMode.ADD_SWIPE) {
        if (!lastMessage || lastMessage.is_user) return;
        chatHistoryForPrompt.pop();
      } else if (mode === GenerationMode.CONTINUE) {
        if (!lastMessage || lastMessage.is_user) return;
      }

      const activePersona = personaStore.activePersona;
      if (!activePersona) {
        throw new Error(t('chat.generate.noPersonaError'));
      }

      const settings = settingsStore.settings;
      const activeModel = apiStore.activeModel;
      if (!activeModel) {
        throw new Error(t('chat.generate.noModelError'));
      }

      const tokenizer = new ApiTokenizer({ tokenizerType: settings.api.tokenizer, model: activeModel });

      const context: GenerationContext = {
        mode,
        characters: characterStore.activeCharacters,
        history: chatHistoryForPrompt,
        persona: activePersona,
        settings: {
          sampler: settings.api.samplers,
          source: settings.api.chatCompletionSource,
          model: activeModel,
          providerSpecific: settings.api.providerSpecific,
        },
        playerName: uiStore.activePlayerName || 'User',
        controller: new AbortController(),
        tokenizer: tokenizer,
      };

      await eventEmitter.emit('process:generation-context', context);
      if (context.controller.signal.aborted) {
        console.log(
          `Generation aborted by extension (process:generation-context). Reason: ${context.controller.signal.reason}`,
        );
        return;
      }

      const promptBuilder = new PromptBuilder({
        characters: context.characters,
        chatHistory: context.history,
        persona: context.persona,
        samplerSettings: context.settings.sampler,
        tokenizer: context.tokenizer,
      });
      const messages = await promptBuilder.build();

      if (messages.length === 0) {
        throw new Error(t('chat.generate.noPrompts'));
      }

      const processedWorldInfo = promptBuilder.processedWorldInfo;

      const maxContext = context.settings.sampler.max_context;
      const maxResponse = context.settings.sampler.max_tokens;
      let promptTotal = 0;
      for (const m of messages) {
        promptTotal += await tokenizer.getTokenCount(m.content);
      }

      let wiTokens = 0;
      if (processedWorldInfo) {
        const parts = [
          processedWorldInfo.worldInfoBefore,
          processedWorldInfo.worldInfoAfter,
          ...processedWorldInfo.anBefore,
          ...processedWorldInfo.anAfter,
          ...processedWorldInfo.emBefore,
          ...processedWorldInfo.emAfter,
          ...processedWorldInfo.depthEntries.flatMap((d) => d.entries),
          ...Object.values(processedWorldInfo.outletEntries).flat(),
        ];
        const fullWiText = parts.filter(Boolean).join('\n');
        if (fullWiText) {
          wiTokens = await tokenizer.getTokenCount(fullWiText);
        }
      }

      // TODO: With group chats, we need to track per-character prompts
      const breakdown: PromptTokenBreakdown = {
        systemTotal: 0,
        description: await tokenizer.getTokenCount(activeCharacter.description || ''),
        personality: await tokenizer.getTokenCount(activeCharacter.personality || ''),
        scenario: await tokenizer.getTokenCount(activeCharacter.scenario || ''),
        examples: await tokenizer.getTokenCount(activeCharacter.mes_example || ''),
        persona: await tokenizer.getTokenCount(activePersona.description || ''),
        worldInfo: wiTokens,
        chatHistory: 0,
        extensions: 0,
        bias: 0,
        promptTotal: promptTotal,
        maxContext: maxContext,
        padding: maxContext - promptTotal - maxResponse,
      };

      // Estimate System vs History from final messages
      for (const m of messages) {
        const count = await tokenizer.getTokenCount(m.content);
        if (m.role === 'system') {
          breakdown.systemTotal += count;
        } else {
          breakdown.chatHistory += count;
        }
      }

      const targetMessageIndex =
        mode === GenerationMode.CONTINUE ? activeChatMessages.length - 1 : activeChatMessages.length;

      const itemizedPrompt: ItemizedPrompt = {
        messageIndex: targetMessageIndex,
        model: context.settings.model,
        api: context.settings.source,
        tokenizer: settings.api.tokenizer,
        presetName: settings.api.selectedSampler || 'Default',
        messages: messages,
        breakdown: breakdown,
        timestamp: Date.now(),
        worldInfoEntries: processedWorldInfo?.triggeredEntries ?? {},
      };
      promptStore.addItemizedPrompt(itemizedPrompt);

      const payload = buildChatCompletionPayload({
        messages,
        model: context.settings.model,
        samplerSettings: context.settings.sampler,
        source: context.settings.source,
        providerSpecific: context.settings.providerSpecific,
        playerName: context.playerName,
        modelList: apiStore.modelList,
      });

      const payloadController = new AbortController();
      await eventEmitter.emit('process:request-payload', payload, payloadController);
      if (payloadController.signal.aborted) {
        console.log(
          `Generation aborted by extension (process:request-payload). Reason: ${payloadController.signal.reason}`,
        );
        return;
      }

      const handleGenerationResult = async (content: string, reasoning?: string) => {
        const genFinished = new Date().toISOString();
        const token_count = await tokenizer.getTokenCount(content);
        const swipeInfo: SwipeInfo = {
          send_date: getMessageTimeStamp(),
          gen_started: genStarted,
          gen_finished: genFinished,
          extra: { reasoning, token_count },
        };

        if (mode === GenerationMode.CONTINUE && lastMessage) {
          lastMessage.mes += content;
          lastMessage.gen_finished = genFinished;
          lastMessage.extra!.token_count = await tokenizer.getTokenCount(lastMessage.mes);
          generatedMessage = lastMessage;
          await nextTick();
          await eventEmitter.emit('message:updated', activeChatMessages.length - 1, lastMessage);
        } else if (mode === GenerationMode.ADD_SWIPE && lastMessage) {
          if (!Array.isArray(lastMessage.swipes)) lastMessage.swipes = [lastMessage.mes];
          if (!Array.isArray(lastMessage.swipe_info)) lastMessage.swipe_info = [];
          lastMessage.swipes.push(content);
          lastMessage.swipe_info.push(swipeInfo);
          await syncSwipeToMes(activeChatMessages.length - 1, lastMessage.swipes.length - 1);
          generatedMessage = lastMessage;
        } else {
          const botMessage: ChatMessage = {
            name: activeCharacter.name,
            is_user: false,
            mes: content,
            send_date: swipeInfo.send_date,
            gen_started: genStarted,
            gen_finished: genFinished,
            swipes: [content],
            swipe_info: [swipeInfo],
            swipe_id: 0,
            extra: { reasoning, token_count },
          };

          const createController = new AbortController();
          await eventEmitter.emit('generation:before-message-create', botMessage, createController);
          if (createController.signal.aborted) {
            console.log(
              `Generation aborted by extension (generation:before-message-create). Reason: ${createController.signal.reason}`,
            );
            return;
          }

          activeChatMessages.push(botMessage);
          generatedMessage = botMessage;
          await nextTick();
          await eventEmitter.emit('message:created', botMessage);
        }
      };

      if (!payload.stream) {
        const response = (await ChatCompletionService.generate(
          payload,
          generationController.value.signal,
        )) as GenerationResponse;

        const responseController = new AbortController();
        await eventEmitter.emit('process:response', response, payload, responseController);
        if (responseController.signal.aborted) {
          console.log(
            `Generation aborted by extension (process:response). Reason: ${responseController.signal.reason}`,
          );
          return;
        }

        await handleGenerationResult(response.content, response.reasoning);
      } else {
        const streamGenerator = (await ChatCompletionService.generate(
          payload,
          generationController.value.signal,
        )) as unknown as () => AsyncGenerator<StreamedChunk>;

        let streamedReasoning = '';
        let targetMessageIndex = -1;

        if (mode === GenerationMode.CONTINUE && lastMessage) {
          targetMessageIndex = activeChatMessages.length - 1;
        } else if (mode === GenerationMode.ADD_SWIPE && lastMessage) {
          targetMessageIndex = activeChatMessages.length - 1;
          if (!Array.isArray(lastMessage.swipes)) lastMessage.swipes = [lastMessage.mes];
          if (!Array.isArray(lastMessage.swipe_info)) lastMessage.swipe_info = [];
          lastMessage.swipe_id = lastMessage.swipes.length;
          lastMessage.swipes.push('');
          lastMessage.mes = '';
          lastMessage.extra = { reasoning: '' };
        } else {
          const botMessage: ChatMessage = {
            name: activeCharacter.name,
            is_user: false,
            mes: '',
            send_date: getMessageTimeStamp(),
            gen_started: genStarted,
            swipes: [''],
            swipe_id: 0,
            swipe_info: [],
            extra: { reasoning: '' },
          };

          const createController = new AbortController();
          await eventEmitter.emit('generation:before-message-create', botMessage, createController);
          if (createController.signal.aborted) {
            console.log(
              `Generation aborted by extension (generation:before-message-create). Reason: ${createController.signal.reason}`,
            );
            return;
          }

          activeChatMessages.push(botMessage);
          generatedMessage = botMessage;
          targetMessageIndex = activeChatMessages.length - 1;
          await nextTick();
          await eventEmitter.emit('message:created', botMessage);
        }

        try {
          for await (const chunk of streamGenerator()) {
            const chunkController = new AbortController();
            await eventEmitter.emit('process:stream-chunk', chunk, payload, chunkController);
            if (chunkController.signal.aborted) {
              console.log(
                `Generation aborted by extension (process:stream-chunk). Reason: ${chunkController.signal.reason}`,
              );
              generationController.value?.abort();
              break;
            }
            if (chunk.reasoning) streamedReasoning += chunk.reasoning;

            const targetMessage = activeChatMessages[targetMessageIndex];
            if (mode === GenerationMode.ADD_SWIPE) {
              targetMessage.swipes![targetMessage.swipe_id!] += chunk.delta;
              targetMessage.mes = targetMessage.swipes![targetMessage.swipe_id!];
            } else {
              targetMessage.mes += chunk.delta;
            }
            if (chunk.reasoning) targetMessage.extra!.reasoning = streamedReasoning;
          }
        } finally {
          const finalMessage = activeChatMessages[targetMessageIndex];
          if (!finalMessage) return;
          finalMessage.gen_finished = new Date().toISOString();
          finalMessage.extra!.token_count = await tokenizer.getTokenCount(finalMessage.mes);

          if (mode === GenerationMode.NEW || mode === GenerationMode.REGENERATE) {
            finalMessage.swipes![0] = finalMessage.mes;
          }

          const swipeInfo: SwipeInfo = {
            send_date: finalMessage.send_date!,
            gen_started: genStarted,
            gen_finished: finalMessage.gen_finished,
            extra: { ...finalMessage.extra },
          };

          if (mode === GenerationMode.ADD_SWIPE) {
            if (!Array.isArray(finalMessage.swipe_info)) finalMessage.swipe_info = [];
            finalMessage.swipe_info.push(swipeInfo);
          } else if (mode === GenerationMode.NEW || mode === GenerationMode.REGENERATE) {
            finalMessage.swipe_info = [swipeInfo];
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      generationError = error;
      if (error.name === 'AbortError') {
        toast.info('Generation aborted.');
      } else {
        console.error('Failed to generate response:', error);
        toast.error(error.message || t('chat.generate.errorFallback'));
      }
    } finally {
      isGenerating.value = false;
      generationController.value = null;
      await nextTick();
      await eventEmitter.emit('generation:finished', generatedMessage, generationError);
    }
  }

  async function sendMessage(messageText: string, triggerGeneration = true) {
    if (!messageText.trim() || isGenerating.value || activeChat.value === null) {
      return;
    }

    const userMessage: ChatMessage = {
      name: uiStore.activePlayerName || 'User',
      is_user: true,
      mes: messageText.trim(),
      send_date: getMessageTimeStamp(),
      force_avatar: getThumbnailUrl('persona', uiStore.activePlayerAvatar || default_user_avatar),
      extra: {},
    };

    const createController = new AbortController();
    await eventEmitter.emit('chat:before-message-create', userMessage, createController);
    if (createController.signal.aborted) {
      console.log(
        `Message creation aborted by extension (chat:before-message-create). Reason: ${createController.signal.reason}`,
      );
      return;
    }
    activeChat.value.messages.push(userMessage);
    await nextTick();
    await eventEmitter.emit('message:created', userMessage);

    if (triggerGeneration) {
      await generateResponse(GenerationMode.NEW);
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
  }

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
      // Right swipe
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
    await eventEmitter.emit('message:deleted', index);
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
      toast.error(t('chat.delete.lastSwipeError'));
      return;
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
  }

  return {
    activeChat,
    chatInfos,
    activeMessageEditState,
    isGenerating,
    activeChatFile,
    chatsMetadataByCharacterAvatars,
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
  };
});
