<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: { label: string; value: string; icon?: string }[];
}>();

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="app-tabs">
    <button
      v-for="tab in options"
      :key="tab.value"
      class="app-tab-button"
      :class="{ active: modelValue === tab.value }"
      @click="emit('update:modelValue', tab.value)"
    >
      <i v-if="tab.icon" :class="['fa-solid', tab.icon]"></i>
      <span>{{ tab.label }}</span>
    </button>
  </div>
</template>
