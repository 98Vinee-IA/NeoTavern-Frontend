<script setup lang="ts">
import AppInput from './AppInput.vue';

defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="app-search-bar">
    <div class="search-input-wrapper">
      <AppInput
        type="search"
        :model-value="modelValue"
        :placeholder="placeholder"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>

    <!-- Slot for Sort Select or Filter buttons -->
    <div v-if="$slots.actions" class="search-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
