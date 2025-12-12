<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { computed, markRaw, ref } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { usePopupStore } from '../../stores/popup.store';
import { useSettingsStore } from '../../stores/settings.store';
import { POPUP_TYPE, type CodeMirrorTarget } from '../../types';
import CodeMirrorEditor from './CodeMirrorEditor.vue';
import TextareaExpanded from './TextareaExpanded.vue';

interface Props {
  modelValue: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  resizable?: boolean;
  allowMaximize?: boolean;
  codeMirror?: boolean;
  language?: 'markdown' | 'css';
  identifier?: CodeMirrorTarget;
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  disabled: false,
  resizable: true,
  allowMaximize: false,
  label: undefined,
  placeholder: '',
  codeMirror: false,
  language: 'markdown',
  identifier: undefined,
});

const emit = defineEmits(['update:modelValue']);

const popupStore = usePopupStore();
const settingsStore = useSettingsStore();

const { t } = useStrictI18n();

const textareaRef = ref<HTMLTextAreaElement>();
const codeEditorRef = ref<InstanceType<typeof CodeMirrorEditor>>();

const isCodeMirrorActive = computed(() => {
  if (props.codeMirror) return true;
  if (props.identifier && settingsStore.settings.ui.editor.codeMirrorIdentifiers.includes(props.identifier)) {
    return true;
  }
  return false;
});

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

function onCodeMirrorUpdate(value: string) {
  emit('update:modelValue', value);
}

defineExpose({
  focus() {
    if (isCodeMirrorActive.value && codeEditorRef.value) {
      codeEditorRef.value.focus();
    } else if (textareaRef.value) {
      textareaRef.value.focus();
      textareaRef.value.setSelectionRange(textareaRef.value.value.length, textareaRef.value.value.length);
    }
  },
});

async function maximizeEditor() {
  await popupStore.show({
    type: POPUP_TYPE.CONFIRM,
    title: props.label ? `${t('common.expandedEditor')}: ${props.label}` : t('common.expandedEditor'),
    large: true,
    wide: true,
    component: markRaw(TextareaExpanded),
    componentProps: {
      value: props.modelValue,
      label: props.label,
      language: props.language,
      codeMirror: isCodeMirrorActive.value,
      'onUpdate:value': (value: string) => {
        emit('update:modelValue', value);
      },
    },
    okButton: 'common.close',
    cancelButton: false,
  });
}

const cmMinHeight = computed(() => {
  return `calc(${props.rows} * 1em + var(--textarea-padding-y) * 2)`;
});
</script>

<template>
  <div class="textarea-wrapper">
    <div v-if="label || $slots.header || props.allowMaximize" class="textarea-header">
      <label v-if="label">{{ label }}</label>
      <div v-if="props.allowMaximize" class="maximize-icon" @click="maximizeEditor">
        <i class="fa-solid fa-maximize"></i>
      </div>
    </div>

    <CodeMirrorEditor
      v-if="isCodeMirrorActive"
      ref="codeEditorRef"
      :language="language"
      :model-value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder"
      :min-height="cmMinHeight"
      :max-height="cmMinHeight"
      @update:model-value="onCodeMirrorUpdate"
    />

    <textarea
      v-else
      ref="textareaRef"
      class="text-pole"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :style="{ resize: resizable ? 'vertical' : 'none' }"
      @input="onInput"
    ></textarea>
    <slot name="footer" />
  </div>
</template>
