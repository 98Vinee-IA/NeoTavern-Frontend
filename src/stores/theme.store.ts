import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Preset } from '../api/presets';
import * as api from '../api/presets';
import { useStrictI18n } from '../composables/useStrictI18n';
import { toast } from '../composables/useToast';
import type { Theme, ThemeVariables } from '../types/theme';
import { VARIABLE_TYPES } from '../types/theme';
import { downloadFile } from '../utils/commons';
import { useSettingsStore } from './settings.store';

export const useThemeStore = defineStore('theme', () => {
  const { t } = useStrictI18n();
  const themes = ref<Preset<Theme>[]>([]);
  const activeThemeName = ref<string>('Default');

  // The current working state of variables (what is seen on screen)
  const currentVariables = ref<Partial<ThemeVariables>>({});
  const customCss = ref<string>('');

  const settingsStore = useSettingsStore();

  /**
   * Reads current computed styles from the DOM to populate initial state
   */
  function loadCurrentDOMStyles() {
    const computed = getComputedStyle(document.documentElement);
    const vars: Partial<ThemeVariables> = {};

    for (const key of Object.keys(VARIABLE_TYPES)) {
      const val = computed.getPropertyValue(key).trim();
      if (val) {
        vars[key as keyof ThemeVariables] = val;
      }
    }
    currentVariables.value = vars;
  }

  /**
   * Applies the variables to the root document
   */
  function applyToDOM(variables: Partial<ThemeVariables>) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) {
      if (value) {
        root.style.setProperty(key, value);
      } else {
        root.style.removeProperty(key);
      }
    }
  }

  /**
   * Applies the custom CSS to a style tag in the document head
   */
  function applyCustomCss(css: string) {
    let styleTag = document.getElementById('theme-custom-css');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'theme-custom-css';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = css;
  }

  async function fetchThemes() {
    try {
      themes.value = await api.fetchAllThemes();
      activeThemeName.value = settingsStore.settings.ui.selectedTheme;
      if (activeThemeName.value !== 'Default') {
        await loadTheme(activeThemeName.value);
      }
      // Ensure there is at least a default if API returns empty or specific logic needed
    } catch (error) {
      console.error('Failed to fetch themes', error);
      toast.error(t('themes.errors.loadFailed'));
    }
  }

  async function loadTheme(name: string) {
    // If selecting "Default" or essentially clearing overrides
    if (!name || name === 'Default') {
      activeThemeName.value = 'Default';
      // Reset DOM to stylesheet defaults
      const root = document.documentElement;
      for (const key of Object.keys(VARIABLE_TYPES)) {
        root.style.removeProperty(key);
      }
      // Clear Custom CSS
      customCss.value = '';
      applyCustomCss('');

      loadCurrentDOMStyles();
      return;
    }

    const found = themes.value.find((t) => t.name === name);
    if (found) {
      activeThemeName.value = name;
      currentVariables.value = { ...found.preset.variables };
      customCss.value = found.preset.customCss || '';
      applyToDOM(currentVariables.value);
      applyCustomCss(customCss.value);
    }
  }

  function updateVariable(key: keyof ThemeVariables, value: string) {
    currentVariables.value[key] = value;
    document.documentElement.style.setProperty(key, value);
  }

  function updateCustomCss(css: string) {
    customCss.value = css;
    applyCustomCss(css);
  }

  async function saveTheme(name: string) {
    if (!name) return;

    const newTheme: Theme = {
      variables: { ...currentVariables.value },
      customCss: customCss.value,
    };

    const previousThemes = [...themes.value];
    const previousActiveTheme = activeThemeName.value;

    const existingIndex = themes.value.findIndex((t) => t.name === name);
    if (existingIndex >= 0) {
      themes.value[existingIndex].preset = newTheme;
    } else {
      themes.value.push({ name, preset: newTheme });
    }
    activeThemeName.value = name;
    settingsStore.settings.ui.selectedTheme = name; // Update settings to prevent revert on fetch
    toast.success(`Theme "${name}" saved`);

    api
      .saveTheme(name, newTheme)
      .then(() => fetchThemes())
      .catch((error) => {
        console.error(error);
        toast.error(t('themes.errors.saveFailed'));

        themes.value = previousThemes;
        if (activeThemeName.value === name) {
          activeThemeName.value = previousActiveTheme;
          settingsStore.settings.ui.selectedTheme = previousActiveTheme; // Rollback settings
          if (previousActiveTheme !== 'Default') {
            loadTheme(previousActiveTheme);
          }
        }
      });
  }

  async function deleteTheme(name: string) {
    const previousThemes = [...themes.value];
    const previousActiveTheme = activeThemeName.value;

    const index = themes.value.findIndex((t) => t.name === name);
    if (index !== -1) {
      themes.value.splice(index, 1);
    }

    if (activeThemeName.value === name) {
      loadTheme('Default');
      settingsStore.settings.ui.selectedTheme = 'Default'; // Update settings
    }

    toast.success('Theme deleted');

    api
      .deleteTheme(name)
      .then(() => fetchThemes())
      .catch((error) => {
        console.error(error);
        toast.error(t('themes.errors.deleteFailed'));

        themes.value = previousThemes;
        if (activeThemeName.value !== previousActiveTheme) {
          loadTheme(previousActiveTheme);
          settingsStore.settings.ui.selectedTheme = previousActiveTheme; // Rollback settings
        }
      });
  }

  function exportTheme() {
    const themeToExport: Theme = {
      variables: currentVariables.value,
      customCss: customCss.value,
    };

    downloadFile(
      JSON.stringify(themeToExport, null, 2),
      `${activeThemeName.value || 'theme'}.json`,
      'application/json',
    );
  }

  async function importTheme(file: File) {
    try {
      const text = await file.text();
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const json = JSON.parse(text) as Theme;

      if (!json.variables || typeof json.variables !== 'object') {
        throw new Error('Invalid theme format');
      }

      // Apply immediately
      currentVariables.value = json.variables;
      customCss.value = json.customCss || '';
      applyToDOM(json.variables);
      applyCustomCss(customCss.value);
      activeThemeName.value = fileNameWithoutExt || 'Imported';

      // Auto save? Or let user save? Let's auto save for convenience
      await saveTheme(fileNameWithoutExt || 'Imported Theme');
    } catch (error) {
      console.error(error);
      toast.error(t('themes.errors.importFailed'));
    }
  }

  return {
    themes,
    activeThemeName,
    currentVariables,
    customCss,
    fetchThemes,
    loadTheme,
    updateVariable,
    updateCustomCss,
    saveTheme,
    deleteTheme,
    exportTheme,
    importTheme,
    loadCurrentDOMStyles,
  };
});
