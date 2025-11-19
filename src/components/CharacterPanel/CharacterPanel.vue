<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useCharacterStore } from '../../stores/character.store';
import type { Character } from '../../types';
import CharacterEditForm from './CharacterEditForm.vue';
import Pagination from '../Common/Pagination.vue';
import { getThumbnailUrl } from '../../utils/image';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { useResizable } from '../../composables/useResizable';
import { useSettingsStore } from '../../stores/settings.store';

const { t } = useStrictI18n();

const characterStore = useCharacterStore();
const settingsStore = useSettingsStore();

const isSearchActive = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const characterListEl = ref<HTMLElement | null>(null);
const highlightedItemRef = ref<HTMLElement | null>(null);

// --- Collapsible & Resizable State ---
const BROWSER_COLLAPSED_KEY = 'character_browser_collapsed';
const BROWSER_WIDTH_KEY = 'character_browser_width';

const isBrowserCollapsed = ref(settingsStore.getAccountItem(BROWSER_COLLAPSED_KEY) === 'true');
const browserPane = ref<HTMLElement | null>(null);
const dividerEl = ref<HTMLElement | null>(null);

useResizable(browserPane, dividerEl, { storageKey: BROWSER_WIDTH_KEY });

watch(isBrowserCollapsed, (newValue) => {
  settingsStore.setAccountItem(BROWSER_COLLAPSED_KEY, String(newValue));
});

// Watch for a character being highlighted by the store
watch(
  () => characterStore.highlightedAvatar,
  (avatar) => {
    if (avatar && highlightedItemRef.value) {
      highlightedItemRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },
  { flush: 'post' }, // Wait for the DOM to update
);

const activeCharacter = computed(() => characterStore.activeCharacter);

function createNew() {
  characterStore.startCreating();
}

function triggerImport() {
  fileInput.value?.click();
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const files = Array.from(target.files);
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

  if (target) {
    target.value = '';
  }
}

onMounted(() => {
  characterStore.refreshCharacters();
});
</script>

<template>
  <div class="character-panel" :class="{ 'is-collapsed': isBrowserCollapsed }">
    <!-- Left Pane: Character Browser -->
    <div ref="browserPane" class="character-panel-browser">
      <div class="character-panel-browser-header">
        <div class="character-panel-actions">
          <div
            :title="t('characterPanel.createNew')"
            class="menu-button fa-solid fa-user-plus"
            @click="createNew"
          ></div>
          <div
            :title="t('characterPanel.importFile')"
            class="menu-button fa-solid fa-file-import"
            @click="triggerImport"
          ></div>
          <input ref="fileInput" type="file" accept=".json,.png" multiple hidden @change="handleFileImport" />
          <div :title="t('characterPanel.importUrl')" class="menu-button fa-solid fa-cloud-arrow-down"></div>
          <div :title="t('characterPanel.createGroup')" class="menu-button fa-solid fa-users-gear"></div>
          <div id="extension-buttons-container"></div>
          <div
            class="menu-button-icon fa-fw fa-solid fa-search character-search-toggle"
            :title="t('characterPanel.searchToggle')"
            @click="isSearchActive = !isSearchActive"
          ></div>
        </div>
        <div v-show="isSearchActive" id="character-search-form" class="character-panel-search-form">
          <input
            v-model="characterStore.searchTerm"
            class="text-pole character-panel-search-input"
            type="search"
            :placeholder="t('characterPanel.searchPlaceholder')"
          />
          <select
            v-model="characterStore.sortOrder"
            class="text-pole character-sort-order"
            :title="t('characterPanel.sorting.title')"
          >
            <option value="name:asc">{{ t('characterPanel.sorting.nameAsc') }}</option>
            <option value="name:desc">{{ t('characterPanel.sorting.nameDesc') }}</option>
            <option value="create_date:desc">{{ t('characterPanel.sorting.newest') }}</option>
            <option value="create_date:asc">{{ t('characterPanel.sorting.oldest') }}</option>
            <option value="fav:desc">{{ t('characterPanel.sorting.favorites') }}</option>
          </select>
        </div>
      </div>

      <div class="character-panel-pagination">
        <Pagination
          v-if="characterStore.displayableEntities.length > 0"
          v-model:current-page="characterStore.currentPage"
          v-model:items-per-page="characterStore.itemsPerPage"
          :total-items="characterStore.displayableEntities.length"
          :items-per-page-options="[10, 25, 50, 100]"
        />
      </div>

      <div id="character-list" ref="characterListEl" class="character-panel-character-list">
        <div v-if="characterStore.paginatedEntities.length === 0">{{ t('common.loading') }}</div>
        <template v-for="entity in characterStore.paginatedEntities" :key="entity.id">
          <div
            v-if="entity.type === 'character'"
            :ref="
              (el) => {
                if ((entity.item as Character).avatar === characterStore.highlightedAvatar) {
                  highlightedItemRef = el as HTMLElement;
                }
              }
            "
            class="character-item"
            :class="{
              'is-active': activeCharacter?.avatar === (entity.item as Character).avatar,
              'flash animated': (entity.item as Character).avatar === characterStore.highlightedAvatar,
            }"
            tabindex="0"
            :data-character-avatar="(entity.item as Character).avatar"
            @click="characterStore.selectCharacterById(entity.id as number)"
          >
            <div class="character-item-avatar">
              <img
                :src="getThumbnailUrl('avatar', (entity.item as Character).avatar)"
                :alt="`${(entity.item as Character).name} Avatar`"
              />
            </div>
            <div class="character-item-content">
              <div class="character-item-header">
                <span class="character-item-name">{{ (entity.item as Character).name }}</span>
                <i v-if="(entity.item as Character).fav" class="character-item-fav-icon fa-solid fa-star"></i>
              </div>
              <div class="character-item-description">{{ (entity.item as Character).description || '&nbsp;' }}</div>
            </div>
          </div>
          <!-- TODO: Group rendering logic -->
        </template>
      </div>
    </div>

    <!-- Divider -->
    <div ref="dividerEl" class="character-panel-divider">
      <div
        class="character-panel-collapse-toggle"
        :title="isBrowserCollapsed ? t('characterPanel.expandBrowser') : t('characterPanel.collapseBrowser')"
        @click="isBrowserCollapsed = !isBrowserCollapsed"
      >
        <i class="fa-solid" :class="isBrowserCollapsed ? 'fa-angles-right' : 'fa-angles-left'"></i>
      </div>
    </div>

    <!-- Right Pane: Character Editor -->
    <div class="character-panel-editor">
      <div v-show="!activeCharacter" class="character-panel-editor-placeholder">
        <div class="placeholder-icon fa-solid fa-user-pen"></div>
        <h2 class="placeholder-title">{{ t('characterPanel.editor.placeholderTitle') }}</h2>
        <p class="placeholder-text">{{ t('characterPanel.editor.placeholderText') }}</p>
        <div class="menu-button" @click="createNew">
          <i class="fa-solid fa-user-plus"></i>&nbsp;
          <span>{{ t('characterPanel.editor.placeholderButton') }}</span>
        </div>
      </div>
      <CharacterEditForm v-show="activeCharacter" />
    </div>
  </div>
</template>
