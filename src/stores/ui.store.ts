import { defineStore } from 'pinia';
import { markRaw, ref } from 'vue';
import type { NavBarItemDefinition, SidebarDefinition, ZoomedAvatar } from '../types';

export const useUiStore = defineStore('ui', () => {
  const isChatSaving = ref<boolean>(false);
  const isDeleteMode = ref<boolean>(false);
  const isSendPress = ref<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cropData = ref<any>(null); // TODO: Proper type
  const activePlayerName = ref<string | null>(null);
  const activePlayerAvatar = ref<string | null>(null);
  const zoomedAvatars = ref<ZoomedAvatar[]>([]);

  const activeDrawer = ref<string | null>(null);

  const isLeftSidebarOpen = ref(false);
  const leftSidebarView = ref<string | null>(null);

  const isRightSidebarOpen = ref(false);
  const rightSidebarView = ref<string | null>(null);

  const leftSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const rightSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const navBarRegistry = ref<Map<string, NavBarItemDefinition>>(new Map());

  function registerSidebar(id: string, definition: Omit<SidebarDefinition, 'id'>, side: 'left' | 'right') {
    const rawComponent = markRaw(definition.component);
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    registry.value.set(id, { ...definition, component: rawComponent, id });
  }

  function unregisterSidebar(id: string, side: 'left' | 'right') {
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    registry.value.delete(id);

    if (side === 'left' && leftSidebarView.value === id) {
      closeLeftSidebar();
    } else if (side === 'right' && rightSidebarView.value === id) {
      closeRightSidebar();
    }
  }

  function registerNavBarItem(id: string, definition: Omit<NavBarItemDefinition, 'id'>) {
    const rawComponent = definition.component ? markRaw(definition.component) : undefined;
    navBarRegistry.value.set(id, { ...definition, component: rawComponent, id });
  }

  function unregisterNavBarItem(id: string) {
    navBarRegistry.value.delete(id);
    if (activeDrawer.value === id) {
      activeDrawer.value = null;
    }
  }

  function toggleLeftSidebar(viewId?: string) {
    if (!viewId) {
      if (leftSidebarView.value) {
        isLeftSidebarOpen.value = false;
        leftSidebarView.value = null;
        return;
      }
      viewId = 'recent-chats';
      if (!leftSidebarRegistry.value.has(viewId)) {
        viewId = leftSidebarRegistry.value.keys().next().value;
      }
    }

    if (!viewId) return;

    if (isLeftSidebarOpen.value && leftSidebarView.value === viewId) {
      isLeftSidebarOpen.value = false;
      leftSidebarView.value = null;
    } else {
      if (leftSidebarRegistry.value.has(viewId)) {
        isLeftSidebarOpen.value = true;
        leftSidebarView.value = viewId;
      }
    }
  }

  function closeLeftSidebar() {
    isLeftSidebarOpen.value = false;
    leftSidebarView.value = null;
  }

  function toggleRightSidebar(viewId: string) {
    if (isRightSidebarOpen.value && rightSidebarView.value === viewId) {
      isRightSidebarOpen.value = false;
      rightSidebarView.value = null;
    } else {
      if (rightSidebarRegistry.value.has(viewId)) {
        isRightSidebarOpen.value = true;
        rightSidebarView.value = viewId;
      } else {
        console.warn(`[UiStore] Attempted to open non-existent right sidebar: ${viewId}`);
      }
    }
  }

  function closeRightSidebar() {
    isRightSidebarOpen.value = false;
    rightSidebarView.value = null;
  }

  function toggleZoomedAvatar(avatarData: Omit<ZoomedAvatar, 'id'>) {
    const id = avatarData.charName;
    const existingIndex = zoomedAvatars.value.findIndex((avatar) => avatar.id === id);

    if (existingIndex > -1) {
      zoomedAvatars.value.splice(existingIndex, 1);
    } else {
      zoomedAvatars.value.push({ ...avatarData, id });
    }
  }

  function removeZoomedAvatar(id: string) {
    const index = zoomedAvatars.value.findIndex((avatar) => avatar.id === id);
    if (index > -1) {
      zoomedAvatars.value.splice(index, 1);
    }
  }

  return {
    isChatSaving,
    isDeleteMode,
    isSendPress,
    activeDrawer,
    cropData,
    activePlayerName,
    activePlayerAvatar,
    zoomedAvatars,

    // Sidebar State
    isLeftSidebarOpen,
    leftSidebarView,
    isRightSidebarOpen,
    rightSidebarView,

    // Registries
    leftSidebarRegistry,
    rightSidebarRegistry,
    navBarRegistry,

    // Actions
    registerSidebar,
    unregisterSidebar,
    registerNavBarItem,
    unregisterNavBarItem,
    toggleLeftSidebar,
    closeLeftSidebar,
    toggleRightSidebar,
    closeRightSidebar,

    toggleZoomedAvatar,
    removeZoomedAvatar,
  };
});
