<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useExtensionStore } from '../../stores/extension.store';
import { useStrictI18n } from '../../composables/useStrictI18n';
import { AppIconButton, AppToggle } from '../UI';
import AppSearch from '../UI/AppSearch.vue';
import AppListItem from '../UI/AppListItem.vue';
import SplitPane from '../Common/SplitPane.vue';
import EmptyState from '../Common/EmptyState.vue';

const { t } = useStrictI18n();
const extensionStore = useExtensionStore();

const isBrowserCollapsed = ref(false); // TODO: load from account storage
const notifyOnUpdates = ref(false); // TODO: Connect this to settings

function manageExtensions() {
  // TODO: Open manage extensions popup
  alert(t('extensions.managePopupNotImplemented'));
}

function installExtension() {
  // TODO: Open install extension popup
  alert(t('extensions.installPopupNotImplemented'));
}

onMounted(() => {
  if (Object.keys(extensionStore.extensions).length === 0) {
    extensionStore.initializeExtensions();
  }
});
</script>

<template>
  <SplitPane
    v-model:collapsed="isBrowserCollapsed"
    storage-key="extensionsBrowserWidth"
    :initial-width="250"
    class="extensions-panel"
  >
    <template #side>
      <div class="extensions-panel-browser-header">
        <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 5px">
          <AppIconButton icon="fa-cubes" :title="t('extensions.manage')" @click="manageExtensions" />
          <AppIconButton icon="fa-cloud-arrow-down" :title="t('extensions.install')" @click="installExtension" />
          <AppToggle v-model="notifyOnUpdates" :title="t('extensions.notifyUpdates')" style="margin-left: auto" />
        </div>
        <AppSearch v-model="extensionStore.searchTerm" :placeholder="t('common.search')" />
      </div>

      <div class="extensions-panel-list">
        <div v-for="extension in extensionStore.filteredExtensions" :key="extension.id">
          <AppListItem
            :active="extensionStore.selectedExtensionId === extension.id"
            :data-extension-id="extension.id"
            @click="extensionStore.selectExtension(extension.id)"
          >
            <template #start>
              <i class="fa-solid fa-puzzle-piece" style="opacity: 0.7"></i>
            </template>
            <template #default>
              <div class="font-bold">{{ extension.manifest.display_name || extension.id }}</div>
              <div v-if="extension.manifest.author" style="font-size: 0.8em; opacity: 0.7">
                {{ t('common.by') }} {{ extension.manifest.author }}
              </div>
            </template>
            <template #end>
              <div @click.stop>
                <AppToggle
                  :model-value="extension.isActive"
                  @update:model-value="(val) => extensionStore.toggleExtension(extension.id, val)"
                />
              </div>
            </template>
          </AppListItem>
        </div>
      </div>
    </template>

    <template #main>
      <div class="extensions-panel-editor">
        <EmptyState
          v-show="!extensionStore.selectedExtension"
          icon="fa-puzzle-piece"
          :title="t('extensions.placeholder.title')"
          :description="t('extensions.placeholder.text')"
        />

        <template v-for="extension in Object.values(extensionStore.extensions)" :key="extension.id">
          <div v-show="extensionStore.selectedExtensionId === extension.id">
            <div class="extension-content">
              <div class="extension-content-header">
                <h3>
                  <span>{{ extension.manifest.display_name || extension.id }}</span>
                  <span v-if="extension.manifest.version" class="version">v{{ extension.manifest.version }}</span>
                </h3>
              </div>
              <p v-if="extension.manifest.description" class="extension-content-description">
                {{ extension.manifest.description }}
              </p>

              <!-- This is the container where the extension will mount its UI -->
              <div :id="extension.containerId"></div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </SplitPane>
</template>

<style scoped>
.font-bold {
  font-weight: bold;
}
</style>
