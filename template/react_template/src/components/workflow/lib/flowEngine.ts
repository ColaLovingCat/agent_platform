/** 浏览器端调用上游服务的薄封装。
 *
 * 所有请求都打到本地 Next BFF（`/api/*`），由服务端再转发给 model_server / flow_engine。
 * 这样浏览器端不需要知道（也不应该知道）上游的真实地址。
 */

import type {
  FileInputNodeData,
  Flow,
  FlowNode,
  KnowledgeNodeData,
  LLMNodeData,
  ManualTriggerNodeData,
  MCPNodeData,
  PromptNodeData,
  SkillNodeData,
  ToolNodeData,
  WebhookTriggerNodeData,
} from "./types";
import { DEFAULT_USER_MESSAGE_TEMPLATES, findTriggerNode } from "./types";

export type ModelOption = {
  id: string;
  backend: string;
  loaded?: boolean;
};

/** 函数式工具（function calling）。
 *  来自 model_server 的 GET /v1/library/tools/list（经 BFF /api/tools 代理）。
 *  本地 @skill 装饰过的函数 provider="local"；MCP server 工具的 provider 等于 server name
 *  （MCP 仍由 flow_engine 管，未来要展示时叠加并行 fetch）。
 */
export type Tool = {
  name: string;
  description: string;
  parameters?: unknown;
  provider: string;
};

/** Skill (md playbook) — 人写的方法论 / 风格指南。
 *  来自 model_server 的 GET /v1/library/skills/list（经 BFF /api/skills 代理）。
 *  运行时被 flow_engine 拼进 system prompt。
 */
export type Skill = {
  name: string;
  description: string;
  tags?: string[];
  filename?: string;
};

/** 一个 MCP server 的元信息，来自 flow_engine 的 /v1/mcp/servers。 */
export type MCPServer = {
  name: string;
  active: boolean;
  command?: string;
  args?: string[];
};

/** 知识库（KB）的轻量描述，来自 rag_engine 的 GET /v1/knowledge/list（经 BFF 代理）。
 *  在 flow editor 里用作下拉选项；KB 管理页则用更完整的 KnowledgeBaseDetail。
 */
export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  /** 用户配置的 mode；effective_mode 才是实际运行时模式 */
  mode: "auto" | "inline" | "search";
  effective_mode: "inline" | "search";
  source_count: number;
  total_chunks: number;
  total_chars: number;
  updated_at: number;
};

/** KB 详情中的一条 source（一个上传文件 = 一条 source）。 */
export type KnowledgeSource = {
  id: string;
  type: string;
  filename: string;
  size_bytes: number;
  chars: number;
  chunk_count: number;
  uploaded_at: number;
  indexed_at?: number | null;
  storage_path: string;
};

/** GET /v1/knowledge/{id} 的完整返回结构（KB 管理页的"详情"用）。 */
export type KnowledgeBaseDetail = KnowledgeBase & {
  inline_threshold_tokens: number;
  chunk_size: number;
  chunk_overlap: number;
  sources: KnowledgeSource[];
  stats: {
    source_count: number;
    total_chars: number;
    total_chunks: number;
    estimated_tokens: number;
  };
  created_at: number;
};

/** Search 接口返回的命中片段。 */
export type KnowledgeHit = {
  text: string;
  score: number;
  source_id: string;
  source_filename: string;
  heading: string;
  chunk_index: number;
};

export async function fetchModels(): Promise<{
  data: ModelOption[];
  model_server: string;
  errors: string[];
}> {
  const r = await fetch("/api/models", { cache: "no-store" });
  // 502 是 BFF 包好的"上游不可达"，依然包含 errors，不算 fatal
  if (!r.ok && r.status !== 502) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as Partial<{
    data: ModelOption[];
    model_server: string;
    errors: string[];
  }>;
  return {
    data: j.data || [],
    model_server: j.model_server || "",
    errors: j.errors || [],
  };
}

export async function fetchTools(): Promise<{
  providers: string[];
  data: Tool[];
}> {
  const r = await fetch("/api/tools", { cache: "no-store" });
  if (!r.ok && r.status !== 502) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as Partial<{
    providers: string[];
    data: Tool[];
  }>;
  return {
    providers: j.providers || [],
    data: j.data || [],
  };
}

export async function fetchSkills(): Promise<{ data: Skill[] }> {
  const r = await fetch("/api/skills", { cache: "no-store" });
  if (!r.ok && r.status !== 502) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as Partial<{ data: Skill[] }>;
  return { data: j.data || [] };
}

export async function fetchMcpServers(): Promise<{
  available: boolean;
  data: MCPServer[];
}> {
  const r = await fetch("/api/mcp/servers", { cache: "no-store" });
  if (!r.ok && r.status !== 502) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as Partial<{
    available: boolean;
    data: MCPServer[];
  }>;
  return {
    available: !!j.available,
    data: j.data || [],
  };
}

/* ---------------- KB 列表 / CRUD ----------------
 * fetchKnowledge        : flow editor 选 KB 用（轻量字段）
 * fetchKnowledgeDetail  : KB 管理页详情
 * createKnowledge       : KB 管理页新建
 * deleteKnowledge       : KB 管理页删除
 * uploadKnowledgeSource : KB 管理页上传文件（multipart）
 * deleteKnowledgeSource : KB 管理页删除文件
 * searchKnowledge       : KB 管理页"试一下"按钮
 *
 * 返回 502 时仍把 data 安全降级为空；调用方按 errors 字段做提示即可。
 */
export async function fetchKnowledge(): Promise<{ data: KnowledgeBase[] }> {
  const r = await fetch("/api/knowledge", { cache: "no-store" });
  if (!r.ok && r.status !== 502) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as Partial<{ data: KnowledgeBase[] }>;
  return { data: j.data || [] };
}

export async function fetchKnowledgeDetail(
  kbId: string
): Promise<KnowledgeBaseDetail> {
  const r = await fetch(`/api/knowledge/${encodeURIComponent(kbId)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return (await r.json()) as KnowledgeBaseDetail;
}

export async function createKnowledge(input: {
  name: string;
  description?: string;
  mode?: "auto" | "inline" | "search";
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
}): Promise<KnowledgeBaseDetail> {
  const r = await fetch("/api/knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return (await r.json()) as KnowledgeBaseDetail;
}

export async function deleteKnowledge(kbId: string): Promise<void> {
  const r = await fetch(`/api/knowledge/${encodeURIComponent(kbId)}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
}

export async function uploadKnowledgeSource(
  kbId: string,
  file: File
): Promise<{
  source: { id: string; filename: string; chunk_count: number; indexed: boolean };
}> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const r = await fetch(`/api/knowledge/${encodeURIComponent(kbId)}/sources`, {
    method: "POST",
    body: fd,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return await r.json();
}

export async function deleteKnowledgeSource(
  kbId: string,
  sourceId: string
): Promise<void> {
  const r = await fetch(
    `/api/knowledge/${encodeURIComponent(kbId)}/sources/${encodeURIComponent(
      sourceId
    )}`,
    { method: "DELETE" }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
}

export async function searchKnowledge(
  kbId: string,
  query: string,
  topK = 5
): Promise<{
  effective_mode: "inline" | "search";
  hits: KnowledgeHit[];
}> {
  const r = await fetch(`/api/knowledge/${encodeURIComponent(kbId)}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return await r.json();
}

export type RunBody = {
  /** leader flow_id（可选）—— 当 leader 是一个 master_data 里持久化的 flow 时传过去，
   *  让 flow_engine 把它作为本次 FlowRun 的"主体 flow"记录，用于追溯 / 调用树根。
   *  不传 = 临时 ad-hoc chat，不落 FlowRun。 */
  flowId?: string;
  /** 团队 id（可选）—— 当用户从 /teams/<id>/chat 发起会话时传。flow_engine 收到 teamId
   *  会拉取 Team 实体，按 members 构造 FlowAsToolProvider overlay，把每个非 leader 成员
   *  暴露为 agent_<role>_<id6> 工具供 leader LLM 调用。 */
  teamId?: string;
  backend?: string;
  model?: string;
  messages: { role: string; content: string }[];
  /** 启用的函数式 tool 名白名单。undefined → 不限制；[] → 一个 tool 都不可用 */
  tools?: string[];
  /** 启用的 skill (md) 名。空 / 不传 → 不注入任何 playbook */
  skills?: string[];
  /** 启用的 KB id 列表（图里 LLM 接进来的 Knowledge 节点）。
   *  空 / 不传 → 不接 KB；传了之后：
   *    - 后端预注入：inline 整文 / search top-k 拼进 system
   *    - 后端动态工具：每个 KB 注册一个 kb_search_* 让 LLM 主动检索
   */
  knowledge_ids?: string[];
  /** 检索 KB 预注入时取的 top_k，也是 LLM 主动调 kb_search 的默认值 */
  knowledge_top_k?: number;
  /** Tool 级参数强制覆盖。 `{ toolName: { paramName: value, ... }, ... }`
   *  flow_engine 收到 tool_call 后，把 args 跟 `tool_overrides[name]` 合并（**覆盖优先**），
   *  再 dispatch 给实际 tool。使用场景：把 TTS 的 voice 锁成 ZH-M 等"flow 级风格统一"。
   *  缺省 / 空对象 → 不做任何覆盖；语义跟 tools 字段独立（即使 tools=undefined 不限制，
   *  也可以单独传 overrides 锁某些 tool）。
   */
  tool_overrides?: Record<string, Record<string, unknown>>;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  stream?: boolean;
  connectionID?: string;
};

/* =========================================================================
 * 图驱动的"启用集"推导
 *
 * 三个 helper 各管一件事：
 *   - computeEnabledToolsFromGraph   : Tool / MCP 节点 → LLM tools/mcp 端口 → tool 白名单
 *   - computeEnabledSkillsFromGraph  : Skill 节点 → LLM skills 端口 → playbook 名字
 *   - computeSystemPromptFromGraph   : Prompt 节点 → LLM system 端口 → 拼接 system 文本
 * ========================================================================= */

/** Tool 启用集：完全图驱动。
 *
 *  连入 LLM 的 `tools` / `mcp` 端口的节点会被视为启用：
 *    - Tool 节点 → 取 data.name，必须命中 allTools
 *    - MCP 节点 → 取 data.serverName，把所有 provider==serverName 的 tool 全部加入
 *
 *  返回：
 *    - null    : 没有任何连接 → 不限制（让 flow_engine 启用全部 tool）
 *    - string[]: 至少有一条连接 → 显式白名单（可能为空 = 一个都不启用）
 *
 *  这里 null vs [] 的区分很重要：null 让后端走"不限制"分支，跟"删了所有 tool"
 *  完全不是一回事。
 */
export function computeEnabledToolsFromGraph(
  flow: Flow,
  allTools: Tool[]
): string[] | null {
  const toolNameSet = new Set(allTools.map((t) => t.name));

  const llmIds = new Set(
    flow.nodes.filter((n) => n.type === "llm").map((n) => n.id)
  );
  const toolEdges = flow.edges.filter(
    (e) => llmIds.has(e.target) && e.targetHandle === "tools"
  );
  const mcpEdges = flow.edges.filter(
    (e) => llmIds.has(e.target) && e.targetHandle === "mcp"
  );
  if (toolEdges.length === 0 && mcpEdges.length === 0) return null;

  const result = new Set<string>();
  for (const e of toolEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "tool") continue;
    const name = (node.data as ToolNodeData).name;
    if (name && toolNameSet.has(name)) result.add(name);
  }
  for (const e of mcpEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "mcp") continue;
    const serverName = (node.data as MCPNodeData).serverName;
    if (!serverName) continue;
    // tool list 里 MCP tool 的 provider 字段就是 server name（见 flow_engine/mcp_client.py）
    // 注意：当前 /api/tools 只代理 model_server library；MCP tool 暂时不在列表里，
    // 如果未来需要前端识别 MCP，要么 BFF 合并两源，要么节点直接走 /api/mcp/tools
    for (const t of allTools) {
      if (t.provider === serverName) result.add(t.name);
    }
  }
  return Array.from(result);
}

/** Skill (playbook) 启用集：从图里推导。Skill 节点 → LLM skills 端口。
 *
 *  返回：
 *    - string[] : playbook 名（可能为空）；总是数组，绝不返回 null（playbook 字段语义就是
 *                 "空 = 不注入任何 playbook"，没有"全部启用"概念）
 */
export function computeEnabledSkillsFromGraph(
  flow: Flow,
  allSkills: Skill[]
): string[] {
  const skillNameSet = new Set(allSkills.map((s) => s.name));

  const llmIds = new Set(
    flow.nodes.filter((n) => n.type === "llm").map((n) => n.id)
  );
  const skillEdges = flow.edges.filter(
    (e) => llmIds.has(e.target) && e.targetHandle === "skills"
  );

  const result = new Set<string>();
  for (const e of skillEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "skill") continue;
    const name = (node.data as SkillNodeData).name;
    if (name && skillNameSet.has(name)) result.add(name);
  }
  return Array.from(result);
}

/** Tool 节点的 `paramOverrides` 收集：从图里推导。
 *
 *  扫描所有连到 LLM `tools` 端口的 Tool 节点，把它们各自的 `paramOverrides` 按工具名
 *  聚成 `{toolName: {param: value}}` 返回。空值（undefined/null/空字符串）会被剔除
 *  让它"不算覆盖"——这样面板上"留空"就是"不锁"，跟 ToolNodeData.paramOverrides 注释一致。
 *
 *  多个 Tool 节点同名（一般不该发生，但用户可能复制粘贴出来过）：后写的覆盖前写的
 *  （Object.assign 顺序）；不报错，避免编辑器画布乱删用户数据。
 *
 *  Returns：可能为 `{}`；调用方据此决定是否下发 `tool_overrides` 字段。
 */
export function computeToolOverridesFromGraph(
  flow: Flow
): Record<string, Record<string, unknown>> {
  const llmIds = new Set(
    flow.nodes.filter((n) => n.type === "llm").map((n) => n.id)
  );
  const toolEdges = flow.edges.filter(
    (e) => llmIds.has(e.target) && e.targetHandle === "tools"
  );

  const out: Record<string, Record<string, unknown>> = {};
  for (const e of toolEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "tool") continue;
    const d = node.data as ToolNodeData;
    const tname = d.name;
    if (!tname) continue;
    const raw = d.paramOverrides;
    if (!raw || typeof raw !== "object") continue;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      // 空字符串 / undefined / null 都按"未设置"处理（跟 UI 端语义对齐）
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      clean[k] = v;
    }
    if (Object.keys(clean).length === 0) continue;
    out[tname] = { ...(out[tname] || {}), ...clean };
  }
  return out;
}

/** Knowledge (KB) 启用集：从图里推导。Knowledge 节点 → LLM knowledge 端口。
 *
 *  - 一个 Knowledge 节点可以挂多个 KB（kbIds 数组）；多个 Knowledge 节点连同一个
 *    LLM 时，所有 KB id 取并集去重。
 *  - 找不到的 KB id（用户可能删了 KB 但 flow 还引用着）会按 allKBs 过滤掉，
 *    避免后端 404。
 *  - 跟 skills 一样，返回数组（可能为空），不存在"全部 KB"概念。
 */
export function computeEnabledKBsFromGraph(
  flow: Flow,
  allKBs: KnowledgeBase[]
): string[] {
  const kbIdSet = new Set(allKBs.map((k) => k.id));

  const llmIds = new Set(
    flow.nodes.filter((n) => n.type === "llm").map((n) => n.id)
  );
  const kbEdges = flow.edges.filter(
    (e) => llmIds.has(e.target) && e.targetHandle === "knowledge"
  );

  const result = new Set<string>();
  for (const e of kbEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "knowledge") continue;
    const ids = (node.data as KnowledgeNodeData).kbIds || [];
    for (const id of ids) {
      if (kbIdSet.has(id)) result.add(id);
    }
  }
  return Array.from(result);
}

/** 从图里推导本次运行真正要用的 system prompt。
 *
 *  规则：
 *    - 找出指向任意 LLM 节点、targetHandle="system" 的边，按 edge.id 字典序稳定排序
 *      （写入 flow 时通常按用户连线先后追加，id 是 nanoid，足够稳定）；
 *    - 取每条边 source 端的 Prompt 节点 data.content（去除两端空白），
 *      非空的用 `\n\n` 拼接成最终 system message；
 *    - 一根 system 边都没有 → 返回 null，由调用方退回到 config.system / 节点本地 system 文本。
 */
export function computeSystemPromptFromGraph(flow: Flow): string | null {
  const llmIds = new Set(
    flow.nodes.filter((n) => n.type === "llm").map((n) => n.id)
  );
  const sysEdges = flow.edges
    .filter((e) => llmIds.has(e.target) && e.targetHandle === "system")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (sysEdges.length === 0) return null;

  const parts: string[] = [];
  for (const e of sysEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "prompt") continue;
    const content = ((node.data as PromptNodeData).content || "").trim();
    if (content) parts.push(content);
  }
  return parts.length ? parts.join("\n\n") : null;
}

export function buildRunBody(
  llm: LLMNodeData,
  messages: RunBody["messages"],
  opts: {
    stream?: boolean;
    connectionID?: string;
    /** 函数式 tool 启用集（由 computeEnabledToolsFromGraph 算出）。
     *  - null      → 不限制（不下发 tools 字段，后端启用全部）
     *  - string[]  → 显式白名单（可能为空 = 一个都不启用）
     */
    tools?: string[] | null;
    /** Skill (md playbook) 启用集（由 computeEnabledSkillsFromGraph 算出）。
     *  空数组 → 不下发 skills 字段。
     */
    skills?: string[];
    /** KB 启用集（由 computeEnabledKBsFromGraph 算出）。空数组 → 不接 KB。 */
    knowledgeIds?: string[];
    knowledgeTopK?: number;
    /** Tool 参数覆盖集（由 computeToolOverridesFromGraph 算出）。
     *  空对象 / undefined → 不下发字段。 */
    toolOverrides?: Record<string, Record<string, unknown>>;
    /** leader flow_id（FlowRun 追溯用）。可选。 */
    flowId?: string;
    /** 团队 id（让 flow_engine 接通 team-driven sub-agent overlay）。可选。 */
    teamId?: string;
  } = {}
): RunBody {
  // tools=null（不限制）和 undefined（未传）都视为"不下发字段"
  // tools=[]  / tools=[name,…] 则显式下发，让后端按白名单过滤
  const tools =
    opts.tools === null || opts.tools === undefined ? undefined : opts.tools;

  // skills 空数组等同于"不注入" → 不下发字段
  const skills =
    opts.skills && opts.skills.length ? opts.skills : undefined;

  // KB 同 skills 语义：空数组等同于"不接 KB" → 不下发字段
  const knowledge_ids =
    opts.knowledgeIds && opts.knowledgeIds.length
      ? opts.knowledgeIds
      : undefined;

  // Tool overrides 同样空对象不下发，避免 body 里出现一堆 noise 字段
  const tool_overrides =
    opts.toolOverrides && Object.keys(opts.toolOverrides).length > 0
      ? opts.toolOverrides
      : undefined;

  return {
    flowId: opts.flowId || undefined,
    teamId: opts.teamId || undefined,
    backend: llm.backend || undefined,
    model: llm.model || undefined,
    messages,
    tools,
    skills,
    knowledge_ids,
    knowledge_top_k: knowledge_ids ? opts.knowledgeTopK : undefined,
    tool_overrides,
    temperature: llm.temperature,
    max_tokens: llm.max_tokens,
    max_iterations: llm.max_iterations,
    stream: opts.stream ?? true,
    connectionID: opts.connectionID,
  };
}

/* ===================================================================
 * Trigger payload → user message 模板渲染
 *
 * ReAct flow 的 LLM input handle 只吃一句话用户消息。chat trigger 直接拿
 * user message；非 chat 的 trigger（manual/schedule/webhook）拿到的是结构化
 * payload，需要通过模板渲染成自然语言塞给 LLM。
 *
 * 模板语法（mustache 风格的最小子集）：
 *   - `{{trigger.foo}}`           → payload.foo（string/number/boolean 直出，object 走 JSON.stringify）
 *   - `{{trigger.foo.bar}}`       → payload.foo.bar（按点路径）
 *   - `{{trigger.foo|json}}`      → JSON.stringify(payload.foo, null, 2)
 *   - 未命中的占位符保留原文（不抛错），方便用户调试模板时一眼看到没解析的部分
 *
 * DAG flow 用不到这个——下游节点直接读 trigger.params 即可；这个函数只服务 ReAct。
 * =================================================================== */

/** 按 mustache 风格替换 `{{path[|filter]}}` 占位符。
 *  ctx 是模板根（一般是 `{ trigger: {...payload} }`）。
 */
export function renderUserMessageTemplate(
  template: string,
  ctx: Record<string, unknown>
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}|]+?)\s*(?:\|\s*(\w+)\s*)?\}\}/g, (m, pathExpr, filter) => {
    const path = String(pathExpr).split(".").map((s) => s.trim()).filter(Boolean);
    let cur: unknown = ctx;
    for (const k of path) {
      if (cur && typeof cur === "object" && k in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[k];
      } else {
        // 找不到 → 保留原文，方便调试
        return m;
      }
    }
    if (filter === "json") {
      try {
        return JSON.stringify(cur, null, 2);
      } catch {
        return String(cur);
      }
    }
    if (cur == null) return "";
    if (typeof cur === "string") return cur;
    if (typeof cur === "number" || typeof cur === "boolean") return String(cur);
    try {
      return JSON.stringify(cur);
    } catch {
      return String(cur);
    }
  });
}

/** 从 flow 上的 trigger 节点 + 当前 trigger payload 推出 user message。
 *
 *  逻辑：
 *    - chat trigger：直接返回 payload.message（如果没有则空字符串；ChatPanel 自己有非空校验）
 *    - manual / webhook：取 trigger 节点 data 上的 userMessageTemplate
 *      （没填则用 DEFAULT_USER_MESSAGE_TEMPLATES[type]），再用 renderUserMessageTemplate 渲染
 *    - schedule：DAG-only 触发器，正常不走 ReAct；为了"用户拖错"的兜底，直接用默认模板
 *    - 找不到 trigger 节点：兜底返回 payload 的 JSON（保证 ReAct 至少能跑）
 *
 *  payload 的形态由调用方（运行时）决定：
 *    - chat:      { message: string, history: [...] }
 *    - manual:    { params: {...}, triggeredBy?: string, triggeredAt: string }
 *    - schedule:  { scheduledAt: string, params: {...} }
 *    - webhook:   { body: any, headers: {}, query: {}, path: {} }
 */
export function buildUserMessageFromTrigger(
  flow: Flow,
  payload: Record<string, unknown>
): string {
  const trigger = findTriggerNode(flow.nodes as FlowNode[]);
  if (!trigger) {
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }
  if (trigger.type === "input") {
    const msg = (payload as { message?: unknown }).message;
    return typeof msg === "string" ? msg : "";
  }
  let template: string | undefined;
  if (trigger.type === "manualTrigger") {
    template = (trigger.data as ManualTriggerNodeData).userMessageTemplate;
    template = template ?? DEFAULT_USER_MESSAGE_TEMPLATES.manual;
  } else if (trigger.type === "scheduleTrigger") {
    // schedule 是 DAG-only 触发器，正常不会跑到 ReAct 链路（buildUserMessageFromTrigger
    // 只在 chat flow 渲染 user message 时调用）。但 flow.triggerType 与节点 type 理论上
    // 可以错配（用户拖错），这里给个兜底默认模板避免抛错；不再从节点 data 上取自定义模板——
    // ScheduleTriggerNodeData 已经移除了 userMessageTemplate 字段。
    template = DEFAULT_USER_MESSAGE_TEMPLATES.schedule;
  } else if (trigger.type === "webhookTrigger") {
    template = (trigger.data as WebhookTriggerNodeData).userMessageTemplate;
    template = template ?? DEFAULT_USER_MESSAGE_TEMPLATES.webhook;
  } else {
    template = "";
  }
  return renderUserMessageTemplate(template, { trigger: payload });
}

/* ===================================================================
 * 图驱动取主 LLM
 *
 * 当前 triggerType=chat 流程：用户消息进入 → 找到主 LLM 节点（"主"=直接连到
 * Output 节点的那个；多个 LLM 时取第一个有 output 边的；都没有则取第一个）→
 * 用它的 data 作为本次运行的采样参数源。
 *
 * 这里不做"跨 LLM 编排"——多 LLM 节点 + 工作流编排留到 DAG flow 时再说。
 * =================================================================== */
export function findPrimaryLLMNode(flow: Flow): {
  id: string;
  data: LLMNodeData;
} | null {
  const llms = flow.nodes.filter((n) => n.type === "llm");
  if (llms.length === 0) return null;
  // 优先：output 直连的 LLM（output 节点 = 终点）
  const outputs = new Set(
    flow.nodes.filter((n) => n.type === "output").map((n) => n.id)
  );
  for (const llm of llms) {
    const reachesOutput = flow.edges.some(
      (e) => e.source === llm.id && outputs.has(e.target)
    );
    if (reachesOutput) {
      return { id: llm.id, data: llm.data as LLMNodeData };
    }
  }
  // 回退：图里第一个 LLM
  return { id: llms[0].id, data: llms[0].data as LLMNodeData };
}

/** 找出图里"FileInput 节点 → LLM input 端口"的边对应的 FileInput 节点们。
 *
 *  Chat 场景判定的核心：
 *    - 调用方先确定 primary LLM id（findPrimaryLLMNode）
 *    - 这里返回所有 FileInput 节点的 (id + data)，data 上有 acceptMime / maxBytes /
 *      multiple / parseAs 等约束，ChatPanel 据此决定附件 picker 的形态
 *    - 多个 FileInput 节点连同一个 LLM：约束按"任一允许就允许"原则合并
 *      （e.g. 任一节点 multiple=true 则允许多文件；accept 集合做并集；maxBytes 取最大）；
 *      parseAs 按出现顺序取第一个（chat 场景一次只能一种解析方式，否则文本拼接逻辑混乱）。
 *
 *  返回数组（可能为空）；空数组 → 当前 flow 没有 FileInput → LLM 的接线，ChatPanel
 *  应当不显示附件 picker。
 */
export function findFileInputNodesForLLM(
  flow: Flow,
  llmId: string
): { id: string; data: FileInputNodeData }[] {
  const fileInputEdges = flow.edges.filter(
    (e) =>
      e.target === llmId &&
      (e.targetHandle ?? "input") === "input"
  );
  const out: { id: string; data: FileInputNodeData }[] = [];
  for (const e of fileInputEdges) {
    const node = flow.nodes.find((n) => n.id === e.source);
    if (node?.type !== "fileInput") continue;
    out.push({ id: node.id, data: node.data as FileInputNodeData });
  }
  return out;
}

/** HTML `accept` 语义匹配 —— ChatPanel picker 与 FileInputNode picker 共用。
 *
 *  patterns 来自节点 acceptMime 字段切分；调用方保证非空（空数组应当跳过校验
 *  视为"不限"）。
 *
 *  支持的 pattern 写法（与原生 `<input accept>` 对齐）：
 *    - `* ` / `* /*`     → 任意类型
 *    - `text/*`         → 主类型相等
 *    - `text/plain`     → 完整 mime 精确匹配
 *    - `.pdf`           → 文件名后缀匹配（不区分大小写）
 */
export function matchesAcceptMime(file: File, patterns: string[]): boolean {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  for (const raw of patterns) {
    const p = raw.toLowerCase();
    if (p === "*" || p === "*/*") return true;
    if (p.startsWith(".")) {
      if (fileName.endsWith(p)) return true;
      continue;
    }
    if (p.endsWith("/*")) {
      const major = p.slice(0, -2);
      if (fileType.startsWith(major + "/")) return true;
      continue;
    }
    if (fileType === p) return true;
  }
  return false;
}

/** 按约束验证一批 File；返回 (通过, 错误说明列表)。
 *  - acceptMime 空 → 不校验 accept
 *  - maxBytes 0/负数 → 不校验大小
 *  逻辑跟 ChatPanel / FileInputNode 同款，提到 flowEngine 是为了两边写一遍。
 */
export function validateFilesAgainstConstraints(
  files: File[],
  constraints: { acceptMime: string; maxBytes: number }
): { ok: File[]; errors: string[] } {
  const ok: File[] = [];
  const errors: string[] = [];
  const accepts = constraints.acceptMime
    ? constraints.acceptMime
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  for (const f of files) {
    if (constraints.maxBytes > 0 && f.size > constraints.maxBytes) {
      errors.push(
        `${f.name} 超出大小限制（${formatBytesLocal(constraints.maxBytes)}）`
      );
      continue;
    }
    if (accepts.length > 0 && !matchesAcceptMime(f, accepts)) {
      errors.push(`${f.name} 类型不在白名单（${constraints.acceptMime}）`);
      continue;
    }
    ok.push(f);
  }
  return { ok, errors };
}

/** 内部用的字节格式化——不依赖外面那个，否则会循环依赖 fileOutputUtils */
function formatBytesLocal(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ===================================================================
 * 附件 → user message 合成
 *
 * 把"原文本 + File[] + parseAs"拼成发给 LLM 的最终字符串，并同步返回展示用的
 * 附件元信息。Chat 路径（ChatPanel.send）与画布 inline run 路径（runFlowToStore）
 * 都走这个函数 —— 两边对 LLM 的可见输入完全一致。
 *
 * 设计要点：
 *   - parseAs="text" → await file.text() 内联文件内容
 *   - parseAs="raw"/"chunks" → 仅占位 + 元信息（避免大 base64 撑爆 token；
 *     真正 DAG 引擎接通后才走二进制路径）
 *   - 任一文件读取失败：在 metas 标 error，**不**进 user message
 *   - 仅附件无文本：自动加引导句"请处理以下 N 个附件文件"，保证 user message 非空
 *
 * ## 图片专用路径（auto image-url）
 * 一旦 `f.type` 以 `image/` 起头，**无视 parseAs**，自动走"先 POST /api/upload
 * 拿 URL → 在 user message 里露出 `image_url=...`"的 ReAct 友好路径。这样 LLM
 * 看到的 user message 里有一个可读的 URL，加上 `image_to_text` tool 已经在
 * tool list（LibraryToolProvider 自动注册），LLM 自己就会调
 * `image_to_text(image_url="…")` 把图里的文字读回来。
 *
 * 为什么不走 base64：100KB 的小截图 base64 后就 ~140KB / ~35K token，1.7B / 7B
 * 量级的模型上下文一吞就爆。短 URL（master_data 上传后返回 `/uploads/abc.png`）
 * 几十字节，无压力。
 *
 * 上传失败的兜底：单张图上传失败时 metas 标 error，并退回到 parseAs=raw 的占位
 * 路径——不至于让整个 send 直接挂掉。
 * =================================================================== */

export type ChatAttachmentMeta = {
  name: string;
  size: number;
  mime: string;
  /** image-url：图片经 /api/upload 落地后给 LLM 一段 URL，由 image_to_text tool 读 */
  parsedAs: "text" | "raw" | "chunks" | "image-url";
  /** parsedAs="image-url" 时：上传成功后拿到的可访问 URL；UI bubble 可点开预览 */
  url?: string;
  /** 读取/上传失败 → 用于 UI 标红；有 error 时该附件不在 userInputForLLM 里 */
  error?: string;
};

/** 把一张图丢去 BFF /api/upload，拿回 master_data 落地后的 URL。
 *
 *  返回 url 是 master_data 给出的绝对地址（如 `http://localhost:9740/uploads/abc.png`），
 *  model_server 的 `image_to_text` tool 直接 httpx GET 即可读取。
 */
async function uploadImageForLLM(
  file: File
): Promise<{ url: string; name?: string; size?: number; type?: string }> {
  const fd = new FormData();
  // master_data 端字段名是 PascalCase 的 "File"；BFF /api/upload 原样透传
  fd.append("File", file, file.name);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  let body: { url?: string; name?: string; size?: number; type?: string; error?: string };
  try {
    body = await r.json();
  } catch {
    throw new Error(`upload 返回非 JSON (HTTP ${r.status})`);
  }
  if (!r.ok || !body.url) {
    throw new Error(body.error || `upload 失败 (HTTP ${r.status})`);
  }
  return body as { url: string; name?: string; size?: number; type?: string };
}

/** 单文件 → user message 块；图片走 image-url 路径，其它沿用 parseAs 规则。 */
async function buildOneAttachmentBlock(
  f: File,
  idx: number,
  total: number,
  parseAs: "text" | "raw" | "chunks"
): Promise<{ block: string | null; meta: ChatAttachmentMeta }> {
  const mime = f.type || "application/octet-stream";

  // 图片：走 image-url（OCR via image_to_text tool）
  if (mime.startsWith("image/")) {
    try {
      const up = await uploadImageForLLM(f);
      const block =
        `--- File ${idx + 1}/${total}: name="${f.name}" type="${mime}" size=${f.size} parsedAs=image-url ---\n` +
        `image_url=${up.url}\n` +
        // 给 LLM 一个明确 hint：tool 描述里其实已经说了，这里再强化一遍方便小模型抓住
        `提示：可调用 image_to_text(image_url="${up.url}") 读取图片中的文字。\n` +
        `--- End File ${idx + 1}/${total} ---`;
      return {
        block,
        meta: { name: f.name, size: f.size, mime, parsedAs: "image-url", url: up.url },
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return {
        block: null,
        meta: {
          name: f.name,
          size: f.size,
          mime,
          parsedAs: "image-url",
          error: `图片上传失败：${err}`,
        },
      };
    }
  }

  if (parseAs === "text") {
    try {
      const body = await f.text();
      return {
        block: `--- File ${idx + 1}/${total}: name="${f.name}" type="${mime}" size=${f.size} parsedAs=text ---\n${body}\n--- End File ${idx + 1}/${total} ---`,
        meta: { name: f.name, size: f.size, mime, parsedAs: "text" },
      };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      return {
        block: null,
        meta: {
          name: f.name,
          size: f.size,
          mime,
          parsedAs: "text",
          error: `读取失败：${err}`,
        },
      };
    }
  }

  return {
    block: `--- File ${idx + 1}/${total}: name="${f.name}" type="${mime}" size=${f.size} parsedAs=${parseAs} ---\n[binary content omitted; 仅元信息]\n--- End File ${idx + 1}/${total} ---`,
    meta: { name: f.name, size: f.size, mime, parsedAs },
  };
}

export async function buildUserInputWithAttachments(
  text: string,
  files: File[],
  parseAs: "text" | "raw" | "chunks"
): Promise<{ userInputForLLM: string; metas: ChatAttachmentMeta[] }> {
  if (files.length === 0) {
    return { userInputForLLM: text, metas: [] };
  }

  // 并行处理：图片走上传 + 其它走本地读 / 占位。一次性 await 一组 Promise，
  // 多张图叠加时延 = 单张上传时延，而不是串行累加。
  const results = await Promise.all(
    files.map((f, i) => buildOneAttachmentBlock(f, i, files.length, parseAs))
  );

  const blocks: string[] = [];
  const metas: ChatAttachmentMeta[] = [];
  for (const r of results) {
    if (r.block) blocks.push(r.block);
    metas.push(r.meta);
  }

  const head = text || `请处理以下 ${files.length} 个附件文件：`;
  return {
    userInputForLLM: [head, "", ...blocks].join("\n"),
    metas,
  };
}

/** 把多个 FileInput 节点的约束合并成"实际能上传什么"的有效配置。
 *
 *  规则：
 *    - acceptMime：去重后用逗号拼；任一为空 → 整体不限（HTML `accept` 留空）
 *    - maxBytes：所有节点取最大值；0 / undefined 视作"不限"，整体 = 0
 *    - multiple：任一为 true → true
 *    - parseAs：第一个非空的（chat 场景需要单一解析策略）；都没有 → "text"
 *  调用方应当只在 nodes.length > 0 时调本函数。
 */
export function mergeFileInputConstraints(
  nodes: { data: FileInputNodeData }[]
): {
  acceptMime: string;
  maxBytes: number;
  multiple: boolean;
  parseAs: "raw" | "text" | "chunks";
} {
  let acceptMime = "";
  let acceptOpen = false; // 一旦遇到空 accept，最终就不限
  let maxBytes = 0;
  let unlimitedSize = false;
  let multiple = false;
  let parseAs: "raw" | "text" | "chunks" | undefined;
  const acceptSet = new Set<string>();

  for (const n of nodes) {
    const d = n.data;
    if (!d.acceptMime || !d.acceptMime.trim()) {
      acceptOpen = true;
    } else {
      for (const p of d.acceptMime.split(",")) {
        const t = p.trim();
        if (t) acceptSet.add(t);
      }
    }
    if (d.maxBytes == null || d.maxBytes <= 0) {
      unlimitedSize = true;
    } else {
      maxBytes = Math.max(maxBytes, d.maxBytes);
    }
    if (d.multiple) multiple = true;
    if (!parseAs && d.parseAs) parseAs = d.parseAs;
  }
  if (acceptOpen) acceptMime = "";
  else acceptMime = Array.from(acceptSet).join(",");
  if (unlimitedSize) maxBytes = 0;
  return {
    acceptMime,
    maxBytes,
    multiple,
    parseAs: parseAs || "text",
  };
}

/** 异步生成器：遍历 SSE 事件。
 *
 * `opts.signal` 可选，用于支持用户在前端按"停止"中断；同时也会把上游的
 * fetch 一起取消（在 BFF 路由里转发给 flow_engine）。
 */
export async function* runReactStream(
  body: RunBody,
  opts: { signal?: AbortSignal } = {}
): AsyncGenerator<Record<string, unknown>, void, unknown> {
  const r = await fetch("/api/flows/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal: opts.signal,
  });
  if (!r.ok || !r.body) {
    let detail = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      detail = j.detail || detail;
    } catch {
      try {
        const t = await r.text();
        if (t) detail = t;
      } catch {}
    }
    throw new Error(detail);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    while (true) {
      const idx = buf.indexOf("\n\n");
      if (idx < 0) break;
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of block.split("\n")) {
        const trimmed = line.replace(/^data:\s?/, "");
        if (line === trimmed) continue;
        if (trimmed === "[DONE]") return;
        try {
          yield JSON.parse(trimmed);
        } catch {
          // ignore malformed
        }
      }
    }
  }
}
