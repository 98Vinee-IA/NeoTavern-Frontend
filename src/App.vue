<script setup lang="ts">
import { computed, onMounted } from 'vue';
import ChatHeader from './components/Chat/ChatHeader.vue';
import ChatInterface from './components/Chat/ChatInterface.vue';
import ChatManagement from './components/Chat/ChatManagement.vue';
import RecentChats from './components/Chat/RecentChats.vue';

import CharacterPanel from './components/CharacterPanel/CharacterPanel.vue';
import AiConfigDrawer from './components/NavBar/AiConfigDrawer.vue';
import ApiConnectionsDrawer from './components/NavBar/ApiConnectionsDrawer.vue';
import BackgroundsDrawer from './components/NavBar/BackgroundsDrawer.vue';
import ExtensionsDrawer from './components/NavBar/ExtensionsDrawer.vue';
import FormattingDrawer from './components/NavBar/FormattingDrawer.vue';
import NavBar from './components/NavBar/NavBar.vue';
import PersonaManagementDrawer from './components/NavBar/PersonaManagementDrawer.vue';
import UserSettingsDrawer from './components/NavBar/UserSettingsDrawer.vue';
import WorldInfoDrawer from './components/NavBar/WorldInfoDrawer.vue';
import Popup from './components/Popup/Popup.vue';
import Sidebar from './components/Shared/Sidebar.vue';
import ZoomedAvatar from './components/ZoomedAvatar.vue';
import { useStrictI18n } from './composables/useStrictI18n';
import { useBackgroundStore } from './stores/background.store';
import { usePopupStore } from './stores/popup.store';
import { useSettingsStore } from './stores/settings.store';
import { useUiStore } from './stores/ui.store';

const settingsStore = useSettingsStore();
const popupStore = usePopupStore();
const uiStore = useUiStore();
const backgroundStore = useBackgroundStore();
const { t } = useStrictI18n();

const backgroundStyle = computed(() => ({
  backgroundImage: backgroundStore.currentBackgroundUrl,
}));

const isFullScreen = computed(() => settingsStore.settings.account.chatFullScreen);

onMounted(() => {
  settingsStore.initializeSettings();

  // Register Left Sidebar
  uiStore.registerSidebar(
    'recent-chats',
    {
      component: RecentChats,
      title: 'Recent Chats',
      icon: 'fa-comments',
    },
    'left',
  );

  // Register Right Sidebars
  uiStore.registerSidebar(
    'ai-config',
    {
      component: AiConfigDrawer,
      title: 'AI Configuration',
      icon: 'fa-sliders',
    },
    'right',
  );

  uiStore.registerSidebar(
    'chat-management',
    {
      component: ChatManagement,
      title: t('chat.optionsMenu.manageChats'),
      icon: 'fa-address-book',
    },
    'right',
  );

  // Register NavBar Items
  uiStore.registerNavBarItem('ai-config', {
    icon: 'fa-sliders',
    title: t('navbar.aiConfig'),
    component: AiConfigDrawer,
  });

  uiStore.registerNavBarItem('api-status', {
    icon: 'fa-plug',
    title: t('navbar.apiConnections'),
    component: ApiConnectionsDrawer,
  });

  uiStore.registerNavBarItem('formatting', {
    icon: 'fa-font',
    title: t('navbar.formatting'),
    component: FormattingDrawer,
  });

  uiStore.registerNavBarItem('world-info', {
    icon: 'fa-book-atlas',
    title: t('navbar.worldInfo'),
    component: WorldInfoDrawer,
    layout: 'wide',
  });

  uiStore.registerNavBarItem('user-settings', {
    icon: 'fa-user-cog',
    title: t('navbar.userSettings'),
    component: UserSettingsDrawer,
  });

  uiStore.registerNavBarItem('backgrounds', {
    icon: 'fa-panorama',
    title: t('navbar.backgrounds'),
    component: BackgroundsDrawer,
  });

  uiStore.registerNavBarItem('extensions', {
    icon: 'fa-cubes',
    title: t('navbar.extensions'),
    component: ExtensionsDrawer,
    layout: 'wide',
  });

  uiStore.registerNavBarItem('persona', {
    icon: 'fa-face-smile',
    title: t('navbar.personaManagement'),
    component: PersonaManagementDrawer,
    layout: 'wide',
  });

  uiStore.registerNavBarItem('character', {
    icon: 'fa-address-card',
    title: t('navbar.characterManagement'),
    component: CharacterPanel,
    layout: 'wide',
  });
});
</script>

<template>
  <div id="background" :style="backgroundStyle"></div>
  <NavBar />

  <Sidebar side="left" :is-open="uiStore.isLeftSidebarOpen" storage-key="leftSidebarWidth">
    <template v-for="[id, def] in uiStore.leftSidebarRegistry" :key="id">
      <div v-show="uiStore.leftSidebarView === id" style="height: 100%">
        <component :is="def.component" v-bind="def.componentProps" />
      </div>
    </template>
  </Sidebar>

  <!-- Main Layout -->
  <main
    id="main-content"
    :class="{
      'full-screen': isFullScreen,
      'left-open': uiStore.isLeftSidebarOpen,
      'right-open': uiStore.isRightSidebarOpen,
    }"
  >
    <ChatHeader />
    <div class="content-wrapper">
      <ChatInterface />
    </div>
    <template v-for="avatar in uiStore.zoomedAvatars" :key="avatar.id">
      <ZoomedAvatar :avatar="avatar" />
    </template>
  </main>

  <Sidebar side="right" :is-open="uiStore.isRightSidebarOpen" storage-key="rightSidebarWidth">
    <template v-for="[id, def] in uiStore.rightSidebarRegistry" :key="id">
      <div v-show="uiStore.rightSidebarView === id" style="height: 100%">
        <component :is="def.component" v-bind="def.componentProps" />
      </div>
    </template>
  </Sidebar>

  <template v-for="popup in popupStore.popups" :key="popup.id">
    <Popup
      v-bind="popup"
      @submit="(payload: any) => popupStore.confirm(popup.id, payload)"
      @close="popupStore.cancel(popup.id)"
    />
  </template>
</template>

<style lang="scss" scoped>
.content-wrapper {
  height: calc(100% - var(--header-height));
  position: relative;
}
</style>
