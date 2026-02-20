import type { VisualLorebookFile, VisualLorebookMediaData } from './types';
import { getRequestHeaders } from '../../../utils/client';

export interface UploadMediaRequest {
  file: File;
  lorebook: string;
  entryUid: number;
}

export interface UploadMediaResponse {
  filename: string;
  lorebook: string;
  entryUid: number;
  path: string;
  size: number;
  mimetype: string;
}

export interface DeleteMediaRequest {
  mediaId: string;
}

export interface UpdateMetadataRequest {
  entryUid: number;
  mediaData: VisualLorebookMediaData;
}

export interface RemoveMetadataRequest {
  entryUid: number;
}

const API_BASE = '/api/visual-lorebook';

/**
 * Upload a media file to backend
 */
export async function uploadMedia(request: UploadMediaRequest): Promise<UploadMediaResponse> {
  const formData = new FormData();
  // Use 'avatar' as field name to match global multer middleware
  formData.append('avatar', request.file);
  formData.append('lorebook', request.lorebook);
  formData.append('entryUid', request.entryUid.toString());

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: getRequestHeaders({ omitContentType: true }),
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload media');
  }

  return response.json();
}

/**
 * Delete a media file from backend
 */
export async function deleteMedia(request: DeleteMediaRequest): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/delete`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to delete media');
  }

  return response.json();
}

/**
 * Get URL for a media file
 */
export function getMediaUrl(mediaId: string): string {
  return `${API_BASE}/media/${mediaId}`;
}

/**
 * Fetch media metadata for a lorebook
 */
export async function fetchMediaMetadata(lorebookName: string): Promise<VisualLorebookFile | null> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`, {
    headers: getRequestHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to fetch media metadata');
  }

  return response.json();
}

/**
 * Update media metadata for a lorebook entry
 */
export async function updateMediaMetadata(
  lorebookName: string,
  request: UpdateMetadataRequest,
): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to update media metadata');
  }

  return response.json();
}

/**
 * Remove media metadata for a lorebook entry
 */
export async function removeMediaMetadata(
  lorebookName: string,
  request: RemoveMetadataRequest,
): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/metadata/${lorebookName}`, {
    method: 'DELETE',
    headers: getRequestHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error('Failed to remove media metadata');
  }

  return response.json();
}
