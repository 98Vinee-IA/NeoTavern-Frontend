<script setup lang="ts">
import SidebarHeader from '../common/SidebarHeader.vue';

defineProps<{
  id: string;
  title?: string;
}>();
</script>

<template>
  <div class="vanilla-sidebar-wrapper">
    <SidebarHeader v-if="title" :title="title">
      <template #actions>
        <!-- Extensions can inject header actions here -->
        <div :id="`${id}-header-actions`" class="vanilla-sidebar-header-actions"></div>
      </template>
    </SidebarHeader>

    <div :id="id" class="vanilla-sidebar-container">
      <!-- Vanilla extensions will append content here via document.getElementById(id) -->
    </div>
  </div>
</template>

<style scoped lang="scss">
.vanilla-sidebar-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--theme-background-tint);
}

.vanilla-sidebar-container {
  flex: 1;
  width: 100%;
  min-height: 0;
  overflow-y: auto;
  position: relative;
}

.vanilla-sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
