import type { User, UserInput } from '../shared/datas.type';

export const API_ORIGIN = (import.meta.env.VITE_TEMPLATE_API_ORIGIN || '').replace(/\/$/, '');

type Ok<T> = { success: true } & T;
type Err = { success: false; error?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await response.json()) as T | Err;
  if (!response.ok || (body as Err).success === false) {
    throw new Error((body as Err).error || '请求失败');
  }
  return body as T;
}

export function writeLog(entry: { kind: string; path?: string; title?: string }) {
  return request<Ok<Record<string, never>>>('/api/logs', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export function getLogs(date: string) {
  return request<Ok<{ date: string; content: string }>>(`/api/logs/${encodeURIComponent(date)}`);
}

export function listUsers(q: string) {
  const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return request<Ok<{ users: User[] }>>(`/api/users${query}`);
}

export function saveUser(input: UserInput) {
  return request<Ok<{ user: User }>>('/api/users/save', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function removeUser(id: number) {
  return request<Ok<Record<string, never>>>('/api/users/remove', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}
