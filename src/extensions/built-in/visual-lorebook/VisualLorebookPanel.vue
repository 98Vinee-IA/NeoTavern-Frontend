<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { debounce } from 'lodash-es';
import { Button, FormItem, Input, Search, Select } from '../../../components/UI';
import { useWorldInfoUiStore } from '../../../stores/world-info-ui.store';
import { useWorldInfoStore } from '../../../stores/world-info.store';
import type { ExtensionAPI } from '../../../types';
import {
  deleteMedia,
  fetchMediaMetadata as fetchMediaMetadataFromApi,
  getMediaUrl,
  removeMediaMetadata,
  updateMediaMetadata,
  uploadMedia,
} from './api';
import type { VisualLorebookFile, VisualLorebookMediaData, VisualLorebookSettings } from './types';

const props = defineProps<{
  api: ExtensionAPI<VisualLorebookSettings>;
}>();

const t = props.api.i18n.t;
const worldInfoUiStore = useWorldInfoUiStore();
const worldInfoStore = useWorldInfoStore();

const selectedLorebook = ref<string>('');
const selectedEntryUid = ref<number>(0);
const selectedEntryForUpload = ref<number>(0);
const mediaInputRef = ref<HTMLInputElement | null>(null);
const isUploadingMedia = ref(false);
const searchQuery = ref('');
const mediaMetadata = ref<VisualLorebookFile | null>(null);

// Visual keyword state
const visualKeywordForUpload = ref<string>('');
const visualKeywordForEdit = ref<string>('');
const isSavingKeyword = ref(false);

// Get all available lorebooks (use bookInfos for the list, not worldInfoCache)
// Use file_id (filename) as the value since worldInfoCache is keyed by filename
const lorebooks = computed(() => {
  return worldInfoStore.bookInfos.map((info) => ({ label: info.name, value: info.file_id }));
});

// Fetch media metadata for selected lorebook
async function loadMediaMetadata() {
  if (!selectedLorebook.value) {
    mediaMetadata.value = null;
    return;
  }

  try {
    // First, ensure the lorebook is loaded in the cache
    await worldInfoStore.getBookFromCache(selectedLorebook.value, true);

    const metadata = await fetchMediaMetadataFromApi(selectedLorebook.value);
    if (metadata) {
      mediaMetadata.value = metadata;
    } else {
      // No media file exists yet
      mediaMetadata.value = { name: selectedLorebook.value, entries: {} };
    }
  } catch (error) {
    console.error('Failed to fetch media metadata:', error);
    mediaMetadata.value = { name: selectedLorebook.value, entries: {} };
  }
}

// Get entries for selected lorebook (only entries with media)
const entriesWithMedia = computed(() => {
  if (!selectedLorebook.value || !mediaMetadata.value) return [];

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return [];

  // Filter to only show entries that have media
  let entries = book.entries.filter((entry) => mediaMetadata.value!.entries[entry.uid]);

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    entries = entries.filter(
      (entry) =>
        entry.key.some((k) => k.toLowerCase().includes(query)) ||
        entry.comment.toLowerCase().includes(query) ||
        entry.uid.toString().includes(query),
    );
  }

  // Sort by UID descending (newest first)
  entries.sort((a, b) => b.uid - a.uid);
  return entries;
});

// Get entries for selected lorebook (only entries without media)
const entriesWithoutMedia = computed(() => {
  if (!selectedLorebook.value || !mediaMetadata.value) return [];

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return [];

  // Filter to only show entries that DO NOT have media
  let entries = book.entries.filter((entry) => !mediaMetadata.value!.entries[entry.uid]);

  // Sort by UID descending (newest first)
  entries.sort((a, b) => b.uid - a.uid);
  return entries;
});

// Get selected entry (from grid - has media)
const selectedEntry = computed(() => {
  if (!selectedLorebook.value || selectedEntryUid.value === 0) return null;

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return null;

  return book.entries.find((e) => e.uid === selectedEntryUid.value) || null;
});

// Get media data for selected entry
const mediaData = computed((): VisualLorebookMediaData | null => {
  if (selectedEntryUid.value === 0 || !mediaMetadata.value) return null;
  return mediaMetadata.value.entries[selectedEntryUid.value] || null;
});

// Get media URL
const mediaUrl = computed(() => {
  return getMediaUrl(mediaData.value?.mediaId || '');
});

const isImage = computed(() => mediaData.value?.mediaType === 'image');
const isVideo = computed(() => mediaData.value?.mediaType === 'video');

// Helper function to get media URL for an entry
function getEntryMediaUrl(entryUid: number): string {
  if (!mediaMetadata.value || !mediaMetadata.value.entries[entryUid]) {
    return '';
  }
  return getMediaUrl(mediaMetadata.value.entries[entryUid].mediaId);
}

// Debounced autosave for visual keyword edits
const debouncedSaveVisualKeyword = debounce(async () => {
  if (!selectedLorebook.value || selectedEntryUid.value === 0 || !mediaData.value) return;

  const newKeyword = visualKeywordForEdit.value.trim();
  if (newKeyword === (mediaData.value.visualKeyword || '')) return;

  isSavingKeyword.value = true;
  try {
    await updateMediaMetadata(selectedLorebook.value, {
      entryUid: selectedEntryUid.value,
      mediaData: {
        ...mediaData.value,
        visualKeyword: newKeyword,
      },
    });
    // Update local metadata
    if (mediaMetadata.value) {
      mediaMetadata.value.entries[selectedEntryUid.value] = {
        ...mediaMetadata.value.entries[selectedEntryUid.value],
        visualKeyword: newKeyword,
      };
    }
    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.visualKeywordSaved'), 'success');
  } catch (error) {
    console.error('Failed to save visual keyword:', error);
    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.visualKeywordSaveFailed'), 'error');
  } finally {
    isSavingKeyword.value = false;
  }
}, 500);

// Handler for visual keyword input change
function handleVisualKeywordChange(value: string | number | (string | number)[]) {
  visualKeywordForEdit.value = Array.isArray(value) ? value[0] as string : value as string;
  debouncedSaveVisualKeyword();
}

// Fetch metadata when lorebook changes
watch(selectedLorebook, () => {
  loadMediaMetadata();
});

// Watch for mediaData changes to sync visualKeywordForEdit
watch(mediaData, (newData) => {
  // Update visual keyword when entry's media data changes
  const entryKeyword = newData?.visualKeyword || '';
  visualKeywordForEdit.value = entryKeyword;
});

// Also reload metadata when returning to the same lorebook (e.g., after navigating away and back)
watch(selectedLorebook, (newLorebook, oldLorebook) => {
  if (newLorebook === oldLorebook && newLorebook) {
    // User returned to the same lorebook, reload metadata
    loadMediaMetadata();
  }
});

// Select lorebook when world info selection changes
watch(
  () => worldInfoUiStore.selectedFilename,
  (newFilename) => {
    if (newFilename && lorebooks.value.some((l) => l.value === newFilename)) {
      selectedLorebook.value = newFilename;
    }
  },
  { immediate: true },
);

async function handleMediaSelect(event: Event, targetEntryUid?: number) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Determine which entry to upload to
  const entryUid = targetEntryUid ?? (selectedEntryUid.value !== 0 ? selectedEntryUid.value : selectedEntryForUpload.value);
  if (entryUid === 0) {
    props.api.ui.showToast('Please select an entry first', 'error');
    return;
  }

  // Validate file type
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.invalidFileType'), 'error');
    return;
  }

  // Determine media type and max size
  const isVideoFile = file.type.startsWith('video/');
  const mediaType: 'image' | 'video' = isVideoFile ? 'video' : 'image';
  const maxSize = isVideoFile ? props.api.settings.get('maxVideoSize') : props.api.settings.get('maxImageSize');

  if (file.size > maxSize) {
    const errorMessage = isVideoFile
      ? t('extensionsBuiltin.visualLorebook.videoTooLarge')
      : t('extensionsBuiltin.visualLorebook.imageTooLarge');
    props.api.ui.showToast(errorMessage, 'error');
    return;
  }

  try {
    isUploadingMedia.value = true;

    // Upload to backend
    const uploadResult = await uploadMedia({
      file,
      lorebook: selectedLorebook.value,
      entryUid,
    });

    const mediaId = uploadResult.filename;

    // Update parallel media JSON file
    await updateMediaMetadata(selectedLorebook.value, {
      entryUid,
      mediaData: {
        mediaId,
        mediaType,
        uploadedAt: new Date().toISOString(),
        visualKeyword: visualKeywordForUpload.value.trim(),
      },
    });

    // Clear visual keyword for upload after successful upload
    visualKeywordForUpload.value = '';

    // Refresh media metadata
    await loadMediaMetadata();

    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.mediaUploaded'), 'success');

    // Clear dropdown selection
    selectedEntryForUpload.value = 0;
  } catch (error) {
    console.error('Failed to upload media:', error);
    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.mediaUploadFailed'), 'error');
  } finally {
    isUploadingMedia.value = false;
    if (mediaInputRef.value) {
      mediaInputRef.value.value = '';
    }
  }
}

async function handleRemoveMedia() {
  if (!mediaData.value || selectedEntryUid.value === 0 || !selectedLorebook.value) return;

  const mediaId = mediaData.value.mediaId;

  // Confirm deletion
  const confirmed = confirm(t('extensionsBuiltin.visualLorebook.deleteConfirm'));
  if (!confirmed) return;

  // Delete from backend
  try {
    await deleteMedia({ mediaId });

    // Update parallel media JSON file to remove entry
    await removeMediaMetadata(selectedLorebook.value, {
      entryUid: selectedEntryUid.value,
    });

    // Refresh media metadata
    await loadMediaMetadata();

    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.mediaRemoved'), 'success');
  } catch (error) {
    console.error('Failed to delete media:', error);
    props.api.ui.showToast('Failed to remove media', 'error');
  }
}

// Handler for lorebook select change
function handleLorebookChange(value: string | number | (string | number)[]) {
  selectedLorebook.value = Array.isArray(value) ? value[0] as string : value as string;
}

// Handler for entry select change
function handleEntryForUploadChange(value: string | number | (string | number)[]) {
  selectedEntryForUpload.value = Number(Array.isArray(value) ? value[0] : value);
}
</script>

<template>
  <div class="visual-lorebook-panel">
    <!-- Lorebook Selector -->
    <FormItem :label="t('extensionsBuiltin.visualLorebook.selectLorebook')">
      <Select
        :model-value="selectedLorebook"
        :options="lorebooks"
        :placeholder="t('extensionsBuiltin.visualLorebook.selectLorebook')"
        @update:model-value="handleLorebookChange"
      />
    </FormItem>

    <!-- Entry Search -->
    <FormItem v-if="false">
      <Search v-model="searchQuery" :placeholder="t('extensionsBuiltin.visualLorebook.searchPlaceholder')" />
    </FormItem>
    <!-- Selected Entry Media Section - For viewing/replacing/deleting existing media -->
    <div v-if="selectedEntry" class="selected-entry-section">
      <div class="section-header">
        <h5>{{ t('extensionsBuiltin.visualLorebook.selectEntry') }}: {{ selectedEntry.comment }}</h5>
        <Button variant="ghost" icon="fa-xmark" class="close-button" @click="selectedEntryUid = 0" />
      </div>

      <!-- Media preview -->
      <div v-if="mediaData" class="media-preview">
        <img v-if="isImage" :src="mediaUrl" alt="Entry media preview" class="preview-image" />
        <video v-else-if="isVideo" :src="mediaUrl" controls class="preview-video" />

        <!-- Visual keyword display/edit (small text below media) -->
        <div class="visual-keyword-section">
          <Input
            :model-value="visualKeywordForEdit"
            :placeholder="t('extensionsBuiltin.visualLorebook.visualKeywordPlaceholder')"
            class="visual-keyword-input"
            @update:model-value="handleVisualKeywordChange"
          />
        </div>

        <div class="media-actions">
          <Button variant="ghost" icon="fa-upload" :disabled="isUploadingMedia" @click="mediaInputRef?.click()">
            {{ isUploadingMedia ? t('extensionsBuiltin.visualLorebook.uploading') : t('extensionsBuiltin.visualLorebook.replaceMedia') }}
          </Button>
          <Button variant="danger" icon="fa-trash-can" :title="t('extensionsBuiltin.visualLorebook.removeMedia')" @click="handleRemoveMedia" />
        </div>
      </div>
    </div>
    
    <!-- Entry Grid - Only shows entries WITH media -->
    <div v-if="selectedLorebook" class="entry-grid">
      <div v-if="entriesWithMedia.length === 0" class="empty-state">
        {{ t('extensionsBuiltin.visualLorebook.noEntriesWithMedia') }}
      </div>

      <div
        v-for="entry in entriesWithMedia"
          :key="entry.uid"
          class="entry-card"
          :class="{ selected: selectedEntryUid === entry.uid }"
          @click="selectedEntryUid = entry.uid"
        >
          <div class="entry-header">
            <span class="entry-key">{{ entry.comment || 'No Name' }}</span>
          </div>

          <!-- Media thumbnail -->
          <div class="entry-media">
            <img
              v-if="mediaMetadata?.entries[entry.uid]?.mediaType === 'image'"
              :src="getEntryMediaUrl(entry.uid)"
              alt="UID {{ entry.uid }}"
            />
            <video v-else-if="isVideo" :src="getEntryMediaUrl(entry.uid)" class="preview-video" autoplay loop>
            </video>
          </div>
        </div>
      </div>



    <!-- Add Media to Entry Section - For uploading to entries without media -->
    <div v-if="selectedLorebook" class="add-media-section">
      <div class="section-header">
        <h3>{{ t('extensionsBuiltin.visualLorebook.selectEntryToUpload') }}</h3>
      </div>

      <FormItem :label="t('extensionsBuiltin.visualLorebook.selectEntry')">
        <Select
          :model-value="selectedEntryForUpload"
          :options="entriesWithoutMedia.map((e) => ({ label: `${e.uid}: ${e.comment}`, value: e.uid }))"
          :placeholder="t('extensionsBuiltin.visualLorebook.selectEntry')"
          @update:model-value="handleEntryForUploadChange"
        />
      </FormItem>

      <FormItem :label="t('extensionsBuiltin.visualLorebook.visualKeyword')">
        <Input
          v-model="visualKeywordForUpload"
          :placeholder="t('extensionsBuiltin.visualLorebook.visualKeywordPlaceholder')"
        />
      </FormItem>

      <div v-if="selectedEntryForUpload !== 0" class="upload-placeholder">
        <Button variant="ghost" icon="fa-upload" :disabled="isUploadingMedia" @click="mediaInputRef?.click()">
          {{ isUploadingMedia ? t('extensionsBuiltin.visualLorebook.uploading') : t('extensionsBuiltin.visualLorebook.uploadMedia') }}
        </Button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="mediaInputRef"
      type="file"
      accept="image/*,video/*"
      style="display: none"
      @change="(e) => handleMediaSelect(e, selectedEntryForUpload !== 0 ? selectedEntryForUpload : undefined)"
    />
  </div>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
