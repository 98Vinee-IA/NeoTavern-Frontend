<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useWorldInfoStore } from '../../stores/world-info.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import WorldInfoEntryEditor from './WorldInfoEntryEditor.vue';
import WorldInfoGlobalSettings from './WorldInfoGlobalSettings.vue';
import type { WorldInfoEntry as WorldInfoEntryType } from '../../types';
import { Button, Select, Search, ListItem, FileInput } from '../UI';
import { SplitPane } from '../Common';

const { t } = useStrictI18n();
const worldInfoStore = useWorldInfoStore();

const isBrowserCollapsed = ref(false);

onMounted(() => {
  if (worldInfoStore.bookInfos.length === 0) {
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
    return worldInfoStore.bookInfos;
  }
  const lowerSearch = worldInfoStore.browserSearchTerm.toLowerCase();
  const books = worldInfoStore.bookInfos.filter((bookInfo) => {
    // Show book if its name matches
    if (bookInfo.name.toLowerCase().includes(lowerSearch)) {
      return true;
    }
    // Or if it has any entries that match
    return worldInfoStore.filteredAndSortedEntries(bookInfo.file_id).length > 0;
  });
  return books;
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
          <Button
            variant="ghost"
            icon="fa-plus"
            :title="t('worldInfo.newWorld')"
            @click="worldInfoStore.createNewBook"
          />
          <FileInput accept=".json" icon="fa-file-import" :label="t('worldInfo.import')" @change="handleFileImport" />
          <Button variant="ghost" icon="fa-sync" :title="t('worldInfo.refresh')" @click="worldInfoStore.initialize" />
        </div>
        <div class="world-info-controls-row">
          <Search v-model="worldInfoStore.browserSearchTerm" :placeholder="t('worldInfo.searchPlaceholder')">
            <template #actions>
              <Select v-model="worldInfoStore.sortOrder" :title="t('worldInfo.sorting.title')" :options="sortOptions" />
            </template>
          </Search>
        </div>
      </div>

      <div class="character-panel-character-list">
        <ListItem
          :active="worldInfoStore.selectedItemId === 'global-settings'"
          @click="worldInfoStore.selectItem('global-settings')"
        >
          <template #start><i class="fa-solid fa-cogs" style="opacity: 0.7"></i></template>
          <template #default>{{ t('worldInfo.globalSettings') }}</template>
        </ListItem>

        <hr class="panel-divider" />

        <div v-for="bookInfo in filteredBookNames" :key="bookInfo.file_id" class="lorebook-group">
          <ListItem class="is-book" @click="worldInfoStore.toggleBookExpansion(bookInfo.file_id)">
            <template #start>
              <i
                class="fa-solid fa-chevron-right browser-item-chevron"
                :class="{ 'is-open': worldInfoStore.expandedBooks.has(bookInfo.file_id) }"
                style="font-size: 0.8em; width: 15px; text-align: center"
              ></i>
            </template>
            <template #default>
              <span class="font-bold">{{ bookInfo.name }}</span>
            </template>
            <template #end>
              <div class="browser-item-actions" @click.stop>
                <Button
                  variant="ghost"
                  icon="fa-plus"
                  :title="t('worldInfo.newEntryInBook', { bookName: bookInfo.name })"
                  @click.stop="worldInfoStore.createNewEntry(bookInfo.file_id)"
                />
                <Button
                  variant="ghost"
                  icon="fa-file-export"
                  :title="t('worldInfo.export')"
                  @click.stop="worldInfoStore.exportBook(bookInfo.file_id)"
                />
                <Button
                  variant="ghost"
                  icon="fa-clone"
                  :title="t('worldInfo.duplicate')"
                  @click.stop="worldInfoStore.duplicateBook(bookInfo.file_id)"
                />
                <Button
                  variant="ghost"
                  icon="fa-pencil"
                  :title="t('worldInfo.rename')"
                  @click.stop="worldInfoStore.renameBook(bookInfo.file_id)"
                />
                <Button
                  variant="danger"
                  icon="fa-trash-can"
                  :title="t('worldInfo.deleteBook', { bookName: bookInfo.name })"
                  @click.stop="worldInfoStore.deleteBook(bookInfo.file_id)"
                />
              </div>
            </template>
          </ListItem>

          <!--
            TODO: v-if is used here instead of v-show for performance.
            TODO: What about pagination for large books?
          -->
          <Transition name="grid-slide">
            <div v-if="worldInfoStore.expandedBooks.has(bookInfo.file_id)" class="lorebook-group-entries">
              <div>
                <div v-if="worldInfoStore.loadingBooks.has(bookInfo.file_id)" class="lorebook-group-loading">
                  <i class="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div v-else>
                  <div v-for="entry in worldInfoStore.filteredAndSortedEntries(bookInfo.file_id)" :key="entry.uid">
                    <ListItem
                      :active="worldInfoStore.selectedItemId === `${bookInfo.file_id}/${entry.uid}`"
                      @click="worldInfoStore.selectItem(`${bookInfo.file_id}/${entry.uid}`)"
                    >
                      <template #default>
                        <span style="font-size: 0.95em">{{ entry.comment || '[Untitled Entry]' }}</span>
                      </template>
                    </ListItem>
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
