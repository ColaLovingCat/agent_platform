import { clsx } from 'clsx';
import { ChevronDown, Link2 } from 'lucide-react';
import {
  createContext,
  useContext,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import type { ChatMessage } from '../com/chats.types';

export type ChatSourceItem = NonNullable<ChatMessage['sources']>[number];

// ============================================================================
// Context
// ============================================================================

interface SourcesContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SourcesContext = createContext<SourcesContextValue | null>(null);

function useSourcesContext() {
  const ctx = useContext(SourcesContext);
  if (!ctx) {
    throw new Error('Sources components must be used within <Sources>');
  }
  return ctx;
}

// ============================================================================
// Components
// ============================================================================

export function Sources({
  children,
  className,
  defaultOpen = false,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <SourcesContext.Provider value={{ open, setOpen }}>
      <div className={clsx('chat-sources', className)}>{children}</div>
    </SourcesContext.Provider>
  );
}

export function SourcesTrigger({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const { open, setOpen } = useSourcesContext();

  return (
    <button
      type="button"
      className={clsx('chat-sources-trigger', className)}
      onClick={() => setOpen(!open)}
      aria-expanded={open}
    >
      <span>Used {count} source{count === 1 ? '' : 's'}</span>
      <ChevronDown
        size={14}
        className={clsx('chat-sources-chevron', open && 'chat-sources-chevron-open')}
      />
    </button>
  );
}

export function SourcesContent({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  const { open } = useSourcesContext();

  if (!open) return null;

  return (
    <div className={clsx('chat-sources-content', className)}>
      {children}
    </div>
  );
}

export function Source({
  href,
  title,
  className,
}: ChatSourceItem & { className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx('chat-source-item', className)}
    >
      <Link2 size={13} className="chat-source-icon" aria-hidden />
      <span className="chat-source-title">{title}</span>
    </a>
  );
}
