<script setup lang="ts">
import { computed } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useApiStore } from '../../stores/api.store';
import { usePopupStore } from '../../stores/popup.store';
import { useSettingsStore } from '../../stores/settings.store';
import type { AiConfigValueItem } from '../../types';
import { POPUP_TYPE } from '../../types';
import { Button, Select } from '../UI';

const props = defineProps<{
  item: AiConfigValueItem;
}>();

const apiStore = useApiStore();
const settingsStore = useSettingsStore();
const popupStore = usePopupStore();
const { t } = useStrictI18n();

const selectedPreset = computed({
  get: () => settingsStore.getSetting(props.item.id!) as string,
  set: (val) => settingsStore.setSetting(props.item.id!, val),
});

const presetOptions = computed(() => apiStore.presets.map((p) => ({ label: p.name, value: p.name })));

async function handleNewPreset() {
  const { result, value } = await popupStore.show<string>({
    title: t('aiConfig.presets.newName'),
    type: POPUP_TYPE.INPUT,
    inputValue: selectedPreset.value || 'New Preset',
  });

  if (result === 1 && value) {
    apiStore.saveCurrentPresetAs(value);
  }
}
</script>

<template>
  <div class="preset-manager">
    <div class="standout-header">
      <strong>{{ item.label ? t(item.label) : '' }}</strong>
      <div class="preset-manager-actions">
        <Button
          variant="ghost"
          icon="fa-file-import"
          :title="t('aiConfig.presets.import')"
          @click="apiStore.importPreset()"
        />
        <Button
          variant="ghost"
          icon="fa-file-export"
          :title="t('aiConfig.presets.export')"
          @click="apiStore.exportPreset(selectedPreset)"
        />
        <Button
          icon="fa-trash-can"
          variant="danger"
          :title="t('aiConfig.presets.delete')"
          @click="apiStore.deleteExperimentalPreset(selectedPreset)"
        />
      </div>
    </div>
    <div class="preset-manager-controls">
      <div style="flex-grow: 1">
        <Select v-model="selectedPreset" :options="presetOptions" />
      </div>
      <Button
        variant="ghost"
        icon="fa-save"
        :title="t('aiConfig.presets.update')"
        @click="apiStore.updateCurrentPreset(selectedPreset)"
      />
      <Button
        variant="ghost"
        icon="fa-pencil"
        :title="t('aiConfig.presets.rename')"
        @click="apiStore.renamePreset(selectedPreset)"
      />
      <Button
        variant="ghost"
        icon="fa-file-circle-plus"
        :title="t('aiConfig.presets.saveAs')"
        @click="handleNewPreset()"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.standout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 1.1em;
  color: var(--theme-text-color);
}

.preset-manager {
  margin-bottom: 20px;

  &-actions {
    display: flex;
    gap: 4px;
  }

  &-controls {
    display: flex;
    gap: 4px;
    align-items: center;
  }
}
</style>
