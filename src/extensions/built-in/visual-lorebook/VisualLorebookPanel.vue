<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Button, FormItem, Search, Select } from '../../../components/UI';
import { useChatStore } from '../../../stores/chat.store';
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
import type { VisualLorebookFile, VisualLorebookSettings } from './types';

const props = defineProps<{
  api: ExtensionAPI<VisualLorebookSettings>;
}>();

const t = props.api.i18n.t;
const worldInfoUiStore = useWorldInfoUiStore();
const worldInfoStore = useWorldInfoStore();
const chatStore = useChatStore();

const selectedLorebook = ref<string>('');
const selectedEntryForUpload = ref<number>(0);
const entryUidForReplace = ref<number>(0);
const mediaInputRef = ref<HTMLInputElement | null>(null);
const isUploadingMedia = ref(false);
const searchQuery = ref('');
const mediaMetadata = ref<VisualLorebookFile | null>(null);

// Track matched entries in order (most recent first)
const matchedEntryUids = ref<number[]>([]);

// Active characters filter
const showOnlyActiveCharacters = ref<boolean>(false);

// Common words to ignore in entry name matching
const COMMON_WORDS = new Set(['the', 'and', 'a', 'an', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

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

// Get entries that have been mentioned in recent messages
const activeEntries = computed(() => {
  if (!showOnlyActiveCharacters.value || !selectedLorebook.value || !mediaMetadata.value) {
    return new Set<number>();
  }

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return new Set<number>();

  // Use keywordLookbackCount instead of activeCharacterLookback
  const lookback = props.api.settings.get('keywordLookbackCount') ?? 3;
  const recentMessages = chatStore.activeChat?.messages.slice(-lookback) || [];
  const activeEntryUids = new Set<number>();

  const enableKeywordMatching = props.api.settings.get('enableKeywordMatching') ?? true;
  const enableEntryNameMatching = props.api.settings.get('enableEntryNameMatching') ?? false;

  for (const message of recentMessages) {
    const messageText = cleanMessageText(message.mes).toLowerCase();
    // Check each entry's keywords from lorebook
    for (const uidStr of Object.keys(mediaMetadata.value!.entries)) {
      const uid = Number(uidStr);
      const entry = book.entries.find((e) => e.uid === uid);

      if (!entry) continue;

      let matched = false;

      // Check keyword matching (if enabled)
      if (enableKeywordMatching) {
        for (const keyword of entry.key) {
          const trimmedKeyword = keyword.trim();
          if (trimmedKeyword && messageText.includes(trimmedKeyword.toLowerCase())) {
            console.log(
              `[Visual Lorebook] Active filter match - Keyword: "${trimmedKeyword}", UID: ${uid}, Comment: "${entry.comment}"`,
            );
            activeEntryUids.add(uid);
            matched = true;
            break;
          }
        }
      }

      // Check entry name matching (if enabled and not already matched)
      if (!matched && enableEntryNameMatching) {
        const entryNameKeywords = extractEntryNameKeywords(entry.comment);
        for (const keyword of entryNameKeywords) {
          const keywordLower = keyword.toLowerCase();
          // Match exact keyword OR possessive form (e.g., "Hira" matches "Hira" or "Hira's")
          if (messageText.includes(keywordLower) || messageText.includes(`${keywordLower}'s`)) {
            console.log(
              `[Visual Lorebook] Active filter match - Entry name: "${keyword}", UID: ${uid}, Comment: "${entry.comment}"`,
            );
            activeEntryUids.add(uid);
            matched = true;
            break;
          }
        }
      }
    }
  }

  return activeEntryUids;
});

// Get entries for selected lorebook (only entries with media)
const entriesWithMedia = computed(() => {
  if (!selectedLorebook.value || !mediaMetadata.value) return [];

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return [];

  // Filter to only show entries that have media
  let entries = book.entries.filter((entry) => mediaMetadata.value!.entries[entry.uid]);

  // Filter by active characters if toggle is enabled
  if (showOnlyActiveCharacters.value) {
    entries = entries.filter((entry) => activeEntries.value.has(entry.uid));
  }

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

  // Sort: matched entries first (in order of most recent match), then by UID descending
  entries.sort((a, b) => {
    const aMatchIndex = matchedEntryUids.value.indexOf(a.uid);
    const bMatchIndex = matchedEntryUids.value.indexOf(b.uid);

    // If both are matched, sort by match order (lower index = more recent)
    if (aMatchIndex !== -1 && bMatchIndex !== -1) {
      return aMatchIndex - bMatchIndex;
    }
    // If only a is matched, it comes first
    if (aMatchIndex !== -1) return -1;
    // If only b is matched, it comes first
    if (bMatchIndex !== -1) return 1;
    // Neither matched, sort by UID descending (newest first)
    return b.uid - a.uid;
  });

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

// Get media URL

// Helper function to get media URL for an entry
function getEntryMediaUrl(entryUid: number): string {
  if (!mediaMetadata.value || !mediaMetadata.value.entries[entryUid]) {
    return '';
  }
  return getMediaUrl(mediaMetadata.value.entries[entryUid].mediaId);
}

/**
 * Clean message text by removing unwanted content for keyword matching
 * - Removes text inside <...> tags (angle brackets)
 * - Removes text inside <!-- --> comments
 * - Removes text inside <memo></memo> tags
 * - Removes text inside </think>...</think> tags (LLM chain-of-thought)
 * - Removes text inside <thinking>...</thinking> tags (LLM chain-of-thought)
 */
function cleanMessageText(text: string): string {
  let cleaned = text;

  // Remove HTML comments <!-- ... -->
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove memo tags <memo>...</memo>
  cleaned = cleaned.replace(/<memo>[\s\S]*?<\/memo>/gi, '');

  // Remove thinking tags <thinking>...</thinking> (LLM chain-of-thought)
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

  // Remove think tags <think>...</think> (LLM chain-of-thought)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Remove any remaining tags with angle brackets <...>
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  return cleaned;
}

// Extract keywords from entry name (comment field)
function extractEntryNameKeywords(comment: string): string[] {
  // Delimit by whitespace
  const words = comment.split(/\s+/);

  // Filter out common words and strip quotes
  const keywords: string[] = [];
  for (const word of words) {
    const trimmed = word.trim();
    if (!trimmed) continue;

    // Check if it's a common word (case-insensitive)
    if (COMMON_WORDS.has(trimmed.toLowerCase())) continue;

    // Strip leading/trailing single or double quotes
    // Examples: "'Hira'" -> "Hira", '"Hira"' -> "Hira", "Hira" -> "Hira"
    const stripped = trimmed.replace(/^['"]|['"]$/g, '');

    if (stripped) {
      keywords.push(stripped);
    }
  }

  return keywords;
}

// Find visual keywords in message text
function findMatchingVisualKeywords(messageText: string): number[] {
  if (!selectedLorebook.value || !mediaMetadata.value) return [];

  const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
  if (!book) return [];

  const text = cleanMessageText(messageText).toLowerCase();
  const matchedUids: number[] = [];

  const enableKeywordMatching = props.api.settings.get('enableKeywordMatching') ?? true;
  const enableEntryNameMatching = props.api.settings.get('enableEntryNameMatching') ?? false;

  // Scan all entries with media for keyword matches
  for (const [uidStr] of Object.entries(mediaMetadata.value.entries)) {
    const uid = Number(uidStr);
    const entry = book.entries.find((e) => e.uid === uid);

    if (!entry) continue;

    let matched = false;

    // Check keyword matching (if enabled)
    if (enableKeywordMatching) {
      for (const keyword of entry.key) {
        const trimmedKeyword = keyword.trim();
        if (trimmedKeyword && text.includes(trimmedKeyword.toLowerCase())) {
          console.log(
            `[Visual Lorebook] Keyword matched - Keyword: "${trimmedKeyword}", UID: ${uid}, Comment: "${entry.comment}"`,
          );
          matchedUids.push(uid);
          matched = true;
          break;
        }
      }
    }

    // Check entry name matching (if enabled and not already matched)
    if (!matched && enableEntryNameMatching) {
      const entryNameKeywords = extractEntryNameKeywords(entry.comment);
      for (const keyword of entryNameKeywords) {
        const keywordLower = keyword.toLowerCase();
        // Match exact keyword OR possessive form (e.g., "Hira" matches "Hira" or "Hira's")
        if (text.includes(keywordLower) || text.includes(`${keywordLower}'s`)) {
          console.log(
            `[Visual Lorebook] Entry name matched - Keyword: "${keyword}", UID: ${uid}, Comment: "${entry.comment}"`,
          );
          matchedUids.push(uid);
          matched = true;
          break;
        }
      }
    }
  }

  return matchedUids;
}

// Check if an entry is matched
function isEntryMatched(entryUid: number): boolean {
  return matchedEntryUids.value.includes(entryUid);
}

// Get the match position (1-based) for an entry
function getMatchPosition(entryUid: number): number | null {
  const index = matchedEntryUids.value.indexOf(entryUid);
  return index !== -1 ? index + 1 : null;
}

// Fetch metadata when lorebook changes
watch(selectedLorebook, () => {
  loadMediaMetadata();
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

// Set up event listener for generation finished
onMounted(() => {
  // Restore last selected lorebook from settings
  const lastSelected = props.api.settings.get('lastSelectedLorebook');
  if (lastSelected && lorebooks.value.some((l) => l.value === lastSelected)) {
    selectedLorebook.value = lastSelected;
  }

  // Restore matched entry order from settings for current lorebook
  const matchedOrder = props.api.settings.get('matchedEntryOrder') || {};
  if (lastSelected && matchedOrder[lastSelected]) {
    matchedEntryUids.value = matchedOrder[lastSelected];
  }

  // Restore showOnlyActiveCharacters from settings
  const savedShowOnlyActive = props.api.settings.get('showOnlyActiveCharacters');
  showOnlyActiveCharacters.value = savedShowOnlyActive ?? false;

  // Listen for generation finished to detect new LLM responses
  const unsubscribe = props.api.events.on('generation:finished', async (result) => {
    if (result.message && !result.message.is_user) {
      // This is an AI response, scan for visual keywords
      console.log('[Visual Lorebook] Scanning message for visual keywords:', result.message.mes);
      const matchedUids = findMatchingVisualKeywords(result.message.mes);

      if (matchedUids.length > 0) {
        console.log('[Visual Lorebook] Found matched entries:', matchedUids);
        // Update matched entry order (most recent first)
        // Remove any existing occurrences and prepend new matches
        matchedEntryUids.value = [
          ...matchedUids,
          ...matchedEntryUids.value.filter((uid) => !matchedUids.includes(uid)),
        ];
        console.log('[Visual Lorebook] Updated matched order:', matchedEntryUids.value);
      } else {
        console.log('[Visual Lorebook] No visual keyword matches found');
      }
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe();
  });
});

// Reset matched entries when switching lorebooks
watch(selectedLorebook, () => {
  matchedEntryUids.value = [];
});

// Persist selected lorebook to settings
watch(selectedLorebook, (newLorebook) => {
  props.api.settings.set('lastSelectedLorebook', newLorebook);
});

// Persist showOnlyActiveCharacters toggle to settings
watch(showOnlyActiveCharacters, (newValue) => {
  props.api.settings.set('showOnlyActiveCharacters', newValue);
});

// Persist matched entry order to settings
watch(
  matchedEntryUids,
  (newOrder) => {
    if (selectedLorebook.value) {
      const matchedOrder = props.api.settings.get('matchedEntryOrder') || {};
      matchedOrder[selectedLorebook.value] = newOrder;
      props.api.settings.set('matchedEntryOrder', matchedOrder);
    }
  },
  { deep: true },
);

// Watch for changes in active entries and log when entries are removed
let previousActiveEntries = new Set<number>();
watch(
  activeEntries,
  (newActiveEntries) => {
    if (!selectedLorebook.value || !mediaMetadata.value) return;

    const book = worldInfoStore.worldInfoCache[selectedLorebook.value];
    if (!book) return;

    // Find entries that were in the previous active set but not in the new set
    const removedUids: number[] = [];
    for (const uid of previousActiveEntries) {
      if (!newActiveEntries.has(uid)) {
        removedUids.push(uid);
      }
    }

    // Log removed entries
    for (const uid of removedUids) {
      const entry = book.entries.find((e) => e.uid === uid);
      if (entry) {
        console.log(
          `[Visual Lorebook] Active filter removed - UID: ${uid}, Comment: "${entry.comment}"`,
        );
      }
    }

    // Update previous active entries for next comparison
    previousActiveEntries = new Set(newActiveEntries);
  },
  { deep: true },
);

async function handleMediaSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Determine which entry to upload to (from inline replace or upload section)
  const entryUid = entryUidForReplace.value !== 0 ? entryUidForReplace.value : selectedEntryForUpload.value;
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
      },
    });

    // Refresh media metadata
    await loadMediaMetadata();

    props.api.ui.showToast(t('extensionsBuiltin.visualLorebook.mediaUploaded'), 'success');

    // Clear selections
    selectedEntryForUpload.value = 0;
    entryUidForReplace.value = 0;
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

// Handle media replacement for specific entry
function handleReplaceMedia(event: Event, entryUid: number) {
  event.stopPropagation();
  entryUidForReplace.value = entryUid;
  mediaInputRef.value?.click();
}

// Handle media removal for specific entry
async function handleRemoveMedia(event: Event, entryUid: number) {
  event.stopPropagation();

  if (!selectedLorebook.value) return;

  const entryMediaData = mediaMetadata.value?.entries[entryUid];
  if (!entryMediaData) return;

  const mediaId = entryMediaData.mediaId;

  // Confirm deletion
  const confirmed = confirm(t('extensionsBuiltin.visualLorebook.deleteConfirm'));
  if (!confirmed) return;

  // Delete from backend
  try {
    await deleteMedia({ mediaId });

    // Update parallel media JSON file to remove entry
    await removeMediaMetadata(selectedLorebook.value, {
      entryUid,
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
  selectedLorebook.value = Array.isArray(value) ? (value[0] as string) : (value as string);
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
      <Button
        :variant="showOnlyActiveCharacters ? 'confirm' : 'ghost'"
        :icon="showOnlyActiveCharacters ? 'fa-eye' : 'fa-eye-slash'"
        title="Show only active characters"
        class="toggle-active-characters"
        @click="showOnlyActiveCharacters = !showOnlyActiveCharacters"
      />
    </FormItem>

    <!-- Entry Search -->
    <FormItem v-if="false">
      <Search v-model="searchQuery" :placeholder="t('extensionsBuiltin.visualLorebook.searchPlaceholder')" />
    </FormItem>

    <!-- Entry Grid - Only shows entries WITH media -->
    <div v-if="selectedLorebook" class="entry-grid">
      <div v-if="entriesWithMedia.length === 0" class="empty-state">
        {{ t('extensionsBuiltin.visualLorebook.noEntriesWithMedia') }}
      </div>

      <div
        v-for="entry in entriesWithMedia"
        :key="entry.uid"
        class="entry-card"
        :class="{
          matched: isEntryMatched(entry.uid),
        }"
      >
        <div class="entry-header">
          <span class="entry-key">{{ entry.comment || 'No Name' }}</span>
          <span v-if="isEntryMatched(entry.uid)" class="match-badge"> #{{ getMatchPosition(entry.uid) }} </span>
        </div>

        <!-- Media thumbnail with hover controls -->
        <div class="entry-media">
          <img
            v-if="mediaMetadata?.entries[entry.uid]?.mediaType === 'image'"
            :src="getEntryMediaUrl(entry.uid)"
            alt="UID {{ entry.uid }}"
          />
          <video v-else :src="getEntryMediaUrl(entry.uid)" class="preview-video" autoplay loop></video>

          <!-- Icon-only controls overlay (centered, shown on hover) -->
          <div class="entry-card-controls">
            <Button
              variant="ghost"
              icon="fa-upload"
              :disabled="isUploadingMedia"
              :title="t('extensionsBuiltin.visualLorebook.replaceMedia')"
              @click="(e) => handleReplaceMedia(e, entry.uid)"
            />
            <Button
              variant="danger"
              icon="fa-trash-can"
              :title="t('extensionsBuiltin.visualLorebook.removeMedia')"
              @click="(e) => handleRemoveMedia(e, entry.uid)"
            />
          </div>
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

      <div v-if="selectedEntryForUpload !== 0" class="upload-placeholder">
        <Button variant="ghost" icon="fa-upload" :disabled="isUploadingMedia" @click="mediaInputRef?.click()">
          {{
            isUploadingMedia
              ? t('extensionsBuiltin.visualLorebook.uploading')
              : t('extensionsBuiltin.visualLorebook.uploadMedia')
          }}
        </Button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input ref="mediaInputRef" type="file" accept="image/*,video/*" style="display: none" @change="handleMediaSelect" />
  </div>
</template>

<style lang="scss" scoped>
@import './style.scss';
</style>
