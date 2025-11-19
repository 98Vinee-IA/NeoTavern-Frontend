<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useChatStore } from '../../stores/chat.store';
import { useSettingsStore } from '../../stores/settings.store';
import ChatMessage from './ChatMessage.vue';
import ChatManagementPopup from './ChatManagementPopup.vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { GenerationMode } from '../../constants';

const chatStore = useChatStore();
const settingsStore = useSettingsStore();
const { t } = useStrictI18n();
const userInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isOptionsMenuVisible = ref(false);
const optionsMenu = ref<HTMLElement | null>(null);
const isChatManagementPopupVisible = ref(false);

function submitMessage() {
  chatStore.sendMessage(userInput.value);
  userInput.value = '';
}

function regenerate() {
  chatStore.generateResponse(GenerationMode.REGENERATE);
  isOptionsMenuVisible.value = false;
}

function continueGeneration() {
  chatStore.generateResponse(GenerationMode.CONTINUE);
  isOptionsMenuVisible.value = false;
}

function openChatManagement() {
  isChatManagementPopupVisible.value = true;
  isOptionsMenuVisible.value = false;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && settingsStore.shouldSendOnEnter) {
    event.preventDefault();
    submitMessage();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (optionsMenu.value && !optionsMenu.value.contains(event.target as Node)) {
    const optionsButton = document.getElementById('chat-options-button');
    if (optionsButton && !optionsButton.contains(event.target as Node)) {
      isOptionsMenuVisible.value = false;
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Watch for changes in the chat history to handle auto-scrolling.
watch(
  () => chatStore.chat,
  () => {
    const el = messagesContainer.value;
    if (!el) return;

    // Check if the user is near the bottom before the DOM updates.
    // A tolerance of 100px allows for some leeway.
    const isScrolledToBottom = el.scrollHeight - el.clientHeight <= el.scrollTop + 100;

    // If the user is at the bottom, scroll down after the next DOM update.
    if (isScrolledToBottom) {
      nextTick(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  },
  { deep: true }, // Deep watch is necessary to detect streaming updates inside a message.
);
</script>

<template>
  <div class="chat-interface">
    <div id="chat-messages-container" ref="messagesContainer" class="chat-interface-messages">
      <ChatMessage v-for="(message, index) in chatStore.chat" :key="index" :message="message" :index="index" />
      <div v-show="chatStore.isGenerating" class="chat-interface-typing-indicator">
        <span>{{ t('chat.typingIndicator') }}</span>
        <div class="dot dot1"></div>
        <div class="dot dot2"></div>
        <div class="dot dot3"></div>
      </div>
    </div>
    <div class="chat-interface-form-container">
      <form id="chat-form" class="chat-form" @submit.prevent="submitMessage">
        <div class="chat-form-inner">
          <div class="chat-form-actions-left">
            <button
              id="chat-options-button"
              type="button"
              class="chat-form-button fa-solid fa-bars"
              :title="t('chat.options')"
              @click.stop="isOptionsMenuVisible = !isOptionsMenuVisible"
            ></button>
            <button
              type="button"
              class="chat-form-button fa-solid fa-magic-wand-sparkles"
              :title="t('chat.extensions')"
            ></button>
          </div>
          <textarea
            id="chat-input"
            v-model="userInput"
            :placeholder="t('chat.inputPlaceholder')"
            autocomplete="off"
            :disabled="chatStore.isGenerating"
            @keydown="handleKeydown"
          ></textarea>
          <div class="chat-form-actions-right">
            <button
              v-show="chatStore.isGenerating"
              type="button"
              class="chat-form-button fa-fw fa-solid fa-stop"
              :title="t('chat.abort')"
              @click="chatStore.abortGeneration"
            ></button>
            <div v-show="!chatStore.isGenerating">
              <button
                type="button"
                class="chat-form-button fa-fw fa-solid fa-arrow-right"
                :title="t('chat.continue')"
                :disabled="chatStore.isGenerating"
                @click="continueGeneration"
              ></button>
              <button
                type="submit"
                class="chat-form-button fa-solid fa-paper-plane"
                :title="t('chat.send')"
                :disabled="chatStore.isGenerating"
              ></button>
            </div>
          </div>
        </div>

        <div v-show="isOptionsMenuVisible" ref="optionsMenu" class="options-menu">
          <a class="options-menu-item" @click="openChatManagement">
            <i class="fa-solid fa-address-book"></i>
            <span>{{ t('chat.optionsMenu.manageChats') }}</span>
          </a>
          <hr />
          <a class="options-menu-item" @click="regenerate">
            <i class="fa-solid fa-repeat"></i>
            <span>{{ t('chat.optionsMenu.regenerate') }}</span>
          </a>
          <a class="options-menu-item" @click="continueGeneration">
            <i class="fa-solid fa-arrow-right"></i>
            <span>{{ t('chat.optionsMenu.continue') }}</span>
          </a>
        </div>
      </form>
    </div>
    <ChatManagementPopup :visible="isChatManagementPopupVisible" @close="isChatManagementPopupVisible = false" />
  </div>
</template>
