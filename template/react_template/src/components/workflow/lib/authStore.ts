/** 当前登录用户的客户端 store。
 *
 *  这里只缓存"展示用"的 user 信息（id / username / avatar / email / roles）。
 *  真正的 token 由 httpOnly cookie 持有 —— 浏览器 JS 读不到，避免 XSS 偷 token；
 *  middleware 凭 cookie 判定路由放行；BFF 凭 cookie 透传给 master_data。
 *
 *  ### 生命周期 ###
 *  - 首次挂载（AuthBootstrap 组件）触发 `hydrate()`：
 *      先看 localStorage 有缓存 user 没 → 有则直接灌进 store（瞬开），
 *      然后异步打一次 /api/auth/me 做"权威验证"（cookie 过期就清掉）。
 *  - login() 成功后调 `setUser()` 同时写 localStorage + 内存
 *  - logout() 调 `clear()` 把两边都抹掉
 *
 *  ### 设计取舍：为什么不用 zustand persist middleware ###
 *  SSR / 首屏闪烁不友好；persist 会在水合时短暂返回空状态，导致 Nav 闪一下"未登录"。
 *  手动 hydrate 我可以保证"首屏先用 localStorage 灌"，避免出现这种闪烁。
 */

"use client";

import { useEffect } from "react";
import { create } from "zustand";

import type { AuthUser } from "./authClient";
import { getMe } from "./authClient";

const LS_KEY = "front_next.authUser.v1";

function readLs(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as AuthUser;
    if (!obj || typeof obj !== "object" || !obj.ID) return null;
    return obj;
  } catch {
    return null;
  }
}

function writeLs(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.localStorage.setItem(LS_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(LS_KEY);
    }
  } catch {
    // 隐身模式 / 配额满 —— 静默放过
  }
}

type State = {
  user: AuthUser | null;
  /** true 表示首次启动还没确认过——Nav / page 在这期间显示 loading 占位避免闪烁 */
  hydrating: boolean;
  /** true 表示已经至少 hydrate 过一次（不管成功失败）；后续不再自动调 /me */
  hydrated: boolean;
};

type Actions = {
  setUser: (u: AuthUser | null) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
};

export const useAuthStore = create<State & Actions>((set, get) => ({
  user: null,
  hydrating: true,
  hydrated: false,

  setUser: (u) => {
    writeLs(u);
    set({ user: u });
  },

  clear: () => {
    writeLs(null);
    set({ user: null });
  },

  hydrate: async () => {
    if (get().hydrated) return;
    // 1) 先用 localStorage 瞬开（避免 Nav 闪烁）
    const cached = readLs();
    if (cached) {
      set({ user: cached });
    }
    // 2) 再异步用 BFF 做权威校验
    try {
      const r = await getMe();
      if (r.ok && r.user) {
        writeLs(r.user);
        set({ user: r.user, hydrating: false, hydrated: true });
      } else {
        // /me 401 —— cookie 没了或过期；清掉本地缓存
        writeLs(null);
        set({ user: null, hydrating: false, hydrated: true });
      }
    } catch {
      // 网络/BFF 故障 —— 不动 user（保留 localStorage 缓存的展示态，让用户能继续点）
      set({ hydrating: false, hydrated: true });
    }
  },
}));

/** Hook：组件挂载时确保 hydrate 已发起（只触发一次）。 */
export function useAuthHydrate() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrating = useAuthStore((s) => s.hydrating);
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    if (!hydrated && hydrating) {
      void hydrate();
    }
  }, [hydrated, hydrating, hydrate]);
}
