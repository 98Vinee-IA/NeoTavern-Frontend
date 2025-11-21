<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore } from '../../stores/chat.store';
import { useCharacterStore } from '../../stores/character.store';
import { usePopupStore } from '../../stores/popup.store';
import { POPUP_RESULT, POPUP_TYPE, type ChatInfo } from '../../types';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { humanizedDateTime } from '../../utils/date';
import * as api from '../../api/chat';
import { toast } from '../../composables/useToast';

const { t } = useStrictI18n();
const chatStore = useChatStore();
const characterStore = useCharacterStore();
const popupStore = usePopupStore();

const chats = computed<ChatInfo[]>(() => {
  if (!characterStore.activeCharacters) return [];
  const avatars = characterStore.activeCharacterAvatars;
  let allChats: ChatInfo[] = [];
  for (const avatar of avatars) {
    const chatsForAvatar = chatStore.chatsMetadataByCharacterAvatars[avatar];
    if (chatsForAvatar) {
      allChats.push(...chatsForAvatar);
    }
  }

  // Remove duplicates
  allChats = allChats.filter((chat, index, self) => index === self.findIndex((c) => c.file_id === chat.file_id));

  allChats.sort((a, b) => b.last_mes - a.last_mes);
  return allChats;
});

async function selectChat(chatFile: string) {
  await chatStore.setActiveChatFile(chatFile);
  close();
}

async function createNewChat(askConfirmation = true) {
  if (!characterStore.activeCharacters) {
    console.warn("No active characters to create a chat for. This shouldn't happen.");
    return;
  }
  const firstCharacter = characterStore.activeCharacters[0];
  let result: POPUP_RESULT = POPUP_RESULT.AFFIRMATIVE;
  let value = `${firstCharacter?.avatar} - ${humanizedDateTime()}`;
  if (askConfirmation) {
    ({ result, value } = await popupStore.show({
      title: t('chatManagement.newChat'),
      content: t('chatManagement.createPrompt'),
      type: POPUP_TYPE.INPUT,
      inputValue: `${firstCharacter?.avatar} - ${humanizedDateTime()}`,
    }));
  }

  if (result === POPUP_RESULT.AFFIRMATIVE && value) {
    try {
      await chatStore.createNewChatForCharacter(firstCharacter.avatar, value.trim());
    } catch {
      toast.error(t('chatManagement.errors.create'));
    }
  }
}

async function renameChat(oldFile: string) {
  const { result, value: newName } = await popupStore.show({
    title: t('chatManagement.actions.rename'),
    content: t('chatManagement.renamePrompt'),
    type: POPUP_TYPE.INPUT,
    inputValue: oldFile,
  });

  if (result === POPUP_RESULT.AFFIRMATIVE && newName && characterStore.activeCharacters) {
    let newFileName = newName.trim();
    try {
      // TODO: Implement group chat
      newFileName = (await api.renameChat(oldFile, newFileName, false)).newFileName;
      if (chatStore.activeChatFile === oldFile) {
        chatStore.activeChatFile = newFileName;
      }
    } catch {
      toast.error(t('chatManagement.errors.rename'));
    }
  }
}

async function deleteChat(chatFile: string) {
  const { result } = await popupStore.show({
    title: t('chatManagement.deleteConfirmTitle'),
    content: t('chatManagement.deleteConfirmContent', { chatFile }),
    type: POPUP_TYPE.CONFIRM,
  });

  if (result === POPUP_RESULT.AFFIRMATIVE && characterStore.activeCharacters) {
    try {
      await api.deleteChat(chatFile);
      const index = chats.value.findIndex((chat) => chat.file_id === chatFile);
      const isActiveChat = chatStore.activeChatFile === chatFile;
      if (isActiveChat) {
        // Select another chat if available
        if (chats.value.length > 1) {
          const newIndex = index === 0 ? 1 : index - 1;
          const newChatFile = chats.value[newIndex].file_id;
          await selectChat(newChatFile);
        } else {
          await createNewChat(false);
        }
      }
      chatStore.chatInfos = chatStore.chatInfos.filter((chat) => chat.file_id !== chatFile);
    } catch {
      toast.error(t('chatManagement.errors.delete'));
    }
  }
}
</script>

<template>
  <div class="popup-body">
    <h3>{{ t('chatManagement.title') }}</h3>
    <div class="chat-management-actions">
      <button v-show="characterStore.activeCharacters" class="menu-button" @click="createNewChat()">
        {{ t('chatManagement.newChat') }}
      </button>
    </div>
    <div class="chat-management-list">
      <table>
        <tbody>
          <tr v-for="file in chats" :key="file.file_id" class="chat-file-row" :data-file="file.file_id">
            <td class="chat-file-name">
              <span v-show="chatStore.activeChatFile === file.file_id" class="active-indicator">
                {{ t('chatManagement.active') }}
              </span>
              {{ file.file_id }}
            </td>
            <td class="chat-file-actions">
              <button
                class="menu-button"
                :disabled="chatStore.activeChatFile === file.file_id"
                :title="t('chatManagement.actions.select')"
                @click="selectChat(file.file_id)"
              >
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="menu-button" :title="t('chatManagement.actions.rename')" @click="renameChat(file.file_id)">
                <i class="fa-solid fa-pencil"></i>
              </button>
              <button
                class="menu-button menu-button--danger"
                :title="t('chatManagement.actions.delete')"
                @click="deleteChat(file.file_id)"
              >
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
