<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { defineAsyncComponent, markRaw, ref } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { usePopupStore } from '../../stores/popup.store';
import { POPUP_TYPE } from '../../types';
import TextareaExpanded from './TextareaExpanded.vue';

// Async import Monaco to avoid bundling it if not used
const MonacoEditor = defineAsyncComponent(() => import('./MonacoEditor.vue'));

interface Props {
  modelValue: string;
  label?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  resizable?: boolean;
  allowMaximize?: boolean;
  code?: boolean;
  language?: string;
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  disabled: false,
  resizable: true,
  allowMaximize: false,
  label: undefined,
  placeholder: '',
  code: false,
  language: 'markdown',
});

const emit = defineEmits(['update:modelValue']);

const popupStore = usePopupStore();
const { t } = useStrictI18n();

const textareaRef = ref<HTMLTextAreaElement>();

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

function onCodeInput(value: string) {
  emit('update:modelValue', value);
}

defineExpose({
  focus() {
    if (textareaRef.value && !props.code) {
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
      code: props.code,
      language: props.language,
      'onUpdate:value': (value: string) => {
        emit('update:modelValue', value);
      },
    },
    okButton: 'common.close',
    cancelButton: false,
  });
}
</script>

<template>
  <div class="textarea-wrapper" :class="{ 'is-code-editor': code }">
    <div v-if="label || $slots.header || props.allowMaximize" class="textarea-header">
      <label v-if="label">{{ label }}</label>
      <div v-if="code" class="code-badge"><i class="fa-solid fa-code"></i> {{ language }}</div>
      <div v-if="props.allowMaximize" class="maximize-icon" @click="maximizeEditor">
        <i class="fa-solid fa-maximize"></i>
      </div>
    </div>

    <!-- Monaco Editor Mode -->
    <div v-if="code" class="monaco-wrapper" :style="{ height: `${rows * 24 + 20}px` }">
      <MonacoEditor
        :model-value="modelValue"
        :language="language"
        :read-only="disabled"
        @update:model-value="onCodeInput"
      />
    </div>

    <!-- Standard Textarea Mode -->
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

<style scoped>
.monaco-wrapper {
  margin: var(--spacing-xs) 0;
  min-height: 150px;
}

.code-badge {
  font-size: 0.7em;
  opacity: 0.6;
  margin-left: auto;
  margin-right: var(--spacing-sm);
  background-color: var(--black-30a);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-family-mono);
  text-transform: uppercase;
}
</style>
