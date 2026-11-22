import type { LucideIcon } from 'lucide-react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  Presentation,
} from 'lucide-react';

/** Unified file-type kind used by file tree, chat attachments, etc. */
export type FileIconKind =
  | 'html'
  | 'pdf'
  | 'image'
  | 'spreadsheet'
  | 'word'
  | 'presentation'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'default';

/** @deprecated Prefer FileIconKind */
export type FileTreeIconKind = FileIconKind;

const FILE_ICON_BY_EXT: Record<string, FileIconKind> = {
  html: 'html',
  htm: 'html',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  avif: 'image',
  heic: 'image',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
  tsv: 'spreadsheet',
  ods: 'spreadsheet',
  doc: 'word',
  docx: 'word',
  ppt: 'presentation',
  pptx: 'presentation',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  m4v: 'video',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  m4a: 'audio',
  aac: 'audio',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  rar: 'archive',
  '7z': 'archive',
  json: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  py: 'code',
  txt: 'text',
  md: 'text',
  log: 'text',
};

/** Tailwind text color class per file kind (icons / labels). */
export const FILE_ICON_TEXT_COLORS: Record<FileIconKind, string> = {
  html: 'text-amber-500',
  pdf: 'text-red-500',
  image: 'text-emerald-500',
  spreadsheet: 'text-green-600',
  word: 'text-blue-600',
  presentation: 'text-orange-500',
  video: 'text-purple-500',
  audio: 'text-pink-500',
  archive: 'text-yellow-600',
  code: 'text-sky-500',
  text: 'text-slate-500',
  default: 'text-slate-400',
};

/** Tailwind background color class per file kind (corner dots / badges). */
export const FILE_ICON_DOT_COLORS: Record<FileIconKind, string> = {
  html: 'bg-amber-500',
  pdf: 'bg-red-500',
  image: 'bg-emerald-500',
  spreadsheet: 'bg-green-600',
  word: 'bg-blue-600',
  presentation: 'bg-orange-500',
  video: 'bg-purple-500',
  audio: 'bg-pink-500',
  archive: 'bg-yellow-500',
  code: 'bg-sky-500',
  text: 'bg-slate-500',
  default: 'bg-slate-400',
};

const FILE_KIND_ICONS: Record<FileIconKind, LucideIcon> = {
  html: Globe,
  pdf: FileText,
  image: FileImage,
  spreadsheet: FileSpreadsheet,
  word: FileText,
  presentation: Presentation,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  code: FileCode,
  text: FileText,
  default: File,
};

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function getFileIconKind(name: string): FileIconKind {
  const ext = getFileExtension(name);
  return FILE_ICON_BY_EXT[ext] ?? 'default';
}

export function getFileTypeIcon(kind: FileIconKind): LucideIcon {
  return FILE_KIND_ICONS[kind] ?? File;
}

export function getFileIconTextClass(kind: FileIconKind): string {
  return FILE_ICON_TEXT_COLORS[kind] ?? FILE_ICON_TEXT_COLORS.default;
}

export function getFileIconDotClass(kind: FileIconKind): string {
  return FILE_ICON_DOT_COLORS[kind] ?? FILE_ICON_DOT_COLORS.default;
}

/** Resolve kind + lucide icon + color classes from a file name. */
export function getFileIconMeta(name: string) {
  const kind = getFileIconKind(name);
  return {
    kind,
    Icon: getFileTypeIcon(kind),
    textClass: getFileIconTextClass(kind),
    dotClass: getFileIconDotClass(kind),
  };
}
