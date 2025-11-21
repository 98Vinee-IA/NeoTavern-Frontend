<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useCharacterStore } from '../../stores/character.store';
import CharacterEditForm from './CharacterEditForm.vue';
import Pagination from '../Common/Pagination.vue';
import { getThumbnailUrl } from '../../utils/image';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useSettingsStore } from '../../stores/settings.store';
import { AppIconButton, AppButton, AppSelect } from '../UI';
import AppSearch from '../UI/AppSearch.vue';
import AppFileInput from '../UI/AppFileInput.vue';
import AppListItem from '../UI/AppListItem.vue';
import SplitPane from '../Common/SplitPane.vue';
import EmptyState from '../Common/EmptyState.vue';

const { t } = useStrictI18n();

const characterStore = useCharacterStore();
const settingsStore = useSettingsStore();

const isSearchActive = ref(false);
const characterListEl = ref<HTMLElement | null>(null);
const highlightedItemRef = ref<HTMLElement | null>(null);

// Watch for a character being highlighted by the store
watch(
  () => characterStore.highlightedAvatar,
  (avatar) => {
    if (avatar && highlightedItemRef.value) {
      highlightedItemRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  { flush: 'post' },
);

function createNew() {
  characterStore.startCreating();
}

async function handleFileImport(files: File[]) {
  const importedAvatars: string[] = [];

  for (const file of files) {
    try {
      const avatarFileName = await characterStore.importCharacter(file);
      if (avatarFileName) {
        importedAvatars.push(avatarFileName);
      }
    } catch {
      // Toast is handled in the store action
    }
  }

  if (importedAvatars.length > 0) {
    await characterStore.refreshCharacters();
    await characterStore.importTagsForCharacters(importedAvatars);
    const lastAvatar = importedAvatars[importedAvatars.length - 1];
    characterStore.highlightCharacter(lastAvatar);
  }
}

const sortOptions = [
  { value: 'name:asc', label: t('characterPanel.sorting.nameAsc') },
  { value: 'name:desc', label: t('characterPanel.sorting.nameDesc') },
  { value: 'create_date:desc', label: t('characterPanel.sorting.newest') },
  { value: 'create_date:asc', label: t('characterPanel.sorting.oldest') },
  { value: 'fav:desc', label: t('characterPanel.sorting.favorites') },
];

onMounted(() => {
  characterStore.refreshCharacters();
});
</script>

<template>
  <SplitPane
    v-model:collapsed="settingsStore.settings.account.characterBrowserExpanded"
    storage-key="characterBrowserWidth"
    class="character-panel"
  >
    <template #side>
      <div class="character-panel-browser-header">
        <div class="character-panel-actions">
          <AppIconButton icon="fa-user-plus" :title="t('characterPanel.createNew')" @click="createNew" />
          <AppFileInput
            accept=".json,.png"
            multiple
            icon="fa-file-import"
            :label="t('characterPanel.importFile')"
            @change="handleFileImport"
          />
          <AppIconButton icon="fa-cloud-arrow-down" :title="t('characterPanel.importUrl')" />
          <AppIconButton icon="fa-users-gear" :title="t('characterPanel.createGroup')" />

          <div id="extension-buttons-container"></div>

          <AppIconButton
            icon="fa-search"
            :title="t('characterPanel.searchToggle')"
            @click="isSearchActive = !isSearchActive"
          />
        </div>

        <div v-show="isSearchActive" style="margin-top: 5px">
          <AppSearch v-model="characterStore.searchTerm" :placeholder="t('characterPanel.searchPlaceholder')">
            <template #actions>
              <div style="min-width: 140px">
                <AppSelect
                  v-model="characterStore.sortOrder"
                  :options="sortOptions"
                  :title="t('characterPanel.sorting.title')"
                />
              </div>
            </template>
          </AppSearch>
        </div>
      </div>

      <div class="character-panel-pagination">
        <Pagination
          v-if="characterStore.displayableCharacters.length > 0"
          v-model:current-page="characterStore.currentPage"
          v-model:items-per-page="characterStore.itemsPerPage"
          :total-items="characterStore.displayableCharacters.length"
          :items-per-page-options="[10, 25, 50, 100]"
        />
      </div>

      <div id="character-list" ref="characterListEl" class="character-panel-character-list">
        <div v-if="characterStore.paginatedCharacters.length === 0" style="padding: 10px; opacity: 0.7">
          {{ t('common.loading') }}
        </div>
        <template v-for="character in characterStore.paginatedCharacters" :key="character.id">
          <AppListItem
            :ref="
              (el: any) => {
                if (character.avatar === characterStore.highlightedAvatar) highlightedItemRef = el?.$el;
              }
            "
            :active="characterStore.editFormCharacter?.avatar === character.avatar"
            :class="{ 'flash animated': character.avatar === characterStore.highlightedAvatar }"
            :data-character-avatar="character.avatar"
            @click="characterStore.selectCharacterByAvatar(character.avatar)"
          >
            <template #start>
              <img :src="getThumbnailUrl('avatar', character.avatar)" :alt="`${character.name} Avatar`" />
            </template>

            <template #default>
              <div style="display: flex; align-items: center; gap: 5px">
                <span class="font-bold">{{ character.name }}</span>
                <i
                  v-if="character.fav"
                  class="fa-solid fa-star"
                  style="color: var(--color-golden); font-size: 0.8em"
                ></i>
              </div>
              <div
                style="font-size: 0.8em; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
              >
                {{ character.description || '&nbsp;' }}
              </div>
            </template>
          </AppListItem>
        </template>
      </div>
    </template>

    <template #main>
      <div class="character-panel-editor">
        <EmptyState
          v-show="!characterStore.editFormCharacter"
          icon="fa-user-pen"
          :title="t('characterPanel.editor.placeholderTitle')"
          :description="t('characterPanel.editor.placeholderText')"
        >
          <AppButton icon="fa-user-plus" @click="createNew">
            {{ t('characterPanel.editor.placeholderButton') }}
          </AppButton>
        </EmptyState>

        <CharacterEditForm v-show="characterStore.editFormCharacter" />
      </div>
    </template>
  </SplitPane>
</template>

<style scoped>
.font-bold {
  font-weight: bold;
}
</style>
