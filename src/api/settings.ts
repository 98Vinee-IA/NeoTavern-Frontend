import type { LegacyOaiPresetSettings, LegacyOaiSettings, LegacySettings, Settings } from '../types';
import type { InstructTemplate } from '../types/instruct';
import { getRequestHeaders } from '../utils/client';

export interface UserSettingsResponse {
  settings: string; // JSON string of LegacySettings
  openai_setting_names: string[];
  openai_settings: string[]; // JSON string of LegacyOaiPresetSettings
  v2ExperimentalSamplerPreset_names?: string[];
  v2ExperimentalSamplerPreset_settings?: string[]; // JSON string of SamplerSettings
  world_names: string[];
  instruct: InstructTemplate[];
}

export interface ParsedUserSettingsResponse {
  settings: LegacySettings;
  openai_setting_names: string[];
  openai_settings: LegacyOaiPresetSettings[];
  world_names: string[];
  instruct: InstructTemplate[];
}

let cachedResponse: ParsedUserSettingsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 2000; // 2 seconds cache duration to handle initial load bursts
let fetchPromise: Promise<ParsedUserSettingsResponse> | null = null;

let cachedV2Response: Settings | null = null;
let v2CacheTimestamp = 0;
let v2FetchPromise: Promise<Settings> | null = null;

export async function fetchUserSettings(force = false): Promise<ParsedUserSettingsResponse> {
  const now = Date.now();

  if (!force && cachedResponse && now - cacheTimestamp < CACHE_TTL) {
    return cachedResponse;
  }

  // Request coalescing: if a request is already in flight, return the existing promise.
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }

      const data = (await response.json()) as UserSettingsResponse;

      const parsed: ParsedUserSettingsResponse = {
        settings: JSON.parse(data.settings) as LegacySettings,
        openai_setting_names: data.openai_setting_names,
        openai_settings: data.openai_settings.map((s) => JSON.parse(s) as LegacyOaiSettings),
        world_names: data.world_names,
        instruct: data.instruct,
      };

      cachedResponse = parsed;
      cacheTimestamp = Date.now();

      return parsed;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export async function fetchV2Settings(force = false): Promise<Settings> {
  const now = Date.now();

  if (!force && cachedV2Response && now - v2CacheTimestamp < CACHE_TTL) {
    return cachedV2Response;
  }

  if (v2FetchPromise) {
    return v2FetchPromise;
  }

  v2FetchPromise = (async () => {
    try {
      const response = await fetch('/api/plugins/v2/settings', {
        method: 'GET',
        headers: getRequestHeaders(),
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch v2 user settings: ${response.statusText}`);
      }

      const data = (await response.json()) as Settings;

      cachedV2Response = data;
      v2CacheTimestamp = Date.now();

      return data;
    } finally {
      v2FetchPromise = null;
    }
  })();

  return v2FetchPromise;
}

export async function saveV2Settings(settings: Settings): Promise<void> {
  await fetch('/api/plugins/v2/settings', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(settings),
    cache: 'no-cache',
  });

  cachedV2Response = null;
  v2CacheTimestamp = 0;
}
