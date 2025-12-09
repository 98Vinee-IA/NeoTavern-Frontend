<script setup lang="ts">
import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt, ViewUpdate } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
    autofocus?: boolean;
    minHeight?: string;
    maxHeight?: string;
  }>(),
  {
    disabled: false,
    placeholder: '',
    autofocus: false,
    minHeight: 'auto',
    maxHeight: 'none',
  },
);

const emit = defineEmits(['update:modelValue', 'focus', 'blur']);

const editorContainer = ref<HTMLElement>();
let editorView: EditorView | null = null;

// Custom theme to match application styles
const appTheme = EditorView.theme(
  {
    '&': {
      color: 'var(--theme-text-color)',
      backgroundColor: 'var(--black-30a)',
      border: '1px solid var(--theme-border-color)',
      borderRadius: 'var(--base-border-radius)',
      fontSize: 'var(--font-size-main)',
      fontFamily: 'var(--font-family-mono, monospace)',
      minHeight: props.minHeight,
      maxHeight: props.maxHeight,
      overflow: 'hidden',
    },
    '&.cm-focused': {
      outline: 'none',
      borderColor: 'var(--theme-underline-color)',
      backgroundColor: 'var(--black-50a)',
    },
    '.cm-content': {
      padding: 'var(--textarea-padding-y) var(--textarea-padding-x)',
      caretColor: 'var(--theme-text-color)',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      overflow: 'auto',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--black-30a)',
      color: 'var(--theme-emphasis-color)',
      borderRight: '1px solid var(--theme-border-color)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--white-20a)',
    },
    '.cm-placeholder': {
      color: 'var(--theme-emphasis-color)',
    },
    // Selection
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-accent-cobalt-30a) !important',
    },
    // Basic Syntax Highlighting matching dark theme generic colors
    '.cm-header': { color: 'var(--color-golden)', fontWeight: 'bold' },
    '.cm-strong': { fontWeight: 'bold' },
    '.cm-em': { fontStyle: 'italic' },
    '.cm-link': { color: 'var(--color-info-cobalt)', textDecoration: 'underline' },
    '.cm-code': { fontFamily: 'var(--font-family-mono)', backgroundColor: 'var(--white-20a)', borderRadius: '3px' },
  },
  { dark: true },
);

const initEditor = () => {
  if (!editorContainer.value) return;

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      markdown(), // Default to markdown for chat/text heavy apps
      appTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((v: ViewUpdate) => {
        if (v.docChanged) {
          emit('update:modelValue', v.state.doc.toString());
        }
        if (v.focusChanged) {
          if (v.view.hasFocus) emit('focus');
          else emit('blur');
        }
      }),
      props.placeholder ? placeholderExt(props.placeholder) : [],
      EditorState.readOnly.of(props.disabled),
    ],
  });

  editorView = new EditorView({
    state: startState,
    parent: editorContainer.value,
  });

  if (props.autofocus) {
    editorView.focus();
  }
};

onMounted(() => {
  initEditor();
});

onBeforeUnmount(() => {
  if (editorView) {
    editorView.destroy();
  }
});

// Watch for external value changes
watch(
  () => props.modelValue,
  (newVal) => {
    if (editorView && newVal !== editorView.state.doc.toString()) {
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: newVal },
      });
    }
  },
);

// Watch for disabled state
watch(
  () => props.disabled,
  (val) => {
    if (editorView) {
      editorView.dispatch({
        effects: EditorState.readOnly.reconfigure(val),
      });
    }
  },
);

defineExpose({
  focus: () => editorView?.focus(),
});
</script>

<template>
  <div ref="editorContainer" class="codemirror-wrapper"></div>
</template>

<style scoped>
.codemirror-wrapper {
  width: 100%;
  /* Flex grow if parent allows, but ensure height */
  display: flex;
  flex-direction: column;
}
</style>
