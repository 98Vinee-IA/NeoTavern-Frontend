import { defineStore } from 'pinia';
import { ref } from 'vue';
import { POPUP_TYPE, POPUP_RESULT, type PopupShowOptions, type PopupState } from '../types';
import { uuidv4 } from '../utils/common';

interface PopupPromise<T = unknown> {
  resolve: (payload: { result: number; value: T }) => void;
  reject: (reason?: unknown) => void;
}

export const usePopupStore = defineStore('popup', () => {
  const popups = ref<PopupState[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promises = ref<Record<string, PopupPromise<any>>>({});

  function show<T = unknown>(options: PopupShowOptions): Promise<{ result: number; value: T }> {
    const id = uuidv4();
    const newPopup: PopupState = {
      id,
      visible: true,
      title: '',
      content: '',
      type: POPUP_TYPE.TEXT,
      inputValue: '',
      ...options,
    };

    popups.value.push(newPopup);

    return new Promise((resolve, reject) => {
      promises.value[id] = { resolve, reject };
    });
  }

  function hide(id: string) {
    const index = popups.value.findIndex((p) => p.id === id);
    if (index > -1) {
      popups.value.splice(index, 1);
    }
    delete promises.value[id];
  }

  function confirm<T = unknown>(id: string, payload: { result: number; value: T }) {
    promises.value[id]?.resolve(payload);
    hide(id);
  }

  function cancel(id: string) {
    promises.value[id]?.resolve({ result: POPUP_RESULT.CANCELLED, value: null });
    hide(id);
  }

  return {
    popups,
    show,
    confirm,
    cancel,
  };
});
