<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { FormItem, Input, Toggle } from '../../../components/UI';
import type { ExtensionAPI } from '../../../types';
import { defaultSettings, type VisualLorebookSettings } from './types';

const props = defineProps<{
  api: ExtensionAPI<VisualLorebookSettings>;
}>();

const t = props.api.i18n.t;

const settings = ref<VisualLorebookSettings>({ ...defaultSettings });

onMounted(() => {
  const saved = props.api.settings.get();
  if (saved) {
    settings.value = { ...defaultSettings, ...saved };
  }
});

watch(
  settings,
  (newSettings) => {
    props.api.settings.set(undefined, newSettings);
    props.api.settings.save();
  },
  { deep: true },
);
</script>

<template>
  <div class="visual-lorebook-settings">
    <div class="group-header">{{ t('extensionsBuiltin.visualLorebook.settings.enable') }}</div>
    <FormItem :label="t('extensionsBuiltin.visualLorebook.settings.enable')">
      <Toggle v-model="settings.enabled" />
    </FormItem>

    <div class="group-header">{{ t('extensionsBuiltin.visualLorebook.settings.keywordMatching.enable') }}</div>
    <FormItem
      :label="t('extensionsBuiltin.visualLorebook.settings.keywordMatching.enable')"
      :description="t('extensionsBuiltin.visualLorebook.settings.keywordMatching.description')"
    >
      <Toggle v-model="settings.enableKeywordMatching" />
    </FormItem>

    <FormItem
      :label="t('extensionsBuiltin.visualLorebook.settings.keywordMatching.lookbackCount')"
      :description="t('extensionsBuiltin.visualLorebook.settings.keywordMatching.lookbackDescription')"
    >
      <Input v-model.number="settings.keywordLookbackCount" type="number" :min="1" :max="20" />
    </FormItem>

    <div class="group-header">{{ t('extensionsBuiltin.visualLorebook.settings.entryNameMatching.enable') }}</div>
    <FormItem
      :label="t('extensionsBuiltin.visualLorebook.settings.entryNameMatching.enable')"
      :description="t('extensionsBuiltin.visualLorebook.settings.entryNameMatching.description')"
    >
      <Toggle v-model="settings.enableEntryNameMatching" />
    </FormItem>

    <div class="group-header">{{ t('extensionsBuiltin.visualLorebook.settings.autoClear') }}</div>
    <FormItem
      :label="t('extensionsBuiltin.visualLorebook.settings.autoClear.label')"
      :description="t('extensionsBuiltin.visualLorebook.settings.autoClear.description')"
    >
      <Input v-model.number="settings.autoClearMatchedEntriesAfterMessages" type="number" :min="1" :max="100" />
    </FormItem>
  </div>
</template>

<style scoped>
.visual-lorebook-settings {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
}
.group-header {
  font-weight: bold;
  font-size: 1.1em;
  color: var(--theme-text-color-primary);
  border-bottom: 1px solid var(--theme-border-color);
  padding-bottom: var(--spacing-xs);
  margin-top: var(--spacing-md);
}
</style>
