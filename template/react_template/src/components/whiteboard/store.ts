import { get, set, del } from 'idb-keyval';

export const WHITEBOARD_IDB_KEY = 'agents:whiteboard:v1';
export const WHITEBOARD_UI_KEY = 'agents:whiteboard:ui:v1';

export type BinaryFiles = Record<string, unknown>;

export type WhiteboardSnapshot = {
  version: 1;
  updatedAt: string;
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: BinaryFiles;
};

export type WhiteboardViewMode = 'fullscreen' | 'windowed';

export type WhiteboardBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WhiteboardUiPrefs = {
  version: 1;
  mode: WhiteboardViewMode;
  bounds: WhiteboardBounds;
};

export type ExcalidrawImperativeAPI = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => BinaryFiles;
  resetScene?: () => void;
  updateScene?: (scene: {
    elements?: readonly unknown[];
    appState?: Record<string, unknown>;
  }) => void;
  history?: { clear?: () => void };
};

const APP_STATE_OMIT = new Set([
  'collaborators',
  'cursorButton',
  'draggingElement',
  'editingElement',
  'editingGroupId',
  'editingLinearElement',
  'activeTool',
  'penMode',
  'penDetected',
  'exportBackground',
  'toast',
  'contextMenu',
  'newElement',
  'resizingElement',
  'multiElement',
  'selectionElement',
  'isBindingEnabled',
  'startBoundElement',
  'suggestedBindings',
  'frameRendering',
  'isCropping',
  'croppingElementId',
  'searchMatches',
]);

export function pickPersistableAppState(appState: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(appState)) {
    if (APP_STATE_OMIT.has(key)) continue;
    next[key] = value;
  }
  return next;
}

export async function loadWhiteboardSnapshot(): Promise<WhiteboardSnapshot | null> {
  try {
    const data = await get<WhiteboardSnapshot>(WHITEBOARD_IDB_KEY);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveWhiteboardSnapshot(snapshot: WhiteboardSnapshot): Promise<void> {
  await set(WHITEBOARD_IDB_KEY, snapshot);
}

export async function clearWhiteboardSnapshot(): Promise<void> {
  await del(WHITEBOARD_IDB_KEY);
}

export function loadWhiteboardUiPrefs(): WhiteboardUiPrefs | null {
  try {
    const raw = localStorage.getItem(WHITEBOARD_UI_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as WhiteboardUiPrefs;
    if (!data || data.version !== 1) return null;
    if (data.mode !== 'fullscreen' && data.mode !== 'windowed') return null;
    const { x, y, w, h } = data.bounds ?? ({} as WhiteboardBounds);
    if (![x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveWhiteboardUiPrefs(prefs: WhiteboardUiPrefs): void {
  try {
    localStorage.setItem(WHITEBOARD_UI_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('[whiteboard] ui prefs save failed', err);
  }
}
