import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { findPortalApp, getAllowedAppIds, getPortalAppCacheKey, type PortalApp } from '@/commons/datas/apps';
import { handleUnauthorized } from '@/commons/utils/authSession';
import { useSystemStore } from '@/commons/stores/systems';
import { useUserStore } from '@/commons/stores/users';
import * as extend from '@/commons/utils/extends';

import './styles.scss';

type AppMessage = {
  source: 'app';
  type: 'APP_READY' | 'SET_TITLE' | 'LOGOUT' | 'REQUEST_CONTEXT';
  payload?: unknown;
};

/** URL ?mode=guest 时允许匿名打开微应用（不校验登录） */
export const APP_GUEST_MODE = 'guest';

function getSubAppEntry(appId: string, cacheKey: string | undefined, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  if (cacheKey) params.set('v', cacheKey);
  const query = params.toString();
  const base = `/apps/${appId}/index.html`;
  return query ? `${base}?${query}` : base;
}

export default function StaticMicroApp() {
  const { appId = '' } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [app, setApp] = useState<PortalApp | undefined>();

  const isGuestMode = searchParams.get('mode')?.toLowerCase() === APP_GUEST_MODE;
  const cacheKey = getPortalAppCacheKey(app);
  const subAppSrc = getSubAppEntry(appId, cacheKey, searchParams);
  const iframeKey = `${appId}-${cacheKey ?? ''}-${searchParams.toString()}`;
  const frameTitle = app?.name ?? appId;

  const debug = useSystemStore((state) => state.systemState.debug);
  const userInfo = useUserStore((state) => state.userInfo);

  const postHostContext = () => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;

    frame.postMessage(
      {
        source: 'host',
        type: 'HOST_CONTEXT',
        payload: {
          mode: isGuestMode ? APP_GUEST_MODE : 'user',
          anonymous: isGuestMode,
          token: isGuestMode ? undefined : (extend.ExLocalStore.get('token') || undefined),
          locale: extend.ExLocalStore.get('lang') || 'zh',
          user: isGuestMode ? undefined : (userInfo ?? undefined),
        },
      },
      window.location.origin,
    );
  };

  useEffect(() => {
    if (isGuestMode || debug) return;
    const token = extend.ExLocalStore.get('token');
    if (!token || token === '') {
      handleUnauthorized();
    }
  }, [debug, isGuestMode]);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setLoading(true);

    (async () => {
      const [ids, meta] = await Promise.all([
        getAllowedAppIds(true),
        findPortalApp(appId, true),
      ]);
      if (cancelled) return;
      setAllowed(Boolean(appId) && ids.has(appId));
      setApp(meta);
      setResolving(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [appId]);

  const postHostContextRef = useRef(postHostContext);
  postHostContextRef.current = postHostContext;

  useEffect(() => {
    if (resolving || !allowed) return;
    postHostContextRef.current();
  }, [userInfo, isGuestMode, allowed, resolving]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<AppMessage>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== 'app') return;

      switch (event.data.type) {
        case 'APP_READY':
          setLoading(false);
          postHostContextRef.current();
          break;
        case 'LOGOUT':
          navigate('/login', { replace: true });
          break;
        case 'REQUEST_CONTEXT':
          postHostContextRef.current();
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  if (resolving) {
    return (
      <div className="micro-app-shell micro-app-shell--empty">
        <div className="micro-app-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>校验应用…</span>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="micro-app-shell micro-app-shell--empty">
        <div className="micro-app-empty">
          <h2>未知应用</h2>
          <p>{appId ? `"${appId}" 不在白名单中` : '缺少 appId'}</p>
          {!isGuestMode ? (
            <button type="button" onClick={() => navigate('/hub-apps')}>
              前往 Apps Hub
            </button>
          ) : null}
          <button type="button" onClick={() => navigate(isGuestMode ? '/login' : '/home')}>
            {isGuestMode ? '去登录' : '返回门户'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="micro-app-shell">
      {loading && (
        <div className="micro-app-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>加载子应用…</span>
        </div>
      )}

      <iframe
        key={iframeKey}
        ref={iframeRef}
        className="micro-app-frame"
        title={frameTitle}
        src={subAppSrc}
        onLoad={() => {
          postHostContext();
          setLoading(false);
        }}
      />

      <div className="micro-app-home-fab-dock">
        <button
          type="button"
          className="micro-app-home-fab"
          title={isGuestMode ? '去登录' : '返回门户'}
          aria-label={isGuestMode ? '去登录' : '返回门户'}
          onClick={() => navigate(isGuestMode ? '/login' : '/home')}
        >
          <i className={`fa-solid ${isGuestMode ? 'fa-right-to-bracket' : 'fa-house'}`} />
        </button>
      </div>
    </div>
  );
}
