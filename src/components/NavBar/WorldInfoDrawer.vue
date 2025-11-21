<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useWorldInfoStore } from '../../stores/world-info.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import WorldInfoEntryEditor from './WorldInfoEntryEditor.vue';
import WorldInfoGlobalSettings from './WorldInfoGlobalSettings.vue';
import type { WorldInfoEntry as WorldInfoEntryType } from '../../types';
import { AppIconButton, AppSelect } from '../UI';
import SplitPane from '../Common/SplitPane.vue';
import AppSearch from '../UI/AppSearch.vue';
import AppListItem from '../UI/AppListItem.vue';
import AppFileInput from '../UI/AppFileInput.vue';

const { t } = useStrictI18n();
const worldInfoStore = useWorldInfoStore();

const isBrowserCollapsed = ref(false);

onMounted(() => {
  if (worldInfoStore.bookNames.length === 0) {
    worldInfoStore.initialize();
  }
});

async function updateEntry(newEntry: WorldInfoEntryType) {
  await worldInfoStore.updateSelectedEntry(newEntry);
}

async function handleFileImport(files: File[]) {
  if (files[0]) {
    await worldInfoStore.importBook(files[0]);
  }
}

const filteredBookNames = computed(() => {
  if (!worldInfoStore.browserSearchTerm) {
    return worldInfoStore.bookNames;
  }
  const lowerSearch = worldInfoStore.browserSearchTerm.toLowerCase();
  return worldInfoStore.bookNames.filter((name) => {
    // Show book if its name matches
    if (name.toLowerCase().includes(lowerSearch)) {
      return true;
    }
    // Or if it has any entries that match
    return worldInfoStore.filteredAndSortedEntries(name).length > 0;
  });
});

const sortOptions = computed(() => [
  { value: 'order:asc', label: t('worldInfo.sorting.orderAsc') },
  { value: 'comment:asc', label: t('worldInfo.sorting.titleAsc') },
  { value: 'comment:desc', label: t('worldInfo.sorting.titleDesc') },
  { value: 'uid:asc', label: t('worldInfo.sorting.uidAsc') },
  { value: 'uid:desc', label: t('worldInfo.sorting.uidDesc') },
]);
</script>

<template>
  <SplitPane
    v-model:collapsed="isBrowserCollapsed"
    storage-key="worldinfoBrowserWidth"
    :initial-width="350"
    class="character-panel world-info-drawer"
  >
    <template #side>
      <div class="character-panel-browser-header world-info-controls">
        <div class="world-info-controls-row" style="margin-bottom: 5px">
          <AppIconButton icon="fa-plus" :title="t('worldInfo.newWorld')" @click="worldInfoStore.createNewBook" />
          <AppFileInput
            accept=".json"
            icon="fa-file-import"
            :label="t('worldInfo.import')"
            @change="handleFileImport"
          />
          <AppIconButton icon="fa-sync" :title="t('worldInfo.refresh')" @click="worldInfoStore.refresh" />
        </div>
        <div class="world-info-controls-row">
          <AppSearch v-model="worldInfoStore.browserSearchTerm" :placeholder="t('worldInfo.searchPlaceholder')">
            <template #actions>
              <AppSelect
                v-model="worldInfoStore.sortOrder"
                :title="t('worldInfo.sorting.title')"
                :options="sortOptions"
              />
            </template>
          </AppSearch>
        </div>
      </div>

      <div class="character-panel-character-list">
        <AppListItem
          :active="worldInfoStore.selectedItemId === 'global-settings'"
          @click="worldInfoStore.selectItem('global-settings')"
        >
          <template #start><i class="fa-solid fa-cogs" style="opacity: 0.7"></i></template>
          <template #default>{{ t('worldInfo.globalSettings') }}</template>
        </AppListItem>

        <hr class="panel-divider" />

        <div v-for="bookName in filteredBookNames" :key="bookName" class="lorebook-group">
          <AppListItem class="is-book" @click="worldInfoStore.toggleBookExpansion(bookName)">
            <template #start>
              <i
                class="fa-solid fa-chevron-right browser-item-chevron"
                :class="{ 'is-open': worldInfoStore.expandedBooks.has(bookName) }"
                style="font-size: 0.8em; width: 15px; text-align: center"
              ></i>
            </template>
            <template #default>
              <span class="font-bold">{{ bookName }}</span>
            </template>
            <template #end>
              <div class="browser-item-actions" @click.stop>
                <AppIconButton
                  icon="fa-plus"
                  :title="t('worldInfo.newEntryInBook', { bookName })"
                  @click.stop="worldInfoStore.createNewEntry(bookName)"
                />
                <AppIconButton
                  icon="fa-file-export"
                  :title="t('worldInfo.export')"
                  @click.stop="worldInfoStore.exportBook(bookName)"
                />
                <AppIconButton
                  icon="fa-clone"
                  :title="t('worldInfo.duplicate')"
                  @click.stop="worldInfoStore.duplicateBook(bookName)"
                />
                <AppIconButton
                  icon="fa-pencil"
                  :title="t('worldInfo.rename')"
                  @click.stop="worldInfoStore.renameBook(bookName)"
                />
                <AppIconButton
                  icon="fa-trash-can"
                  :title="t('worldInfo.deleteBook', { bookName })"
                  @click.stop="worldInfoStore.deleteBook(bookName)"
                />
              </div>
            </template>
          </AppListItem>

          <!--
            TODO: v-if is used here instead of v-show for performance.
            TODO: What about pagination for large books?
          -->
          <Transition name="grid-slide">
            <div v-if="worldInfoStore.expandedBooks.has(bookName)" class="lorebook-group-entries">
              <div>
                <div v-if="worldInfoStore.loadingBooks.has(bookName)" class="lorebook-group-loading">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div v-else>
                  <div v-for="entry in worldInfoStore.filteredAndSortedEntries(bookName)" :key="entry.uid">
                    <AppListItem
                      :active="worldInfoStore.selectedItemId === `${bookName}/${entry.uid}`"
                      @click="worldInfoStore.selectItem(`${bookName}/${entry.uid}`)"
                    >
                      <template #default>
                        <span style="font-size: 0.95em">{{ entry.comment || '[Untitled Entry]' }}</span>
                      </template>
                    </AppListItem>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </template>

    <template #main>
      <div class="character-panel-editor">
        <WorldInfoGlobalSettings v-show="worldInfoStore.selectedItemId === 'global-settings'" />
        <WorldInfoEntryEditor
          v-show="worldInfoStore.selectedEntry"
          :model-value="worldInfoStore.selectedEntry ?? undefined"
          @update:model-value="updateEntry"
        />
      </div>
    </template>
  </SplitPane>
</template>

<style scoped>
.font-bold {
  font-weight: bold;
}
</style>
