<script setup lang="ts">
import { ref } from 'vue';
import AppIconButton from './AppIconButton.vue';
import AppButton from './AppButton.vue';

defineProps<{
  accept?: string;
  multiple?: boolean;
  type?: 'icon' | 'button'; // default to icon
  icon?: string;
  label?: string; // Text for button mode or title for icon mode
}>();

const emit = defineEmits<{
  (e: 'change', files: File[]): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function trigger() {
  inputRef.value?.click();
}

function handleChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('change', Array.from(target.files));
  }
  // Reset so same file can be selected again
  target.value = '';
}
</script>

<template>
  <div class="app-file-input">
    <input ref="inputRef" type="file" hidden :accept="accept" :multiple="multiple" @change="handleChange" />

    <AppButton v-if="type === 'button'" :icon="icon || 'fa-upload'" @click="trigger">
      {{ label || 'Upload' }}
    </AppButton>

    <AppIconButton v-else :icon="icon || 'fa-upload'" :title="label || 'Upload'" @click="trigger" />
  </div>
</template>
