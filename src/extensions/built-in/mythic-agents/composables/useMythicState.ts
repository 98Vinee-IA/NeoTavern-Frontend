import { onMounted, onUnmounted, ref } from 'vue';
import type { MythicExtensionAPI, MythicMessageExtraData } from '../types';

export function useMythicState(api: MythicExtensionAPI) {
  const state = ref<MythicMessageExtraData>();

  function updateState() {
    const history = api.chat.getHistory();
    if (history.length === 0) {
      state.value = undefined;
      return;
    }
    const lastMsg = history[history.length - 1];
    state.value = lastMsg.extra?.['core.mythic-agents'];
  }

  let unsubscribe: (() => void) | undefined;

  onMounted(() => {
    updateState();
    const unsubscribeUpdated = api.events.on('message:updated', (index, message) => {
      const history = api.chat.getHistory();
      if (index === history.length - 1) {
        state.value = message.extra?.['core.mythic-agents'];
      }
    });
    const unsubscribeCreated = api.events.on('message:created', () => updateState());
    const unsubscribeDeleted = api.events.on('message:deleted', () => updateState());
    const unsubscribeEntered = api.events.on('chat:entered', () => updateState());
    const unsubscribeCleared = api.events.on('chat:cleared', () => updateState());
    // Combine unsubscribes
    unsubscribe = () => {
      unsubscribeUpdated();
      unsubscribeCreated();
      unsubscribeDeleted();
      unsubscribeEntered();
      unsubscribeCleared();
    };
  });

  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
  });

  return state;
}
