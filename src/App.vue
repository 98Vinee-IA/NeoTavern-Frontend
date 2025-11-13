<script setup lang="ts">
import TopBar from './components/TopBar/TopBar.vue';
import ChatInterface from './components/Chat/ChatInterface.vue';
import { onMounted } from 'vue';
import { useSettingsStore } from './stores/settings.store';

const settingsStore = useSettingsStore();

onMounted(() => {
  settingsStore.initializeSettings();
});
</script>

<template>
  <div id="background" style="background-image: url('backgrounds/landscape postapoc.jpg')"></div>
  <TopBar />
  <ChatInterface />
</template>
