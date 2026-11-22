/** 服务端独占的上游 URL 配置。
 *
 * 所有跨服务调用都必须经过 Next 的 /api/* BFF；浏览器永远只跟同源说话，
 * 不需要也不应该知道 model_server / flow_engine / rag_engine / master_data 的真实地址。
 *
 * 部署时通过环境变量注入：
 *   MODEL_SERVER_URL=http://model_server:9710   LLM/Embedding/TTS/STT/OCR
 *   RAG_ENGINE_URL=http://rag_engine:9720       KB CRUD + 检索（独立服务）
 *   FLOW_ENGINE_URL=http://flow_engine:9730     ReAct 编排
 *   MASTER_DATA_URL=http://master_data:9740     基础数据 (Auth / Flows / Logs / WebSocket)
 *
 * MASTER_DATA_TOKEN 是给 BFF 调 master_data 的"服务账号" JWT，**fallback 用**。
 * 实际取数优先级见 lib/authToken.ts.getServerAuthToken()：
 *   1) 当前请求 Cookie `auth-token`（用户登录后由 BFF /api/auth/login 写入）—— 首选
 *   2) MASTER_DATA_TOKEN —— 兜底，给后台脚本路径 / dev 阶段没接登录前的临时连通
 *   3) 空串 —— 全没有，写接口会被 master_data 顶 401
 *
 * 接入登录后日常开发不再需要这个变量；保留它是为了：
 *   - 后台 scheduler / webhook 调 master_data（没有"当前用户"上下文）
 *   - dev 阶段不想注册账号、直接登录跑通的快速路径
 */

export const MODEL_SERVER_URL = "http://localhost:9710";

export const FLOW_ENGINE_URL ="http://localhost:9730";

export const RAG_ENGINE_URL = "http://localhost:9720";

export const MASTER_DATA_URL ="http://localhost:9740";

/** 给 BFF 调 master_data 写接口用的 JWT（dev: 登录一次后塞到 .env.local）。 */
export const MASTER_DATA_TOKEN =  "";
