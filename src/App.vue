<script setup lang="ts">
import TopBar from './components/TopBar/TopBar.vue';
import ChatInterface from './components/Chat/ChatInterface.vue';
import Popup from './components/Popup/Popup.vue';
import ZoomedAvatar from './components/ZoomedAvatar.vue';
import { onMounted } from 'vue';
import { useSettingsStore } from './stores/settings.store';
import { usePopupStore } from './stores/popup.store';
import { useUiStore } from './stores/ui.store';

const settingsStore = useSettingsStore();
const popupStore = usePopupStore();
const uiStore = useUiStore();

onMounted(() => {
  settingsStore.initializeSettings();
});
</script>

<template>
  <div id="background" style="background-image: url('backgrounds/landscape postapoc.jpg')"></div>
  <TopBar />
  <ChatInterface />
  <template v-for="popup in popupStore.popups" :key="popup.id">
    <Popup
      v-bind="popup"
      @submit="(payload: any) => popupStore.confirm(popup.id, payload)"
      @close="popupStore.cancel(popup.id)"
    />
  </template>

  <template v-for="avatar in uiStore.zoomedAvatars" :key="avatar.id">
    <ZoomedAvatar :avatar="avatar" />
  </template>
</template>
