<script setup lang="ts">
import { computed } from 'vue';
import { CollapsibleSection, FileInput, FormItem, Input, RangeControl, Textarea } from '../../components/UI';
import { PresetControl, SidebarHeader } from '../../components/common';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { usePopupStore } from '../../stores/popup.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useThemeStore } from '../../stores/theme.store';
import { POPUP_TYPE } from '../../types';
import type { ThemeVariables } from '../../types/theme';
import { THEME_CATEGORIES, VARIABLE_LABELS, VARIABLE_TYPES } from '../../types/theme';

const themeStore = useThemeStore();
const popupStore = usePopupStore();
const settingsStore = useSettingsStore();
const { t } = useStrictI18n();

// Utility function to convert RGBA to Hex (for color picker display)
function rgbaToHex(rgba: string): string {
  // Match rgba(r, g, b, a) format
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) {
    // If it's already in hex format or invalid, return as is
    return rgba;
  }

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  // For hex conversion, we ignore alpha channel

  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

// Utility function to merge hex color with existing alpha
function mergeWithAlpha(hex: string, original: string): string {
  // Extract alpha from original rgba value
  const alphaMatch = original.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
  const alpha = alphaMatch && alphaMatch[1] ? parseFloat(alphaMatch[1]) : 1;

  // If alpha is 1 (fully opaque), just return the hex value
  if (alpha === 1) {
    return hex;
  }

  // Convert hex to rgb
  if (hex.startsWith('#')) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return hex;
}

const themeOptions = computed(() => {
  const list = [{ label: 'Default', value: 'Default' }];
  themeStore.themes.forEach((t) => {
    list.push({ label: t.name, value: t.name });
  });
  return list;
});

function onThemeChange(name: string | number) {
  themeStore.loadTheme(String(name));
  settingsStore.settings.ui.selectedTheme = String(name);
}

function getVariable(key: keyof ThemeVariables) {
  return themeStore.currentVariables[key] || '';
}

function getVariableForColorInput(key: keyof ThemeVariables) {
  const value = getVariable(key);
  // Convert RGBA to hex for color inputs
  if (value.startsWith('rgba(') || value.startsWith('rgb(')) {
    return rgbaToHex(value);
  }
  return value;
}

function setVariable(key: keyof ThemeVariables, value: string | number) {
  let newValue = String(value);

  // If this is a color variable and the original value was rgba,
  // try to preserve the alpha channel
  if (isColor(key)) {
    const originalValue = getVariable(key);
    if (originalValue.startsWith('rgba(')) {
      newValue = mergeWithAlpha(newValue, originalValue);
    }
  }

  themeStore.updateVariable(key, newValue);
}

function updateCustomCss(val: string) {
  themeStore.updateCustomCss(val);
}

// Helpers for specific input types
function isColor(key: keyof ThemeVariables) {
  return VARIABLE_TYPES[key] === 'color';
}
function isNumber(key: keyof ThemeVariables) {
  return VARIABLE_TYPES[key] === 'number';
}

// CRUD Actions
async function onCreate() {
  const { result, value } = await popupStore.show<string>({
    type: POPUP_TYPE.TEXT,
    title: t('common.create'),
    okButton: 'common.save',
    cancelButton: 'common.cancel',
  });

  if (result && value) {
    await themeStore.saveTheme(value);
  }
}

async function onSave() {
  if (themeStore.activeThemeName === 'Default') {
    await onCreate();
    return;
  }
  await themeStore.saveTheme(themeStore.activeThemeName);
}

async function onDelete() {
  if (themeStore.activeThemeName === 'Default') return;

  const { result } = await popupStore.show({
    type: POPUP_TYPE.CONFIRM,
    title: t('common.delete'),
    content: `Delete theme "${themeStore.activeThemeName}"?`,
  });

  if (result) {
    await themeStore.deleteTheme(themeStore.activeThemeName);
  }
}

function onImport(files: File[]) {
  if (files.length > 0) {
    themeStore.importTheme(files[0]);
  }
}
</script>

<template>
  <div class="theme-drawer">
    <SidebarHeader title="Themes" />

    <div class="theme-drawer-content">
      <!-- Preset Control -->
      <div class="theme-presets">
        <PresetControl
          :model-value="themeStore.activeThemeName"
          :options="themeOptions"
          allow-create
          allow-save
          allow-delete
          allow-export
          @update:model-value="onThemeChange"
          @create="onCreate"
          @save="onSave"
          @delete="onDelete"
          @export="themeStore.exportTheme"
        >
          <template #actions>
            <FileInput accept=".json" icon="fa-file-import" @change="onImport" />
          </template>
        </PresetControl>
      </div>

      <!-- Variable Editors -->
      <div class="theme-editor">
        <!-- Custom CSS Section -->
        <CollapsibleSection title="Custom CSS">
          <div class="theme-vars-list">
            <Textarea
              :model-value="themeStore.customCss"
              allow-maximize
              identifier="theme.custom_css"
              language="css"
              class="custom-css-editor"
              @update:model-value="updateCustomCss"
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection v-for="(vars, category) in THEME_CATEGORIES" :key="category" :title="category">
          <div class="theme-vars-list">
            <div v-for="key in vars" :key="key" class="theme-var-item">
              <!-- Colors -->
              <div v-if="isColor(key)" class="color-picker-row">
                <label>{{ t(VARIABLE_LABELS[key]) }}</label>
                <div class="color-input-wrapper">
                  <input
                    type="color"
                    :value="getVariableForColorInput(key)"
                    @input="(e) => setVariable(key, (e.target as HTMLInputElement).value)"
                  />
                  <span class="color-value">{{ getVariable(key) }}</span>
                </div>
              </div>

              <!-- Numbers (Sliders) -->
              <div v-else-if="isNumber(key)">
                <RangeControl
                  :label="t(VARIABLE_LABELS[key])"
                  :model-value="parseFloat(getVariable(key)) || 0"
                  :min="0"
                  :max="50"
                  @update:model-value="(val) => setVariable(key, val)"
                />
              </div>

              <!-- Text / generic -->
              <div v-else>
                <FormItem :label="t(VARIABLE_LABELS[key])">
                  <Input :model-value="getVariable(key)" @update:model-value="(val) => setVariable(key, val)" />
                </FormItem>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.theme-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  &-content {
    padding: var(--spacing-md);
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
}

.theme-vars-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
}

.custom-css-editor {
  min-height: 200px;
  max-height: 500px;
  border: 1px solid var(--theme-border-color);
  border-radius: var(--base-border-radius);
}

.color-picker-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--black-30a);
  padding: var(--spacing-sm);
  border-radius: var(--base-border-radius);
  border: 1px solid var(--theme-border-color);

  label {
    font-size: 0.9em;
    opacity: 0.9;
  }

  .color-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);

    input[type='color'] {
      border: none;
      width: 32px;
      height: 32px;
      padding: 0;
      background: none;
      cursor: pointer;

      &::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      &::-webkit-color-swatch {
        border: 1px solid var(--white-30a);
        border-radius: 4px;
      }
    }

    .color-value {
      font-family: var(--font-family-mono);
      font-size: 0.8em;
      opacity: 0.7;
      min-width: 60px;
    }
  }
}
</style>
