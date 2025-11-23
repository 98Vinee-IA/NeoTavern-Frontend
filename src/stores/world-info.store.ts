import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import { useSettingsStore } from './settings.store';
import { POPUP_TYPE, POPUP_RESULT, type WorldInfoEntry, type WorldInfoHeader, type WorldInfoBook } from '../types';
import * as api from '../api/world-info';
import { toast } from '../composables/useToast';
import { debounce } from 'lodash-es';
import { usePopupStore } from './popup.store';
import { downloadFile } from '../utils/file';
import { useStrictI18n } from '../composables/useStrictI18n';
import { eventEmitter } from '../utils/event-emitter';
import { usePersonaStore } from './persona.store';
import { useChatStore } from './chat.store';
import { useCharacterStore } from './character.store';
import { DebounceTimeout, WorldInfoLogic, WorldInfoPosition } from '../constants';
import { uuidv4 } from '../utils/common';

export const useWorldInfoStore = defineStore('world-info', () => {
  const { t } = useStrictI18n();
  const settingsStore = useSettingsStore();
  const popupStore = usePopupStore();
  const personaStore = usePersonaStore();
  const chatStore = useChatStore();
  const characterStore = useCharacterStore();

  const isPanelPinned = ref(false);
  const bookInfos = ref<WorldInfoHeader[]>([]);
  const worldInfoCache = ref<Record<string, WorldInfoBook>>({}); // filename -> book

  const selectedItemId = ref<'global-settings' | string | null>('global-settings');
  const expandedBooks = ref<Set<string>>(new Set());
  const browserSearchTerm = ref('');
  const loadingBooks = ref<Set<string>>(new Set());

  const activeBookNames = computed<string[]>(() => {
    const global = settingsStore.settings.worldInfo.activeBookNames || [];
    const persona = personaStore.activePersona?.lorebooks || [];
    const chat = chatStore.activeChat?.metadata.chat_lorebooks || [];

    const charBooks = new Set<string>();
    for (const char of characterStore.activeCharacters) {
      if (char.data?.character_book?.name) {
        charBooks.add(char.data.character_book.name);
      }
    }

    const uniqueNames = new Set<string>([...global, ...persona, ...chat, ...charBooks]);
    return Array.from(uniqueNames);
  });

  const globalBookNames = computed<string[]>({
    get: () => settingsStore.settings.worldInfo.activeBookNames || [],
    set: (value) => {
      settingsStore.settings.worldInfo.activeBookNames = value;
    },
  });

  const sortOrder = computed({
    get: () => settingsStore.settings.account.worldInfoSortOrder ?? 'order:asc',
    set: (value) => (settingsStore.settings.account.worldInfoSortOrder = value),
  });

  const selectedEntry = computed<WorldInfoEntry | null>(() => {
    if (typeof selectedItemId.value !== 'string' || !selectedItemId.value.includes('/')) return null;
    const [filename, entryUidStr] = selectedItemId.value.split('/');
    const entryUid = parseInt(entryUidStr, 10);
    const book = worldInfoCache.value[filename];
    return book?.entries.find((e) => e.uid === entryUid) ?? null;
  });

  const selectedBookForEntry = computed<WorldInfoBook | null>(() => {
    return selectedFilename.value ? worldInfoCache.value[selectedFilename.value] || null : null;
  });

  const selectedFilename = computed<string | null>(() => {
    if (typeof selectedItemId.value !== 'string' || !selectedItemId.value.includes('/')) return null;
    const [filename] = selectedItemId.value.split('/');
    return filename;
  });

  // TODO: Potential performance bottleneck for very large lorebooks, but acceptable for now.
  // Can be optimized with debouncing or memoization if it becomes a problem.
  function filteredAndSortedEntries(filename: string): WorldInfoEntry[] {
    const book = worldInfoCache.value[filename];
    if (!book) return [];

    let entries = [...book.entries];

    // Filter based on search term
    if (browserSearchTerm.value) {
      const lowerSearch = browserSearchTerm.value.toLowerCase();
      entries = entries.filter(
        (entry) =>
          entry.comment.toLowerCase().includes(lowerSearch) ||
          entry.key.join(',').toLowerCase().includes(lowerSearch) ||
          entry.content.toLowerCase().includes(lowerSearch) ||
          String(entry.uid).includes(lowerSearch),
      );
    }

    // Sort the (potentially filtered) entries
    const [field, direction] = sortOrder.value.split(':');
    entries.sort((a, b) => {
      let valA = (a as never)[field] as string;
      let valB = (b as never)[field] as string;
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return entries;
  }

  async function getBookFromCache(filename: string, force?: boolean): Promise<WorldInfoBook | undefined> {
    if (force && !worldInfoCache.value[filename]) {
      await fetchBook(filename);
    }
    return worldInfoCache.value[filename];
  }

  async function initialize() {
    await settingsStore.waitForSettings();
    try {
      bookInfos.value = (await api.listAllWorldInfoBooks()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to load world info list:', error);
      toast.error(t('worldInfo.errors.loadListFailed'));
    }
  }

  async function selectItem(id: 'global-settings' | string | null) {
    if (id && id !== 'global-settings') {
      const [filename] = id.split('/');
      if (!worldInfoCache.value[filename]) {
        await fetchBook(filename);
      }
    }
    selectedItemId.value = id;
  }

  async function fetchBook(filename: string) {
    if (loadingBooks.value.has(filename)) return; // Already fetching
    try {
      loadingBooks.value.add(filename);
      const book = await api.fetchWorldInfoBook(filename);
      if (book.name) {
        worldInfoCache.value[filename] = book;
      }
    } catch (error) {
      console.error(`Failed to load book ${filename}:`, error);
      toast.error(t('worldInfo.errors.loadFailed', { name: filename }));
    } finally {
      loadingBooks.value.delete(filename);
    }
  }

  function toggleBookExpansion(filename: string) {
    if (expandedBooks.value.has(filename)) {
      expandedBooks.value.delete(filename);
    } else {
      expandedBooks.value.add(filename);
      if (!worldInfoCache.value[filename]) {
        fetchBook(filename);
      }
    }
  }

  const saveBookDebounced = debounce(async (book?: WorldInfoBook) => {
    if (book) {
      try {
        await api.saveWorldInfoBook(book.name, book);
        worldInfoCache.value[book.name] = structuredClone(book);
        await nextTick();
        await eventEmitter.emit('world-info:book-updated', book);
      } catch (error) {
        console.error('Failed to save lorebook:', error);
        toast.error(t('worldInfo.errors.saveFailed'));
      }
    } else {
      settingsStore.saveSettingsDebounced();
    }
  }, DebounceTimeout.RELAXED);

  async function updateSelectedEntry(newEntryData: WorldInfoEntry) {
    if (!selectedEntry.value || !selectedBookForEntry.value) return;
    const book = selectedBookForEntry.value;
    const index = book.entries.findIndex((e) => e.uid === newEntryData.uid);
    if (index !== -1) {
      book.entries[index] = { ...newEntryData };
      saveBookDebounced(book);
      await nextTick();
      await eventEmitter.emit('world-info:entry-updated', book.name, newEntryData);
    }
  }

  async function createNewBook(data?: { filename: string; book: WorldInfoBook }) {
    let affirmative = !!data;
    let newName = data?.book.name;
    if (!data) {
      const { result, value } = await popupStore.show({
        title: t('worldInfo.popup.newBookTitle'),
        content: t('worldInfo.popup.newBookContent'),
        type: POPUP_TYPE.INPUT,
        inputValue: t('worldInfo.popup.newBookInput'),
      });
      affirmative = result === POPUP_RESULT.AFFIRMATIVE && !!value;
      newName = value;
    }
    if (affirmative && newName) {
      let newBook = data?.book;
      let filename = data?.filename;
      if (!newBook || !filename) {
        filename = uuidv4();
        newBook = { name: newName, entries: [] };
      }
      try {
        await api.importWorldInfoBook(
          new File([JSON.stringify(newBook, null, 2)], `${filename}.json`, { type: 'application/json' }),
        );
        worldInfoCache.value[filename] = newBook;
        bookInfos.value.push({ file_id: filename, name: newBook.name });
        toggleBookExpansion(filename);
        await nextTick();
        await eventEmitter.emit('world-info:book-created', newName);
      } catch (error: unknown) {
        toast.error(t('worldInfo.errors.createFailed'));
        console.error('Failed to create lorebook:', error);
      }
    }
  }

  function getNewUid(book: WorldInfoBook): number {
    return book.entries.length > 0 ? Math.max(...book.entries.map((e) => e.uid)) + 1 : 1;
  }

  async function createNewEntry(filename: string) {
    const book = worldInfoCache.value[filename];
    if (!book) return;

    const newUid = getNewUid(book);
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
    saveBookDebounced(book);
    selectItem(`${filename}/${newUid}`);
    await nextTick();
    await eventEmitter.emit('world-info:entry-created', filename, newEntry);
  }

  async function deleteBook(filename: string) {
    const displayName = worldInfoCache.value[filename]?.name || filename;
    const { result } = await popupStore.show({
      title: t('common.confirmDelete'),
      content: t('worldInfo.popup.deleteBookContent', { name: displayName }),
      type: POPUP_TYPE.CONFIRM,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      try {
        await api.deleteWorldInfoBook(filename);
        delete worldInfoCache.value[filename];
        if (selectedItemId.value?.startsWith(`${filename}/`)) {
          selectItem('global-settings');
        }
        delete worldInfoCache.value[filename];
        expandedBooks.value.delete(filename);
        bookInfos.value = bookInfos.value.filter((b) => b.file_id !== filename);
        await nextTick();
        await eventEmitter.emit('world-info:book-deleted', filename);
      } catch (error: unknown) {
        console.error('Failed to delete lorebook:', error);
        toast.error(t('worldInfo.errors.deleteFailed'));
      }
    }
  }

  async function renameBook(filename: string) {
    const book = await getBookFromCache(filename, true);
    if (!book) {
      toast.error(t('worldInfo.errors.bookNotFound', { name: filename }));
      return;
    }
    const { result, value: newName } = await popupStore.show({
      title: t('worldInfo.popup.renameBookTitle'),
      type: POPUP_TYPE.INPUT,
      inputValue: book.name,
    });


    if (result === POPUP_RESULT.AFFIRMATIVE && newName && newName.trim() && newName !== book.name) {
      try {
        book.name = newName;
        await api.saveWorldInfoBook(filename, book);
        const bookInfo = bookInfos.value.find((b) => b.file_id === filename);
        if (bookInfo) {
          bookInfo.name = newName;
        }
        await nextTick();
        await eventEmitter.emit('world-info:book-renamed', filename, newName);
      } catch (error: unknown) {
        console.error('Failed to rename lorebook:', error);
        toast.error(t('worldInfo.errors.renameFailed'));
      }
    }
  }

  async function duplicateBook(name: string) {
    const { result, value: newName } = await popupStore.show({
      title: t('worldInfo.popup.duplicateBookTitle'),
      type: POPUP_TYPE.INPUT,
      inputValue: `${name}${t('worldInfo.popup.duplicateBookInputSuffix')}`,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE && newName && newName.trim()) {
      const book = await getBookFromCache(name, true);
      if (!book) {
        toast.error(t('worldInfo.errors.bookNotFound', { name }));
        return;
      }
      const filename = uuidv4();
      const newBook: WorldInfoBook = {
        ...structuredClone(book),
        name: newName,
      };
      try {
        await api.saveWorldInfoBook(filename, newBook);
        worldInfoCache.value[filename] = newBook;
        bookInfos.value.push({ file_id: filename, name: newName });
        toggleBookExpansion(filename);
        await nextTick();
        await eventEmitter.emit('world-info:book-created', newName);
      } catch (error: unknown) {
        console.error('Failed to duplicate lorebook:', error);
        toast.error(t('worldInfo.errors.duplicateFailed'));
      }
    }
  }

  async function deleteSelectedEntry() {
    if (!selectedEntry.value || !selectedBookForEntry.value) return;
    const book = selectedBookForEntry.value;
    const entry = selectedEntry.value;
    const entryUid = entry.uid;

    const { result } = await popupStore.show({
      title: t('worldInfo.popup.deleteEntryTitle'),
      content: t('worldInfo.popup.deleteEntryContent', { name: entry.comment }),
      type: POPUP_TYPE.CONFIRM,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      const index = book.entries.findIndex((e) => e.uid === entry.uid);
      if (index !== -1) {
        book.entries.splice(index, 1);
        saveBookDebounced(book);
        selectItem('global-settings');
        await nextTick();
        await eventEmitter.emit('world-info:entry-deleted', book.name, entryUid);
      }
    }
  }

  async function duplicateSelectedEntry() {
    if (!selectedEntry.value || !selectedBookForEntry.value || !selectedFilename.value) return;
    const book = selectedBookForEntry.value;
    const entryToCopy = structuredClone(selectedEntry.value);

    const newEntry = {
      ...entryToCopy,
      uid: getNewUid(book),
      comment: `${entryToCopy.comment} (copy)`,
    };
    book.entries.unshift(newEntry);
    saveBookDebounced(book);
    selectItem(`${selectedFilename.value}/${newEntry.uid}`);
  }

  async function importBook(file: File) {
    try {
      const filename = uuidv4();
      const newFile = new File([file], `${filename}.json`, { type: file.type });
      const { name } = await api.importWorldInfoBook(newFile);
      await fetchBook(filename);
      toggleBookExpansion(filename);
      bookInfos.value.push({ file_id: filename, name });
      await nextTick();
      await eventEmitter.emit('world-info:book-imported', name);
    } catch (error: unknown) {
      console.error('Failed to import lorebook:', error);
      toast.error(t('worldInfo.errors.importFailed'));
    }
  }

  async function exportBook(name: string) {
    try {
      const book = await getBookFromCache(name, true);
      if (!book) {
        toast.error(t('worldInfo.errors.bookNotFound', { name }));
        return;
      }
      const content = JSON.stringify(book, null, 2);
      downloadFile(content, `${book.name}.json`, 'application/json');
    } catch (error: unknown) {
      console.error('Failed to export lorebook:', error);
      toast.error(t('worldInfo.errors.exportFailed'));
    }
  }

  return {
    isPanelPinned,
    bookInfos,
    activeBookNames,
    globalBookNames,
    worldInfoCache,
    selectedItemId,
    expandedBooks,
    browserSearchTerm,
    sortOrder,
    loadingBooks,
    selectedEntry,
    selectedBookForEntry,
    filteredAndSortedEntries,
    initialize,
    selectItem,
    toggleBookExpansion,
    updateSelectedEntry,
    createNewBook,
    createNewEntry,
    deleteBook,
    renameBook,
    duplicateBook,
    deleteSelectedEntry,
    duplicateSelectedEntry,
    getBookFromCache,
    fetchBook,
    importBook,
    exportBook,
    saveBookDebounced,
  };
});
