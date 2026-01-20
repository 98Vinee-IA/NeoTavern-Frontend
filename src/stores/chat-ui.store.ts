import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ChatMessageEditState {
  index: number;
  originalContent: string;
}

export type QuickActionsLayout = 'row' | 'column';

export const useChatUiStore = defineStore('chat-ui', () => {
  const isChatLoading = ref(false);
  const activeMessageEditState = ref<ChatMessageEditState | null>(null);
  const renderedMessagesCount = ref(100);
  const chatInputElement = ref<HTMLTextAreaElement | null>(null);

  // TODO: Move to settings
  const quickActionsLayout = ref<QuickActionsLayout>('row');
  const quickActionsShowLabels = ref(true);
  const disabledQuickActions = ref<Set<string>>(new Set());

  function startEditing(index: number, content: string) {
    activeMessageEditState.value = {
      index,
      originalContent: content,
    };
  }

  function cancelEditing() {
    activeMessageEditState.value = null;
  }

  function resetRenderedMessagesCount(initialCount: number) {
    renderedMessagesCount.value = initialCount;
  }

  function loadMoreMessages(count: number) {
    renderedMessagesCount.value += count;
  }

  function setChatInputElement(el: HTMLTextAreaElement | null) {
    chatInputElement.value = el;
  }

  // New actions for quick actions
  function setQuickActionsLayout(layout: QuickActionsLayout) {
    quickActionsLayout.value = layout;
  }

  function setQuickActionsShowLabels(show: boolean) {
    quickActionsShowLabels.value = show;
  }

  function isQuickActionDisabled(id: string): boolean {
    return disabledQuickActions.value.has(id);
  }

  function toggleQuickAction(id: string) {
    if (disabledQuickActions.value.has(id)) {
      disabledQuickActions.value.delete(id);
    } else {
      disabledQuickActions.value.add(id);
    }
    // Return a new Set to ensure reactivity if needed, though direct mutation of ref<Set> is reactive in Vue 3
    disabledQuickActions.value = new Set(disabledQuickActions.value);
  }

  return {
    isChatLoading,
    activeMessageEditState,
    renderedMessagesCount,
    chatInputElement,
    quickActionsLayout,
    quickActionsShowLabels,
    disabledQuickActions,
    startEditing,
    cancelEditing,
    resetRenderedMessagesCount,
    loadMoreMessages,
    setChatInputElement,
    setQuickActionsLayout,
    setQuickActionsShowLabels,
    isQuickActionDisabled,
    toggleQuickAction,
  };
});
