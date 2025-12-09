<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue';

const MonacoEditor = defineAsyncComponent(() => import('./MonacoEditor.vue'));

const props = defineProps<{
  popupId: string;
  value: string;
  label?: string;
  code?: boolean;
  language?: string;
}>();

const emit = defineEmits(['update:value']);
const inputValue = ref(props.value);

function onCodeUpdate(val: string) {
  inputValue.value = val;
  emit('update:value', val);
}
</script>

<template>
  <div class="expanded-textarea-container" :class="{ 'full-height-editor': code }">
    <label v-if="label" class="expanded-label">{{ label }}</label>

    <div v-if="code" class="expanded-monaco-wrapper">
      <MonacoEditor v-model="inputValue" :language="language || 'markdown'" @update:model-value="onCodeUpdate" />
    </div>

    <textarea
      v-else
      v-model="inputValue"
      class="text-pole expanded-textarea"
      rows="25"
      @change="emit('update:value', inputValue)"
    ></textarea>
  </div>
</template>

<style scoped>
.full-height-editor,
.expanded-monaco-wrapper {
  height: 100%;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.expanded-monaco-wrapper {
  min-height: 500px;
}
</style>
