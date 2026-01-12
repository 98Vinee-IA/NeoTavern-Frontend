<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ConnectionProfileSelector } from '../../../components/common';
import { FormItem, Tabs } from '../../../components/UI';
import type { ExtensionAPI } from '../../../types';
import LorebookTab from './components/LorebookTab.vue';
import MessageSummariesTab from './components/MessageSummariesTab.vue';
import type { ExtensionSettings } from './types';

const props = defineProps<{
  api: ExtensionAPI<ExtensionSettings>;
}>();

// --- Tabs ---
const activeTab = ref('lorebook');
const tabs = [
  { label: 'Lorebook Summaries', value: 'lorebook', icon: 'fa-book-atlas' },
  { label: 'Message Summaries', value: 'messages', icon: 'fa-message' },
];

// --- Shared State ---
const connectionProfile = ref<string | undefined>(undefined);

// --- Lifecycle ---
onMounted(async () => {
  loadSettings();
});

// Auto-save settings
watch([connectionProfile], () => {
  saveSettings();
});

// --- Common Methods ---
function loadSettings() {
  const settings = props.api.settings.get();
  if (settings) {
    if (settings.connectionProfile) connectionProfile.value = settings.connectionProfile;
  }
}

function saveSettings() {
  props.api.settings.set('connectionProfile', connectionProfile.value);
  props.api.settings.save();
}
</script>

<template>
  <div class="memory-popup">
    <!-- Header -->
    <div class="header-controls">
      <Tabs v-model="activeTab" :options="tabs" class="main-tabs" />
    </div>

    <!-- Connection Profile Global Setting for the Popup -->
    <div class="profile-section">
      <FormItem label="Connection Profile" description="Used for generating summaries">
        <ConnectionProfileSelector v-model="connectionProfile" />
      </FormItem>
    </div>

    <!-- Content Area -->
    <div class="tab-content-area">
      <LorebookTab v-if="activeTab === 'lorebook'" :api="api" :connection-profile="connectionProfile" />
      <MessageSummariesTab v-if="activeTab === 'messages'" :api="api" :connection-profile="connectionProfile" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.memory-popup {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px;
  max-height: 80vh;
  overflow-y: auto;
  height: 100%;
}

.header-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 5px;
}

.profile-section {
  border-bottom: 1px solid var(--theme-border-color);
  padding-bottom: 15px;
  margin-bottom: 15px;
}

.tab-content-area {
  flex: 1;
  min-height: 0;
}
</style>
