# Visual Lorebook Inline Controls UX Improvement

## Current State Analysis

### How it works now:

1. **Entry Grid** - Displays cards with images/videos for entries that have media
2. **Selection** - Clicking an entry card sets `selectedEntryUid`
3. **Separate Edit Panel** - A "Selected Entry Media Section" appears above the grid with:
   - Full-size preview of the selected media
   - "Replace Media" button
   - "Remove Media" button
   - Close button to deselect

### Problems:

- Users must scroll to find the edit panel
- The panel can be far from the entry they clicked
- Creates context switching between grid and panel

## Desired UX

### How it should work:

1. **Entry Grid** - Same as before, displays cards with images/videos
2. **Hover to Reveal** - Hovering over an entry card reveals icon-only controls centered on the image
3. **Controls Disappear** - Controls disappear when mouse moves away
4. **No Scrolling Needed** - Controls appear exactly where the user is looking

## Implementation Plan

### 1. VisualLorebookPanel.vue Changes

#### Remove state changes:

- No need for `expandedEntryUid` - using hover instead
- Remove `toggleEntryControls` function
- Simplify handlers to work with entryUid directly

#### Modify entry card template:

```vue
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
    <span v-if="isEntryMatched(entry.uid)" class="match-badge">
      #{{ getMatchPosition(entry.uid) }}
    </span>
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
        @click="(e) => handleReplaceMedia(e, entry.uid)"
        title="Replace media"
      />
      <Button
        variant="danger"
        icon="fa-trash-can"
        @click="(e) => handleRemoveMediaForEntry(e, entry.uid)"
        title="Delete media"
      />
    </div>
  </div>
</div>
```

#### Update handlers:

```typescript
// Handle media replacement for specific entry
async function handleReplaceMedia(event: Event, entryUid: number) {
  event.stopPropagation();
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

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

// Handle media removal for specific entry
async function handleRemoveMediaForEntry(event: Event, entryUid: number) {
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
```

#### Remove or simplify the "Selected Entry Media Section":

- Remove it entirely since controls are now inline on hover

### 2. style.scss Changes

#### Add new styles for inline controls:

```scss
.entry-card {
  // ... existing styles ...

  position: relative;
}

.entry-media {
  // ... existing styles ...
  position: relative;

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.entry-card-controls {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 12px 16px;
  border-radius: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;

  // Show on hover
  .entry-media:hover & {
    opacity: 1;
    pointer-events: auto;
  }

  button {
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    transition:
      transform 0.2s ease,
      background 0.2s ease;

    &:hover {
      transform: scale(1.1);
      background: white;
    }

    &:active {
      transform: scale(0.95);
    }

    &.variant-danger {
      background: rgba(220, 53, 69, 0.9);
      color: white;

      &:hover {
        background: rgb(220, 53, 69);
      }
    }
  }
}
```

### 3. Optional i18n Updates

No new keys needed - using existing `replaceMedia` and `removeMedia` keys for tooltips.

## Visual Flow

```
Before:
┌─────────────────────────────────┐
│ Selected Entry Media Section    │  ← Edit panel (separate)
│ [Preview Image]                 │
│ [Replace] [Delete] [Close]      │
├─────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │ Img  │ │ Img  │ │ Img  │     │  ← Entry grid
│ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────┘

After (normal state):
┌─────────────────────────────────┐
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │ Img  │ │ Img  │ │ Img  │     │  ← Entry grid
│ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────┘

After (hover state):
┌─────────────────────────────────┐
│ ┌──────┐ ┌──────┐ ┌──────┐     │
│ │ Img  │ │  📷🗑 │ │ Img  │     │  ← Icon-only controls centered
│ └──────┘ └──────┘ └──────┘     │
└─────────────────────────────────┘
```

## Files to Modify

1. `src/extensions/built-in/visual-lorebook/VisualLorebookPanel.vue`
2. `src/extensions/built-in/visual-lorebook/style.scss`

## Testing Checklist

- [ ] Hovering over an entry reveals centered icon-only controls
- [ ] Controls disappear when mouse moves away
- [ ] Upload button opens file picker and uploads new media
- [ ] Delete button removes media with confirmation
- [ ] Matched entries still show their badge correctly
- [ ] Active character filter still works
- [ ] Upload to entry without media still works
- [ ] Buttons have proper hover/active states
- [ ] Controls are properly centered on the image
