import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { discoverExtensions, fetchManifest } from '../api/extensions';
import type { ExtensionManifest } from '../types';
import { loadScript, loadStyle } from '../utils/extension-loader';
import { sanitizeSelector } from '../utils/dom';

export interface Extension {
  name: string;
  type: string;
  manifest: ExtensionManifest;
  isActive: boolean;
  containerId: string;
}

export const useExtensionStore = defineStore('extension', () => {
  const extensions = ref<Record<string, Extension>>({});
  const disabledExtensions = ref<string[]>([]); // This should be loaded from settings store
  const searchTerm = ref('');
  const selectedExtensionName = ref<string | null>(null);

  const filteredExtensions = computed(() => {
    const lowerSearch = searchTerm.value.toLowerCase();
    return Object.values(extensions.value)
      .filter((ext) => {
        if (!lowerSearch) return true;
        return (
          ext.name.toLowerCase().includes(lowerSearch) ||
          ext.manifest.display_name?.toLowerCase().includes(lowerSearch) ||
          ext.manifest.author?.toLowerCase().includes(lowerSearch)
        );
      })
      .sort((a, b) => (a.manifest.display_name ?? a.name).localeCompare(b.manifest.display_name ?? b.name));
  });

  const selectedExtension = computed<Extension | null>(() => {
    return selectedExtensionName.value ? extensions.value[selectedExtensionName.value] : null;
  });

  function selectExtension(name: string | null) {
    selectedExtensionName.value = name;
  }

  async function initializeExtensions() {
    if (Object.keys(extensions.value).length > 0) return; // Already initialized

    try {
      const discovered = await discoverExtensions();
      const manifestPromises = discovered.map(async (ext) => {
        try {
          const manifest = await fetchManifest(ext.name);
          return { ...ext, manifest };
        } catch (error) {
          console.error(`Failed to load manifest for ${ext.name}`, error);
          return null;
        }
      });

      const results = (await Promise.all(manifestPromises)).filter((x): x is NonNullable<typeof x> => x !== null);

      const newExtensions: Record<string, Extension> = {};
      for (const ext of results) {
        newExtensions[ext.name] = {
          name: ext.name,
          type: ext.type,
          manifest: ext.manifest,
          isActive: false, // will be set by activation logic
          containerId: `${sanitizeSelector(ext.name)}_container`,
        };
      }
      extensions.value = newExtensions;

      await activateExtensions();
    } catch (error) {
      console.error('Failed to initialize extensions:', error);
    }
  }

  async function activateExtensions() {
    // Basic activation logic. A full implementation would check dependencies, versions etc.
    for (const ext of Object.values(extensions.value)) {
      if (!disabledExtensions.value.includes(ext.name)) {
        try {
          if (ext.manifest.css) {
            await loadStyle(ext.name, ext.manifest.css);
          }
          if (ext.manifest.js) {
            await loadScript(ext.name, ext.manifest.js);
          }
          ext.isActive = true;
          console.debug(`Activated extension: ${ext.name}`);
        } catch (error) {
          console.error(`Failed to activate extension ${ext.name}:`, error);
        }
      }
    }
  }

  return {
    extensions,
    disabledExtensions,
    searchTerm,
    selectedExtensionName,
    filteredExtensions,
    selectedExtension,
    selectExtension,
    initializeExtensions,
  };
});
