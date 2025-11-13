<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { ChatMessage } from '../../types';
import { useCharacterStore } from '../../stores/character.store';
import { useUiStore } from '../../stores/ui.store';
import { useChatStore } from '../../stores/chat.store';
import { getThumbnailUrl } from '../../utils/image';
import { formatTimeStamp } from '../../utils/date';
import { formatMessage } from '../../utils/markdown';

const props = defineProps({
  message: {
    type: Object as PropType<ChatMessage>,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
});

const characterStore = useCharacterStore();
const uiStore = useUiStore();
const chatStore = useChatStore();

const editedContent = ref('');

const isEditing = computed(() => chatStore.activeMessageEditIndex === props.index);

watch(isEditing, (editing) => {
  if (editing) {
    editedContent.value = props.message.mes;
  }
});

const avatarUrl = computed(() => {
  if (props.message.is_user && !props.message.force_avatar) {
    return getThumbnailUrl('persona', undefined); // Will use default_avatar
  }
  if (props.message.force_avatar) {
    // This could be a URL or a thumbnail string. Assuming it's a URL for now.
    return props.message.force_avatar;
  }
  return getThumbnailUrl('avatar', characterStore.activeCharacter?.avatar);
});

const displayName = computed(() => {
  if (props.message.is_user) {
    return uiStore.activePlayerName;
  }
  return props.message.name;
});

const formattedTimestamp = computed(() => {
  return formatTimeStamp(props.message.send_date);
});

const formattedContent = computed(() => {
  return formatMessage(props.message);
});

function startEditing() {
  chatStore.startEditing(props.index);
}

function saveEdit() {
  chatStore.saveMessageEdit(editedContent.value);
}

function cancelEdit() {
  chatStore.cancelEditing();
}
</script>

<template>
  <div class="message" :class="{ 'is-user': message.is_user, 'is-bot': !message.is_user }">
    <div class="message__avatar-wrapper">
      <div class="message__avatar">
        <img :src="avatarUrl" :alt="`${displayName} Avatar`" />
      </div>
      <div class="message__id">#{{ index }}</div>
      <div v-if="message.extra?.reasoning_duration" class="message__timer">
        {{ message.extra.reasoning_duration.toFixed(1) }}s
      </div>
      <div v-if="message.extra?.token_count" class="message__token-count">{{ message.extra.token_count }}t</div>
    </div>

    <div class="message__main">
      <div class="message__header">
        <div class="message__name-block">
          <span class="message__name">{{ displayName }}</span>
          <small class="message__timestamp">{{ formattedTimestamp }}</small>
        </div>
        <div class="message__buttons">
          <!-- TODO: Implement extra buttons dropdown -->
          <i class="message__button fa-solid fa-ellipsis" title="Message Actions"></i>
          <!-- TODO: Implement bookmark button -->
          <i class="message__button fa-solid fa-flag" title="Bookmark"></i>
          <i v-if="!isEditing" @click="startEditing" class="message__button fa-solid fa-pencil" title="Edit"></i>
        </div>
      </div>
      <div v-if="!isEditing" class="message__content" v-html="formattedContent"></div>
      <div v-else class="message__edit-area">
        <textarea v-model="editedContent" class="text-pole"></textarea>
        <div class="message__edit-actions">
          <button @click="saveEdit" class="menu-button">{{ $t('common.save') }}</button>
          <button @click="cancelEdit" class="menu-button">{{ $t('common.cancel') }}</button>
        </div>
      </div>
      <!-- TODO: Implement swipes, reasoning block, media, etc. -->
    </div>
  </div>
</template>
