export interface VisualLorebookSettings {
  maxImageSize: number; // Max image size in bytes (default: 5MB)
  maxVideoSize: number; // Max video size in bytes (default: 50MB)
  enabled: boolean;
  lastSelectedLorebook: string; // Last selected lorebook filename
  showOnlyActiveCharacters: boolean; // Show only characters mentioned in recent messages
  activeCharacterLookback: number; // Number of messages to look back for character mentions
  matchedEntryOrder: Record<string, number[]>; // Lorebook filename -> array of entry UIDs in matched order
  keywordLookbackCount: number; // Number of chat messages to look back for keyword matches
  enableKeywordMatching: boolean; // Enable matching by lorebook keywords (entry.key)
  enableEntryNameMatching: boolean; // Enable matching by entry name (comment field)
  autoClearMatchedEntriesAfterMessages: number; // Number of messages after which to auto-clear matched entries (default: 20)
}

export const defaultSettings: VisualLorebookSettings = {
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  enabled: true,
  lastSelectedLorebook: '',
  showOnlyActiveCharacters: false,
  activeCharacterLookback: 3,
  matchedEntryOrder: {},
  keywordLookbackCount: 3,
  enableKeywordMatching: true,
  enableEntryNameMatching: false,
  autoClearMatchedEntriesAfterMessages: 3,
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
