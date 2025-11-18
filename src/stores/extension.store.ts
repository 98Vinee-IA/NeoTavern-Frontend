import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { discoverExtensions, fetchManifest } from '../api/extensions';
import type { ExtensionManifest } from '../types';
import { loadScript, loadStyle } from '../utils/extension-loader';
import { sanitizeSelector } from '../utils/dom';

export interface Extension {
  id: string;
  type: string;
  manifest: ExtensionManifest;
  isActive: boolean;
  containerId: string;
}

/**
 * Generates a consistent DOM ID for an extension container.
 */
export function getExtensionContainerId(extensionId: string): string {
  return `extension-root-${sanitizeSelector(extensionId)}`;
}

export const useExtensionStore = defineStore('extension', () => {
  const extensions = ref<Record<string, Extension>>({});
  const disabledExtensions = ref<string[]>([]); // This should be loaded from settings store
  const searchTerm = ref('');
  const selectedExtensionId = ref<string | null>(null);

  const filteredExtensions = computed(() => {
    const lowerSearch = searchTerm.value.toLowerCase();
    return Object.values(extensions.value)
      .filter((ext) => {
        if (!lowerSearch) return true;
        return (
          ext.id.toLowerCase().includes(lowerSearch) ||
          ext.manifest.display_name?.toLowerCase().includes(lowerSearch) ||
          ext.manifest.author?.toLowerCase().includes(lowerSearch)
        );
      })
      .sort((a, b) => (a.manifest.display_name ?? a.id).localeCompare(b.manifest.display_name ?? b.id));
  });

  const selectedExtension = computed<Extension | null>(() => {
    return selectedExtensionId.value ? extensions.value[selectedExtensionId.value] : null;
  });

  function selectExtension(id: string | null) {
    selectedExtensionId.value = id;
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
        // The name in the manifest (or folder name) is the ID
        const id = ext.name;
        newExtensions[id] = {
          id: id,
          type: ext.type,
          manifest: ext.manifest,
          isActive: false, // will be set by activation logic
          containerId: getExtensionContainerId(id),
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
      if (!disabledExtensions.value.includes(ext.id)) {
        try {
          if (ext.manifest.css) {
            await loadStyle(ext.id, ext.manifest.css);
          }
          if (ext.manifest.js) {
            await loadScript(ext.id, ext.manifest.js);
          }
          ext.isActive = true;
          console.debug(`Activated extension: ${ext.id}`);
        } catch (error) {
          console.error(`Failed to activate extension ${ext.id}:`, error);
        }
      }
    }
  }

  return {
    extensions,
    disabledExtensions,
    searchTerm,
    selectedExtensionId,
    filteredExtensions,
    selectedExtension,
    selectExtension,
    initializeExtensions,
    getExtensionContainerId,
  };
});
