import { getRequestHeaders } from '../utils/api';
import type { Character } from '../types';

export async function fetchChat(character: Character, chatMetadata: Record<string, any>): Promise<any[]> {
  const response = await fetch('/api/chats/get', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      ch_name: character.name,
      file_name: character.chat,
      avatar_url: character.avatar,
      chat_metadata: chatMetadata,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat history');
  }

  return await response.json();
}

export async function saveChat(character: Character, chatToSave: any[]): Promise<void> {
  const response = await fetch('/api/chats/save', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify({
      ch_name: character.name,
      file_name: character.chat,
      chat: chatToSave,
      avatar_url: character.avatar,
      force: false, // For now, we won't handle the integrity check failure popup
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // TODO: Handle integrity check failure with a user prompt
    if (errorData?.error === 'integrity') {
      throw new Error('Chat integrity check failed. Data may be out of sync.');
    }
    throw new Error('Failed to save chat history');
  }
}
