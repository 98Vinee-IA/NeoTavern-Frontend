import type { SamplerSettings } from '../types';
import type { InstructTemplate } from '../types/instruct';
import { getRequestHeaders } from '../utils/client';
import { fetchUserSettings } from './settings';

export interface Preset {
  name: string;
  preset: SamplerSettings;
}

export async function fetchAllExperimentalPresets(): Promise<Preset[]> {
  const userSettingsResponse = await fetchUserSettings();

  const presets: Preset[] = [];
  const names = userSettingsResponse.v2ExperimentalSamplerPreset_names ?? [];
  const settingsData = userSettingsResponse.v2ExperimentalSamplerPreset_settings ?? [];

  if (Array.isArray(names) && Array.isArray(settingsData)) {
    names.forEach((name: string, i: number) => {
      try {
        presets.push({
          name,
          preset: settingsData[i],
        });
      } catch (e: unknown) {
        console.error(`Failed to parse preset "${name}":`, settingsData[i]);
        console.error(e);
      }
    });
  }

  return presets;
}

export async function saveExperimentalPreset(name: string, preset: SamplerSettings): Promise<void> {
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

  await response.json();
}

export async function deleteExperimentalPreset(name: string): Promise<void> {
  const response = await fetch('/api/presets/delete', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ apiId: 'v2ExperimentalSamplerPreset', name }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete preset');
  }

  await response.json();
}

export async function fetchAllInstructTemplates(): Promise<InstructTemplate[]> {
  const userSettingsResponse = await fetchUserSettings();
  return userSettingsResponse.instruct;
}

export async function saveInstructTemplate(template: InstructTemplate): Promise<void> {
  const response = await fetch('/api/presets/save', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      apiId: 'instruct',
      name: template.name,
      preset: template,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save instruct template');
  }

  await response.json();
}

export async function deleteInstructTemplate(name: string): Promise<void> {
  const response = await fetch('/api/presets/delete', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      apiId: 'instruct',
      name: name,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete instruct template');
  }

  await response.json();
}
