<script setup lang="ts">
import { computed } from 'vue';
import type { Settings } from '../../types';
import { MainContentFullscreenToggle, SidebarHeader, SplitPane } from '../common';

const props = defineProps<{
  mode?: 'full' | 'main-only' | 'side-only';
  title: string;
  storageKey: keyof Settings['account'];
  initialWidth?: number;
  collapsed?: boolean;
}>();
const emit = defineEmits(['update:collapsed']);

const panelCollapsed = computed({
  get: () => props.collapsed ?? false,
  set: (val) => emit('update:collapsed', val),
});

const displayMode = computed(() => props.mode ?? 'full');
const isSideOnly = computed(() => displayMode.value === 'side-only');
const isMainOnly = computed(() => displayMode.value === 'main-only');
</script>

<template>
  <!-- side-only mode -->
  <div v-if="isSideOnly" style="height: 100%">
    <div class="standalone-pane">
      <SidebarHeader :title="props.title" />
      <slot name="side"></slot>
    </div>
  </div>

  <!-- main-only mode -->
  <div v-else-if="isMainOnly" style="height: 100%">
    <div class="standalone-pane">
      <div class="main-page-header">
        <div class="main-page-header-left">
          <MainContentFullscreenToggle />
        </div>
        <div class="main-page-header-main">
          <h3>{{ props.title }}</h3>
        </div>
        <div class="main-page-header-actions">
          <slot name="main-header-actions"></slot>
        </div>
      </div>
      <div class="main-page-content">
        <slot name="main"></slot>
      </div>
    </div>
  </div>

  <!-- full mode -->
  <SplitPane
    v-else
    v-model:collapsed="panelCollapsed"
    :storage-key="props.storageKey"
    :initial-width="props.initialWidth"
  >
    <template #side>
      <slot name="side"></slot>
    </template>
    <template #main>
      <slot name="main"></slot>
    </template>
  </SplitPane>
</template>

<style scoped>
.standalone-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--theme-background-tint);
  min-height: 0;
  min-width: 0;
}
.main-page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
