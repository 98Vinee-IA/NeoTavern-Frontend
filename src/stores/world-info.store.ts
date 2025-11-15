import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useSettingsStore } from './settings.store';
import {
  type WorldInfoBook,
  type WorldInfoSettings,
  WorldInfoInsertionStrategy,
  POPUP_TYPE,
  POPUP_RESULT,
  type WorldInfoEntry,
  WorldInfoPosition,
  WorldInfoLogic,
} from '../types';
import * as api from '../api/world-info';
import { toast } from '../composables/useToast';
import { debounce } from '../utils/common';
import { defaultsDeep } from 'lodash-es';
import { usePopupStore } from './popup.store';
import { downloadFile } from '../utils/file';

export const defaultWorldInfoSettings: WorldInfoSettings = {
  world_info: {},
  world_info_depth: 2,
  world_info_min_activations: 0,
  world_info_min_activations_depth_max: 0,
  world_info_budget: 25,
  world_info_include_names: true,
  world_info_recursive: false,
  world_info_overflow_alert: false,
  world_info_case_sensitive: false,
  world_info_match_whole_words: false,
  world_info_character_strategy: WorldInfoInsertionStrategy.CHARACTER_FIRST,
  world_info_budget_cap: 0,
  world_info_use_group_scoring: false,
  world_info_max_recursion_steps: 0,
};

export const useWorldInfoStore = defineStore('world-info', () => {
  const settingsStore = useSettingsStore();
  const popupStore = usePopupStore();

  const isPanelPinned = ref(false);
  const bookNames = ref<string[]>([]);
  const activeBookNames = ref<string[]>([]);
  const worldInfoCache = ref<Record<string, WorldInfoBook>>({});

  const selectedItemId = ref<'global-settings' | string | null>('global-settings');
  const expandedBooks = ref<Set<string>>(new Set());
  const browserSearchTerm = ref('');

  const settings = computed({
    get: () => settingsStore.settings.world_info_settings,
    set: (value) => {
      settingsStore.setSetting('world_info_settings', { ...value });
    },
  });

  const selectedEntry = computed<WorldInfoEntry | null>(() => {
    if (typeof selectedItemId.value !== 'string' || !selectedItemId.value.includes('/')) return null;
    const [bookName, entryUidStr] = selectedItemId.value.split('/');
    const entryUid = parseInt(entryUidStr, 10);
    const book = worldInfoCache.value[bookName];
    return book?.entries.find((e) => e.uid === entryUid) ?? null;
  });

  const selectedBookForEntry = computed<WorldInfoBook | null>(() => {
    if (!selectedEntry.value || typeof selectedItemId.value !== 'string') return null;
    const [bookName] = selectedItemId.value.split('/');
    return worldInfoCache.value[bookName] ?? null;
  });

  watch(
    () => settingsStore.settings.world_info_settings,
    (newSettings) => {
      if (newSettings) {
        const newValues = defaultsDeep({}, newSettings, defaultWorldInfoSettings);
        if (JSON.stringify(settings.value) !== JSON.stringify(newValues)) {
          settings.value = newValues;
        }
        activeBookNames.value = settings.value.world_info?.globalSelect ?? [];
      }
    },
    { deep: true, immediate: true },
  );

  watch(
    activeBookNames,
    (newActive) => {
      if (!settings.value.world_info) {
        settings.value.world_info = {};
      }
      settings.value.world_info.globalSelect = newActive;
      saveBookDebounced();
    },
    { deep: true },
  );

  function getBookFromCache(name: string): WorldInfoBook | undefined {
    return worldInfoCache.value[name];
  }

  async function initialize() {
    try {
      bookNames.value = (await api.fetchAllWorldInfoNames()).sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Failed to load world info list:', error);
      toast.error('Could not load lorebooks.');
    }
  }

  async function selectItem(id: 'global-settings' | string | null) {
    if (id && id !== 'global-settings') {
      const [bookName] = id.split('/');
      if (!worldInfoCache.value[bookName]) {
        await fetchBook(bookName);
      }
    }
    selectedItemId.value = id;
  }

  async function fetchBook(bookName: string) {
    try {
      const book = await api.fetchWorldInfoBook(bookName);
      worldInfoCache.value[bookName] = book;
    } catch (error) {
      console.error(`Failed to load book ${bookName}:`, error);
      toast.error(`Could not load lorebook: ${bookName}`);
    }
  }

  function toggleBookExpansion(bookName: string) {
    if (expandedBooks.value.has(bookName)) {
      expandedBooks.value.delete(bookName);
    } else {
      if (!worldInfoCache.value[bookName]) {
        fetchBook(bookName);
      }
      expandedBooks.value.add(bookName);
    }
  }

  const saveBookDebounced = debounce(async (book?: WorldInfoBook) => {
    if (book) {
      try {
        await api.saveWorldInfoBook(book.name, book);
        worldInfoCache.value[book.name] = JSON.parse(JSON.stringify(book));
        toast.success(`Saved lorebook: ${book.name}`);
      } catch (error) {
        console.error('Failed to save lorebook:', error);
        toast.error('Failed to save lorebook.');
      }
    } else {
      settingsStore.saveSettingsDebounced();
    }
  }, 1000);

  function updateSelectedEntry(newEntryData: WorldInfoEntry) {
    if (!selectedEntry.value || !selectedBookForEntry.value) return;
    const book = selectedBookForEntry.value;
    const index = book.entries.findIndex((e) => e.uid === newEntryData.uid);
    if (index !== -1) {
      book.entries[index] = { ...newEntryData };
      saveBookDebounced(book);
    }
  }

  async function createNewBook() {
    const { result, value: newName } = await popupStore.show({
      title: 'New Lorebook',
      content: 'Enter the name for the new lorebook:',
      type: POPUP_TYPE.INPUT,
      inputValue: 'New Lorebook',
    });
    if (result === POPUP_RESULT.AFFIRMATIVE && newName) {
      const newBook: WorldInfoBook = { name: newName, entries: [] };
      try {
        await api.saveWorldInfoBook(newName, newBook);
        await initialize();
        toggleBookExpansion(newName);
        toast.success(`Created lorebook: ${newName}`);
      } catch (error) {
        toast.error(`Failed to create lorebook.`);
      }
    }
  }

  async function createNewEntry(bookName: string) {
    const book = worldInfoCache.value[bookName];
    if (!book) return;

    const newUid = book.entries.length > 0 ? Math.max(...book.entries.map((e) => e.uid)) + 1 : 1;
    const newEntry: WorldInfoEntry = {
      uid: newUid,
      key: [],
      keysecondary: [],
      comment: 'New Entry',
      content: '',
      constant: false,
      vectorized: false,
      selective: false,
      selectiveLogic: WorldInfoLogic.AND_ANY,
      addMemo: false,
      order: 100,
      position: WorldInfoPosition.BEFORE_CHAR,
      disable: false,
      ignoreBudget: false,
      excludeRecursion: false,
      preventRecursion: false,
      matchPersonaDescription: false,
      matchCharacterDescription: false,
      matchCharacterPersonality: false,
      matchCharacterDepthPrompt: false,
      matchScenario: false,
      matchCreatorNotes: false,
      delayUntilRecursion: false,
      probability: 100,
      useProbability: false,
      depth: 4,
      outletName: '',
      group: '',
      groupOverride: false,
      groupWeight: 100,
      scanDepth: null,
      caseSensitive: null,
      matchWholeWords: null,
      useGroupScoring: null,
      automationId: '',
      role: 0,
      sticky: null,
      cooldown: null,
      delay: null,
      characterFilterNames: [],
      characterFilterTags: [],
      characterFilterExclude: false,
      triggers: [],
    };

    book.entries.unshift(newEntry);
    await saveBookDebounced(book);
    selectItem(`${bookName}/${newUid}`);
  }

  async function deleteBook(name: string) {
    const { result } = await popupStore.show({
      title: 'Confirm Deletion',
      content: `Are you sure you want to delete the lorebook "<b>${name}</b>"?`,
      type: POPUP_TYPE.CONFIRM,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      try {
        await api.deleteWorldInfoBook(name);
        delete worldInfoCache.value[name];
        if (selectedItemId.value?.startsWith(`${name}/`)) {
          selectItem('global-settings');
        }
        await initialize();
        toast.success(`Deleted lorebook: ${name}`);
      } catch (error) {
        toast.error('Failed to delete lorebook.');
      }
    }
  }

  async function deleteSelectedEntry() {
    if (!selectedEntry.value || !selectedBookForEntry.value) return;
    const book = selectedBookForEntry.value;
    const entry = selectedEntry.value;

    const { result } = await popupStore.show({
      title: 'Confirm Entry Deletion',
      content: `Are you sure you want to delete the entry "<b>${entry.comment}</b>"?`,
      type: POPUP_TYPE.CONFIRM,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      const index = book.entries.findIndex((e) => e.uid === entry.uid);
      if (index !== -1) {
        book.entries.splice(index, 1);
        saveBookDebounced(book);
        selectItem('global-settings');
      }
    }
  }

  async function importBook(file: File) {
    try {
      const { name } = await api.importWorldInfoBook(file);
      await initialize();
      await fetchBook(name);
      toggleBookExpansion(name);
      toast.success(`Imported lorebook: ${name}`);
    } catch (error) {
      toast.error('Failed to import lorebook.');
    }
  }

  async function exportBook(name: string) {
    try {
      const book = await api.exportWorldInfoBook(name);
      const content = JSON.stringify(book, null, 2);
      downloadFile(content, `${book.name}.json`, 'application/json');
    } catch (error) {
      toast.error('Failed to export lorebook.');
    }
  }

  return {
    isPanelPinned,
    settings,
    bookNames,
    activeBookNames,
    worldInfoCache,
    selectedItemId,
    expandedBooks,
    browserSearchTerm,
    selectedEntry,
    selectedBookForEntry,
    initialize,
    selectItem,
    toggleBookExpansion,
    updateSelectedEntry,
    createNewBook,
    createNewEntry,
    deleteBook,
    deleteSelectedEntry,
    getBookFromCache,
    importBook,
    exportBook,
    saveBookDebounced,
  };
});
