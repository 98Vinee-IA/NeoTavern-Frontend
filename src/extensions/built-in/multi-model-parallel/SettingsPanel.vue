<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { ExtensionAPI } from '../../../types';
import type { MultiModelSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

interface Props {
  api: ExtensionAPI<MultiModelSettings>;
}

const props = defineProps<Props>();

const { t } = props.api.i18n;

// Use ref for settings like model-randomizer plugin
const settings = ref<MultiModelSettings>({ ...DEFAULT_SETTINGS });
const availableProfiles = computed(() => props.api.api.getConnectionProfiles());

// Load settings on mount
onMounted(() => {
  console.log('SettingsPanel: onMounted - loading settings');
  const saved = props.api.settings.get();
  console.log('SettingsPanel: saved settings from API:', saved);
  
  if (saved) {
    settings.value = { ...DEFAULT_SETTINGS, ...saved };
    console.log('SettingsPanel: merged settings:', settings.value);
  } else {
    console.log('SettingsPanel: no saved settings, using defaults');
  }
});

// Single deep watch on settings to save changes
watch(
  settings,
  (newSettings) => {
    console.log('SettingsPanel: watch triggered - saving settings:', newSettings);
    props.api.settings.set(undefined, newSettings);
    props.api.settings.save();
  },
  { deep: true },
);

const toggleProfile = (profileId: string) => {
  console.log('SettingsPanel: toggleProfile called for:', profileId);
  const index = settings.value.connectionProfiles.indexOf(profileId);
  if (index > -1) {
    settings.value.connectionProfiles.splice(index, 1);
    console.log('SettingsPanel: removed profile, new list:', settings.value.connectionProfiles);
  } else {
    settings.value.connectionProfiles.push(profileId);
    console.log('SettingsPanel: added profile, new list:', settings.value.connectionProfiles);
  }
};

const isSelected = (profileId: string) => {
  return settings.value.connectionProfiles.includes(profileId);
};
</script>

<template>
  <div class="multi-model-parallel-settings">
    <div class="settings-section">
      <h3>{{ t('extensionsBuiltin.multiModelParallel.settings.title') }}</h3>
      <p class="settings-description">
        {{ t('extensionsBuiltin.multiModelParallel.settings.description') }}
      </p>
    </div>

    <div class="settings-section">
      <div class="form-item">
        <label class="form-label">{{ t('extensionsBuiltin.multiModelParallel.settings.enabled') }}</label>
        <div class="form-control">
          <input type="checkbox" :checked="settings.enabled" @change="(e: any) => (settings.enabled = e.target.checked)" />
        </div>
        <p class="form-description">
          {{ t('extensionsBuiltin.multiModelParallel.settings.enabledDescription') }}
        </p>
      </div>
    </div>

    <div v-if="settings.enabled" class="settings-section">
      <div class="form-item">
        <label class="form-label">{{ t('extensionsBuiltin.multiModelParallel.settings.connectionProfiles') }}</label>
        <p class="form-description">
          {{ t('extensionsBuiltin.multiModelParallel.settings.connectionProfilesDescription') }}
        </p>
        <div class="profile-list">
          <div
            v-for="profile in availableProfiles"
            :key="profile.id"
            class="profile-item"
            :class="{ selected: isSelected(profile.id) }"
            @click="toggleProfile(profile.id)"
          >
            <input
              type="checkbox"
              :checked="isSelected(profile.id)"
              @change="
                (e: any) => {
                  e.stopPropagation();
                  toggleProfile(profile.id);
                }
              "
            />
            <span class="profile-name">{{ profile.name || profile.id }}</span>
            <span class="profile-provider">{{ profile.provider }}</span>
          </div>
        </div>
        <p v-if="settings.connectionProfiles.length === 0" class="warning-text">
          {{ t('extensionsBuiltin.multiModelParallel.settings.noProfilesWarning') }}
        </p>
      </div>
    </div>

    <div v-if="settings.enabled" class="settings-section">
      <div class="form-item">
        <label class="form-label">{{ t('extensionsBuiltin.multiModelParallel.settings.maxSwipes') }}</label>
        <div class="form-control">
          <input
            type="number"
            :value="settings.maxSwipes"
            min="1"
            max="10"
            @input="(e: any) => (settings.maxSwipes = parseInt(e.target.value) || 1)"
          />
        </div>
        <p class="form-description">
          {{ t('extensionsBuiltin.multiModelParallel.settings.maxSwipesDescription') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.multi-model-parallel-settings {
  padding: 1rem;
}

.settings-section {
  margin-bottom: 1.5rem;
}

.settings-section h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.settings-description {
  margin: 0 0 1rem 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.form-item {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-control {
  display: flex;
  align-items: center;
}

.form-description {
  margin: 0.5rem 0 0 0;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.profile-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.profile-item:hover {
  background: var(--bg-tertiary);
}

.profile-item.selected {
  border-color: var(--primary-color);
  background: var(--primary-color-dimmed);
}

.profile-name {
  flex: 1;
  font-weight: 500;
}

.profile-provider {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.warning-text {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--warning-bg);
  color: var(--warning-text);
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

input[type='checkbox'] {
  width: 1.2rem;
  height: 1.2rem;
  cursor: pointer;
}

input[type='number'] {
  width: 4rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  background: var(--bg-secondary);
  color: var(--text-color);
}
</style>
