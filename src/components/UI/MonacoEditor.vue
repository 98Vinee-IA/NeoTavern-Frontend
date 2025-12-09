<script setup lang="ts">
import * as monaco from 'monaco-editor';
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string;
    readOnly?: boolean;
    theme?: string;
  }>(),
  {
    language: 'markdown',
    readOnly: false,
    theme: 'vs-dark', // Default to dark to match the app theme
  },
);

const emit = defineEmits(['update:modelValue', 'change']);

const editorContainer: Ref<HTMLElement | null> = ref(null);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

// Initialize Editor
onMounted(() => {
  if (editorContainer.value) {
    monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });

    editorInstance = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
      language: props.language,
      theme: props.theme,
      readOnly: props.readOnly,
      automaticLayout: true, // Handles resizing automatically
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: "'Noto Sans Mono', 'Courier New', Consolas, monospace",
      padding: { top: 10, bottom: 10 },
      scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    editorInstance.onDidChangeModelContent(() => {
      const value = editorInstance?.getValue() || '';
      if (value !== props.modelValue) {
        emit('update:modelValue', value);
        emit('change', value);
      }
    });
  }
});

// Sync value changes from parent (e.g. reset)
watch(
  () => props.modelValue,
  (newValue) => {
    if (editorInstance && newValue !== editorInstance.getValue()) {
      editorInstance.setValue(newValue);
    }
  },
);

// Watch language changes
watch(
  () => props.language,
  (newLang) => {
    if (editorInstance) {
      const model = editorInstance.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, newLang);
      }
    }
  },
);

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose();
  }
});
</script>

<template>
  <div ref="editorContainer" class="monaco-editor-host"></div>
</template>

<style scoped>
.monaco-editor-host {
  width: 100%;
  height: 100%;
  min-height: 200px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--theme-border-color);
}
</style>
