import { defineStore } from 'pinia';
import { computed, markRaw, reactive, ref } from 'vue';
import type { NavBarItemDefinition, SidebarDefinition, ZoomedAvatar } from '../types';

type RightSidebarState = {
  isOpen: boolean;
  view: string | null;
};

export const useUiStore = defineStore('ui', () => {
  const isChatSaving = ref(false);
  const isDeleteMode = ref(false);
  const isSendPress = ref(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cropData = ref<any>(null); // TODO: Proper type
  const activePlayerName = ref<string | null>(null);
  const activePlayerAvatar = ref<string | null>(null);
  const zoomedAvatars = ref<ZoomedAvatar[]>([]);

  const activeDrawer = ref<string | null>(null);
  const activeMainLayout = ref<string>('chat');

  const isLeftSidebarOpen = ref(false);
  const leftSidebarView = ref<string | null>(null);

  const rightSidebarStateByLayout = reactive<Record<string, RightSidebarState>>({});

  const leftSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const rightSidebarRegistry = ref<Map<string, SidebarDefinition>>(new Map());
  const navBarRegistry = ref<Map<string, NavBarItemDefinition>>(new Map());

  /**
   * Central handler for all NavBar interactions.
   * Determines if the click should switch layout, toggle sidebar, or toggle drawer.
   */
  function activateNavBarItem(itemId: string) {
    const item = navBarRegistry.value.get(itemId);
    if (!item) return;

    // 1. Custom Handler
    if (item.onClick) {
      item.onClick();
    }

    // 2. Main Layout Switcher
    if (item.layoutComponent) {
      if (activeMainLayout.value === itemId) {
        // Already active? Toggle the default sidebar if one exists
        if (item.defaultSidebarId) toggleLeftSidebar(item.defaultSidebarId);
      } else {
        // Switch layout
        activeMainLayout.value = itemId;
        activeDrawer.value = null; // Close any open drawers
        cleanupRightSidebarForLayout(itemId);

        // Open default sidebar for this layout if defined
        if (item.defaultSidebarId) {
          isLeftSidebarOpen.value = true;
          leftSidebarView.value = item.defaultSidebarId;
        } else {
          isLeftSidebarOpen.value = false;
        }
      }
      return;
    }

    // 3. Floating Sidebar Toggle
    if (item.targetSidebarId) {
      toggleLeftSidebar(item.targetSidebarId);
      return;
    }

    // 4. Drawer/Modal Toggle
    if (item.component) {
      activeDrawer.value = activeDrawer.value === itemId ? null : itemId;
    }
  }

  function toggleLeftSidebar(viewId: string) {
    if (!leftSidebarRegistry.value.has(viewId)) return;

    if (isLeftSidebarOpen.value && leftSidebarView.value === viewId) {
      isLeftSidebarOpen.value = false;
      leftSidebarView.value = null;
    } else {
      isLeftSidebarOpen.value = true;
      leftSidebarView.value = viewId;
      activeDrawer.value = null;
    }
  }

  function closeLeftSidebar() {
    isLeftSidebarOpen.value = false;
    leftSidebarView.value = null;
  }

  function getRightSidebarState(layoutId = activeMainLayout.value): RightSidebarState {
    if (!rightSidebarStateByLayout[layoutId]) {
      rightSidebarStateByLayout[layoutId] = { isOpen: false, view: null };
    }
    return rightSidebarStateByLayout[layoutId];
  }

  function cleanupRightSidebarForLayout(layoutId: string) {
    const state = getRightSidebarState(layoutId);
    // If current view is invalid for this layout, close it
    if (state.view) {
      const def = rightSidebarRegistry.value.get(state.view);
      if (def && (def.layoutId ?? 'chat') !== layoutId) {
        state.isOpen = false;
        state.view = null;
      }
    }
  }

  function toggleRightSidebar(viewId: string) {
    const layoutId = activeMainLayout.value;
    const def = rightSidebarRegistry.value.get(viewId);

    if (!def || (def.layoutId ?? 'chat') !== layoutId) return;

    const state = getRightSidebarState(layoutId);
    if (state.isOpen && state.view === viewId) {
      state.isOpen = false;
      state.view = null;
    } else {
      state.isOpen = true;
      state.view = viewId;
    }
  }

  function closeRightSidebar() {
    const state = getRightSidebarState(activeMainLayout.value);
    state.isOpen = false;
    state.view = null;
  }

  function registerSidebar(id: string, definition: Omit<SidebarDefinition, 'id'>, side: 'left' | 'right') {
    const rawComponent = markRaw(definition.component);
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    const layoutId = side === 'right' ? (definition.layoutId ?? 'chat') : definition.layoutId;
    registry.value.set(id, { ...definition, component: rawComponent, layoutId, id });
  }

  function unregisterSidebar(id: string, side: 'left' | 'right') {
    const registry = side === 'left' ? leftSidebarRegistry : rightSidebarRegistry;
    registry.value.delete(id);
    // Cleanup if currently open
    if (side === 'left' && leftSidebarView.value === id) closeLeftSidebar();
    if (side === 'right') cleanupRightSidebarForLayout(activeMainLayout.value);
  }

  function registerNavBarItem(id: string, definition: Omit<NavBarItemDefinition, 'id'>) {
    navBarRegistry.value.set(id, {
      ...definition,
      component: definition.component ? markRaw(definition.component) : undefined,
      layoutComponent: definition.layoutComponent ? markRaw(definition.layoutComponent) : undefined,
      id,
    });
  }

  function unregisterNavBarItem(id: string) {
    navBarRegistry.value.delete(id);
    if (activeDrawer.value === id) activeDrawer.value = null;
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
    if (index > -1) zoomedAvatars.value.splice(index, 1);
  }

  const isRightSidebarOpen = computed(() => getRightSidebarState().isOpen);
  const rightSidebarView = computed(() => getRightSidebarState().view);

  return {
    isChatSaving,
    isDeleteMode,
    isSendPress,
    cropData,
    activePlayerName,
    activePlayerAvatar,
    zoomedAvatars,
    activeDrawer,
    activeMainLayout,

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
    activateNavBarItem,

    toggleLeftSidebar,
    closeLeftSidebar,

    toggleRightSidebar,
    closeRightSidebar,

    registerSidebar,
    unregisterSidebar,
    registerNavBarItem,
    unregisterNavBarItem,
    getNavBarItem: (id: string) => navBarRegistry.value.get(id),

    toggleZoomedAvatar,
    removeZoomedAvatar,
  };
});
