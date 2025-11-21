<script setup lang="ts">
import { computed } from 'vue';
import { useUiStore } from '../../stores/ui.store';
import { useCharacterStore } from '../../stores/character.store';
import { useSettingsStore } from '../../stores/settings.store';
import { getThumbnailUrl } from '@/utils/image';
import { useChatStore } from '@/stores/chat.store';
import { formatTimeStamp } from '@/utils/date';

const uiStore = useUiStore();
const characterStore = useCharacterStore();
const settingsStore = useSettingsStore();
const chatStore = useChatStore();

const firstCharacter = computed(() => characterStore.activeCharacters?.[0]);

const isGroup = computed(() => chatStore.isGroupChat);

const headerTitle = computed(() => {
  if (isGroup.value) {
    return characterStore.activeCharacters.map((c) => c.name).join(', ');
  }
  return firstCharacter.value?.name || '';
});

const avatarUrls = computed(() => {
  if (isGroup.value) {
    return characterStore.activeCharacters.slice(0, 4).map((c) => getThumbnailUrl('avatar', c.avatar));
  }
  return [getThumbnailUrl('avatar', firstCharacter.value?.avatar || '')];
});

const lastMessageDate = computed(() => {
  const messages = chatStore.activeChat?.messages;
  if (!messages || messages.length === 0) return '';
  const lastMsg = messages[messages.length - 1];
  return formatTimeStamp(lastMsg.send_date || lastMsg.gen_finished || Date.now());
});

const isFullScreen = computed(() => settingsStore.getAccountItem('chat_full_screen') === 'true');

function handleCharacterClick() {
  if (isGroup.value) {
    uiStore.toggleRightSidebar('chat-management');
  } else if (firstCharacter.value) {
    uiStore.selectedCharacterAvatarForEditing = firstCharacter.value.avatar;
    uiStore.activeDrawer = 'character';
  }
}

function toggleFullScreen() {
  settingsStore.setAccountItem('chat_full_screen', (!isFullScreen.value).toString());
}
</script>

<template>
  <header class="chat-header">
    <div class="chat-header-group left">
      <template v-for="[id, def] in uiStore.leftSidebarRegistry" :key="id">
        <i
          v-if="def.icon"
          class="chat-header-icon fa-solid"
          :class="[def.icon, { active: uiStore.leftSidebarView === id }]"
          :title="def.title"
          @click="uiStore.toggleLeftSidebar(id)"
        ></i>
      </template>
    </div>

    <div class="chat-header-group center" @click="handleCharacterClick">
      <div v-if="characterStore.activeCharacters.length > 0" class="chat-header-info">
        <div v-if="isGroup" class="chat-header-info-avatar group-grid">
          <img
            v-for="(url, index) in avatarUrls"
            :key="index"
            :src="url"
            class="group-avatar-img"
            onerror="this.src='img/ai4.png'"
            alt="Group Member"
          />
        </div>
        <img
          v-else
          :src="avatarUrls[0]"
          :alt="headerTitle"
          class="chat-header-info-avatar"
          onerror="this.src='img/ai4.png'"
        />

        <div class="chat-header-info-text">
          <span class="chat-header-info-name" :title="headerTitle">{{ headerTitle }}</span>
          <span v-show="lastMessageDate" class="chat-header-info-meta">{{ lastMessageDate }}</span>
        </div>
      </div>
    </div>

    <div class="chat-header-group right">
      <i
        class="chat-header-icon fa-solid"
        :class="isFullScreen ? 'fa-compress active' : 'fa-expand'"
        title="Toggle Full Screen"
        @click="toggleFullScreen"
      ></i>
      <template v-for="([id, def], index) in uiStore.rightSidebarRegistry" :key="index">
        <i
          v-if="def.icon"
          class="chat-header-icon fa-solid"
          :class="[def.icon, { active: uiStore.rightSidebarView === id }]"
          :title="def.title"
          @click="uiStore.toggleRightSidebar(id)"
        ></i>
      </template>
    </div>
  </header>
</template>
