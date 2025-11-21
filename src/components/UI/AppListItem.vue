<script setup lang="ts">
defineProps<{
  active?: boolean;
  selected?: boolean;
}>();
</script>

<template>
  <div class="app-list-item" :class="{ 'is-active': active, 'is-selected': selected }">
    <!-- Left: Avatar/Icon -->
    <div v-if="$slots.start" class="app-list-item-start">
      <slot name="start" />
    </div>

    <!-- Center: Text content -->
    <div class="app-list-item-content">
      <slot />
    </div>

    <!-- Right: Actions/Meta -->
    <div v-if="$slots.end" class="app-list-item-end">
      <slot name="end" />
    </div>
  </div>
</template>
