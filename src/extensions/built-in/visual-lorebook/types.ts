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
  visualKeyword: string; // Optional text keyword for visual reference
}

// Structure of the parallel media JSON file
export interface VisualLorebookFile {
  name: string; // Lorebook name (matches original lorebook file)
  entries: Record<number, VisualLorebookMediaData>; // Entry UID -> Media data mapping
}
