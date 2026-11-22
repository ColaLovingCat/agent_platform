import { clsx } from 'clsx';
import { ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const INDENT = 16;
const CHEVRON_SLOT = 20;

interface FileTreeContextValue {
  expanded: Set<string>;
  toggleExpanded: (path: string) => void;
  selectedPath?: string;
  onSelect?: (path: string) => void;
  depth: number;
}

const FileTreeContext = createContext<FileTreeContextValue | null>(null);

function useFileTree() {
  const ctx = useContext(FileTreeContext);
  if (!ctx) {
    throw new Error('FileTree components must be used within <FileTree>');
  }
  return ctx;
}

export interface FileTreeProps {
  children: ReactNode;
  className?: string;
  defaultExpanded?: Set<string>;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

export function FileTree({
  children,
  className,
  defaultExpanded = new Set(),
  selectedPath,
  onSelect,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));

  const toggleExpanded = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      expanded,
      toggleExpanded,
      selectedPath,
      onSelect,
      depth: 0,
    }),
    [expanded, toggleExpanded, selectedPath, onSelect],
  );

  return (
    <FileTreeContext.Provider value={value}>
      <div
        className={clsx(
          'select-none rounded-xl border border-slate-100 bg-white p-2 text-sm shadow-[0_2px_16px_rgba(15,23,42,0.04)]',
          className,
        )}
        role="tree"
      >
        {children}
      </div>
    </FileTreeContext.Provider>
  );
}

export interface FileTreeFolderProps {
  name: string;
  path: string;
  children: ReactNode;
  className?: string;
}

export function FileTreeFolder({
  name,
  path,
  children,
  className,
}: FileTreeFolderProps) {
  const parent = useFileTree();
  const isExpanded = parent.expanded.has(path);
  const containsSelected =
    parent.selectedPath != null &&
    (parent.selectedPath === path ||
      parent.selectedPath.startsWith(`${path}/`));

  const childContext = useMemo(
    () => ({ ...parent, depth: parent.depth + 1 }),
    [parent],
  );

  const paddingLeft = parent.depth * INDENT + 8;

  return (
    <div className={clsx('file-tree-folder', className)} role="treeitem" aria-expanded={isExpanded}>
      <div
        className={clsx(
          'flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors',
          containsSelected
            ? 'bg-blue-50/70 text-blue-700'
            : 'text-slate-700 hover:bg-slate-50',
        )}
        style={{ paddingLeft }}
      >
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          onClick={() => parent.toggleExpanded(path)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
        >
          <ChevronRight
            size={14}
            className={clsx(
              'transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
        </button>

        {isExpanded ? (
          <FolderOpen size={16} className="shrink-0 text-blue-500" aria-hidden />
        ) : (
          <Folder size={16} className="shrink-0 text-blue-500" aria-hidden />
        )}

        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      </div>

      {isExpanded && (
        <FileTreeContext.Provider value={childContext}>
          {children}
        </FileTreeContext.Provider>
      )}
    </div>
  );
}

export interface FileTreeFileProps {
  name: string;
  path: string;
  className?: string;
}

export function FileTreeFile({ name, path, className }: FileTreeFileProps) {
  const { selectedPath, onSelect, depth } = useFileTree();
  const isSelected = selectedPath === path;
  const paddingLeft = depth * INDENT + 8 + CHEVRON_SLOT;

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={isSelected}
      className={clsx(
        'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors',
        isSelected
          ? 'bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]'
          : 'text-slate-700 hover:bg-slate-50',
        className,
      )}
      style={{ paddingLeft }}
      onClick={() => onSelect?.(path)}
    >
      <FileText
        size={16}
        className={clsx('shrink-0', isSelected ? 'text-blue-500' : 'text-slate-400')}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </button>
  );
}

export default FileTree;
