<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ConnectionProfileSelector } from '../../../components/common';
import { CollapsibleSection, FormItem, Textarea, Toggle } from '../../../components/UI';
import type { ExtensionAPI } from '../../../types';
import type { TextareaToolDefinition } from '../../../types/ExtensionAPI';
import { DEFAULT_IMPERSONATE_PROMPT, type ExtensionSettings } from './types';

const props = defineProps<{
  api: ExtensionAPI<ExtensionSettings>;
}>();

const settings = ref<ExtensionSettings>({
  rerollContinueEnabled: true,
  impersonateEnabled: true,
  impersonateConnectionProfile: undefined,
  impersonatePrompt: DEFAULT_IMPERSONATE_PROMPT,
});

const t = props.api.i18n.t;

onMounted(() => {
  const saved = props.api.settings.get();
  if (saved) {
    settings.value = { ...settings.value, ...saved };
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

const promptTools = computed<TextareaToolDefinition[]>(() => [
  {
    id: 'reset',
    icon: 'fa-rotate-left',
    title: t('extensionsBuiltin.rerollContinue.settings.reset'),
    onClick: ({ setValue }) => {
      setValue(DEFAULT_IMPERSONATE_PROMPT);
    },
  },
]);
</script>

<template>
  <div class="impersonate-settings">
    <FormItem :label="t('extensionsBuiltin.rerollContinue.settings.rerollEnabled')">
      <Toggle v-model="settings.rerollContinueEnabled" />
    </FormItem>

    <FormItem :label="t('extensionsBuiltin.rerollContinue.settings.impersonateEnabled')">
      <Toggle v-model="settings.impersonateEnabled" />
    </FormItem>

    <CollapsibleSection :title="t('extensionsBuiltin.rerollContinue.settings.impersonateTitle')" :is-open="false">
      <FormItem
        :label="t('extensionsBuiltin.rerollContinue.settings.connectionProfileLabel')"
        :description="t('extensionsBuiltin.rerollContinue.settings.connectionProfileDesc')"
      >
        <ConnectionProfileSelector v-model="settings.impersonateConnectionProfile" />
      </FormItem>

      <FormItem
        :label="t('extensionsBuiltin.rerollContinue.settings.promptLabel')"
        :description="t('extensionsBuiltin.rerollContinue.settings.promptDesc')"
      >
        <Textarea
          v-model="settings.impersonatePrompt"
          allow-maximize
          class="prompt-area"
          :rows="8"
          identifier="extension.reroll-continue.prompt"
          :tools="promptTools"
        />
      </FormItem>
    </CollapsibleSection>
  </div>
</template>

<style scoped>
.impersonate-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.prompt-area {
  font-family: var(--font-family-mono);
  font-size: 0.9em;
}
</style>
