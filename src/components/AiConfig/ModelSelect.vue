<script setup lang="ts">
import { computed } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useApiStore } from '../../stores/api.store';
import { useSettingsStore } from '../../stores/settings.store';
import type { AiConfigValueItem } from '../../types';
import { api_providers } from '../../types';
import { Input, Select } from '../UI';
import type { SelectItem } from '../UI/Select.vue';

const props = defineProps<{
  item: AiConfigValueItem;
}>();

const settingsStore = useSettingsStore();
const apiStore = useApiStore();
const { t } = useStrictI18n();

const modelValue = computed({
  get: () => settingsStore.getSetting(props.item.id!) as string,
  set: (val) => settingsStore.setSetting(props.item.id!, String(val)),
});

// OpenAI Options
const staticOpenAIModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
const dynamicOpenAIModels = computed(() => {
  return apiStore.modelList.filter((model) => !staticOpenAIModels.includes(model.id));
});

const openAIModelOptions = computed(() => [
  {
    label: t('apiConnections.modelGroups.gpt4o'),
    options: [
      { label: 'gpt-4o', value: 'gpt-4o' },
      { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
    ],
  },
  {
    label: t('apiConnections.modelGroups.gpt4turbo'),
    options: [{ label: 'gpt-4-turbo', value: 'gpt-4-turbo' }],
  },
  ...(dynamicOpenAIModels.value.length > 0
    ? [
        {
          label: t('apiConnections.modelGroups.other'),
          options: dynamicOpenAIModels.value.map((m) => ({ label: m.id, value: m.id })),
        },
      ]
    : []),
]);

// OpenRouter Options
const hasOpenRouterGroupedModels = computed(() => {
  return apiStore.groupedOpenRouterModels && Object.keys(apiStore.groupedOpenRouterModels).length > 0;
});

const openRouterModelOptions = computed(() => {
  const opts: SelectItem<string>[] = [{ label: t('apiConnections.openrouterWebsite'), value: 'OR_Website' }];

  if (hasOpenRouterGroupedModels.value && apiStore.groupedOpenRouterModels) {
    for (const [vendor, models] of Object.entries(apiStore.groupedOpenRouterModels)) {
      opts.push({
        label: vendor,
        options: models.map((m) => ({ label: m.name || m.id, value: m.id })),
      });
    }
  }

  return opts;
});

const provider = computed(() => settingsStore.settings.api.provider);
</script>

<template>
  <template v-if="provider === api_providers.OPENAI">
    <Select v-model="modelValue" :options="openAIModelOptions" searchable />
  </template>

  <template v-else-if="provider === api_providers.OPENROUTER">
    <Select v-show="hasOpenRouterGroupedModels" v-model="modelValue" :options="openRouterModelOptions" searchable />
    <Input v-show="!hasOpenRouterGroupedModels" v-model="modelValue" :placeholder="item.placeholder" />
  </template>

  <template v-else>
    <Input v-model="modelValue" :placeholder="item.placeholder" />
  </template>
</template>
