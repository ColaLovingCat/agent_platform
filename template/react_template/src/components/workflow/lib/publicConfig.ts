/** 浏览器与服务端共享的"公开"配置。
 *
 * 跟 `serverConfig.ts` 的区别：
 * - `serverConfig.ts` 是**服务端独占**的上游 URL（MODEL_SERVER_URL / FLOW_ENGINE_URL 等），
 *   只在 `/api/*` BFF route handlers 里用，浏览器侧永远不能读到。
 * - 本文件是用 `NEXT_PUBLIC_` 前缀注入到浏览器 bundle 的 URL，给"用户要拿到手并复用"的
 *   外部入口用——典型例子：webhook trigger 节点编辑页显示的 endpoint URL，用户拷给
 *   外部系统（Stripe / GitHub / Zapier）直接调用，不能经过 BFF（BFF 在 webhook 链路上
 *   加不上任何价值，反而多一跳故障面）。
 *
 * 部署时通过环境变量注入：
 *   NEXT_PUBLIC_WEBHOOK_PUBLIC_URL=https://webhooks.example.com
 *
 * dev 默认值：直连本机的 flow_engine（9730）。它已经挂载了 /webhooks/{flow_id} 路由，
 * 处理 auth + 执行 DAG + 写日志。
 */

/** 外部系统调用 webhook 的公网入口前缀（不带尾部斜杠）。
 *
 *  组合规则：`${WEBHOOK_PUBLIC_URL}/webhooks/${flow_id}` = 用户拷给外部用的完整 URL。
 *  改这个 = 改用户在 PropertyPanel 看到的 URL；不会改 BFF 自己访问 flow_engine 的链路
 *  （那条用的是服务端独占的 FLOW_ENGINE_URL）。 */
export const WEBHOOK_PUBLIC_URL = "http://localhost:9730".replace(/\/+$/, "");
