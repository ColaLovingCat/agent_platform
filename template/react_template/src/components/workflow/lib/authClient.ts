/** 客户端 auth helpers —— 跟 BFF /api/auth/* 对话。
 *
 *  本模块**只在浏览器里跑**，所以可以放心 import 到任何 "use client" 组件。
 *  服务端取 token 走 lib/authToken.ts 那条路径，跟这里彻底分开。
 *
 *  跟 master_data 的 UserResponseDto 字段名（PascalCase）一致——透传，不在客户端层
 *  再做一次 camelCase 转换：少一层映射 = 少一层"忘了同步导致悄悄 undefined" 的坑。
 */

"use client";

/** 登录用户的展示信息 —— 跟 master_data UserResponseDto 一致（PascalCase）。 */
export type AuthUser = {
  ID: string;
  Userno: string;
  Username: string;
  NtAccount?: string;
  Email?: string;
  DeptName?: string;
  Avatar?: string;
  Status?: boolean;
  Roles?: Array<{ Code?: string; Name?: string }>;
};

/** BFF 通用包壳 —— 跟 app/api/auth/* 路由约定的形态一致。 */
type BffResp<T> = {
  ok: boolean;
  message?: string;
} & T;

async function postJson<T>(url: string, body?: Record<string, unknown>): Promise<BffResp<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let data: BffResp<T> | null = null;
  try {
    data = text ? (JSON.parse(text) as BffResp<T>) : null;
  } catch {
    data = null;
  }
  if (!data) {
    return { ok: false, message: `${res.status} ${res.statusText}` } as BffResp<T>;
  }
  return data;
}

async function getJson<T>(url: string): Promise<BffResp<T>> {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let data: BffResp<T> | null = null;
  try {
    data = text ? (JSON.parse(text) as BffResp<T>) : null;
  } catch {
    data = null;
  }
  if (!data) {
    return { ok: false, message: `${res.status} ${res.statusText}` } as BffResp<T>;
  }
  return data;
}

/** 用账号密码登录。成功时 BFF 已经把 httpOnly cookie 写好；返回的 token 用来塞 localStorage。 */
export async function login(account: string, password: string): Promise<BffResp<{ token?: string }>> {
  return postJson<{ token?: string }>("/api/auth/login", { account, password });
}

/** 拉当前登录用户信息 —— 一般在应用启动 / 强制 refresh 时调一次。 */
export async function getMe(): Promise<BffResp<{ user?: AuthUser }>> {
  return getJson<{ user?: AuthUser }>("/api/auth/me");
}

/** 退出登录 —— BFF 清 cookie；store 自己清 user 状态。 */
export async function logout(): Promise<BffResp<unknown>> {
  return postJson<unknown>("/api/auth/logout");
}

/** 注册新用户 —— 不自动登录；返回 ok 后让前端跳回登录表单。 */
export async function register(input: {
  account: string;
  password: string;
  username?: string;
  email?: string;
}): Promise<BffResp<unknown>> {
  return postJson<unknown>("/api/auth/register", { ...input });
}
