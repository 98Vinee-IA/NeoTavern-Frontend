<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSettingsStore } from '../../stores/settings.store';
import CodeMirrorEditor from './CodeMirrorEditor.vue';

const props = withDefaults(
  defineProps<{
    popupId?: string;
    value: string;
    label?: string;
    language?: 'markdown' | 'css';
    codeMirror?: boolean;
  }>(),
  {
    popupId: undefined,
    label: undefined,
    language: 'markdown',
    codeMirror: false,
  },
);

const emit = defineEmits(['update:value']);
const inputValue = ref(props.value);
const settingsStore = useSettingsStore();

const isCodeMirrorActive = computed(() => {
  return props.codeMirror || settingsStore.settings.ui.editor.codeMirrorExpanded;
});

watch(
  () => props.value,
  (newVal) => {
    inputValue.value = newVal;
  },
);

function updateValue(val: string) {
  inputValue.value = val;
  emit('update:value', val);
}
</script>

<template>
  <div class="expanded-textarea-container" :class="{ 'is-codemirror': isCodeMirrorActive }">
    <label v-if="label" class="expanded-label">{{ label }}</label>

    <div v-if="isCodeMirrorActive" class="expanded-codemirror-wrapper">
      <CodeMirrorEditor
        :model-value="inputValue"
        :language="language"
        autofocus
        min-height="500px"
        max-height="calc(80vh - 100px)"
        @update:model-value="updateValue"
      />
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
.expanded-textarea-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.expanded-label {
  font-weight: bold;
  margin-bottom: var(--spacing-sm);
  flex-shrink: 0;
}

.expanded-textarea {
  min-height: 500px;
  resize: none !important;
}

.expanded-codemirror-wrapper {
  flex-grow: 1;
  min-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
