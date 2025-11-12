<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { PropType } from 'vue';
import { useSettingsStore } from '../../stores/settings.store';

// Mirrored types from the old Popup.ts for compatibility
export enum POPUP_TYPE {
  TEXT = 1,
  CONFIRM = 2,
  INPUT = 3,
  DISPLAY = 4,
  CROP = 5,
}

export enum POPUP_RESULT {
  AFFIRMATIVE = 1,
  NEGATIVE = 0,
  CANCELLED = -1,
}

export interface CustomPopupButton {
  text: string;
  result?: number;
  classes?: string[] | string;
  action?: () => void;
}

export interface CustomPopupInput {
  id: string;
  label: string;
  tooltip?: string;
  defaultState?: boolean | string;
  type?: 'checkbox' | 'text';
}

export interface PopupOptions {
  okButton?: string | boolean;
  cancelButton?: string | boolean;
  rows?: number;
  wide?: boolean;
  customButtons?: CustomPopupButton[];
  customInputs?: CustomPopupInput[];
  defaultResult?: number;
}

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  type: { type: Number as PropType<POPUP_TYPE>, default: POPUP_TYPE.TEXT },
  inputValue: { type: String, default: '' },
  options: { type: Object as PropType<PopupOptions>, default: () => ({}) },
});

const emit = defineEmits(['close', 'submit']);

const settings = useSettingsStore();
const dialog = ref<HTMLDialogElement | null>(null);
const mainInput = ref<HTMLTextAreaElement | null>(null);
const internalInputValue = ref(props.inputValue);

const okText = ref('OK');
const cancelText = ref('Cancel');
const showOk = ref(true);
const showCancel = ref(false);

function resolveOptions() {
  const { okButton, cancelButton } = props.options;
  switch (props.type) {
    case POPUP_TYPE.CONFIRM:
      okText.value = typeof okButton === 'string' ? okButton : 'Yes';
      cancelText.value = typeof cancelButton === 'string' ? cancelButton : 'No';
      showOk.value = okButton !== false;
      showCancel.value = cancelButton !== false;
      break;
    case POPUP_TYPE.INPUT:
      okText.value = typeof okButton === 'string' ? okButton : 'Save';
      cancelText.value = typeof cancelButton === 'string' ? cancelButton : 'Cancel';
      showOk.value = okButton !== false;
      showCancel.value = cancelButton !== false;
      break;
    default: // TEXT
      okText.value = typeof okButton === 'string' ? okButton : 'OK';
      cancelText.value = typeof cancelButton === 'string' ? cancelButton : 'Cancel';
      showOk.value = okButton !== false;
      showCancel.value = !!cancelButton;
  }
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      resolveOptions();
      dialog.value?.showModal();
      // Auto-focus logic
      setTimeout(() => {
        if (props.type === POPUP_TYPE.INPUT && mainInput.value) {
          mainInput.value.focus();
        } else {
          (dialog.value?.querySelector('.menu-button.default') as HTMLElement)?.focus();
        }
      }, 100); // Delay to allow dialog to render
    } else {
      dialog.value?.close();
    }
  },
);

onMounted(() => {
  if (props.visible) {
    resolveOptions();
    dialog.value?.showModal();
  }
});

function handleResult(result: number) {
  const payload: { result: number; value: any } = { result, value: null };
  if (result === POPUP_RESULT.AFFIRMATIVE) {
    if (props.type === POPUP_TYPE.INPUT) {
      payload.value = internalInputValue.value;
    }
  }
  emit('submit', payload);
  emit('close');
}

function onCancel() {
  emit('submit', { result: POPUP_RESULT.CANCELLED, value: null });
  emit('close');
}

function handleEnter(evt: KeyboardEvent) {
  if (evt.key === 'Enter' && !evt.shiftKey && !evt.altKey) {
    const target = evt.target as HTMLElement;
    const isInput = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';
    if (!isInput || settings.shouldSendOnEnter) {
      evt.preventDefault();
      handleResult(props.options.defaultResult ?? POPUP_RESULT.AFFIRMATIVE);
    }
  }
}
</script>

<template>
  <dialog ref="dialog" class="popup" @cancel="onCancel" @keydown="handleEnter">
    <div class="popup-body">
      <h3 v-if="title" v-html="title"></h3>
      <div v-if="content" class="popup-content" v-html="content"></div>

      <textarea
        v-if="type === POPUP_TYPE.INPUT"
        ref="mainInput"
        class="popup-input"
        :rows="options.rows ?? 1"
        v-model="internalInputValue"
      ></textarea>

      <!-- TODO: Implement CROP and custom inputs if needed -->

      <div class="popup-controls">
        <button
          v-if="showCancel"
          type="button"
          class="menu-button popup-button-cancel"
          @click="handleResult(POPUP_RESULT.NEGATIVE)"
        >
          {{ cancelText }}
        </button>
        <button v-if="showOk" type="button" class="menu-button default" @click="handleResult(POPUP_RESULT.AFFIRMATIVE)">
          {{ okText }}
        </button>
      </div>
    </div>
  </dialog>
</template>
