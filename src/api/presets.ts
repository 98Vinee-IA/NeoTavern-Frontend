import type { SamplerSettings } from '../types';
import type { InstructTemplate } from '../types/instruct';
import { getRequestHeaders } from '../utils/client';
import { fetchUserSettings } from './settings';

export interface Preset {
  name: string;
  preset: SamplerSettings;
}

export async function fetchAllExperimentalPresets(): Promise<Preset[]> {
  const response = await fetch('/api/plugins/v2/v2ExperimentalSamplerPreset', {
    method: 'GET',
    headers: getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch experimental presets');
  }

  return await response.json();
}

export async function fetchExperimentalPreset(name: string): Promise<Preset> {
  const response = await fetch(`/api/plugins/v2/v2ExperimentalSamplerPreset/${encodeURIComponent(name)}`, {
    method: 'GET',
    headers: getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch preset');
  }

  return await response.json();
}

export async function saveExperimentalPreset(name: string, preset: SamplerSettings): Promise<void> {
  const response = await fetch('/api/plugins/v2/v2ExperimentalSamplerPreset', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ name, preset }),
  });

  if (!response.ok) {
    throw new Error('Failed to save preset');
  }
}

export async function deleteExperimentalPreset(name: string): Promise<void> {
  const response = await fetch(`/api/plugins/v2/v2ExperimentalSamplerPreset/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: getRequestHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete preset');
  }
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
