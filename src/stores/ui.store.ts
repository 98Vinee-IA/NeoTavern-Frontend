import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MenuType, ZoomedAvatar } from '../types';
import { useSettingsStore } from './settings.store';

export const useUiStore = defineStore('ui', () => {
  const isChatSaving = ref<boolean>(false);
  const isDeleteMode = ref<boolean>(false);
  const isSendPress = ref<boolean>(false);
  const selectedButton = ref<MenuType | null>(null);
  const menuType = ref<MenuType | null>(null);
  const cropData = ref<any>(null);
  const activePlayerName = ref<string | null>(null);
  const activePlayerAvatar = ref<string | null>(null);
  const zoomedAvatars = ref<ZoomedAvatar[]>([]);

  function toggleZoomedAvatar(avatarData: Omit<ZoomedAvatar, 'id'>) {
    const settingsStore = useSettingsStore();
    const id = avatarData.charName; // Use charName as ID to toggle

    const existingIndex = zoomedAvatars.value.findIndex((avatar) => avatar.id === id);

    if (existingIndex > -1) {
      // It exists, so remove it
      zoomedAvatars.value.splice(existingIndex, 1);
    } else {
      // It doesn't exist, so add it
      if (!settingsStore.powerUser.movingUI) {
        // If movingUI is off, only allow one at a time
        zoomedAvatars.value = [];
      }
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
    selectedButton,
    menuType,
    cropData,
    activePlayerName,
    activePlayerAvatar,
    zoomedAvatars,
    toggleZoomedAvatar,
    removeZoomedAvatar,
  };
});
