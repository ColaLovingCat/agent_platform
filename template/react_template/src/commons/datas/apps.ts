export interface PortalApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  /** 来自 registry 的动态部署项 */
  dynamic?: boolean;
  /** 当前线上版本（registry / 发布接口） */
  currentVersion?: string;
  /** DeployRoot/{id}/index.html 最后修改时间，用于 iframe cache-bust */
  indexHtmlModifiedAt?: string;
}

/** App id：小写字母/数字开头，允许连字符，总长 2–32 */
export const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;

export function isValidAppId(id: string): boolean {
  return APP_ID_PATTERN.test(id);
}

/** 内置应用。模板默认不预置业务子应用，列表来自登记接口。 */
export const BUILTIN_PORTAL_APPS: PortalApp[] = [];

export const BUILTIN_APP_IDS = new Set(BUILTIN_PORTAL_APPS.map((app) => app.id));

/** @deprecated 使用 BUILTIN_PORTAL_APPS；保留别名兼容旧引用 */
export const PORTAL_APPS = BUILTIN_PORTAL_APPS;

/** 同步兜底（仅 builtin）；运行时请用 loadPortalApps / getAllowedAppIds */
export const ALLOWED_APP_IDS = new Set(BUILTIN_PORTAL_APPS.map((app) => app.id));

export function getPortalApp(appId: string): PortalApp | undefined {
  return BUILTIN_PORTAL_APPS.find((app) => app.id === appId);
}

function normalizeApp(raw: Partial<PortalApp>, dynamic = false): PortalApp | null {
  if (!raw?.id || !isValidAppId(raw.id)) return null;
  return {
    id: raw.id,
    name: (raw.name || raw.id).trim() || raw.id,
    description: (raw.description || '').trim(),
    icon: (raw.icon || 'fa-cube').trim() || 'fa-cube',
    color: (raw.color || '#334155').trim() || '#334155',
    dynamic,
    currentVersion: raw.currentVersion?.trim() || undefined,
    indexHtmlModifiedAt: raw.indexHtmlModifiedAt || undefined,
  };
}

/** builtin ∪ registry；同 id 以 registry 覆盖 */
export function mergePortalApps(registryApps: PortalApp[] = []): PortalApp[] {
  const map = new Map<string, PortalApp>();
  for (const app of BUILTIN_PORTAL_APPS) {
    map.set(app.id, { ...app, dynamic: false });
  }
  for (const raw of registryApps) {
    const app = normalizeApp(raw, !BUILTIN_APP_IDS.has(raw.id));
    if (!app) continue;
    const builtin = BUILTIN_APP_IDS.has(app.id);
    map.set(app.id, {
      ...app,
      dynamic: !builtin,
    });
  }
  return Array.from(map.values());
}

let cachedApps: PortalApp[] | null = null;
let cacheAt = 0;
const CACHE_MS = 5_000;

export function clearPortalAppsCache() {
  cachedApps = null;
  cacheAt = 0;
}

async function fetchRegistryApps(): Promise<PortalApp[]> {
  try {
    const { getlistPortalApps } = await import('@/services/portal-apps.services');
    const list = await getlistPortalApps();
    return list
      .map((item) =>
        normalizeApp(
          {
            id: item.id,
            name: item.name,
            description: item.description,
            icon: item.icon,
            color: item.color,
            currentVersion: item.currentVersion,
            indexHtmlModifiedAt: item.indexHtmlModifiedAt,
          },
          Boolean(item.dynamic),
        ),
      )
      .filter((item): item is PortalApp => item != null);
  } catch {
    // 登记接口不可用时只使用内置列表
    return [];
  }
}

/** 加载合并后的门户应用列表（短缓存） */
export async function loadPortalApps(force = false): Promise<PortalApp[]> {
  if (!force && cachedApps && Date.now() - cacheAt < CACHE_MS) {
    return cachedApps;
  }
  const registryApps = await fetchRegistryApps();
  cachedApps = mergePortalApps(registryApps);
  cacheAt = Date.now();
  return cachedApps;
}

export async function getAllowedAppIds(force = false): Promise<Set<string>> {
  const apps = await loadPortalApps(force);
  return new Set(apps.map((a) => a.id));
}

export async function findPortalApp(appId: string, force = false): Promise<PortalApp | undefined> {
  const apps = await loadPortalApps(force);
  return apps.find((a) => a.id === appId);
}

/** iframe 入口 cache-bust：优先 registry 版本，其次 index.html 修改时间 */
export function getPortalAppCacheKey(app?: Pick<PortalApp, 'currentVersion' | 'indexHtmlModifiedAt'>): string | undefined {
  if (!app) return undefined;
  if (app.currentVersion) return app.currentVersion;
  if (app.indexHtmlModifiedAt) return app.indexHtmlModifiedAt;
  return undefined;
}
