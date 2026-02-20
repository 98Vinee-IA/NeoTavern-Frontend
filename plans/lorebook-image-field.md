# Visual Lorebook Implementation Plan (Extension-Based)

## Overview

Add media (image and video) support to lorebook (world-info) entries using a completely self-contained extension called "Visual Lorebook". Media files are stored on the backend server and referenced by entry UIDs. This approach requires zero core changes and is completely self-contained for easy merging.

## Key Requirements

1. **No core changes** - No changes to core codebase at all
2. **Backend storage** - Media stored on server in `/backend/data/default-user/visual-lorebook/media/` directory
3. **Extension architecture** - All code changes in a new extension for easier merging
4. **Proper i18n** - All UI labels defined in extension's own locales
5. **Support both media types** - Images and videos with appropriate UI elements
6. **Easy merging** - Extension can be kept as-is when merging from parent repo
7. **Dedicated panel** - Separate media management panel accessible from nav bar
8. **Entry grid filtering** - Only displays entries that have media attached
9. **UI flow** - Click entries in grid to view/replace/delete media; use dropdown at bottom to add media to entries without media
10. **File size limits only** - No dimension limits on media, only file size (5MB for images, 50MB for videos)
11. **File naming convention** - Media files named as `{lorebook-name}-{entry-uid}-{timestamp}.ext` to avoid duplication issues

## Architecture Diagram

```mermaid
graph TD
    A[User Opens Media Panel] --> B[VisualLorebookPanel.vue]
    B --> C[Select Lorebook]
    C --> D[Fetch Media Metadata JSON]
    D --> E[Entry Grid - Only entries WITH media]
    C --> F[Entry Dropdown - Only entries WITHOUT media]
    E --> G[Click Entry to View/Replace/Delete Media]
    G --> H[Show Media Preview with Replace/Delete Actions]
    H --> I[Replace Media - File Input Handler]
    I --> J[Validate File Type/Size]
    J --> K[Upload to Backend API]
    K --> L[Backend stores file in /backend/data/default-user/visual-lorebook/media/]
    L --> M[Update Parallel Media JSON]
    M --> N[Backend saves {lorebook-name}.json]
    F --> O[Select Entry from Dropdown]
    O --> P[Upload Media to New Entry]
    P --> K
    Q[Delete Media] --> R[Remove from Backend + Update Media JSON]
    S[View Media] --> T[Fetch from Backend API - Route: /api/visual-lorebook/media/:filename]
```

## Implementation Steps

### Phase 1: Extension Implementation

Create a new extension `visual-lorebook` that provides a dedicated media management panel.

#### 1.1 Create Extension Directory Structure

Create the following files in `src/extensions/built-in/visual-lorebook/`:

```
src/extensions/built-in/visual-lorebook/
├── index.ts
├── manifest.ts
├── types.ts
├── api.ts
├── VisualLorebookPanel.vue
├── locales/
│   └── en.json
└── style.scss
```

#### 1.2 Extension Manifest

**File**: `src/extensions/built-in/visual-lorebook/manifest.ts`

```typescript
import type { ExtensionManifest } from '../../../types';

export const manifest: ExtensionManifest = {
  name: 'core.visual-lorebook',
  display_name: 'Visual Lorebook',
  description: 'Add image and video support to lorebook entries.',
  version: '1.0.0',
  author: 'NeoTavern Team',
  icon: 'fa-solid fa-photo-video',
};
```

#### 1.3 Extension Types

**File**: `src/extensions/built-in/visual-lorebook/types.ts`

```typescript
export interface VisualLorebookSettings {
  maxImageSize: number; // Max image size in bytes (default: 5MB)
  maxVideoSize: number; // Max video size in bytes (default: 50MB)
  enabled: boolean;
}

export const defaultSettings: VisualLorebookSettings = {
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  enabled: true,
};

// Media metadata stored in parallel JSON file
export interface VisualLorebookMediaData {
  mediaId: string; // Reference to media file on backend
  mediaType: 'image' | 'video';
  uploadedAt: string; // ISO timestamp
}

// Structure of the parallel media JSON file
export interface VisualLorebookFile {
  name: string; // Lorebook name (matches original lorebook file)
  entries: Record<number, VisualLorebookMediaData>; // Entry UID -> Media data mapping
}
```

#### 1.4 Extension Locales

**File**: `src/extensions/built-in/visual-lorebook/locales/en.json`

```json
{
  "title": "Visual Lorebook",
  "selectLorebook": "Select Lorebook",
  "selectEntry": "Select Entry",
  "selectEntryToUpload": "Select entry to add media to",
  "noLorebooks": "No lorebooks available",
  "noEntriesWithMedia": "No entries with media in this lorebook",
  "noEntriesWithoutMedia": "All entries have media",
  "searchPlaceholder": "Search entries with media...",
  "uploadMedia": "Upload Media",
  "replaceMedia": "Replace Media",
  "removeMedia": "Remove Media",
  "uploading": "Uploading...",
  "invalidFileType": "Invalid file type. Please select an image or video.",
  "imageTooLarge": "Image too large. Maximum size is 5MB.",
  "videoTooLarge": "Video too large. Maximum size is 50MB.",
  "mediaUploaded": "Media uploaded successfully.",
  "mediaUploadFailed": "Failed to upload media.",
  "mediaRemoved": "Media removed successfully.",
  "mediaRemoveFailed": "Failed to remove media.",
  "deleteConfirm": "Are you sure you want to remove this media?",
  "noMedia": "No media attached to this entry",
  "mediaPreview": "Media Preview",
  "entryUid": "Entry UID",
  "entryKey": "Entry Key"
}
```

#### 1.4 Extension API Service

**File**: `src/extensions/built-in/visual-lorebook/api.ts`

```typescript
import type { VisualLorebookMediaData, VisualLorebookFile } from './types';

export interface UploadMediaRequest {
  file: File;
  lorebook: string;
  entryUid: number;
}

export interface UploadMediaResponse {
  filename: string;
  lorebook: string;
  entryUid: number;
  path: string;
  size: number;
  mimetype: string;
}

export interface DeleteMediaRequest {
  mediaId: string;
}

export interface UpdateMetadataRequest {
  entryUid: number;
  mediaData: VisualLorebookMediaData;
}

export interface RemoveMetadataRequest {
  entryUid: number;
}

const API_BASE = '/api/visual-lorebook';

/**
 * Upload a media file to the backend
 */
export async function uploadMedia(request: UploadMediaRequest): Promise<UploadMediaResponse> {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('lorebook', request.lorebook);
  formData.append('entryUid', request.entryUid.toString());

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload media');
  }

  return response.json();
}

/**
 * Delete a media file from the backend
 */
export async function deleteMedia(request: DeleteMediaRequest): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to delete media');
  }

  return response.json();
}

/**
 * Get the URL for a media file
 */
export function getMediaUrl(mediaId: string): string {
  return `${API_BASE}/media/${mediaId}`;
}

/**
 * Fetch media metadata for a lorebook
 */
export async function fetchMediaMetadata(lorebookName: string): Promise<VisualLorebookFile | null> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch media metadata');
  }

  return response.json();
}

/**
 * Update media metadata for a lorebook entry
 */
export async function updateMediaMetadata(
  lorebookName: string,
  request: UpdateMetadataRequest,
): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to update media metadata');
  }

  return response.json();
}

/**
 * Remove media metadata for a lorebook entry
 */
export async function removeMediaMetadata(
  lorebookName: string,
  request: RemoveMetadataRequest,
): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to remove media metadata');
  }

  return response.json();
}
```

#### 1.5 Extension Main File

**File**: `src/extensions/built-in/visual-lorebook/index.ts`

```typescript
import type { ExtensionAPI } from '../../../types';
import { manifest } from './manifest';
import VisualLorebookPanel from './VisualLorebookPanel.vue';
import type { VisualLorebookSettings } from './types';
import en from './locales/en.json';

export { manifest };

export function activate(api: ExtensionAPI<VisualLorebookSettings>) {
  // Register i18n for the extension
  api.i18n.register('en', en);

  // Register sidebar panel
  const panelId = api.ui.registerSidebarPanel({
    id: 'visual-lorebook',
    icon: 'fa-solid fa-photo-video',
    title: 'extensionsBuiltin.visualLorebook.title',
    component: VisualLorebookPanel,
  });

  // Register nav bar item
  api.ui.registerNavBarItem({
    id: 'visual-lorebook',
    icon: 'fa-solid fa-photo-video',
    label: 'extensionsBuiltin.visualLorebook.title',
    action: () => {
      api.ui.openSidebarPanel(panelId);
    },
  });

  // Cleanup function
  return () => {
    api.ui.unregisterSidebarPanel(panelId);
    api.ui.unregisterNavBarItem('visual-lorebook');
  };
}
```

#### 1.6 Extension UI Component

**File**: `src/extensions/built-in/visual-lorebook/VisualLorebookPanel.vue`

````vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button, FormItem, Select, Search } from '../../../components/UI';
import { useStrictI18n } from '../../../composables/useStrictI18n';
import { useWorldInfoUiStore } from '../../../stores/world-info-ui.store';
import { useWorldInfoStore } from '../../../stores/world-info.store';
import type { ExtensionAPI } from '../../../types';
import type { VisualLorebookSettings, VisualLorebookMediaData, VisualLorebookFile } from './types';
import {
  fetchMediaMetadata as fetchMediaMetadataFromApi,
  uploadMedia,
  deleteMedia,
  getMediaUrl,
  updateMediaMetadata,
  removeMediaMetadata,
} from './api';

const props = defineProps<{
  api: ExtensionAPI<VisualLorebookSettings>;
}>();

const { t } = useStrictI18n();
const worldInfoUiStore = useWorldInfoUiStore();
const worldInfoStore = useWorldInfoStore();

const selectedLorebook = ref<string | null>(null);
const selectedEntryUid = ref<number | null>(null);
const mediaInputRef = ref<HTMLInputElement | null>(null);
const isUploadingMedia = ref(false);
const searchQuery = ref('');
const mediaMetadata = ref<VisualLorebookFile | null>(null);

// Get all available lorebooks
const lorebooks = computed(() => {
  return Object.keys(worldInfoStore.worldInfoCache);
});

// Fetch media metadata for selected lorebook
async function loadMediaMetadata() {
  if (!selectedLorebook.value) {
    mediaMetadata.value = null;
    return;
  }

  try {
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
  let entries = book.entries.filter((entry) => mediaMetadata.value.entries[entry.uid]);

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
  let entries = book.entries.filter((entry) => !mediaMetadata.value.entries[entry.uid]);

  // Sort by UID descending (newest first)
  entries.sort((a, b) => b.uid - a.uid);

  return entries;
});

const selectedEntryForUpload = ref<number | null>(null);

// Get selected entry (from grid - has media)
const selectedEntry = computed(() => {
  if (!selectedLorebook.value || selectedEntryUid.value === null) return null;

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return null;

  return book.entries.find((e) => e.uid === selectedEntryUid.value) || null;
});

// Get selected entry for upload (from dropdown - no media yet)
const selectedEntryForUploadData = computed(() => {
  if (!selectedLorebook.value || selectedEntryForUpload.value === null) return null;

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return null;

  return book.entries.find((e) => e.uid === selectedEntryForUpload.value) || null;
});

// Get media data for selected entry
const mediaData = computed((): VisualLorebookMediaData | null => {
  if (!selectedEntryUid.value || !mediaMetadata.value) return null;
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

// Fetch metadata when lorebook changes
watch(selectedLorebook, () => {
  loadMediaMetadata();
});

// Select lorebook when world info selection changes
watch(
  () => worldInfoUiStore.selectedFilename,
  (newFilename) => {
    if (newFilename && lorebooks.value.includes(newFilename)) {
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
  const entryUid = targetEntryUid ?? selectedEntryUid.value ?? selectedEntryForUpload.value;
  if (entryUid === null || entryUid === undefined) {
    props.api.ui.showToast('Please select an entry first', 'error');
    return;
  }

  // Validate file type
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    props.api.ui.showToast(t('invalidFileType'), 'error');
    return;
  }

  // Determine media type and max size
  const isVideoFile = file.type.startsWith('video/');
  const mediaType: 'image' | 'video' = isVideoFile ? 'video' : 'image';
  const maxSize = isVideoFile ? props.api.settings.get('maxVideoSize') : props.api.settings.get('maxImageSize');

  if (file.size > maxSize) {
    const errorMessage = isVideoFile ? t('videoTooLarge') : t('imageTooLarge');
    props.api.ui.showToast(errorMessage, 'error');
    return;
  }

  try {
    isUploadingMedia.value = true;

    // Upload to backend
    const uploadResult = await uploadMedia({
      file,
      lorebook: selectedLorebook.value!,
      entryUid,
    });

    const mediaId = uploadResult.filename;

    // Update parallel media JSON file
    await updateMediaMetadata(selectedLorebook.value!, {
      entryUid,
      mediaData: {
        mediaId,
        mediaType,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Refresh media metadata
    await loadMediaMetadata();

    props.api.ui.showToast(t('mediaUploaded'), 'success');

    // Clear the dropdown selection
    selectedEntryForUpload.value = null;
  } catch (error) {
    console.error('Failed to upload media:', error);
    props.api.ui.showToast(t('mediaUploadFailed'), 'error');
  } finally {
    isUploadingMedia.value = false;
    if (mediaInputRef.value) {
      mediaInputRef.value.value = '';
    }
  }
}

async function handleRemoveMedia() {
  if (!mediaData.value || !selectedEntryUid.value || !selectedLorebook.value) return;

  const mediaId = mediaData.value.mediaId;

  // Confirm deletion
  const confirmed = confirm(t('deleteConfirm'));
  if (!confirmed) return;

  // Delete from backend
  try {
    await deleteMedia({ mediaId });

    // Update parallel media JSON file to remove entry
    await removeMediaMetadata(selectedLorebook.value!, {
      entryUid: selectedEntryUid.value,
    });

    // Refresh media metadata
    await loadMediaMetadata();

    props.api.ui.showToast(t('mediaRemoved'), 'success');
  } catch (error) {
    console.error('Failed to delete media:', error);
    props.api.ui.showToast(t('mediaRemoveFailed'), 'error');
  }
}
</script>

<template>
  <div class="visual-lorebook-panel">
    <!-- Lorebook Selector -->
    <FormItem :label="t('selectLorebook')">
      <Select
        v-model="selectedLorebook"
        :options="lorebooks.map((l) => ({ label: l, value: l }))"
        :placeholder="t('selectLorebook')"
      />
    </FormItem>

    <!-- Entry Search -->
    <FormItem v-if="selectedLorebook">
      <Search v-model="searchQuery" :placeholder="t('searchPlaceholder')" />
    </FormItem>

    <!-- Entry Grid - Only shows entries WITH media -->
    <div v-if="selectedLorebook" class="entry-grid">
      <div v-if="entriesWithMedia.length === 0" class="empty-state">
        {{ t('noEntriesWithMedia') }}
      </div>

      <div
        v-for="entry in entriesWithMedia"
        :key="entry.uid"
        class="entry-card"
        :class="{ selected: selectedEntryUid === entry.uid }"
        @click="selectedEntryUid = entry.uid"
      >
        <div class="entry-header">
          <span class="entry-uid">{{ t('entryUid') }}: {{ entry.uid }}</span>
          <span class="entry-key">{{ entry.key[0] || '(no key)' }}</span>
        </div>

        <!-- Media thumbnail -->
        <div class="entry-media">
          <img
            v-if="mediaMetadata.entries[entry.uid].mediaType === 'image'"
            :src="getEntryMediaUrl(entry.uid)"
            alt="Entry media thumbnail"
          />
          <div v-else class="video-thumbnail">
            <i class="fa-solid fa-play"></i>
          </div>
        </div>

        <div class="entry-comment">{{ entry.comment }}</div>
      </div>
    </div>

    <!-- Selected Entry Media Section - For viewing/replacing/deleting existing media -->
    <div v-if="selectedEntry" class="selected-entry-section">
      <div class="section-header">
        <h3>{{ t('selectEntry') }}: {{ selectedEntry.uid }}</h3>
      </div>

      <!-- Media preview -->
      <div v-if="mediaData" class="media-preview">
        <img v-if="isImage" :src="mediaUrl" alt="Entry media preview" class="preview-image" />
        <video v-else-if="isVideo" :src="mediaUrl" controls class="preview-video" />

        <div class="media-actions">
          <Button variant="secondary" icon="fa-upload" :disabled="isUploadingMedia" @click="mediaInputRef?.click()">
            {{ isUploadingMedia ? t('uploading') : t('replaceMedia') }}
          </Button>
          <Button variant="danger" icon="fa-trash-can" :title="t('removeMedia')" @click="handleRemoveMedia" />
        </div>
      </div>
    </div>

    <!-- Add Media to Entry Section - For uploading to entries without media -->
    <div v-if="selectedLorebook" class="add-media-section">
      <div class="section-header">
        <h3>{{ t('selectEntryToUpload') }}</h3>
      </div>

      <FormItem v-if="entriesWithoutMedia.length > 0">
        <Select
          v-model="selectedEntryForUpload"
          :options="
            entriesWithoutMedia.map((e) => ({
              label: `UID: ${e.uid} - ${e.key[0] || '(no key)'}`,
              value: e.uid,
            }))
          "
          :placeholder="t('selectEntryToUpload')"
        />
      </FormItem>

      <div v-else class="empty-state">
        {{ t('noEntriesWithoutMedia') }}
      </div>

      <div v-if="selectedEntryForUpload" class="upload-placeholder">
        <Button variant="secondary" icon="fa-upload" :disabled="isUploadingMedia" @click="mediaInputRef?.click()">
          {{ isUploadingMedia ? t('uploading') : t('uploadMedia') }}
        </Button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      type="file"
      ref="mediaInputRef"
      accept="image/*,video/*"
      @change="(e) => handleMediaSelect(e, selectedEntryForUpload ?? undefined)"
      style="display: none"
    />
  </div>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>

#### 1.7 Extension Styling **File**: `src/extensions/built-in/visual-lorebook/style.scss` ```scss .visual-lorebook-panel
{ padding: 16px; display: flex; flex-direction: column; gap: 16px; max-height: 100vh; overflow-y: auto; } .entry-grid {
display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; max-height: 40vh; overflow-y:
auto; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; } .empty-state { grid-column: 1 / -1;
text-align: center; padding: 32px; color: var(--text-secondary); } .entry-card { border: 1px solid var(--border-color);
border-radius: 4px; padding: 12px; cursor: pointer; transition: border-color 0.2s; display: flex; flex-direction:
column; gap: 8px; &:hover { border-color: var(--primary-color); } &.selected { border-color: var(--primary-color);
background-color: var(--background-secondary); } } .entry-header { display: flex; justify-content: space-between;
font-size: 0.85em; color: var(--text-secondary); } .entry-uid { font-weight: 500; } .entry-key { max-width: 100px;
overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .entry-media { width: 100%; aspect-ratio: 16/9;
background-color: var(--background-secondary); border-radius: 4px; overflow: hidden; img { width: 100%; height: 100%;
object-fit: cover; } } .video-thumbnail { width: 100%; height: 100%; display: flex; align-items: center;
justify-content: center; color: var(--text-secondary); font-size: 2em; } .entry-comment { font-size: 0.9em; color:
var(--text-primary); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2;
-webkit-box-orient: vertical; } .selected-entry-section { border-top: 1px solid var(--border-color); padding-top: 16px;
} .section-header { margin-bottom: 12px; h3 { margin: 0; font-size: 1.1em; } } .media-preview { display: flex;
flex-direction: column; gap: 12px; .preview-image, .preview-video { max-width: 100%; max-height: 33vh; border-radius:
4px; border: 1px solid var(--border-color); } .media-actions { display: flex; gap: 8px; } } .upload-placeholder {
display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; border: 1px dashed
var(--border-color); border-radius: 4px; background-color: var(--background-secondary); p { margin: 0; color:
var(--text-secondary); } } .add-media-section { border-top: 1px solid var(--border-color); padding-top: 16px;
margin-top: 16px; }
````

#### 1.8 Register Extension

**File**: `src/extensions/built-in/index.ts`

Add import and export for the new extension:

```typescript
import { manifest as visualLorebookManifest, activate as activateVisualLorebook } from './visual-lorebook';

// ... existing imports ...

export const builtInExtensions = [
  // ... existing extensions ...
  {
    manifest: visualLorebookManifest,
    activate: activateVisualLorebook,
  },
];
```

### Phase 2: Backend API Endpoint (Separate Implementation)

**Note**: The Visual Lorebook extension requires backend API support for storing and serving media files. Since the backend is in a separate git repository, the backend implementation should be created separately.

**Required Backend Endpoints**:

1. **POST `/api/visual-lorebook/upload`** - Upload media file
   - Request body: `FormData` with `file`, `lorebook`, `entryUid`
   - Response: `{ filename, lorebook, entryUid, path, size, mimetype }`
   - Store file in `/backend/data/default-user/visual-lorebook/media/` with naming `{lorebook-name}-{entry-uid}-{timestamp}.ext`
   - File size limit: 50MB
   - Allowed types: images (jpeg, png, webp, gif, bmp, svg) and videos (mp4, webm, mov)

2. **DELETE `/api/visual-lorebook/delete`** - Delete media file
   - Request body: `{ mediaId }`
   - Response: `{ success: true }`

3. **GET `/api/visual-lorebook/media/:filename`** - Serve media files
   - Response: Media file with proper content-type header
   - Cache-Control: `public, max-age=31536000` (1 year)

4. **GET `/api/visual-lorebook/metadata/:lorebookName`** - Get media metadata
   - Response: `{ name, entries: { [uid]: { mediaId, mediaType, uploadedAt } } }`
   - Returns 404 if metadata file doesn't exist

5. **POST `/api/visual-lorebook/metadata/:lorebookName`** - Update media metadata
   - Request body: `{ entryUid, mediaData }`
   - Response: `{ success: true }`
   - Creates or updates `{lorebookName}.json` in `/backend/data/default-user/visual-lorebook/`

6. **DELETE `/api/visual-lorebook/metadata/:lorebookName`** - Remove media metadata
   - Request body: `{ entryUid }`
   - Response: `{ success: true }`
   - Removes entry from metadata file

**Backend File Structure**:

```
backend/data/
└── default-user/
    └── visual-lorebook/
        ├── media/                  # Media files
        │   ├── fantasy-world-123-1739501234.jpg
        │   ├── fantasy-world-456-1739504567.png
        │   └── my-lorebook-789-1739509876.mp4
        ├── fantasy-world.json         # Media metadata files
        ├── my-lorebook.json
        └── another-lorebook.json
```

**Metadata File Format** (`{lorebook-name}.json`):

```json
{
  "name": "my-lorebook",
  "entries": {
    "123": {
      "mediaId": "my-lorebook-123-1739501234.jpg",
      "mediaType": "image",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "456": {
      "mediaId": "my-lorebook-456-1739504567.mp4",
      "mediaType": "video",
      "uploadedAt": "2024-01-15T11:00:00.000Z"
    }
  }
}
```

## Testing Considerations

1. Test image upload with various file types (PNG, JPG, WEBP, GIF, BMP, SVG)
2. Test video upload with various formats (MP4, WEBM, MOV)
3. Test large file size validation (5MB for images, 50MB for videos)
4. Test media removal with confirmation
5. Test lorebook selector functionality
6. Test entry grid display - only shows entries with media, sorted by UID descending
7. Test empty state when no entries have media in a lorebook
8. Test search/filter functionality for entries with media
9. Test entry selection from grid to view/replace/delete media
10. Test dropdown selection to add media to entries without media
11. Test media preview for images and videos
12. Test cross-device media sharing (upload on Computer A, view on Computer B)
13. Test panel navigation from nav bar
14. Test panel state persistence when switching lorebooks

**Edge Cases and Error Handling:** 15. Test uploading media to an entry that already has media (should replace existing media) 16. Test deleting media from an entry, then the entry is deleted from the lorebook (orphaned media - no auto-cleanup since extension can't modify core) 17. Test switching lorebooks (should refresh media metadata for new lorebook) 18. Test backend upload failure (should show error to user) 19. Test backend metadata save failure (should show error to user) 20. Test backend delete failure (should show error to user) 21. Test when lorebook is deleted (orphaned metadata file - no auto-cleanup since extension can't modify core) 22. Test when lorebook is renamed (orphaned metadata file - metadata won't automatically update to new name) 23. Test when media file is deleted but metadata still references it (should show error when trying to view) 24. Test concurrent uploads to the same entry (race condition - last upload wins)

## Important Notes

1. **Backend endpoint required** - The extension requires the backend endpoint to store media files
2. **Zero core changes** - No changes to core codebase at all
3. **Self-contained extension** - All functionality in extension folder
4. **Backend storage** - Media stored on server in `/backend/data/default-user/visual-lorebook/media/`
5. **Proper i18n** - All UI labels defined in extension's own locales
6. **Supports both images and videos** - Different UI elements and size limits for each type
7. **Easy merging** - Extension can be kept as-is when merging from parent repo
8. **Cross-device support** - Media stored on backend, accessible from any device
9. **Dedicated panel** - Separate panel accessible from nav bar, not injected into existing editor
10. **Entry grid filtering** - Only displays entries that have media attached
11. **Media serving via route** - Images/videos served via `/api/visual-lorebook/media/:filename` route (no special folder permissions needed)
12. **File size limits only** - No dimension limits, only file size validation
13. **Parallel JSON files** - Media metadata stored in separate `{lorebook-name}.json` files in `/backend/data/default-user/visual-lorebook/`, never modifying original lorebook files
14. **No automatic cleanup** - Since the extension can't modify core code, there's no automatic cleanup when lorebooks/entries are deleted or renamed. Users can manually clean up orphaned files in `/backend/data/default-user/visual-lorebook/`.

## File Storage Structure

```
backend/data/
└── visual-lorebook/           # Visual Lorebook directory
    ├── media/                  # Media files directory
    │   ├── fantasy-world-123-1739501234.jpg
    │   ├── fantasy-world-456-1739504567.png
    │   └── my-lorebook-789-1739509876.mp4
    ├── fantasy-world.json         # Media metadata JSON files
    ├── my-lorebook.json
    └── another-lorebook.json
```

**Lorebook JSON files remain unchanged** - Original lorebook files are not modified.

**Media metadata is stored in parallel JSON files** in `/backend/data/default-user/visual-lorebook/` with the naming convention `{lorebook-name}.json`:

**File naming convention** - Media files are named as `{lorebook-name}-{entry-uid}-{timestamp}.ext` to avoid duplication issues across lorebooks and entries.

```json
{
  "name": "my-lorebook",
  "entries": {
    "123": {
      "mediaId": "my-lorebook-123-1739501234.jpg",
      "mediaType": "image",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    },
    "456": {
      "mediaId": "my-lorebook-456-1739504567.mp4",
      "mediaType": "video",
      "uploadedAt": "2024-01-15T11:00:00.000Z"
    }
  }
}
```

**Benefits of parallel JSON files:**

- **Zero core changes** - Original lorebook files are never modified
- **Self-contained extension** - All extension data is in separate files
- **Easier merging** - No conflicts when merging from upstream
- **Clean separation** - Extension data is completely isolated from core data
