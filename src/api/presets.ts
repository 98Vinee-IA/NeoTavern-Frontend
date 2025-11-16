import type { LegacyOaiPresetSettings, SamplerSettings } from '../types';
import { getRequestHeaders } from '../utils/api';
import { fetchUserSettings } from './settings';

export interface Preset {
  name: string;
  preset: SamplerSettings;
}

export function migratePreset(legacyPreset: LegacyOaiPresetSettings): SamplerSettings {
  // @ts-ignore
  const newPreset: SamplerSettings = {};
  if (legacyPreset.temperature !== undefined) newPreset.temperature = legacyPreset.temperature;
  if (legacyPreset.frequency_penalty !== undefined) newPreset.frequency_penalty = legacyPreset.frequency_penalty;
  if (legacyPreset.presence_penalty !== undefined) newPreset.presence_penalty = legacyPreset.presence_penalty;
  if (legacyPreset.top_p !== undefined) newPreset.top_p = legacyPreset.top_p;
  if (legacyPreset.top_k !== undefined) newPreset.top_k = legacyPreset.top_k;
  if (legacyPreset.top_a !== undefined) newPreset.top_a = legacyPreset.top_a;
  if (legacyPreset.min_p !== undefined) newPreset.min_p = legacyPreset.min_p;
  if (legacyPreset.openai_max_context !== undefined) newPreset.max_context = legacyPreset.openai_max_context;
  if (legacyPreset.openai_max_tokens !== undefined) newPreset.max_tokens = legacyPreset.openai_max_tokens;
  if (legacyPreset.stream_openai !== undefined) newPreset.stream = legacyPreset.stream_openai;
  if (legacyPreset.prompts !== undefined) newPreset.prompts = legacyPreset.prompts;
  if (legacyPreset.prompt_order !== undefined)
    newPreset.prompt_order = { order: legacyPreset.prompt_order?.[0]?.order ?? [] };
  // TODO: Migrate other settings if needed

  // If there are no new keys, it means the preset was already in the new format.
  if (Object.keys(newPreset).length === 0) {
    // @ts-ignore
    return legacyPreset as SamplerSettings;
  }

  return newPreset;
}

export async function fetchAllExperimentalPresets(): Promise<Preset[]> {
  const userSettingsResponse = await fetchUserSettings();

  const presets: Preset[] = [];
  const names = userSettingsResponse.v2ExperimentalSamplerPreset_names ?? [];
  const settingsData = userSettingsResponse.v2ExperimentalSamplerPresets ?? [];

  if (Array.isArray(names) && Array.isArray(settingsData)) {
    names.forEach((name: string, i: number) => {
      try {
        presets.push({
          name,
          preset: settingsData[i],
        });
      } catch (e) {
        console.error(`Failed to parse preset "${name}":`, settingsData[i]);
      }
    });
  }

  return presets;
}

export async function saveExperimentalPreset(name: string, preset: SamplerSettings): Promise<any> {
  const response = await fetch('/api/presets/save', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      apiId: 'v2ExperimentalSamplerPreset',
      name,
      preset,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save preset');
  }

  return await response.json();
}

export async function deletePreset(name: string): Promise<any> {
  const response = await fetch('/api/presets/delete', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ apiId: 'v2ExperimentalSamplerPreset', name }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete preset');
  }

  return await response.json();
}
