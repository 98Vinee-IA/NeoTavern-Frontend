<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useWorldInfoStore } from '../../stores/world-info.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useResizable } from '../../composables/useResizable';
import { slideTransitionHooks } from '../../utils/dom';
import WorldInfoEntryEditor from './WorldInfoEntryEditor.vue';
import WorldInfoGlobalSettings from './WorldInfoGlobalSettings.vue';
import type { WorldInfoEntry as WorldInfoEntryType } from '../../types';

const { t } = useStrictI18n();
const worldInfoStore = useWorldInfoStore();
const { beforeEnter, enter, leave } = slideTransitionHooks;

const browserPane = ref<HTMLElement | null>(null);
const dividerEl = ref<HTMLElement | null>(null);
const isBrowserCollapsed = ref(false);

useResizable(browserPane, dividerEl, { storageKey: 'worldinfo_browser_width', initialWidth: 350 });

onMounted(() => {
  if (worldInfoStore.bookNames.length === 0) {
    worldInfoStore.initialize();
  }
});

function updateEntry(newEntry: WorldInfoEntryType) {
  worldInfoStore.updateSelectedEntry(newEntry);
}

const filteredBookNames = computed(() => {
  if (!worldInfoStore.browserSearchTerm) {
    return worldInfoStore.bookNames;
  }
  const lowerSearch = worldInfoStore.browserSearchTerm.toLowerCase();
  return worldInfoStore.bookNames.filter((name) => {
    const book = worldInfoStore.getBookFromCache(name);
    if (name.toLowerCase().includes(lowerSearch)) {
      return true;
    }
    if (book) {
      return book.entries.some(
        (entry) =>
          entry.comment.toLowerCase().includes(lowerSearch) || entry.key.join(',').toLowerCase().includes(lowerSearch),
      );
    }
    return false;
  });
});
</script>

<template>
  <div class="character-panel" :class="{ 'is-collapsed': isBrowserCollapsed }">
    <!-- Left Pane: Lorebook Browser -->
    <div ref="browserPane" class="character-panel__browser">
      <div class="character-panel__browser-header">
        <div class="u-flex u-items-center">
          <div
            @click="worldInfoStore.createNewBook"
            class="menu-button fa-solid fa-plus"
            :title="t('worldInfo.newWorld')"
          ></div>
          <input
            class="text-pole u-w-full"
            type="search"
            :placeholder="t('worldInfo.searchPlaceholder')"
            v-model="worldInfoStore.browserSearchTerm"
          />
        </div>
      </div>

      <div class="character-panel__character-list">
        <div
          class="browser-item"
          :class="{ 'is-active': worldInfoStore.selectedItemId === 'global-settings' }"
          @click="worldInfoStore.selectItem('global-settings')"
        >
          <div class="browser-item__content">
            <i class="fa-solid fa-cogs browser-item__icon"></i>
            <span class="browser-item__name">{{ t('worldInfo.globalSettings') }}</span>
          </div>
        </div>

        <hr class="panel-divider" />

        <div v-for="bookName in filteredBookNames" :key="bookName" class="lorebook-group">
          <div class="browser-item is-book" @click="worldInfoStore.toggleBookExpansion(bookName)">
            <div class="browser-item__content">
              <i
                class="fa-solid fa-chevron-right browser-item__chevron"
                :class="{ 'is-open': worldInfoStore.expandedBooks.has(bookName) }"
              ></i>
              <span class="browser-item__name">{{ bookName }}</span>
            </div>
            <div class="browser-item__actions">
              <i
                class="fa-solid fa-plus"
                :title="t('worldInfo.newEntryInBook', { bookName })"
                @click.stop="worldInfoStore.createNewEntry(bookName)"
              ></i>
              <i
                class="fa-solid fa-trash-can"
                :title="t('worldInfo.deleteBook', { bookName })"
                @click.stop="worldInfoStore.deleteBook(bookName)"
              ></i>
            </div>
          </div>

          <Transition name="slide-js" @before-enter="beforeEnter" @enter="enter" @leave="leave">
            <div v-if="worldInfoStore.expandedBooks.has(bookName)" class="lorebook-group__entries">
              <div
                v-for="(entry, index) in worldInfoStore.getBookFromCache(bookName)?.entries"
                :key="`${entry.uid}-${index}`"
                class="browser-item is-entry"
                :class="{ 'is-active': worldInfoStore.selectedItemId === `${bookName}/${entry.uid}` }"
                @click="worldInfoStore.selectItem(`${bookName}/${entry.uid}`)"
              >
                <div class="browser-item__content">
                  <span class="browser-item__name">{{ entry.comment || '[Untitled Entry]' }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div ref="dividerEl" class="character-panel__divider">
      <div class="character-panel__collapse-toggle" @click="isBrowserCollapsed = !isBrowserCollapsed">
        <i class="fa-solid" :class="isBrowserCollapsed ? 'fa-angles-right' : 'fa-angles-left'"></i>
      </div>
    </div>

    <!-- Right Pane: Editor -->
    <div class="character-panel__editor">
      <WorldInfoGlobalSettings v-if="worldInfoStore.selectedItemId === 'global-settings'" />
      <WorldInfoEntryEditor
        v-else-if="worldInfoStore.selectedEntry"
        :model-value="worldInfoStore.selectedEntry"
        @update:model-value="updateEntry"
      />
      <div v-else class="character-panel__editor-placeholder">
        <div class="placeholder-icon fa-solid fa-book-atlas"></div>
        <h2 class="placeholder-title">{{ t('worldInfo.selectEntryPlaceholderTitle') }}</h2>
        <p class="placeholder-text">{{ t('worldInfo.selectEntryPlaceholderText') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-divider {
  border: none;
  border-top: 1px solid var(--theme-border-color);
  margin: 5px 0;
}

.browser-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 5px;
  margin-bottom: 1px;
  gap: 10px;
}

.browser-item:hover,
.browser-item.is-active {
  background-color: var(--white-20a);
}

.browser-item.is-active {
  outline: 1px solid var(--theme-quote-color);
}

.browser-item__content {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.browser-item__icon {
  flex-shrink: 0;
}

.browser-item__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browser-item__chevron {
  transition: transform var(--animation-duration-2x);
}

.browser-item__chevron.is-open {
  transform: rotate(90deg);
}

.browser-item.is-book {
  font-weight: bold;
}

.browser-item.is-entry {
  padding-left: 24px;
  font-weight: normal;
  font-size: 0.95em;
}

.browser-item__actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity var(--animation-duration-2x);
}

.browser-item__actions i:hover {
  color: var(--color-warning);
}

.browser-item:hover .browser-item__actions {
  opacity: 0.7;
}

.lorebook-group__entries {
  padding-left: 10px;
  border-left: 1px solid var(--black-50a);
  margin-left: 12px;
}
</style>
