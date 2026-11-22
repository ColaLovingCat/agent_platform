import { fetchRequest } from '@/commons/utils/fetch';
import type { PortalApp } from '@/commons/datas/apps';

export type PortalAppVersionItem = {
  version: string;
  publishedAt?: string;
  zipPath?: string;
};

export type PortalAppApiItem = PortalApp & {
  deployed?: boolean;
  currentVersion?: string;
  indexHtmlModifiedAt?: string;
  versions?: PortalAppVersionItem[];
};

type ApiEnvelope<T> = {
  status?: boolean;
  Status?: boolean;
  message?: string;
  Message?: string;
  data?: T;
  Data?: T;
};

function unwrap<T>(resp: any): { ok: boolean; data?: T; message: string } {
  const body = resp as ApiEnvelope<T>;
  const ok = body?.status ?? body?.Status ?? false;
  const data = (body?.data ?? body?.Data) as T | undefined;
  const message = body?.message ?? body?.Message ?? '';
  return { ok: Boolean(ok), data, message };
}

function mapApp(item: any): PortalAppApiItem {
  const versionsRaw = item.versions ?? item.Versions ?? [];
  return {
    id: item.id ?? item.Id,
    name: item.name ?? item.Name,
    description: item.description ?? item.Description ?? '',
    icon: item.icon ?? item.Icon ?? 'fa-cube',
    color: item.color ?? item.Color ?? '#334155',
    dynamic: Boolean(item.dynamic ?? item.Dynamic),
    deployed: Boolean(item.deployed ?? item.Deployed),
    currentVersion: item.currentVersion ?? item.CurrentVersion ?? undefined,
    indexHtmlModifiedAt: item.indexHtmlModifiedAt ?? item.IndexHtmlModifiedAt ?? undefined,
    versions: (Array.isArray(versionsRaw) ? versionsRaw : []).map((v: any) => ({
      version: v.version ?? v.Version,
      publishedAt: v.publishedAt ?? v.PublishedAt,
      zipPath: v.zipPath ?? v.ZipPath,
    })),
  };
}

export const getlistPortalApps = async (): Promise<PortalAppApiItem[]> => {
  const resp = await fetchRequest('/api/apps/getlist', { method: 'GET' });
  const { ok, data, message } = unwrap<any[]>(resp);
  if (!ok) throw new Error(message || 'getlist failed');
  return (data ?? []).map(mapApp);
};

export const addPortalApp = async (payload: {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}) => {
  const resp = await fetchRequest('/api/apps/add', {
    method: 'POST',
    data: {
      id: payload.id,
      name: payload.name,
      description: payload.description ?? '',
      icon: payload.icon ?? 'fa-cube',
      color: payload.color ?? '#334155',
    },
  });
  const { ok, message } = unwrap<string>(resp);
  if (!ok) throw new Error(message || 'add failed');
  return message;
};

export const publishPortalApp = async (payload: {
  id: string;
  version: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  zip: File;
}) => {
  const form = new FormData();
  form.append('Id', payload.id);
  form.append('Version', payload.version);
  if (payload.name) form.append('Name', payload.name);
  if (payload.description) form.append('Description', payload.description);
  if (payload.icon) form.append('Icon', payload.icon);
  if (payload.color) form.append('Color', payload.color);
  form.append('Zip', payload.zip);

  const resp = await fetchRequest('/api/apps/publish', {
    method: 'POST',
    type: 'none',
    data: form,
  });
  const { ok, message } = unwrap<string>(resp);
  if (!ok) throw new Error(message || 'publish failed');
  return message;
};

export const rollbackPortalApp = async (id: string, version: string) => {
  const resp = await fetchRequest('/api/apps/rollback', {
    method: 'POST',
    data: { id, version },
  });
  const { ok, message } = unwrap<string>(resp);
  if (!ok) throw new Error(message || 'rollback failed');
  return message;
};

export const deletePortalApp = async (id: string, force = false) => {
  const resp = await fetchRequest('/api/apps/delete', {
    method: 'POST',
    data: { id, force },
  });
  const { ok, message } = unwrap<string>(resp);
  if (!ok) throw new Error(message || 'delete failed');
  return message;
};
