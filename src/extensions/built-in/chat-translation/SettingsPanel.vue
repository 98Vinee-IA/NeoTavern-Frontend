<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import type { ExtensionAPI } from '@/types';
import { AutoTranslateMode, type ChatTranslationSettings, DEFAULT_PROMPT } from './types';
import ConnectionProfileSelector from '@/components/Common/ConnectionProfileSelector.vue';
import { AppInput, AppSelect, AppTextarea, AppButton } from '@/components/UI';
import AppFormItem from '@/components/UI/AppFormItem.vue';
import { useStrictI18n } from '@/composables/useStrictI18n';

const props = defineProps<{
  api: ExtensionAPI;
}>();

const { t } = useStrictI18n();

const settings = ref<ChatTranslationSettings>({
  connectionProfile: undefined,
  sourceLang: 'Auto',
  targetLang: 'English',
  autoMode: AutoTranslateMode.NONE,
  prompt: DEFAULT_PROMPT,
});

const autoModeOptions = computed(() => [
  { label: t('extensionsBuiltin.chatTranslation.autoMode.none'), value: AutoTranslateMode.NONE },
  { label: t('extensionsBuiltin.chatTranslation.autoMode.responses'), value: AutoTranslateMode.RESPONSES },
  { label: t('extensionsBuiltin.chatTranslation.autoMode.inputs'), value: AutoTranslateMode.INPUTS },
  { label: t('extensionsBuiltin.chatTranslation.autoMode.both'), value: AutoTranslateMode.BOTH },
]);

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

function resetPrompt() {
  settings.value.prompt = DEFAULT_PROMPT;
}
</script>

<template>
  <div class="translation-settings">
    <AppFormItem
      :label="t('extensionsBuiltin.chatTranslation.connectionProfile')"
      :description="t('extensionsBuiltin.chatTranslation.connectionProfileHint')"
    >
      <ConnectionProfileSelector v-model="settings.connectionProfile" />
    </AppFormItem>

    <div class="setting-row">
      <div style="flex: 1">
        <AppFormItem :label="t('extensionsBuiltin.chatTranslation.sourceLang')">
          <AppInput v-model="settings.sourceLang" />
        </AppFormItem>
      </div>
      <div style="flex: 1">
        <AppFormItem :label="t('extensionsBuiltin.chatTranslation.targetLang')">
          <AppInput v-model="settings.targetLang" />
        </AppFormItem>
      </div>
    </div>

    <AppFormItem :label="t('extensionsBuiltin.chatTranslation.autoMode.label')">
      <AppSelect v-model="settings.autoMode" :options="autoModeOptions" />
    </AppFormItem>

    <AppFormItem :description="t('extensionsBuiltin.chatTranslation.promptHint')">
      <template #default>
        <div class="header-row">
          <div class="app-form-item-label">{{ t('extensionsBuiltin.chatTranslation.promptTemplate') }}</div>
          <AppButton icon="fa-rotate-left" @click="resetPrompt">
            {{ t('common.reset') }}
          </AppButton>
        </div>
        <AppTextarea v-model="settings.prompt" class="prompt-area" :rows="10" />
      </template>
    </AppFormItem>
  </div>
</template>

<style scoped>
.translation-settings {
  display: flex;
  flex-direction: column;
  padding: 10px;
}

.setting-row {
  display: flex;
  gap: 10px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.prompt-area {
  font-family: var(--font-family-mono);
  font-size: 0.9em;
}
</style>
