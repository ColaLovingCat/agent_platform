import { Spin, message } from 'antd';
import { Download, Eraser, Maximize2, Minimize2, X } from 'lucide-react';
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

import {
  clearWhiteboardSnapshot,
  loadWhiteboardSnapshot,
  loadWhiteboardUiPrefs,
  pickPersistableAppState,
  saveWhiteboardSnapshot,
  saveWhiteboardUiPrefs,
  type ExcalidrawImperativeAPI,
  type WhiteboardBounds,
  type WhiteboardSnapshot,
  type WhiteboardViewMode,
} from './store';

import './whiteboard.scss';

type ExcalidrawProps = {
  excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;
  initialData?: {
    elements?: readonly unknown[];
    appState?: Record<string, unknown>;
    files?: WhiteboardSnapshot['files'];
    scrollToContent?: boolean;
  };
  onChange?: (
    elements: readonly unknown[],
    appState: Record<string, unknown>,
    files: WhiteboardSnapshot['files'],
  ) => void;
  theme?: 'light' | 'dark';
};

const ExcalidrawLazy = lazy(async () => {
  await import('@excalidraw/excalidraw/index.css');
  const mod = await import('@excalidraw/excalidraw');
  return { default: mod.Excalidraw as ComponentType<ExcalidrawProps> };
});

const SAVE_DEBOUNCE_MS = 500;
const UI_SAVE_DEBOUNCE_MS = 300;
const MIN_W = 360;
const MIN_H = 280;
const PREFERRED_H = 860;
const PREFERRED_W = 720;
const VIEW_MARGIN = 24;

type ViewMode = WhiteboardViewMode;
type Bounds = WhiteboardBounds;

function defaultWindowBounds(): Bounds {
  const maxW = Math.max(MIN_W, window.innerWidth - VIEW_MARGIN * 2);
  const maxH = Math.max(MIN_H, window.innerHeight - VIEW_MARGIN * 2);
  const w = Math.min(PREFERRED_W, maxW);
  const h = Math.min(PREFERRED_H, maxH);
  return {
    w,
    h,
    x: Math.max(VIEW_MARGIN, window.innerWidth - w - VIEW_MARGIN),
    y: Math.max(VIEW_MARGIN, window.innerHeight - h - VIEW_MARGIN),
  };
}

function clampBounds(b: Bounds): Bounds {
  const maxW = Math.max(MIN_W, window.innerWidth);
  const maxH = Math.max(MIN_H, window.innerHeight);
  const w = Math.min(Math.max(MIN_W, b.w), maxW);
  const h = Math.min(Math.max(MIN_H, b.h), maxH);
  const maxX = Math.max(0, window.innerWidth - 80);
  const maxY = Math.max(0, window.innerHeight - 48);
  return {
    w,
    h,
    x: Math.min(Math.max(-w + 80, b.x), maxX),
    y: Math.min(Math.max(0, b.y), maxY),
  };
}

function readInitialUi(): { mode: ViewMode; bounds: Bounds } {
  if (typeof window === 'undefined') {
    return { mode: 'windowed', bounds: { x: 80, y: 80, w: PREFERRED_W, h: PREFERRED_H } };
  }
  const prefs = loadWhiteboardUiPrefs();
  if (!prefs) {
    return { mode: 'windowed', bounds: defaultWindowBounds() };
  }
  return {
    mode: prefs.mode,
    bounds: clampBounds(prefs.bounds),
  };
}

export type WhiteboardModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function WhiteboardModal({ open, onClose }: WhiteboardModalProps) {
  const initialUiRef = useRef<ReturnType<typeof readInitialUi> | null>(null);
  if (initialUiRef.current === null) {
    initialUiRef.current = readInitialUi();
  }

  const [booted, setBooted] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [initialData, setInitialData] = useState<ExcalidrawProps['initialData']>();
  const [mode, setMode] = useState<ViewMode>(() => initialUiRef.current!.mode);
  const [bounds, setBounds] = useState<Bounds>(() => initialUiRef.current!.bounds);

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{
    elements: readonly unknown[];
    appState: Record<string, unknown>;
    files: WhiteboardSnapshot['files'];
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBooted(true);
  }, [open]);

  useEffect(() => {
    if (!booted || initialData !== undefined) return;
    let cancelled = false;
    setHydrating(true);
    void (async () => {
      const snap = await loadWhiteboardSnapshot();
      if (cancelled) return;
      if (snap) {
        setInitialData({
          elements: snap.elements,
          appState: {
            ...snap.appState,
            collaborators: new Map(),
          },
          files: snap.files,
          scrollToContent: true,
        });
      } else {
        setInitialData({
          elements: [],
          appState: { collaborators: new Map() },
          files: {},
        });
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [booted, initialData]);

  const flushSave = useCallback(async () => {
    const latest = latestRef.current;
    if (!latest) return;
    try {
      await saveWhiteboardSnapshot({
        version: 1,
        updatedAt: new Date().toISOString(),
        elements: latest.elements,
        appState: pickPersistableAppState(latest.appState),
        files: latest.files ?? {},
      });
    } catch (err) {
      console.error('[whiteboard] save failed', err);
      message.error('Whiteboard save failed (storage full?)');
    }
  }, []);

  useEffect(() => {
    if (open) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void flushSave();
    // 关闭会卸载 Excalidraw（避免 undo 等 portal 残留）；同步最新场景供下次挂载
    const latest = latestRef.current;
    if (latest) {
      setInitialData({
        elements: latest.elements,
        appState: {
          ...pickPersistableAppState(latest.appState),
          collaborators: new Map(),
        },
        files: latest.files ?? {},
        scrollToContent: true,
      });
    }
  }, [open, flushSave]);

  useEffect(() => {
    if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    uiSaveTimerRef.current = setTimeout(() => {
      saveWhiteboardUiPrefs({
        version: 1,
        mode,
        bounds: clampBounds(bounds),
      });
    }, UI_SAVE_DEBOUNCE_MS);
    return () => {
      if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    };
  }, [mode, bounds]);

  useEffect(() => {
    const onResize = () => {
      setBounds((prev) => clampBounds(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (uiSaveTimerRef.current) clearTimeout(uiSaveTimerRef.current);
    };
  }, []);

  const refreshCanvas = useCallback(() => {
    requestAnimationFrame(() => {
      (apiRef.current as { refresh?: () => void } | null)?.refresh?.();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshCanvas();
  }, [open, mode, bounds.w, bounds.h, refreshCanvas]);

  const handleChange = useCallback(
    (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: WhiteboardSnapshot['files'],
    ) => {
      latestRef.current = { elements, appState, files };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  const handleClear = useCallback(async () => {
    await clearWhiteboardSnapshot();
    latestRef.current = { elements: [], appState: {}, files: {} };
    const api = apiRef.current;
    if (api?.resetScene) {
      api.resetScene();
    } else if (api?.updateScene) {
      api.updateScene({ elements: [], appState: { collaborators: new Map() } });
    }
    api?.history?.clear?.();
    message.success('Canvas cleared');
  }, []);

  const handleExport = useCallback(() => {
    const api = apiRef.current;
    const elements = api?.getSceneElements() ?? latestRef.current?.elements ?? [];
    const appState = (api?.getAppState() as Record<string, unknown> | undefined)
      ?? latestRef.current?.appState
      ?? {};
    const files = api?.getFiles() ?? latestRef.current?.files ?? {};
    const payload = {
      type: 'excalidraw',
      version: 2,
      source: 'agents-whiteboard',
      elements,
      appState: pickPersistableAppState(appState),
      files,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.excalidraw`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === 'fullscreen') {
        setBounds((b) => clampBounds(b.w > 0 ? b : defaultWindowBounds()));
        return 'windowed';
      }
      return 'fullscreen';
    });
  }, []);

  // 关闭时立刻落盘 UI 偏好
  const handleClose = useCallback(() => {
    saveWhiteboardUiPrefs({
      version: 1,
      mode,
      bounds: clampBounds(bounds),
    });
    onClose();
  }, [mode, bounds, onClose]);

  const onDragPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const start = { ...bounds };
    const ox = e.clientX;
    const oy = e.clientY;
    target.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      setBounds(clampBounds({
        ...start,
        x: start.x + (ev.clientX - ox),
        y: start.y + (ev.clientY - oy),
      }));
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      refreshCanvas();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [bounds, refreshCanvas]);

  const onResizePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const start = { ...bounds };
    const ox = e.clientX;
    const oy = e.clientY;
    target.setPointerCapture(pointerId);

    const onMove = (ev: PointerEvent) => {
      setBounds(clampBounds({
        ...start,
        w: start.w + (ev.clientX - ox),
        h: start.h + (ev.clientY - oy),
      }));
    };
    const onUp = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      refreshCanvas();
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }, [bounds, refreshCanvas]);

  if (!booted || !open) return null;

  const isWindowed = mode === 'windowed';
  const panelStyle = isWindowed
    ? {
        left: bounds.x,
        top: bounds.y,
        width: bounds.w,
        height: bounds.h,
      }
    : undefined;

  return createPortal(
    <div
      className={[
        'whiteboard-root',
        isWindowed ? 'whiteboard-root--windowed' : 'whiteboard-root--fullscreen',
        'is-open',
      ].join(' ')}
    >
      <div
        className="whiteboard-panel"
        style={panelStyle}
      >
        {isWindowed && (
          <div
            className="whiteboard-drag"
            title="Drag"
            onPointerDown={onDragPointerDown}
          />
        )}

        <div className="whiteboard-fab" role="toolbar" aria-label="Whiteboard actions">
          <button
            type="button"
            className="whiteboard-fab__btn"
            title={isWindowed ? 'Fullscreen' : 'Windowed'}
            aria-label={isWindowed ? 'Enter fullscreen' : 'Enter windowed mode'}
            onClick={toggleMode}
          >
            {isWindowed ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
          </button>
          <button
            type="button"
            className="whiteboard-fab__btn"
            title="Clear"
            aria-label="Clear canvas"
            onClick={() => void handleClear()}
          >
            <Eraser size={18} />
          </button>
          <button
            type="button"
            className="whiteboard-fab__btn"
            title="Export"
            aria-label="Export canvas"
            onClick={handleExport}
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            className="whiteboard-fab__btn whiteboard-fab__btn--close"
            title="Close"
            aria-label="Close whiteboard"
            onClick={handleClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="whiteboard-canvas">
          {hydrating || initialData === undefined ? (
            <div className="whiteboard-loading">
              <Spin tip="Loading canvas..." />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="whiteboard-loading">
                  <Spin tip="Loading Excalidraw..." />
                </div>
              }
            >
              <ExcalidrawLazy
                theme="light"
                initialData={initialData}
                excalidrawAPI={(api) => {
                  apiRef.current = api;
                }}
                onChange={handleChange}
              />
            </Suspense>
          )}
        </div>

        {isWindowed && (
          <div
            className="whiteboard-resize"
            title="Resize"
            onPointerDown={onResizePointerDown}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
