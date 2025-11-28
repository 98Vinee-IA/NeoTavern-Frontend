import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { GroupGenerationHandlingMode, GroupReplyStrategy } from '../constants';
import type { Character } from '../types/character';
import { useCharacterStore } from './character.store';
import { useChatStore } from './chat.store';

export const useGroupChatStore = defineStore('group-chat', () => {
  const chatStore = useChatStore();
  const characterStore = useCharacterStore();
  const generationQueue = ref<string[]>([]);
  const generatingAvatar = ref<string | null>(null);

  const isGroupChat = computed(() => {
    return chatStore.activeChat && (chatStore.activeChat.metadata.members?.length ?? 0) > 1;
  });

  const groupConfig = computed(() => {
    if (!chatStore.activeChat) return null;

    // Initialize defaults if missing
    if (!chatStore.activeChat.metadata.group) {
      chatStore.activeChat.metadata.group = {
        config: {
          replyStrategy: GroupReplyStrategy.NATURAL_ORDER,
          handlingMode: GroupGenerationHandlingMode.SWAP,
          allowSelfResponses: false,
          autoMode: 0,
        },
        members: {},
      };
      // Sync members list status
      chatStore.activeChat.metadata.members?.forEach((avatar) => {
        if (chatStore.activeChat!.metadata.group) {
          chatStore.activeChat!.metadata.group.members[avatar] = { muted: false };
        }
      });
    }
    return chatStore.activeChat.metadata.group;
  });

  function toggleMemberMute(avatar: string) {
    if (!chatStore.activeChat?.metadata.group) return;
    const member = chatStore.activeChat.metadata.group.members[avatar];
    if (member) {
      member.muted = !member.muted;
      chatStore.triggerSave();
    }
  }

  function addMember(avatar: string) {
    if (!chatStore.activeChat) return;
    if (chatStore.activeChat.metadata.members?.includes(avatar)) return;

    chatStore.activeChat.metadata.members?.push(avatar);

    if (!chatStore.activeChat.metadata.group) {
      chatStore.activeChat.metadata.group = {
        config: {
          replyStrategy: GroupReplyStrategy.NATURAL_ORDER,
          handlingMode: GroupGenerationHandlingMode.SWAP,
          allowSelfResponses: false,
          autoMode: 0,
        },
        members: {},
      };
    }
    if (!chatStore.activeChat.metadata.group.members[avatar]) {
      chatStore.activeChat.metadata.group.members[avatar] = { muted: false };
    }

    chatStore.triggerSave();
  }

  function removeMember(avatar: string) {
    if (!chatStore.activeChat) return;
    const index = chatStore.activeChat.metadata.members?.indexOf(avatar) ?? -1;
    if (index > -1) {
      chatStore.activeChat.metadata.members?.splice(index, 1);
      if (chatStore.activeChat.metadata.group?.members[avatar]) {
        delete chatStore.activeChat.metadata.group.members[avatar];
      }
      chatStore.triggerSave();
    }
  }

  function clearQueue() {
    generationQueue.value = [];
  }

  function addToQueue(avatars: string[]) {
    generationQueue.value.push(...avatars);
  }

  function popFromQueue() {
    return generationQueue.value.shift();
  }

  function getMentions(text: string, characters: Character[]): string[] {
    const mentions: { index: number; avatar: string }[] = [];
    const lowerText = text.toLowerCase();

    characters.forEach((char) => {
      const name = char.name.trim().toLowerCase();
      if (!name) return;
      // Check for name occurrence
      const idx = lowerText.indexOf(name);
      if (idx !== -1) {
        mentions.push({ index: idx, avatar: char.avatar });
      }
    });

    // Sort by position in text
    mentions.sort((a, b) => a.index - b.index);

    const avatars = mentions.map((m) => m.avatar);
    // Remove duplicates
    return [...new Set(avatars)];
  }

  function prepareGenerationQueue(textToScan?: string) {
    if (generationQueue.value.length > 0) return;

    const activeMembers = chatStore.activeChat?.metadata.members ?? [];

    // Single Chat / Fallback
    if (!isGroupChat.value || !groupConfig.value?.members) {
      if (characterStore.activeCharacters.length > 0) {
        addToQueue([characterStore.activeCharacters[0].avatar]);
      }
      return;
    }

    // Group Chat Logic
    const config = groupConfig.value.config;
    const membersMap = groupConfig.value.members;
    const validMembers = activeMembers.filter((avatar) => !membersMap[avatar]?.muted);

    if (validMembers.length === 0) return;

    const strategy = config.replyStrategy;

    // Manual Strategy: Do nothing (wait for explicit add/force)
    if (strategy === GroupReplyStrategy.MANUAL) {
      return;
    }

    // Natural Order (Scan for mentions)
    if (strategy === GroupReplyStrategy.NATURAL_ORDER && textToScan) {
      const mentions = getMentions(
        textToScan,
        characterStore.activeCharacters.filter((c) => validMembers.includes(c.avatar)),
      );
      if (mentions.length > 0) {
        addToQueue(mentions);
        return;
      }
      // If no mentions, fall through to default behavior (List Order usually)
    }

    // Determine Last Speaker
    const history = chatStore.activeChat?.messages || [];
    const lastBotMessage = [...history].reverse().find((m) => !m.is_user && !m.is_system);
    const lastSpeaker = lastBotMessage?.original_avatar;

    // List Order (Cycle)
    if (strategy === GroupReplyStrategy.LIST_ORDER || strategy === GroupReplyStrategy.NATURAL_ORDER) {
      let nextIndex = 0;
      if (lastSpeaker) {
        const currentIdx = validMembers.indexOf(lastSpeaker);
        if (currentIdx !== -1) {
          nextIndex = (currentIdx + 1) % validMembers.length;
        }
      }
      addToQueue([validMembers[nextIndex]]);
      return;
    }

    // Pooled Order (Random, try to avoid last speaker)
    if (strategy === GroupReplyStrategy.POOLED_ORDER) {
      let candidates = validMembers;
      if (candidates.length > 1 && lastSpeaker) {
        candidates = candidates.filter((m) => m !== lastSpeaker);
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      addToQueue([pick]);
      return;
    }
  }

  return {
    isGroupChat,
    groupConfig,
    generationQueue,
    generatingAvatar,
    toggleMemberMute,
    addMember,
    removeMember,
    clearQueue,
    addToQueue,
    popFromQueue,
    prepareGenerationQueue,
  };
});
