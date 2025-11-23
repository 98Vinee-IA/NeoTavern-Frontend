import { type Character, type ChatMessage, type ChatMetadata } from '../types';
import { GroupReplyStrategy, talkativeness_default } from '../constants';

/**
 * Determines which character should speak next based on the group configuration,
 * history, and reply strategy.
 */
export function determineNextSpeaker(
  activeMembers: Character[],
  groupConfig: ChatMetadata['group'] | null,
  chatMessages: ChatMessage[],
): Character | null {
  // 1. Default fallback if no group config exists (e.g. single chat masquerading)
  if (!groupConfig) {
    return activeMembers.length > 0 ? activeMembers[0] : null;
  }

  // 2. Filter out muted members
  // We strictly check the muted boolean from the map
  const validSpeakers = activeMembers.filter((c) => !groupConfig.members[c.avatar]?.muted);

  if (validSpeakers.length === 0) return null; // Everyone muted

  const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
  const strategy = groupConfig.config.replyStrategy;

  // Strategy: List Order (Round Robin)
  if (strategy === GroupReplyStrategy.LIST_ORDER) {
    if (!lastMessage || lastMessage.is_user) return validSpeakers[0];
    const lastIndex = validSpeakers.findIndex((c) => c.avatar === lastMessage.original_avatar);

    // If last speaker isn't in valid list (e.g. was muted), restart at 0, else next
    const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % validSpeakers.length;
    return validSpeakers[nextIndex];
  }

  // Strategy: Pooled Order (Random among those who haven't spoken since user)
  if (strategy === GroupReplyStrategy.POOLED_ORDER) {
    // Check who hasn't spoken since last user message
    let lastUserIndex = -1;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].is_user) {
        lastUserIndex = i;
        break;
      }
    }

    const speakersSinceUser = new Set<string>();
    if (lastUserIndex > -1) {
      for (let i = lastUserIndex + 1; i < chatMessages.length; i++) {
        if (!chatMessages[i].is_user) speakersSinceUser.add(chatMessages[i].name);
      }
    }

    const available = validSpeakers.filter((c) => !speakersSinceUser.has(c.name));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // All spoke? Pick random from valid speakers.
    return validSpeakers[Math.floor(Math.random() * validSpeakers.length)];
  }

  // Strategy: Natural Order (Mentions > Random based on Talkativeness)
  if (strategy === GroupReplyStrategy.NATURAL_ORDER) {
    if (!lastMessage) return validSpeakers[Math.floor(Math.random() * validSpeakers.length)];

    const textToCheck = lastMessage.mes.toLowerCase();
    const mentions: Character[] = [];

    // A. Check mentions
    for (const char of validSpeakers) {
      // Skip self-response unless allowed
      if (!groupConfig.config.allowSelfResponses && lastMessage.original_avatar === char.avatar) continue;

      // Simple name matching (case-insensitive word boundary)
      const nameParts = char.name.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 2 && new RegExp(`\\b${part}\\b`).test(textToCheck)) {
          mentions.push(char);
          break;
        }
      }
    }

    if (mentions.length > 0) {
      return mentions[0]; // Pick first mention
    }

    // B. Talkativeness RNG
    const candidates: Character[] = [];
    for (const char of validSpeakers) {
      if (!groupConfig.config.allowSelfResponses && lastMessage.original_avatar === char.avatar) continue;

      const chance = (char.talkativeness ?? talkativeness_default) * 100;
      if (Math.random() * 100 < chance) {
        candidates.push(char);
      }
    }

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // C. Fallback (Random)
    return validSpeakers[Math.floor(Math.random() * validSpeakers.length)];
  }

  // Manual/Default fallback
  return null;
}
