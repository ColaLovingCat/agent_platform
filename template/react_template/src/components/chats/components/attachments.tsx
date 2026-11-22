import { Popover } from 'antd';
import { clsx } from 'clsx';
import {
  FileText,
  Globe,
  Image as ImageIcon,
  Music2,
  Paperclip,
  Video,
  X,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

import type {
  ChatAttachmentType,
  ChatMessage,
  PendingAttachment,
} from '../com/chats.types';

// ============================================================================
// Types
// ============================================================================

export type FileUIPartLike = {
  type: 'file';
  url: string;
  filename?: string;
  mediaType?: string;
};

export type SourceDocumentUIPartLike = {
  type: 'source-document';
  title?: string;
  filename?: string;
  mediaType?: string;
  url?: string;
};

export type AttachmentData =
  | (FileUIPartLike & { id: string })
  | (SourceDocumentUIPartLike & { id: string });

export type AttachmentMediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'source'
  | 'unknown';

export type AttachmentVariant = 'small' | 'normal';

type MediaIcon = typeof ImageIcon;

const mediaCategoryIcons: Record<AttachmentMediaCategory, MediaIcon> = {
  audio: Music2,
  document: FileText,
  image: ImageIcon,
  source: Globe,
  unknown: Paperclip,
  video: Video,
};

const CHAT_MEDIA_TYPE: Record<ChatAttachmentType, string> = {
  image: 'image/*',
  video: 'video/*',
  pdf: 'application/pdf',
  file: 'application/octet-stream',
};

const CHAT_ATTACHMENT_TYPES = new Set<string>(Object.keys(CHAT_MEDIA_TYPE));

export function chatAttachmentTypeFromMime(mime: string): ChatAttachmentType {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'file';
}

/** Map chat semantic type or raw MIME to a value `getMediaCategory` understands. */
export function resolveChatAttachmentMediaType(attachType: string): string {
  if (CHAT_ATTACHMENT_TYPES.has(attachType)) {
    return CHAT_MEDIA_TYPE[attachType as ChatAttachmentType];
  }
  if (attachType.includes('/')) {
    return attachType;
  }
  return CHAT_MEDIA_TYPE.file;
}

// ============================================================================
// Utility Functions
// ============================================================================

export const getMediaCategory = (
  data: AttachmentData,
): AttachmentMediaCategory => {
  if (data.type === 'source-document') {
    return 'source';
  }

  const mediaType = data.mediaType ?? '';

  if (mediaType.startsWith('image/')) {
    return 'image';
  }
  if (mediaType.startsWith('video/')) {
    return 'video';
  }
  if (mediaType.startsWith('audio/')) {
    return 'audio';
  }
  if (mediaType.startsWith('application/') || mediaType.startsWith('text/')) {
    return 'document';
  }

  return 'unknown';
};

export const getAttachmentLabel = (data: AttachmentData): string => {
  if (data.type === 'source-document') {
    return data.title || data.filename || 'Source';
  }

  const category = getMediaCategory(data);
  return data.filename || (category === 'image' ? 'Image' : 'Attachment');
};

function splitFilename(filename: string): { base: string; ext: string } {
  const label = filename || 'Attachment';
  const lastDot = label.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === label.length - 1) {
    return { base: label, ext: '' };
  }

  return { base: label.slice(0, lastDot), ext: label.slice(lastDot) };
}

const variantPreviewSize: Record<AttachmentVariant, string> = {
  small: 'size-16',
  normal: 'size-24',
};

export function fromPendingAttachment(p: PendingAttachment): AttachmentData {
  return {
    id: p.id,
    type: 'file',
    url: p.url,
    filename: p.name,
    mediaType: p.mediaType,
  };
}

export function fromChatAttachment(
  attach: NonNullable<ChatMessage['attachments']>[number],
  id?: string,
): AttachmentData {
  return {
    id: id ?? `${attach.url}-${attach.name}`,
    type: 'file',
    url: attach.url,
    filename: attach.name,
    mediaType: resolveChatAttachmentMediaType(attach.type),
  };
}

const renderAttachmentImage = (
  url: string,
  filename: string | undefined,
) => (
  <img
    src={url}
    alt={filename ?? 'attachment'}
    className="size-full object-cover"
  />
);

// ============================================================================
// Contexts
// ============================================================================

interface AttachmentsContextValue {
  variant: AttachmentVariant;
}

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

interface AttachmentContextValue {
  data: AttachmentData;
  mediaCategory: AttachmentMediaCategory;
  onRemove?: () => void;
  variant: AttachmentVariant;
}

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

interface AttachmentHoverCardContextValue {
  content: ReactNode | null;
  setContent: (content: ReactNode) => void;
  openDelay: number;
  closeDelay: number;
  align: 'start' | 'center' | 'end';
  setAlign: (align: 'start' | 'center' | 'end') => void;
}

const AttachmentHoverCardContext =
  createContext<AttachmentHoverCardContextValue | null>(null);

const alignToPlacement = (align: 'start' | 'center' | 'end') => {
  if (align === 'end') return 'bottomRight' as const;
  if (align === 'center') return 'bottom' as const;
  return 'bottomLeft' as const;
};

// ============================================================================
// Hooks
// ============================================================================

export const useAttachmentsContext = () =>
  useContext(AttachmentsContext) ?? { variant: 'normal' as const };

export const useAttachmentContext = () => {
  const ctx = useContext(AttachmentContext);
  if (!ctx) {
    throw new Error('Attachment components must be used within <Attachment>');
  }
  return ctx;
};

// ============================================================================
// Attachments - Container
// ============================================================================

export type AttachmentsProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AttachmentVariant;
};

export const Attachments = ({
  variant = 'normal',
  className,
  children,
  ...props
}: AttachmentsProps) => {
  const contextValue = useMemo(() => ({ variant }), [variant]);

  return (
    <AttachmentsContext.Provider value={contextValue}>
      <div className={clsx('flex flex-wrap gap-2', className)} {...props}>
        {children}
      </div>
    </AttachmentsContext.Provider>
  );
};

// ============================================================================
// Attachment - Item
// ============================================================================

export type AttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: AttachmentData;
  onRemove?: () => void;
};

export const Attachment = ({
  data,
  onRemove,
  className,
  children,
  ...props
}: AttachmentProps) => {
  const { variant } = useAttachmentsContext();
  const mediaCategory = getMediaCategory(data);

  const contextValue = useMemo<AttachmentContextValue>(
    () => ({ data, mediaCategory, onRemove, variant }),
    [data, mediaCategory, onRemove, variant],
  );

  return (
    <AttachmentContext.Provider value={contextValue}>
      <div
        className={clsx(
          'group relative shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50',
          variantPreviewSize[variant],
          className,
        )}
        title={getAttachmentLabel(data)}
        {...props}
      >
        {children}
      </div>
    </AttachmentContext.Provider>
  );
};

export function openAttachment(attachment: AttachmentData) {
  window.open(attachment.url, '_blank');
}

// ============================================================================
// AttachmentPreview - Media preview
// ============================================================================

export type AttachmentPreviewProps = HTMLAttributes<HTMLDivElement> & {
  fallbackIcon?: ReactNode;
  /** 仅显示类型图标，不渲染图片/视频缩略图 */
  iconOnly?: boolean;
};

export const AttachmentPreview = ({
  fallbackIcon,
  iconOnly = false,
  className,
  ...props
}: AttachmentPreviewProps) => {
  const { data, mediaCategory, variant } = useAttachmentContext();

  const iconSize = variant === 'small' ? 'size-3' : 'size-4';

  const renderIcon = (Icon: MediaIcon) => (
    <Icon className={clsx(iconSize, 'text-zinc-500')} aria-hidden />
  );

  const renderContent = () => {
    if (iconOnly) {
      const Icon = mediaCategoryIcons[mediaCategory];
      return fallbackIcon ?? renderIcon(Icon);
    }

    if (mediaCategory === 'image' && data.type === 'file' && data.url) {
      return renderAttachmentImage(data.url, data.filename);
    }

    if (mediaCategory === 'video' && data.type === 'file' && data.url) {
      return (
        <video
          src={data.url}
          className="size-full object-cover"
          muted
          playsInline
        />
      );
    }

    const Icon = mediaCategoryIcons[mediaCategory];
    return fallbackIcon ?? renderIcon(Icon);
  };

  return (
    <div
      className={clsx(
        'flex size-full items-center justify-center',
        className,
      )}
      {...props}
    >
      {renderContent()}
    </div>
  );
};

// ============================================================================
// AttachmentInfo - Name and type display
// ============================================================================

export type AttachmentInfoProps = HTMLAttributes<HTMLDivElement>;

export const AttachmentInfo = ({
  className,
  ...props
}: AttachmentInfoProps) => {
  const { data, variant } = useAttachmentContext();
  const { base, ext } = splitFilename(getAttachmentLabel(data));

  return (
    <div
      className={clsx(
        'absolute inset-x-0 z-10 flex min-w-0 items-center px-1.5 py-0.5',
        'bg-black/65 text-white',
        variant === 'small' ? 'text-[10px] leading-tight' : 'text-xs',
        'transition-[bottom] duration-200 ease-out',
        '-bottom-full group-hover:bottom-0',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{base}</span>
      {ext ? <span className="shrink-0">{ext}</span> : null}
    </div>
  );
};

// ============================================================================
// AttachmentRemove - Remove button
// ============================================================================

export type AttachmentRemoveProps = ComponentProps<any> & {
  label?: string;
};

export const AttachmentRemove = ({
  label = 'Remove',
  className,
  children,
  ...props
}: AttachmentRemoveProps) => {
  const { onRemove, variant } = useAttachmentContext();

  const handleClick = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove],
  );

  if (!onRemove) {
    return null;
  }

  const buttonSize =
    variant === 'small' ? '!size-5 !min-w-5' : '!size-6 !min-w-6';
  const iconSize = variant === 'small' ? 'size-3' : 'size-3.5';

  return (
    <button
      type="button"
      size="small"
      aria-label={label}
      className={clsx(
        'absolute top-1 right-1 z-20',
        '!flex items-center justify-center rounded-full !border-0 !bg-black/60 !p-0 text-white',
        'opacity-0 transition-opacity group-hover:opacity-100',
        buttonSize,
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children ?? <X className={iconSize} aria-hidden />}
      <span className="sr-only">{label}</span>
    </button>
  );
};

// ============================================================================
// AttachmentHoverCard - Hover preview
// ============================================================================

export type AttachmentHoverCardProps = {
  openDelay?: number;
  closeDelay?: number;
  children: ReactNode;
};

export const AttachmentHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  children,
}: AttachmentHoverCardProps) => {
  const [content, setContent] = useState<ReactNode>(null);
  const [align, setAlign] = useState<'start' | 'center' | 'end'>('start');

  const contextValue = useMemo(
    () => ({
      content,
      setContent,
      openDelay,
      closeDelay,
      align,
      setAlign,
    }),
    [content, openDelay, closeDelay, align],
  );

  return (
    <AttachmentHoverCardContext.Provider value={contextValue}>
      {children}
    </AttachmentHoverCardContext.Provider>
  );
};

export type AttachmentHoverCardTriggerProps = HTMLAttributes<HTMLSpanElement>;

export const AttachmentHoverCardTrigger = ({
  children,
  className,
  ...props
}: AttachmentHoverCardTriggerProps) => {
  const ctx = useContext(AttachmentHoverCardContext);

  if (!ctx?.content) {
    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  }

  return (
    <Popover
      content={ctx.content}
      trigger="hover"
      mouseEnterDelay={ctx.openDelay / 1000}
      mouseLeaveDelay={ctx.closeDelay / 1000}
      placement={alignToPlacement(ctx.align)}
    >
      <span className={clsx('inline-flex', className)} {...props}>
        {children}
      </span>
    </Popover>
  );
};

export type AttachmentHoverCardContentProps = HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'center' | 'end';
};

export const AttachmentHoverCardContent = ({
  align = 'start',
  className,
  children,
}: AttachmentHoverCardContentProps) => {
  const ctx = useContext(AttachmentHoverCardContext);

  useEffect(() => {
    ctx?.setAlign(align);
  }, [align, ctx]);

  useEffect(() => {
    ctx?.setContent(
      <div className={clsx('max-w-xs p-1', className)}>{children}</div>,
    );

    return () => {
      ctx?.setContent(null);
    };
  }, [children, className, ctx]);

  return null;
};

// ============================================================================
// AttachmentEmpty - Empty state
// ============================================================================

export type AttachmentEmptyProps = HTMLAttributes<HTMLDivElement>;

export const AttachmentEmpty = ({
  className,
  children,
  ...props
}: AttachmentEmptyProps) => (
  <div
    className={clsx('text-sm text-zinc-400', className)}
    {...props}
  >
    {children ?? 'No attachments'}
  </div>
);
