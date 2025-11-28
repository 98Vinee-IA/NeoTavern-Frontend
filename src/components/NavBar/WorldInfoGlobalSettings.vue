<script setup lang="ts">
import { debounce } from 'lodash-es';
import { computed, ref, watch } from 'vue';
import { ApiTokenizer } from '../../api/tokenizer';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { DebounceTimeout, defaultWorldInfoSettings } from '../../constants';
import { useSettingsStore } from '../../stores/settings.store';
import { useWorldInfoStore } from '../../stores/world-info.store';
import { Button, Checkbox, FormItem, RangeControl, Select } from '../UI';

const props = withDefaults(defineProps<{ showHeader?: boolean }>(), { showHeader: true });

const { t } = useStrictI18n();
const worldInfoStore = useWorldInfoStore();
const settingsStore = useSettingsStore();

const activeTokenCount = ref(0);
const isLoadingTokens = ref(false);

function resetToDefaults() {
  settingsStore.settings.worldInfo = {
    ...defaultWorldInfoSettings,
    activeBookNames: settingsStore.settings.worldInfo.activeBookNames,
  };
}

const bookOptions = computed(() => {
  return worldInfoStore.bookInfos.map((bookInfo) => ({
    label: bookInfo.name,
    value: bookInfo.file_id,
  }));
});

const calculateGlobalTokens = debounce(async () => {
  isLoadingTokens.value = true;
  try {
    const activeBooks = worldInfoStore.globalBookNames;
    let totalContent = '';

    for (const bookName of activeBooks) {
      // Fetch or get from cache. 'false' means don't force fetch, return undefined if missing.
      const book = await worldInfoStore.getBookFromCache(bookName, false);
      if (book) {
        // Count enabled entries only as they are the ones used in context
        const activeEntries = book.entries.filter((e) => !e.disable);
        totalContent += activeEntries.map((e) => e.content).join('\n') + '\n';
      }
    }
    activeTokenCount.value = await ApiTokenizer.default.getTokenCount(totalContent);
  } finally {
    isLoadingTokens.value = false;
  }
}, DebounceTimeout.STANDARD);

watch(
  () => worldInfoStore.globalBookNames,
  () => calculateGlobalTokens(),
  { immediate: true },
);
</script>

<template>
  <div class="world-info-global-settings">
    <div v-if="props.showHeader" class="main-page-header">
      <div class="main-page-header-main">
        <h3>{{ t('worldInfo.globalSettings') }}</h3>
      </div>
      <div class="main-page-header-actions">
        <Button @click="resetToDefaults">{{ t('common.resetToDefaults') }}</Button>
      </div>
    </div>

    <div class="settings-section">
      <div class="global-token-stat">
        <span>{{ t('worldInfo.totalActiveTokens') }}</span>
        <strong>
          <i v-if="isLoadingTokens" class="fa-solid fa-spinner fa-spin"></i>
          <span v-else>{{ activeTokenCount }}</span>
        </strong>
      </div>

      <FormItem :description="t('worldInfo.activeWorldsHint')">
        <Select
          v-model="worldInfoStore.globalBookNames"
          :options="bookOptions"
          multiple
          searchable
          :label="t('worldInfo.activeWorlds')"
          :placeholder="t('common.none')"
        />
      </FormItem>
    </div>

    <hr />

    <div class="settings-section">
      <h4>{{ t('worldInfo.activationSettings') }}</h4>
      <div class="wi-settings-grid">
        <div class="wi-settings-grid-sliders">
          <RangeControl
            v-model="settingsStore.settings.worldInfo.depth"
            :label="t('worldInfo.scanDepth')"
            :min="0"
            :max="1000"
          />
          <RangeControl
            v-model="settingsStore.settings.worldInfo.budget"
            :label="t('worldInfo.contextPercent')"
            :min="1"
            :max="100"
          />
          <RangeControl
            v-model="settingsStore.settings.worldInfo.budgetCap"
            :label="t('worldInfo.budgetCap')"
            :min="0"
            :max="65536"
            :title="t('worldInfo.budgetCapHint')"
          />
          <RangeControl
            v-model="settingsStore.settings.worldInfo.minActivations"
            :label="t('worldInfo.minActivations')"
            :min="0"
            :max="50"
            :title="t('worldInfo.minActivationsHint')"
          />
          <RangeControl
            v-model="settingsStore.settings.worldInfo.minActivationsDepthMax"
            :label="t('worldInfo.minActivationsDepthMax')"
            :min="0"
            :max="2000"
            :title="t('worldInfo.minActivationsDepthMaxHint')"
          />
          <RangeControl
            v-model="settingsStore.settings.worldInfo.maxRecursionSteps"
            :label="t('worldInfo.maxRecursionSteps')"
            :min="0"
            :max="50"
            :title="t('worldInfo.maxRecursionStepsHint')"
          />
        </div>
        <div class="wi-settings-grid-checkboxes">
          <Checkbox
            v-model="settingsStore.settings.worldInfo.includeNames"
            :label="t('worldInfo.includeNames')"
            :title="t('worldInfo.includeNamesHint')"
          />
          <Checkbox
            v-model="settingsStore.settings.worldInfo.recursive"
            :label="t('worldInfo.recursiveScan')"
            :title="t('worldInfo.recursiveScanHint')"
          />
          <Checkbox
            v-model="settingsStore.settings.worldInfo.caseSensitive"
            :label="t('worldInfo.caseSensitive')"
            :title="t('worldInfo.caseSensitiveHint')"
          />
          <Checkbox
            v-model="settingsStore.settings.worldInfo.matchWholeWords"
            :label="t('worldInfo.matchWholeWords')"
            :title="t('worldInfo.matchWholeWordsHint')"
          />
          <Checkbox
            v-model="settingsStore.settings.worldInfo.useGroupScoring"
            :label="t('worldInfo.useGroupScoring')"
            :title="t('worldInfo.useGroupScoringHint')"
          />
          <Checkbox
            v-model="settingsStore.settings.worldInfo.overflowAlert"
            :label="t('worldInfo.alertOnOverflow')"
            :title="t('worldInfo.alertOnOverflowHint')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
