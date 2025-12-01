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
