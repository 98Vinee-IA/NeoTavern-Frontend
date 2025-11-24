<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiConnectionDefinition } from '../../api-connection-definition';
import { PROVIDER_CAPABILITIES } from '../../api/provider-definitions';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { TokenizerType } from '../../constants';
import { useApiStore } from '../../stores/api.store';
import { usePopupStore } from '../../stores/popup.store';
import { useSettingsStore } from '../../stores/settings.store';
import { api_providers, type AiConfigCondition, type AiConfigItem, type ConnectionProfile } from '../../types';
import { POPUP_RESULT, POPUP_TYPE } from '../../types/popup';
import { ConnectionProfileSelector } from '../Common';
import { Button, Checkbox, FormItem, Input, Select } from '../UI';
import type { SelectItem } from '../UI/Select.vue';
import ConnectionProfilePopup from './ConnectionProfilePopup.vue';
import InstructTemplatePopup from './InstructTemplatePopup.vue';

const { t } = useStrictI18n();

const apiStore = useApiStore();
const settingsStore = useSettingsStore();
const popupStore = usePopupStore();

const isProfilePopupVisible = ref(false);
const isInstructPopupVisible = ref(false);
const editingTemplateId = ref<string | undefined>(undefined);

const staticOpenAIModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
const dynamicOpenAIModels = computed(() => {
  return apiStore.modelList.filter((model) => !staticOpenAIModels.includes(model.id));
});

const hasOpenRouterGroupedModels = computed(() => {
  return apiStore.groupedOpenRouterModels && Object.keys(apiStore.groupedOpenRouterModels).length > 0;
});

function handleProfileSave(profile: Omit<ConnectionProfile, 'id'>) {
  apiStore.createConnectionProfile(profile);
}

function checkConditions(conditions?: AiConfigCondition): boolean {
  if (!conditions) return true;

  if (conditions.provider) {
    const providers = Array.isArray(conditions.provider) ? conditions.provider : [conditions.provider];
    if (!settingsStore.settings.api.provider || !providers.includes(settingsStore.settings.api.provider)) return false;
  }
  return true;
}

const visibleSections = computed(() => {
  return apiConnectionDefinition.filter((section) => checkConditions(section.conditions));
});

function getVisibleItems(section: (typeof apiConnectionDefinition)[0]) {
  return section.items.filter((item) => checkConditions(item.conditions));
}

// Special computed for array-based settings (e.g. OpenRouter providers)
const openrouterProvidersString = computed({
  get: () => settingsStore.settings.api.providerSpecific.openrouter.providers.join(','),
  set: (value) => {
    const newProviders = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    settingsStore.settings.api.providerSpecific.openrouter.providers = newProviders;
  },
});

function getModelValue(item: AiConfigItem) {
  if (item.id === 'api.providerSpecific.openrouter.providers') {
    return openrouterProvidersString.value;
  }
  return item.id ? settingsStore.getSetting(item.id) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setModelValue(item: AiConfigItem, value: any) {
  if (item.id === 'api.providerSpecific.openrouter.providers') {
    openrouterProvidersString.value = String(value);
    return;
  }
  if (item.id) {
    settingsStore.setSetting(item.id, value);
  }
}

const tokenizerOptions = computed(() => [
  { label: t('apiConnections.tokenizers.auto'), value: TokenizerType.AUTO },
  { label: t('apiConnections.tokenizers.none'), value: TokenizerType.NONE },
  { label: t('apiConnections.tokenizers.gpt4o'), value: TokenizerType.GPT4O },
  { label: t('apiConnections.tokenizers.gpt35'), value: TokenizerType.GPT35 },
  { label: t('apiConnections.tokenizers.gpt2'), value: TokenizerType.GPT2 },
  { label: t('apiConnections.tokenizers.gemma'), value: TokenizerType.GEMMA },
  { label: t('apiConnections.tokenizers.deepseek'), value: TokenizerType.DEEPSEEK },
  { label: t('apiConnections.tokenizers.llama'), value: TokenizerType.LLAMA },
  { label: t('apiConnections.tokenizers.llama3'), value: TokenizerType.LLAMA3 },
  { label: t('apiConnections.tokenizers.mistral'), value: TokenizerType.MISTRAL },
  { label: t('apiConnections.tokenizers.nemo'), value: TokenizerType.NEMO },
  { label: t('apiConnections.tokenizers.claude'), value: TokenizerType.CLAUDE },
  { label: t('apiConnections.tokenizers.jamba'), value: TokenizerType.JAMBA },
  { label: t('apiConnections.tokenizers.commandr'), value: TokenizerType.COMMANDR },
  { label: t('apiConnections.tokenizers.commanda'), value: TokenizerType.COMMANDA },
  { label: t('apiConnections.tokenizers.qwen2'), value: TokenizerType.QWEN2 },
  { label: t('apiConnections.tokenizers.yi'), value: TokenizerType.YI },
]);

// Helper to convert definitions options to component compatible options
function resolveOptions(item: AiConfigItem) {
  return (
    item.options?.map((opt) => ({
      // @ts-expect-error dynamic label
      label: opt.label.startsWith('apiConnections') ? t(opt.label) : opt.label,
      value: opt.value,
    })) || []
  );
}

const providerOptions = computed(() => [
  {
    label: '',
    options: [
      { label: t('apiConnections.providers.openai'), value: api_providers.OPENAI },
      { label: t('apiConnections.providers.custom'), value: api_providers.CUSTOM },
    ],
  },
  {
    label: '',
    options: [
      { label: t('apiConnections.providers.ai21'), value: api_providers.AI21 },
      { label: t('apiConnections.providers.aimlapi'), value: api_providers.AIMLAPI },
      { label: t('apiConnections.providers.azure_openai'), value: api_providers.AZURE_OPENAI },
      { label: t('apiConnections.providers.claude'), value: api_providers.CLAUDE },
      { label: t('apiConnections.providers.cohere'), value: api_providers.COHERE },
      { label: t('apiConnections.providers.deepseek'), value: api_providers.DEEPSEEK },
      { label: t('apiConnections.providers.electronhub'), value: api_providers.ELECTRONHUB },
      { label: t('apiConnections.providers.fireworks'), value: api_providers.FIREWORKS },
      { label: t('apiConnections.providers.groq'), value: api_providers.GROQ },
      { label: t('apiConnections.providers.makersuite'), value: api_providers.MAKERSUITE },
      { label: t('apiConnections.providers.vertexai'), value: api_providers.VERTEXAI },
      { label: t('apiConnections.providers.mistralai'), value: api_providers.MISTRALAI },
      { label: t('apiConnections.providers.moonshot'), value: api_providers.MOONSHOT },
      { label: t('apiConnections.providers.nanogpt'), value: api_providers.NANOGPT },
      { label: t('apiConnections.providers.openrouter'), value: api_providers.OPENROUTER },
      { label: t('apiConnections.providers.perplexity'), value: api_providers.PERPLEXITY },
      { label: t('apiConnections.providers.pollinations'), value: api_providers.POLLINATIONS },
      { label: t('apiConnections.providers.xai'), value: api_providers.XAI },
      { label: t('apiConnections.providers.zai'), value: api_providers.ZAI },
    ],
  },
]);

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

// Instruct Logic
const currentProviderCaps = computed(() => PROVIDER_CAPABILITIES[settingsStore.settings.api.provider]);
const showFormatter = computed(() => {
  const caps = currentProviderCaps.value;
  return caps && caps.supportsText;
});

const formatterOptions = computed(() => [
  { label: t('common.chat'), value: 'chat' },
  { label: t('common.text'), value: 'text' },
]);

const instructTemplateOptions = computed(() => {
  return apiStore.instructTemplates.map((t) => ({ label: t.name, value: t.name }));
});

function createTemplate() {
  editingTemplateId.value = undefined;
  isInstructPopupVisible.value = true;
}

function editTemplate() {
  editingTemplateId.value = settingsStore.settings.api.instructTemplateName;
  isInstructPopupVisible.value = true;
}

async function deleteTemplate() {
  const name = settingsStore.settings.api.instructTemplateName;
  if (!name) return;

  const { result } = await popupStore.show({
    title: t('apiConnections.instruct.deleteTitle'),
    content: t('apiConnections.instruct.deleteContent', { name }),
    type: POPUP_TYPE.CONFIRM,
  });

  if (result === POPUP_RESULT.AFFIRMATIVE) {
    await apiStore.deleteInstructTemplate(name);
  }
}

onMounted(() => {
  apiStore.initialize();
});
</script>

<template>
  <div class="api-connections-drawer">
    <div class="api-connections-drawer-wrapper">
      <div class="api-connections-drawer-section">
        <h3>{{ t('apiConnections.profile') }}</h3>
        <div class="preset-manager-controls">
          <ConnectionProfileSelector v-model="apiStore.selectedConnectionProfileName" />
          <Button
            variant="ghost"
            icon="fa-file-circle-plus"
            :title="t('apiConnections.profileManagement.create')"
            @click="isProfilePopupVisible = true"
          />
          <Button
            variant="ghost"
            icon="fa-pencil"
            :title="t('apiConnections.profileManagement.rename')"
            @click="apiStore.renameConnectionProfile"
          />
          <Button
            variant="ghost"
            icon="fa-trash-can"
            :title="t('apiConnections.profileManagement.delete')"
            @click="apiStore.deleteConnectionProfile"
          />
          <Button
            variant="ghost"
            icon="fa-file-import"
            :title="t('apiConnections.profileManagement.import')"
            @click="apiStore.importConnectionProfiles"
          />
          <Button
            variant="ghost"
            icon="fa-file-export"
            :title="t('apiConnections.profileManagement.export')"
            @click="apiStore.exportConnectionProfile"
          />
        </div>
      </div>

      <hr />

      <div class="api-connections-drawer-section">
        <FormItem :label="t('apiConnections.provider')">
          <Select v-model="settingsStore.settings.api.provider" :options="providerOptions" searchable />
        </FormItem>
      </div>

      <!-- Data-Driven Provider Forms -->
      <template v-for="section in visibleSections" :key="section.id">
        <div class="api-connections-drawer-section">
          <template v-for="item in getVisibleItems(section)" :key="item.id || item.label">
            <!-- Key Manager -->
            <FormItem v-if="item.widget === 'key-manager'" :label="item.label ? t(item.label) : ''">
              <div class="api-connections-drawer-input-group">
                <Button icon="fa-key" :title="t('apiConnections.manageKeys')" />
              </div>
              <!-- Warning only for direct keys -->
              <div v-if="['openai', 'claude', 'openrouter'].includes(section.id)" class="neutral_warning">
                {{ t('apiConnections.keyPrivacy') }}
              </div>
            </FormItem>

            <!-- Model Select -->
            <FormItem v-else-if="item.widget === 'model-select'" :label="item.label ? t(item.label) : ''">
              <!-- OpenAI Specific Grouped Select -->
              <Select
                v-if="settingsStore.settings.api.provider === api_providers.OPENAI"
                :model-value="getModelValue(item) as string"
                :options="openAIModelOptions"
                searchable
                @update:model-value="setModelValue(item, $event)"
              />

              <!-- OpenRouter Specific Grouped Select -->
              <template v-else-if="settingsStore.settings.api.provider === api_providers.OPENROUTER">
                <Select
                  v-show="hasOpenRouterGroupedModels"
                  :model-value="getModelValue(item) as string"
                  :options="openRouterModelOptions"
                  searchable
                  @update:model-value="setModelValue(item, $event)"
                />
                <Input
                  v-show="!hasOpenRouterGroupedModels"
                  :model-value="getModelValue(item) as string"
                  :placeholder="item.placeholder"
                  @update:model-value="setModelValue(item, String($event))"
                />
              </template>
            </FormItem>

            <!-- Standard Select -->
            <FormItem v-else-if="item.widget === 'select'" :label="item.label ? t(item.label) : ''">
              <Select
                :model-value="getModelValue(item) as string"
                :options="resolveOptions(item)"
                @update:model-value="setModelValue(item, $event)"
              />
            </FormItem>

            <!-- Text Input -->
            <FormItem v-else-if="item.widget === 'text-input'" :label="item.label ? t(item.label) : ''">
              <Input
                :model-value="getModelValue(item) as string"
                :placeholder="item.placeholder"
                @update:model-value="setModelValue(item, String($event))"
              />
            </FormItem>

            <!-- Checkbox -->
            <div v-else-if="item.widget === 'checkbox'">
              <Checkbox
                :model-value="Boolean(getModelValue(item))"
                :label="item.label ? t(item.label) : ''"
                @update:model-value="setModelValue(item, $event)"
              />
            </div>

            <!-- Header -->
            <h4 v-else-if="item.widget === 'header'">{{ item.label ? t(item.label) : '' }}</h4>
          </template>
        </div>
      </template>

      <!-- Formatter Selection (Conditional) -->
      <div v-if="showFormatter" class="api-connections-drawer-section">
        <FormItem :label="t('apiConnections.formatter')">
          <Select v-model="settingsStore.settings.api.formatter" :options="formatterOptions" />
        </FormItem>
      </div>

      <!-- Instruct Template Manager -->
      <div v-if="settingsStore.settings.api.formatter === 'text'" class="api-connections-drawer-section">
        <h3>{{ t('apiConnections.instruct.title') }}</h3>
        <div class="preset-manager-controls">
          <!-- @vue-ignore -->
          <Select v-model="settingsStore.settings.api.instructTemplateName" :options="instructTemplateOptions" />
          <Button
            variant="ghost"
            icon="fa-file-circle-plus"
            :title="t('apiConnections.instruct.create')"
            @click="createTemplate"
          />
          <Button variant="ghost" icon="fa-pencil" :title="t('apiConnections.instruct.edit')" @click="editTemplate" />
          <Button
            variant="ghost"
            icon="fa-trash-can"
            :title="t('apiConnections.instruct.delete')"
            @click="deleteTemplate"
          />
          <Button
            variant="ghost"
            icon="fa-file-import"
            :title="t('apiConnections.instruct.import')"
            @click="apiStore.importInstructTemplate"
          />
          <Button
            variant="ghost"
            icon="fa-file-export"
            :title="t('apiConnections.instruct.export')"
            @click="apiStore.exportInstructTemplate(settingsStore.settings.api.instructTemplateName || '')"
          />
        </div>
      </div>

      <!-- Tokenizer Selection -->
      <FormItem :label="t('apiConnections.tokenizer')">
        <Select v-model="settingsStore.settings.api.tokenizer" :options="tokenizerOptions" />
      </FormItem>

      <div class="api-connections-drawer-section">
        <div class="api-connections-drawer-actions">
          <Button :loading="apiStore.isConnecting" :disabled="apiStore.isConnecting" @click.prevent="apiStore.connect">
            {{ apiStore.isConnecting ? t('apiConnections.connecting') : t('apiConnections.connect') }}
          </Button>
        </div>
        <div class="online_status">
          <div
            class="online_status_indicator"
            :class="{ success: apiStore.onlineStatus === 'Valid' || apiStore.onlineStatus.includes('bypassed') }"
          ></div>
          <div class="online_status_text">{{ apiStore.onlineStatus }}</div>
        </div>
      </div>
    </div>
    <ConnectionProfilePopup
      :visible="isProfilePopupVisible"
      @close="isProfilePopupVisible = false"
      @save="handleProfileSave"
    />
    <InstructTemplatePopup
      :visible="isInstructPopupVisible"
      :template-id="editingTemplateId"
      @close="isInstructPopupVisible = false"
    />
  </div>
</template>
