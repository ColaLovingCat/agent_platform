/** flow Definition JSON 列的纯打包/拆包辅助函数。
 *
 *  这个文件**没有任何 IO / next/headers / 浏览器 API**——可被 client 组件 / server
 *  组件 / BFF 路由 / store helper 任何运行时直接 import。
 *
 *  之所以单独成文（不放回 masterDataClient.ts）：
 *   - `masterDataClient.ts` 用到 `next/headers` 读 cookie 拿登录态 JWT；它只能在
 *     server runtime 里被加载。
 *   - 但 `FlowToolbar.tsx`（client 组件）需要 `buildFlowDefinition` 给"获取数据"
 *     debug 按钮 console.log 用——一旦让 client 模块直接 import masterDataClient，
 *     Next.js 编译就会因为 next/headers 报错。
 *   - 把纯函数抽到这里既能被 client 调用，masterDataClient.ts 也能继续 re-export
 *     兼容老引用路径。
 */

import type { Flow } from "./types";

/** 构造 master_data Flow.Definition JSON 列的对象形态（不 stringify）。
 *
 *  Definition 这一列在 .NET 端是个透明 JSON 字符串字段——前端把 variables / nodes /
 *  edges 以及 v1 阶段尚未拆出独立列的派生字段（sharedUsers / webhookAuth /
 *  webhookSecrets）都塞进去，dtoToFlow 读出来时再展开成 Flow 上的顶层字段。
 *
 *  仅当数组非空 / kind 非默认时才写入——省字节、便于人眼对照 master_data 实际数据。 */
export function buildFlowDefinition(input: {
  sharedUsers?: Flow["sharedUsers"];
  webhookAuth?: Flow["webhookAuth"];
  webhookSecrets?: Flow["webhookSecrets"];
  variables?: Flow["variables"];
  nodes?: Flow["nodes"];
  edges?: Flow["edges"];
}): Record<string, unknown> {
  const def: Record<string, unknown> = {
    variables: input.variables ?? [],
    nodes: input.nodes ?? [],
    edges: input.edges ?? [],
  };
  if (input.sharedUsers && input.sharedUsers.length > 0) {
    def.sharedUsers = input.sharedUsers;
  }
  if (input.webhookAuth && input.webhookAuth !== "none") {
    def.webhookAuth = input.webhookAuth;
  }
  if (input.webhookSecrets && input.webhookSecrets.length > 0) {
    def.webhookSecrets = input.webhookSecrets;
  }
  // 注：v1 阶段 agentSpec / subAgents 还会在这里写。现在 Flow 不再承担"自己是什么 Agent /
  // 团队是谁"的责任——这些都迁到 /teams 管理界面（Team 实体持有成员 + role + leader）。
  // 旧数据里的 agentSpec / subAgents 字段保留在 master_data Definition 中由 dtoToFlow
  // round-trip 读出来挂回 Flow.agentSpec / subAgents，但新版本不再写入。
  return def;
}
