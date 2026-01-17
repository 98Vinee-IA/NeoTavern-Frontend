<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { toast } from '../../composables/useToast';
import { PROVIDER_SECRET_KEYS } from '../../constants';
import { useApiStore } from '../../stores/api.store';
import { useSecretStore } from '../../stores/secret.store';
import { useSettingsStore } from '../../stores/settings.store';
import type { ConnectionProfile } from '../../types';
import { Button, Checkbox, Input } from '../UI';

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: {
    type: String as () => 'create' | 'view',
    default: 'create',
  },
  profile: {
    type: Object as () => ConnectionProfile | null,
    default: null,
  },
});
const emit = defineEmits(['close', 'save']);

const { t } = useStrictI18n();
const apiStore = useApiStore();
const settingsStore = useSettingsStore();
const secretStore = useSecretStore();

const dialog = ref<HTMLDialogElement | null>(null);

const isViewMode = computed(() => props.mode === 'view' && props.profile);
const popupTitle = computed(() =>
  isViewMode.value
    ? t('apiConnections.profileManagement.viewPopupTitle')
    : t('apiConnections.profileManagement.createPopupTitle'),
);

// --- Create Mode State ---
const defaultProfileName = () => {
  const provider = settingsStore.settings.api.provider;
  const model = apiStore.activeModel;
  return `${provider} - ${model}`;
};
const profileName = ref(defaultProfileName());

const includeProvider = ref(true);
const includeModel = ref(true);
const includeSampler = ref(true);
const includePostProcessing = ref(true);
const includeInstructTemplate = ref(true);
const includeReasoningTemplate = ref(true);
const includeApiUrl = ref(false);
const includeSecretId = ref(false);

// --- Current Settings (for 'create' mode) ---
const currentProvider = computed(() => settingsStore.settings.api.provider);
const currentModel = computed(() => apiStore.activeModel);
const currentSampler = computed(() => settingsStore.settings.api.selectedSampler);
const currentPostProcessing = computed(() => settingsStore.settings.api.customPromptPostProcessing);
const currentInstructTemplate = computed(() => settingsStore.settings.api.instructTemplateName);
const currentReasoningTemplate = computed(() => settingsStore.settings.api.reasoningTemplateName);
const currentApiUrl = computed(() => {
  const provider = currentProvider.value;
  if (provider === 'custom') {
    return settingsStore.settings.api.providerSpecific.custom.url;
  } else if (provider === 'koboldcpp') {
    return settingsStore.settings.api.providerSpecific.koboldcpp.url;
  } else if (provider === 'ollama') {
    return settingsStore.settings.api.providerSpecific.ollama.url;
  }
  return '';
});

const currentSecretKey = computed(() => {
  return PROVIDER_SECRET_KEYS[currentProvider.value] || null;
});

const currentSecret = computed(() => {
  if (!currentSecretKey.value) return null;
  const secrets = secretStore.secrets[currentSecretKey.value];
  if (!secrets) return null;
  return secrets.find((s) => s.active) || null;
});

const currentSecretId = computed(() => currentSecret.value?.id || '');
const currentSecretLabel = computed(() => currentSecret.value?.label || '');

// --- Display values (handles both modes) ---
const providerForDisplay = computed(() => (isViewMode.value ? props.profile?.provider : currentProvider.value));
const modelForDisplay = computed(() => (isViewMode.value ? props.profile?.model : currentModel.value));
const samplerForDisplay = computed(() => (isViewMode.value ? props.profile?.sampler : currentSampler.value));
const postProcessingForDisplay = computed(() =>
  isViewMode.value ? props.profile?.customPromptPostProcessing : currentPostProcessing.value,
);
const apiUrlForDisplay = computed(() => (isViewMode.value ? props.profile?.apiUrl : currentApiUrl.value));
const instructTemplateForDisplay = computed(() =>
  isViewMode.value ? props.profile?.instructTemplate : currentInstructTemplate.value,
);
const reasoningTemplateForDisplay = computed(() =>
  isViewMode.value ? props.profile?.reasoningTemplate : currentReasoningTemplate.value,
);
const secretLabelForDisplay = computed(() => {
  if (isViewMode.value) {
    if (!props.profile?.secretId) return '';
    return (
      secretStore.secrets[currentSecretKey.value || '']?.find((s) => s.id === props.profile?.secretId)?.label || ''
    );
  }
  return currentSecretLabel.value;
});

const modelLabel = computed(() => {
  const provider = providerForDisplay.value;
  switch (provider) {
    case 'openai':
      return t('apiConnections.openaiModel');
    case 'claude':
      return t('apiConnections.claudeModel');
    case 'openrouter':
      return t('apiConnections.openrouterModel');
    case 'mistralai':
      return t('apiConnections.mistralaiModel');
    case 'groq':
      return t('apiConnections.groqModel');
    case 'azure_openai':
      return t('apiConnections.azureModel');
    case 'custom':
    // Fallback for all other providers without a specific label to a generic "Model Name"
    case 'ai21':
    case 'makersuite':
    case 'vertexai':
    case 'cohere':
    case 'perplexity':
    case 'electronhub':
    case 'nanogpt':
    case 'deepseek':
    case 'aimlapi':
    case 'xai':
    case 'pollinations':
    case 'moonshot':
    case 'fireworks':
    case 'cometapi':
    case 'zai':
    default:
      return t('apiConnections.customModel');
  }
});

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      if (props.mode === 'create') {
        profileName.value = defaultProfileName();
        includeProvider.value = true;
        includeModel.value = true;
        includeSampler.value = true;
        includePostProcessing.value = true;
        includeInstructTemplate.value = true;
        includeReasoningTemplate.value = true;
        includeApiUrl.value = false;
        includeSecretId.value = false;
      }
      dialog.value?.showModal();
    } else {
      dialog.value?.close();
    }
  },
);

function close() {
  emit('close');
}

function save() {
  const trimmedName = profileName.value.trim();
  if (!trimmedName) {
    toast.error('Profile name cannot be empty.');
    return;
  }

  const profile: Partial<Omit<ConnectionProfile, 'id'>> & { name: string } = {
    name: trimmedName,
  };

  if (includeProvider.value) profile.provider = currentProvider.value;
  if (includeModel.value) profile.model = currentModel.value;
  if (includeSampler.value) profile.sampler = currentSampler.value;
  if (includePostProcessing.value) profile.customPromptPostProcessing = currentPostProcessing.value;
  if (includeInstructTemplate.value) profile.instructTemplate = currentInstructTemplate.value;
  if (includeReasoningTemplate.value) profile.reasoningTemplate = currentReasoningTemplate.value;
  if (includeApiUrl.value) profile.apiUrl = currentApiUrl.value;
  if (includeSecretId.value && currentSecretId.value) profile.secretId = currentSecretId.value;

  emit('save', profile);
  close();
}
</script>

<template>
  <dialog id="connection-profile-popup" ref="dialog" class="popup" @cancel="close">
    <div class="popup-body">
      <h3>{{ popupTitle }}</h3>

      <div class="connection-profile-form">
        <div class="form-group">
          <Input
            v-if="!isViewMode"
            v-model="profileName"
            :label="t('apiConnections.profileManagement.profileName')"
            class="text-pole"
          />
        </div>

        <h4>
          {{
            isViewMode
              ? t('apiConnections.profileManagement.fieldsIncluded')
              : t('apiConnections.profileManagement.fieldsToInclude')
          }}
        </h4>

        <!-- CREATE MODE -->
        <div v-if="!isViewMode" class="fields-grid">
          <Checkbox v-model="includeProvider" :label="t('apiConnections.provider')" />
          <div class="field-value">{{ providerForDisplay }}</div>

          <Checkbox v-model="includeModel" :label="modelLabel" />
          <div class="field-value">{{ modelForDisplay }}</div>

          <Checkbox v-model="includeSampler" :label="t('aiConfig.presets.sampler.label')" />
          <div class="field-value">{{ samplerForDisplay }}</div>

          <Checkbox v-model="includePostProcessing" :label="t('apiConnections.postProcessing.label')" />
          <div class="field-value">
            {{ postProcessingForDisplay || t('apiConnections.postProcessing.prompts.none') }}
          </div>

          <template v-if="apiUrlForDisplay">
            <Checkbox v-model="includeApiUrl" :label="t('apiConnections.apiUrl')" />
            <div class="field-value">{{ apiUrlForDisplay }}</div>
          </template>

          <template v-if="currentSecret">
            <Checkbox v-model="includeSecretId" :label="t('apiConnections.secretId')" />
            <div class="field-value">{{ secretLabelForDisplay }}</div>
          </template>

          <Checkbox v-model="includeInstructTemplate" :label="t('apiConnections.instructTemplate.label')" />
          <div class="field-value">{{ instructTemplateForDisplay || t('apiConnections.instructTemplate.none') }}</div>

          <Checkbox v-model="includeReasoningTemplate" :label="t('apiConnections.reasoningTemplate.label')" />
          <div class="field-value">{{ reasoningTemplateForDisplay || t('apiConnections.reasoningTemplate.none') }}</div>
        </div>

        <!-- VIEW MODE -->
        <div v-else class="fields-grid view-only">
          <div class="field-label">{{ t('apiConnections.profileManagement.profileName') }}:</div>
          <div class="field-value">{{ profile!.name }}</div>

          <template v-if="providerForDisplay">
            <div class="field-label">{{ t('apiConnections.provider') }}:</div>
            <div class="field-value">{{ providerForDisplay }}</div>
          </template>

          <template v-if="modelForDisplay">
            <div class="field-label">{{ modelLabel }}:</div>
            <div class="field-value">{{ modelForDisplay }}</div>
          </template>

          <template v-if="samplerForDisplay">
            <div class="field-label">{{ t('aiConfig.presets.sampler.label') }}:</div>
            <div class="field-value">{{ samplerForDisplay }}</div>
          </template>

          <template v-if="postProcessingForDisplay">
            <div class="field-label">{{ t('apiConnections.postProcessing.label') }}:</div>
            <div class="field-value">{{ postProcessingForDisplay }}</div>
          </template>

          <template v-if="apiUrlForDisplay">
            <div class="field-label">{{ t('apiConnections.apiUrl') }}:</div>
            <div class="field-value">{{ apiUrlForDisplay }}</div>
          </template>

          <template v-if="secretLabelForDisplay">
            <div class="field-label">{{ t('apiConnections.secretId') }}:</div>
            <div class="field-value">{{ secretLabelForDisplay }}</div>
          </template>

          <template v-if="instructTemplateForDisplay">
            <div class="field-label">{{ t('apiConnections.instructTemplate.label') }}:</div>
            <div class="field-value">{{ instructTemplateForDisplay }}</div>
          </template>

          <template v-if="reasoningTemplateForDisplay">
            <div class="field-label">{{ t('apiConnections.reasoningTemplate.label') }}:</div>
            <div class="field-value">{{ reasoningTemplateForDisplay }}</div>
          </template>
        </div>
      </div>

      <div class="popup-controls">
        <template v-if="!isViewMode">
          <Button variant="confirm" @click="save">{{ t('common.save') }}</Button>
          <Button @click="close">{{ t('common.cancel') }}</Button>
        </template>
        <template v-else>
          <Button @click="close">{{ t('common.close') }}</Button>
        </template>
      </div>
    </div>
  </dialog>
</template>
