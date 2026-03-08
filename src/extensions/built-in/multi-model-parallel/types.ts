export const DEFAULT_SETTINGS: MultiModelSettings = {
  enabled: false,
  connectionProfiles: [],
  maxSwipes: 3,
};

export interface MultiModelSettings {
  enabled: boolean;
  connectionProfiles: string[]; // Array of profile IDs
  maxSwipes: number; // Maximum number of swipes to generate
}

export interface ParallelGenerationState {
  isGenerating: boolean;
  profiles: string[];
  messageIndex: number | null;
  controller: AbortController | null;
}

export interface ProfileResponse {
  profileId: string;
  content: string;
  swipeIndex: number;
}
