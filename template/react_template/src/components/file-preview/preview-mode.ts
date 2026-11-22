import { getFileIconKind } from '@/commons/utils/files';

/** Preview modes beyond the default FileViewer path. */
export type FilePreviewMode = 'html' | 'viewer';

export function isHtmlFile(name: string): boolean {
  return getFileIconKind(name) === 'html';
}

export function getFilePreviewMode(name: string): FilePreviewMode {
  if (isHtmlFile(name)) return 'html';
  return 'viewer';
}

export function hasSpecialPreview(name: string): boolean {
  return getFilePreviewMode(name) !== 'viewer';
}
