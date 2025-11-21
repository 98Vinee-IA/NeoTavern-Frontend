<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { usePersonaStore } from '../../stores/persona.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { getThumbnailUrl } from '../../utils/image';
import Pagination from '../Common/Pagination.vue';
import { usePopupStore } from '../../stores/popup.store';
import { POPUP_RESULT, POPUP_TYPE } from '../../types';
import { AppButton, AppIconButton, AppSelect, AppCheckbox, AppTextarea } from '../UI';
import AppSearch from '../UI/AppSearch.vue';
import AppListItem from '../UI/AppListItem.vue';
import AppFileInput from '../UI/AppFileInput.vue';
import AppFormItem from '../UI/AppFormItem.vue';

const { t } = useStrictI18n();
const personaStore = usePersonaStore();
const settingsStore = useSettingsStore();
const popupStore = usePopupStore();

const searchTerm = ref('');
const sortOrder = ref('asc');
const currentPage = ref(1);
const itemsPerPage = ref(10);
const isGridView = ref(false);

const sortOptions = [
  { label: 'A-Z', value: 'asc' },
  { label: 'Z-A', value: 'desc' },
];

const filteredPersonas = computed(() => {
  let personas = [...personaStore.personas];
  if (searchTerm.value) {
    const lowerSearch = searchTerm.value.toLowerCase();
    personas = personas.filter(
      (p) => p.name.toLowerCase().includes(lowerSearch) || p.description.toLowerCase().includes(lowerSearch),
    );
  }
  personas.sort((a, b) => {
    if (sortOrder.value === 'asc') return a.name.localeCompare(b.name);
    return b.name.localeCompare(a.name);
  });
  return personas;
});

const paginatedPersonas = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredPersonas.value.slice(start, end);
});

function handleFileImport(files: File[]) {
  console.log('Restore from backup clicked', files);
}

async function handleDelete() {
  if (personaStore.activePersonaId) {
    const { result } = await popupStore.show({
      title: t('personaManagement.delete.confirmTitle'),
      content: t('personaManagement.delete.confirmMessage', { name: personaStore.activePersona?.name ?? '' }),
      type: POPUP_TYPE.CONFIRM,
    });
    if (result === POPUP_RESULT.AFFIRMATIVE) {
      personaStore.deletePersona(personaStore.activePersonaId);
    }
  }
}

async function handleAvatarChange(files: File[]) {
  if (files[0]) {
    await personaStore.uploadPersonaAvatar(personaStore.activePersonaId, files[0]);
  }
}

onMounted(() => {
  if (personaStore.personas.length === 0) {
    personaStore.initialize();
  }
});
</script>

<template>
  <div class="persona-drawer">
    <div class="persona-drawer-header">
      <h3>
        <span>{{ t('personaManagement.title') }}</span>
        <a href="https://docs.sillytavern.app/usage/core-concepts/personas/" target="_blank">
          <span class="fa-solid fa-circle-question note-link-span"></span>
        </a>
      </h3>
      <div class="persona-drawer-header-actions">
        <AppButton icon="fa-ranking-star">{{ t('personaManagement.usageStats') }}</AppButton>
        <AppButton icon="fa-file-export">{{ t('personaManagement.backup') }}</AppButton>
        <AppFileInput
          accept=".json"
          icon="fa-file-import"
          type="button"
          :label="t('personaManagement.restore')"
          @change="handleFileImport"
        />
      </div>
    </div>
    <div class="persona-drawer-content">
      <!-- Left Column -->
      <div class="persona-drawer-column--left">
        <div class="persona-drawer-list-controls">
          <AppSearch v-model="searchTerm" :placeholder="t('common.search')">
            <template #actions>
              <AppButton icon="fa-person-circle-question" @click="personaStore.createPersona">
                {{ t('personaManagement.create') }}
              </AppButton>
              <AppSelect v-model="sortOrder" :options="sortOptions" />
              <AppIconButton icon="fa-table-cells-large" @click="isGridView = !isGridView" />
            </template>
          </AppSearch>
        </div>
        <Pagination
          v-if="filteredPersonas.length > 0"
          v-model:current-page="currentPage"
          v-model:items-per-page="itemsPerPage"
          :total-items="filteredPersonas.length"
          :items-per-page-options="[5, 10, 25, 50, 100]"
        />
        <div class="persona-list" :class="{ 'grid-view': isGridView }">
          <div v-for="persona in paginatedPersonas" :key="`${persona.avatarId}-${personaStore.lastAvatarUpdate}`">
            <AppListItem
              :active="persona.avatarId === personaStore.activePersonaId"
              @click="personaStore.setActivePersona(persona.avatarId)"
            >
              <template #start>
                <img
                  :src="getThumbnailUrl('persona', persona.avatarId)"
                  alt="Persona Avatar"
                  class="persona-item-avatar"
                />
              </template>
              <template #default>
                <div class="font-bold" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                  {{ persona.name }}
                </div>
                <div
                  style="font-size: 0.9em; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
                >
                  {{ persona.description || t('personaManagement.noDescription') }}
                </div>
              </template>
            </AppListItem>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="persona-drawer-column--right">
        <div v-show="personaStore.activePersona" class="persona-editor">
          <h4 class="standoutHeader">{{ t('personaManagement.currentPersona') }}</h4>
          <div class="persona-editor-controls">
            <h5 class="persona-editor-name">{{ personaStore.activePersona?.name ?? '' }}</h5>
            <div class="buttons_block">
              <AppIconButton
                icon="fa-pencil"
                :title="t('personaManagement.actions.rename')"
                @click="personaStore.updateActivePersonaName"
              />
              <AppIconButton icon="fa-sync" :title="t('personaManagement.actions.syncName')" />
              <AppIconButton icon="fa-globe" :title="t('personaManagement.actions.lore')" />

              <AppFileInput
                accept="image/*"
                icon="fa-image"
                :label="t('personaManagement.actions.changeImage')"
                @change="handleAvatarChange"
              />

              <AppIconButton icon="fa-clone" :title="t('personaManagement.actions.duplicate')" />
              <AppIconButton
                variant="danger"
                icon="fa-skull"
                :title="t('personaManagement.actions.delete')"
                @click="handleDelete"
              />
            </div>
          </div>

          <AppFormItem :label="t('personaManagement.description.label')">
            <AppTextarea
              :model-value="personaStore.activePersona?.description ?? ''"
              :rows="6"
              :placeholder="t('personaManagement.description.placeholder')"
              @update:model-value="personaStore.updateActivePersonaField('description', $event)"
            />
          </AppFormItem>
          <!-- TODO: Add token counter -->

          <h4 class="standoutHeader">{{ t('personaManagement.connections.title') }}</h4>
          <div class="persona-editor-connections">
            <AppButton icon="fa-crown">{{ t('personaManagement.connections.default') }}</AppButton>
            <AppButton icon="fa-unlock">{{ t('personaManagement.connections.character') }}</AppButton>
            <AppButton icon="fa-unlock">{{ t('personaManagement.connections.chat') }}</AppButton>
          </div>
          <!-- TODO: Connections List -->

          <h4 class="standoutHeader">{{ t('personaManagement.globalSettings.title') }}</h4>
          <div class="persona-editor-global-settings">
            <AppCheckbox
              v-model="settingsStore.settings.persona.showNotifications"
              :label="t('personaManagement.globalSettings.showNotifications')"
            />
            <AppCheckbox
              v-model="settingsStore.settings.persona.allowMultiConnections"
              :label="t('personaManagement.globalSettings.allowMultiConnections')"
            />
            <AppCheckbox
              v-model="settingsStore.settings.persona.autoLock"
              :label="t('personaManagement.globalSettings.autoLock')"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-bold {
  font-weight: bold;
}
</style>
