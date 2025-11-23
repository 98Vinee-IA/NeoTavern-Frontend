import { get, set } from 'lodash-es';
import { type Character } from '../types';
import {
  CHARACTER_FIELD_MAPPINGS,
  depth_prompt_depth_default,
  depth_prompt_role_default,
  talkativeness_default,
} from '../constants';

/**
 * Calculates the differences between an old character state and a new character state.
 * Returns a partial object containing only the fields that have changed, or null if no changes.
 */
export function getCharacterDifferences(oldChar: Character, newChar: Character): Partial<Character> | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diffs: Record<string, any> = {};

  // 1. Map specific fields based on CHARACTER_FIELD_MAPPINGS
  for (const [frontendKey, backendPath] of Object.entries(CHARACTER_FIELD_MAPPINGS)) {
    const newValue = get(newChar, frontendKey);
    const oldValue = get(oldChar, frontendKey);

    // Only add if the value is present in the update data and different
    if (newValue !== undefined && JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
      set(diffs, backendPath, newValue);
      set(diffs, frontendKey, newValue);
    }
  }

  // 2. Handle 'data' object changes generally (for fields not in mapping but still relevant)
  if (newChar.data) {
    const backendDataPath = 'data';
    const newData = newChar.data;
    const oldData = oldChar.data || {};

    const ignoreKeys = ['extensions']; // Handled via mapping or specific logic

    for (const key in newData) {
      if (ignoreKeys.includes(key)) continue;

      const newSubValue = newData[key];
      const oldSubValue = oldData[key];

      if (JSON.stringify(newSubValue) !== JSON.stringify(oldSubValue)) {
        set(diffs, `${backendDataPath}.${key}`, newSubValue);
      }
    }
  }

  return Object.keys(diffs).length > 0 ? diffs : null;
}

/**
 * Creates a FormData object for character creation API calls.
 */
export function createCharacterFormData(character: Character, fileToSend: File | null, uuid: string): FormData {
  const formData = new FormData();

  // Basic fields
  formData.append('ch_name', character.name);
  if (fileToSend) {
    formData.append('avatar', fileToSend);
  }
  formData.append('preserved_name', uuid);
  formData.append('fav', String(character.fav || false));
  formData.append('description', character.description || '');
  formData.append('first_mes', character.first_mes || '');

  // Empty fields for compatibility with SillyTavern backend
  formData.append('json_data', '');
  formData.append('avatar_url', '');
  formData.append('chat', '');
  formData.append('create_date', '');
  formData.append('last_mes', '');
  formData.append('world', '');

  // Advanced fields
  formData.append('system_prompt', character.data?.system_prompt || '');
  formData.append('post_history_instructions', character.data?.post_history_instructions || '');
  formData.append('creator', character.data?.creator || '');
  formData.append('character_version', character.data?.character_version || '');
  formData.append('creator_notes', character.data?.creator_notes || '');
  formData.append('tags', (character.tags || []).join(','));
  formData.append('personality', character.personality || '');
  formData.append('scenario', character.scenario || '');

  // Depth Prompt (Flattened structure)
  formData.append('depth_prompt_prompt', character.data?.depth_prompt?.prompt || '');
  formData.append('depth_prompt_depth', String(character.data?.depth_prompt?.depth ?? depth_prompt_depth_default));
  formData.append('depth_prompt_role', character.data?.depth_prompt?.role || depth_prompt_role_default);

  // Character Book
  if (character.data?.character_book) {
    formData.append('character_book', JSON.stringify(character.data.character_book));
  }

  formData.append('talkativeness', String(character.talkativeness ?? talkativeness_default));
  formData.append('mes_example', character.mes_example || '');
  formData.append('extensions', JSON.stringify({}));

  return formData;
}

/**
 * Filters and sorts a list of characters.
 */
export function filterAndSortCharacters(characters: Character[], searchTerm: string, sortOrder: string): Character[] {
  // 1. Filter characters based on search term
  const lowerSearchTerm = searchTerm.toLowerCase();
  const filteredCharacters =
    lowerSearchTerm.length > 0
      ? characters.filter((char) => {
          return (
            char.name.toLowerCase().includes(lowerSearchTerm) ||
            char.description?.toLowerCase().includes(lowerSearchTerm) ||
            char.tags?.join(',').toLowerCase().includes(lowerSearchTerm)
          );
        })
      : characters;

  // 2. Sort the filtered characters
  const [sortKey, sortDir] = sortOrder.split(':') as ['name' | 'create_date' | 'fav', 'asc' | 'desc'];

  return [...filteredCharacters].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'create_date': {
        const dateA = a.create_date ? new Date(a.create_date).getTime() : 0;
        const dateB = b.create_date ? new Date(b.create_date).getTime() : 0;
        return (dateA - dateB) * dir;
      }
      case 'fav': {
        const favA = a.fav ? 1 : 0;
        const favB = b.fav ? 1 : 0;
        if (favA !== favB) return (favB - favA) * dir; // Favorites first
        return a.name.localeCompare(b.name); // Then sort by name
      }
      default:
        return 0;
    }
  });
}
