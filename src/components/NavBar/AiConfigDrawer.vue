<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { aiConfigDefinition } from '../../ai-config-definition';
import { Button, Tabs } from '../../components/UI';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useApiStore } from '../../stores/api.store';
import { useSettingsStore } from '../../stores/settings.store';
import type { AiConfigCondition } from '../../types';
import AiConfigItemRenderer from '../AiConfig/AiConfigItemRenderer.vue';
import PromptManager from '../AiConfig/PromptManager.vue';

const { t } = useStrictI18n();
const apiStore = useApiStore();
const settingsStore = useSettingsStore();

const activeTab = ref<'sampler' | 'prompts'>('sampler');
const isPanelPinned = ref(false);

function checkConditions(conditions?: AiConfigCondition): boolean {
  if (!conditions) return true;
  if (conditions.provider) {
    const providers = Array.isArray(conditions.provider) ? conditions.provider : [conditions.provider];
    const current = settingsStore.settings.api.provider;
    if (!current || !providers.includes(current)) return false;
  }
  return true;
}

const visibleSections = computed(() => {
  return aiConfigDefinition.filter((section) => checkConditions(section.conditions));
});

onMounted(() => {
  apiStore.loadPresetsForApi();
  apiStore.loadInstructTemplates();
});
</script>

<template>
  <div class="ai-config-drawer">
    <div class="ai-config-drawer-header">
      <Tabs
        v-model="activeTab"
        style="margin-bottom: 0; border-bottom: none"
        :options="[
          { label: t('aiConfig.tabSampler'), value: 'sampler' },
          { label: t('aiConfig.tabPrompts'), value: 'prompts' },
        ]"
      />

      <div class="header-actions">
        <Button
          variant="ghost"
          :icon="isPanelPinned ? 'fa-lock' : 'fa-unlock'"
          :title="t('characterPanel.pinToggle')"
          @click="isPanelPinned = !isPanelPinned"
        />
        <a
          class="ai-config-drawer-docs-link fa-solid fa-circle-question"
          href="https://docs.sillytavern.app/usage/common-settings/"
          target="_blank"
          :title="t('aiConfig.docsLinkTooltip')"
        ></a>
      </div>
    </div>

    <div class="ai-config-drawer-content">
      <div v-show="activeTab === 'sampler'" class="tab-content">
        <div class="ai-config-drawer-manual-input-note">{{ t('aiConfig.manualInputNote') }}</div>

        <template v-for="section in visibleSections" :key="section.id">
          <div v-for="item in section.items" :key="item.id || item.widget" class="ai-config-drawer-item">
            <AiConfigItemRenderer :item="item" />
          </div>
        </template>
      </div>

      <div v-show="activeTab === 'prompts'" class="tab-content">
        <PromptManager />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-config-drawer-item {
  margin-bottom: 16px;
  &:empty {
    display: none;
  }
}
</style>
