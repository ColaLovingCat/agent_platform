import { checkAPI } from '@/commons/types/api.types';
import * as extend from '@/commons/utils/extends';

function buildFetchUrl(url: string, download: boolean): string {
  const params = new URLSearchParams({ url });
  if (download) params.set('download', 'true');
  return checkAPI(`/api/files/fetch?${params.toString()}`);
}

/**
 * Preview always goes through /api/files/fetch:
 * - Backend reads local /uploads/* from disk when URL matches this service
 * - Backend proxies external URLs over HTTP (preview = inline stream)
 */
export function resolvePreviewFetchUrl(sourceUrl: string): string {
  if (!sourceUrl) return sourceUrl;

  try {
    const parsed = new URL(sourceUrl, window.location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return buildFetchUrl(sourceUrl, false);
    }
  } catch {
    // fall through
  }

  return checkAPI(sourceUrl.startsWith('/') ? sourceUrl : `/${sourceUrl}`);
}

export async function fetchPreviewBlob(sourceUrl: string): Promise<Blob> {
  const fetchUrl = resolvePreviewFetchUrl(sourceUrl);
  const headers: Record<string, string> = {};
  const token = extend.ExLocalStore.get('token');
  if (token) {
    headers.Authorization = token;
  }

  // omit credentials: backend CORS uses AllowAnyOrigin(), which rejects credentialed requests
  const response = await fetch(fetchUrl, {
    credentials: 'omit',
    headers,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // non-json error body
    }
    throw new Error(detail);
  }

  return response.blob();
}
