import { getRequestHeaders } from '../utils/api';
import type { Character } from '../types';

export async function fetchAllCharacters(): Promise<Character[]> {
  const response = await fetch('/api/characters/all', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // Catch if json parsing fails
    throw new Error(errorData?.overflow ? 'overflow' : 'Failed to fetch characters');
  }

  return await response.json();
}

export async function fetchCharacterByAvatar(avatar: string): Promise<Character> {
  const response = await fetch('/api/characters/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({ avatar_url: avatar }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch character with avatar: ${avatar}`);
  }

  return await response.json();
}

export async function saveCharacter(character: Partial<Character> & { avatar: string }): Promise<void> {
  if (!character.avatar) {
    throw new Error('`character.avatar` (character filename) is required to save character data.');
  }

  await fetch('/api/characters/merge-attributes', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(character),
    cache: 'no-cache',
  });
}
