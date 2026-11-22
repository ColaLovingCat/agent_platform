/** 连接资产的进程内缓存 + React hook。
 *
 *  设计要点：
 *  - 一个 zustand store 持有 `Record<id, Connection>` 缓存 + "正在 fetch 的 id 集合"
 *  - `useConnectionName(id)` 是给 SqlNode 这种"画布上显示连接名"的薄壳——首次出现时
 *    懒加载一次，缓存命中直接渲染；多个节点同时引用同一个 connectionId 也只发一次请求
 *  - `useConnections()` 给 /connections 列表页和 PropertyPanel 下拉用，主动 refresh()
 *  - 编辑 / 删除后调 `invalidate(id)` / `setOne(conn)`，让组件即时跟随
 *
 *  这是纯前端缓存——后端权威源是 master_data，缓存只是为了避免重复请求。
 */

"use client";

import { useEffect } from "react";
import { create } from "zustand";

import type { Connection } from "./connectionClient";

type State = {
  byId: Record<string, Connection>;
  fetchingIds: Set<string>;
  listLoaded: boolean;
  listLoading: boolean;
  /** 列表为空时这里仍是 true（区分"未加载"和"加载完，空"） */
  lastListError: string | null;
};

type Actions = {
  setOne: (c: Connection) => void;
  setMany: (cs: Connection[]) => void;
  invalidate: (id: string) => void;
  fetchOne: (id: string) => Promise<void>;
  refreshList: () => Promise<void>;
};

export const useConnectionStore = create<State & Actions>((set, get) => ({
  byId: {},
  fetchingIds: new Set<string>(),
  listLoaded: false,
  listLoading: false,
  lastListError: null,

  setOne: (c) =>
    set((s) => ({ byId: { ...s.byId, [c.id]: c } })),
  setMany: (cs) =>
    set((s) => {
      const next = { ...s.byId };
      for (const c of cs) next[c.id] = c;
      return { byId: next };
    }),
  invalidate: (id) =>
    set((s) => {
      if (!id) return {} as Partial<State>;
      const next = { ...s.byId };
      delete next[id];
      return { byId: next };
    }),

  fetchOne: async (id) => {
    if (!id) return;
    const s = get();
    if (s.byId[id]) return; // 已缓存
    if (s.fetchingIds.has(id)) return; // 正在拉
    const fetchingNext = new Set(s.fetchingIds);
    fetchingNext.add(id);
    set({ fetchingIds: fetchingNext });
    try {
      const r = await fetch(`/api/connections/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (r.ok) {
        const conn = (await r.json()) as Connection;
        if (conn && conn.id) {
          set((s2) => ({ byId: { ...s2.byId, [id]: conn } }));
        }
      }
    } catch {
      // 静默：缓存里没有就让 UI 显示 "未选连接" / id 短串兜底
    } finally {
      const after = new Set(get().fetchingIds);
      after.delete(id);
      set({ fetchingIds: after });
    }
  },

  refreshList: async () => {
    if (get().listLoading) return;
    set({ listLoading: true, lastListError: null });
    try {
      const r = await fetch("/api/connections", { cache: "no-store" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        set({
          listLoading: false,
          listLoaded: true,
          lastListError: String(body?.detail || r.statusText),
        });
        return;
      }
      const body = (await r.json()) as { data: Connection[] };
      const list = body?.data || [];
      const map: Record<string, Connection> = {};
      for (const c of list) map[c.id] = c;
      set({ byId: map, listLoaded: true, listLoading: false, lastListError: null });
    } catch (e) {
      set({
        listLoading: false,
        listLoaded: true,
        lastListError: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));

/** 单条引用：懒加载 + 返回连接名（或 undefined）。SqlNode 画布卡片用。 */
export function useConnectionName(id: string | undefined): string | undefined {
  const cid = (id || "").trim();
  const name = useConnectionStore((s) => (cid ? s.byId[cid]?.name : undefined));
  const fetchOne = useConnectionStore((s) => s.fetchOne);
  useEffect(() => {
    if (cid && name === undefined) {
      // fire-and-forget；fetchOne 内部已经做了 in-flight dedup
      void fetchOne(cid);
    }
  }, [cid, name, fetchOne]);
  return name;
}

/** 列表（PropertyPanel 下拉 + /connections 页面）：自动首加载 + 暴露 refresh。 */
export function useConnections(): {
  list: Connection[];
  byId: Record<string, Connection>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const byId = useConnectionStore((s) => s.byId);
  const loaded = useConnectionStore((s) => s.listLoaded);
  const loading = useConnectionStore((s) => s.listLoading);
  const error = useConnectionStore((s) => s.lastListError);
  const refresh = useConnectionStore((s) => s.refreshList);
  useEffect(() => {
    if (!loaded && !loading) {
      void refresh();
    }
  }, [loaded, loading, refresh]);
  const list = Object.values(byId).sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || "";
    const tb = b.updatedAt || b.createdAt || "";
    return tb.localeCompare(ta);
  });
  return { list, byId, loaded, loading, error, refresh };
}
