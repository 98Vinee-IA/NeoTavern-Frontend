import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { SendOnEnterOptions, DEFAULT_SAVE_EDIT_TIMEOUT } from '../constants';
import { isMobile } from '../utils/browser';
import { debounce } from '../utils/common';

export const useSettingsStore = defineStore('settings', () => {
  const powerUser = ref<{
    external_media_forbidden_overrides: Array<string>;
    external_media_allowed_overrides: Array<string>;
    forbid_external_media: boolean;
    world_import_dialog: boolean;
    send_on_enter: number;
    never_resize_avatars: boolean;
    spoiler_free_mode: boolean;
    auto_fix_generated_markdown: boolean;
  }>({
    world_import_dialog: true,
    send_on_enter: SendOnEnterOptions.AUTO,
    never_resize_avatars: false,
    external_media_forbidden_overrides: [],
    external_media_allowed_overrides: [],
    forbid_external_media: false,
    spoiler_free_mode: false,
    auto_fix_generated_markdown: false,
  });

  const shouldSendOnEnter = computed(() => {
    switch (powerUser.value.send_on_enter) {
      case SendOnEnterOptions.DISABLED:
        return false;
      case SendOnEnterOptions.AUTO:
        return !isMobile();
      case SendOnEnterOptions.ENABLED:
        return true;
      default:
        return false;
    }
  });

  async function saveSettings() {
    // TODO: Implement API call to save settings to the backend.
    console.log('Debounced saveSettings called. State:', powerUser.value);
  }

  const saveSettingsDebounced = debounce(() => {
    saveSettings();
  }, DEFAULT_SAVE_EDIT_TIMEOUT);

  // Watch for changes in settings and trigger debounced save
  watch(
    powerUser,
    () => {
      saveSettingsDebounced();
    },
    { deep: true },
  );

  return { powerUser, shouldSendOnEnter, saveSettings, saveSettingsDebounced };
});
