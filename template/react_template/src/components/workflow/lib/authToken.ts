/** 服务端取认证 token —— 给所有 BFF 路由 / store helper 复用。
 *
 * 取数优先级：
 *   1) 当前请求 Cookie 里的 `auth-token`（用户登录后 BFF /api/auth/login 写入）
 *   2) env 里的 `MASTER_DATA_TOKEN` —— "服务账号" fallback，给"无人为驱动"路径用：
 *        - scheduler / webhook 这种后台调 master_data（其实它们走 flow_engine 直连，
 *          不经 Next BFF，这条路径平时用不到，留作兜底）
 *        - dev 阶段没接登录前的临时连通
 *
 * 这个函数**只能在 Server Component / API route / middleware 之外的 server runtime 里用**——
 * 它读 `next/headers.cookies()`，需要在请求上下文中执行。客户端永远不要 import 本文件。
 */
import { cookies } from "next/headers";

import { MASTER_DATA_TOKEN } from "./serverConfig";

/** Cookie 名 —— 跟 BFF /api/auth/login 路由 set-cookie 时用的名一致。 */
export const AUTH_TOKEN_COOKIE = "auth-token";

/** 取当前请求的认证 token：用户 token 优先；缺则用服务账号 token；都没有返空串。
 *
 *  返回空串而不是 undefined，让调用方可以无脑 `if (token)` 判断。空串说明
 *  现在确实没有任何 token——这对 GET（master_data 读接口大多不要 [Authorize]）
 *  是 OK 的；写接口（save / delete）会被 master_data 顶到 401，调用方自然
 *  得到 401 → 触发前端 redirect /login。
 */
export function getServerAuthToken(): string {
  // cookies() 在 Next 15 是同步的；早期版本是 Promise——按你当前 next 版本来。
  // 这里假设同步 API；如果运行时报错"cookies() is now async"再调整。
  try {
    const c = cookies();
    const userToken = c.get(AUTH_TOKEN_COOKIE)?.value;
    if (userToken) return userToken;
  } catch {
    // 在不能访问请求上下文的情境下（比如 build time 渲染）cookies() 会抛——
    // 不要让这种"无害的没上下文"把整个调用炸了，回退到服务号
  }
  return MASTER_DATA_TOKEN || "";
}
