import { default_avatar } from '../constants';
import type { ThumbnailType } from '../types';
import { usePersonaStore } from '../stores/persona.store';
import { useCharacterStore } from '../stores/character.store';

/**
 * Generates a thumbnail URL for a given image type and file.
 * Appends a timestamp to bypass browser caching if the image has been updated.
 * @param type The type of entity (persona, avatar, bg).
 * @param file The filename.
 * @param timestampOverride An optional explicit timestamp. If not provided, it will be looked up from stores.
 */
export function getThumbnailUrl(type: ThumbnailType, file: string | undefined, timestampOverride?: number): string {
  if (!file || file === 'none') {
    return default_avatar;
  }

  let timestamp = timestampOverride;

  if (!timestamp) {
    if (type === 'persona') {
      const personaStore = usePersonaStore();
      timestamp = personaStore.lastAvatarUpdate;
    } else if (type === 'avatar') {
      const charStore = useCharacterStore();
      // Look up character update time from the store map
      timestamp = charStore.characterImageTimestamps[file];
    }
    // For 'bg', we currently don't have a persistent store tracker for updates,
    // so we might default to nothing (browser cache) or assume rarely changed.
    // If explicit bust is needed, timestampOverride should be used.
  }

  const query = timestamp ? `&t=${timestamp}` : '';
  return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}${query}`;
}

interface AvatarDetails {
  type: ThumbnailType;
  file?: string;
  isUser: boolean;
  forceAvatar?: string;
  activePlayerAvatar?: string | null;
}

/**
 * Resolves thumbnail and full-size URLs for an avatar based on various conditions.
 * @param details - The details of the avatar to resolve.
 * @returns An object with `thumbnail` and `full` URL strings.
 */
export function resolveAvatarUrls(details: AvatarDetails): { thumbnail: string; full: string } {
  // Case 1: A specific avatar is forced (e.g., for user messages).
  if (details.forceAvatar) {
    return { thumbnail: details.forceAvatar, full: details.forceAvatar };
  }

  // Case 2: It's a user message without a forced avatar.
  if (details.isUser) {
    const userAvatarFile = details.activePlayerAvatar ?? undefined;
    const thumbnail = getThumbnailUrl('persona', userAvatarFile);
    const full = userAvatarFile ? `/personas/${userAvatarFile}` : default_avatar;
    return { thumbnail, full };
  }

  // Case 3: It's a bot message.
  const characterAvatarFile = details.file;
  const thumbnail = getThumbnailUrl(details.type, characterAvatarFile);
  const full = characterAvatarFile ? `/characters/${characterAvatarFile}` : default_avatar;
  return { thumbnail, full };
}
