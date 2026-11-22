/** Flow 与节点类型定义。
 *
 * 标准化后的 Flow 数据形态：
 *
 *   元数据：id / name / description / triggerType / createdAt / updatedAt
 *   主体  ：variables / nodes / edges
 *
 * 关键设计：
 *
 * 1. **triggerType** 决定触发方式（chat / manual / schedule / webhook）。
 *    跟后端 master_data.Flows.TriggerType 字段名严格对齐——这是同一份数据。
 * 2. **variables** 是 flow 级别的全局变量声明；运行时给节点（Prompt / Tool / …）
 *    引用，例如未来在 Prompt 内写 `{{var.foo}}` 模板。本次先落地骨架，
 *    模板插值实现留给下一阶段。
 * 3. **没有 `config` 字段**——LLM 采样参数（backend / model / system / 温度 …）
 *    全部跟随 LLM 节点 data，运行时从图里找 LLM 节点取。这样所有"运行行为"
 *    都来自 nodes/edges，flow 顶层只承载"flow 是什么"的元数据。
 *
 * 关于 LLM 节点的多 handle 设计：
 * - input     : Position.Left  / id="input"     / type=target — 接收用户输入（slate 灰）
 * - system    : Position.Left  / id="system"    / type=target — Prompt 节点接进来（sky 青）
 * - skills    : Position.Left  / id="skills"    / type=target — Skill 节点接进来（lime 黄绿）
 * - knowledge : Position.Left  / id="knowledge" / type=target — Knowledge 节点接进来（teal 青绿）
 * - tools     : Position.Left  / id="tools"     / type=target — Tool 节点接进来（amber 黄）
 * - mcp       : Position.Left  / id="mcp"       / type=target — MCP 节点接进来（violet 紫）
 * - output    : Position.Right / id="output"    / type=source — 节点输出（brand 蓝）
 *
 * 启用集 / system prompt 都是图驱动（见 lib/flowEngine.ts 三个 compute*FromGraph）。
 */

/* ===================================================================
 * Flow 执行类型
 *
 * react vs dag 是两套**根本不同的执行模型**：
 *
 *   - react : LLM 自主代理（ReAct loop）。一个 LLM 节点 + 上游接 input/skills/
 *             knowledge/tools/mcp 端口；运行时 LLM 自行决定何时调工具、循环
 *             多少次直到产出最终答案。图本身只是「配置 LLM 的方式」，没有
 *             显式的执行顺序——一切顺序由 LLM 推理过程隐式产生。
 *
 *   - dag   : 你来编排执行序列（开发者驱动的工作流）。trigger → 节点 A →
 *             节点 B（条件分支）→ 节点 C → output。每条边都是确定的「先后」,
 *             图就是程序。可以包含 LLM 节点（作为 DAG 中的一步），但 LLM
 *             不是「中心」——只是众多步骤之一。
 *
 * 这俩**创建时就要选定**——画布形态、运行模型、可放节点都不同。后端
 * (master_data.Flows.FlowType) 也用这两个值，前后端字段名严格对齐。
 * =================================================================== */

export type FlowType = "react" | "dag";

export const FLOW_TYPES: ReadonlyArray<{
  value: FlowType;
  label: string;
  /** 一句话副标题——卡片上的次级文字 */
  tagline: string;
  /** 多行详细解释——卡片底部的小字段 */
  description: string;
  /** 适用场景（bullet list 文本，前端渲染时按 \n 拆分） */
  fits: string[];
  /** 经典示例 */
  example: string;
  /** 起手画布说明（让用户对"创建后看到啥"有预期） */
  starterHint: string;
}> = [
  {
    value: "react",
    label: "ReAct LLM",
    tagline: "Workflow enhanced for multi-turn chats",
    description:
      "围绕 1 个 LLM 节点展开：把 prompt / skill / knowledge / tool / mcp 节点连到 LLM 左侧分区，运行时 LLM 在 ReAct loop 里自行调度。图只是「配置 LLM 的方式」，节点之间没有强制执行顺序。",
    fits: [
      "智能问答 / 客服助手",
      "知识查询 / RAG 检索增强",
      "需要 LLM 主动调多个工具的场景",
    ],
    example:
      "用户：今天东京天气如何？\n→ LLM 调 weather(city='Tokyo') → 拿到结果 → 总结生成回答",
    starterHint:
      "起手画布：trigger + 2 个示例 tool（calculator / now）+ LLM + output，连好线即可跑",
  },
  {
    value: "dag",
    label: "DAG Workflow",
    tagline: "Agentic flow for intelligent automations",
    description:
      "图就是程序：trigger 之后顺序 / 条件 / 循环执行节点；每条边都是明确的先后关系。可以放 LLM 节点（作为某一步），但 LLM 不再是中心。runtime 由 flow_engine 的 DAG 引擎调度（接通中）。",
    fits: [
      "数据采集 → 处理 → 输出 的 ETL 流水线",
      "定时同步 / Webhook 自动化",
      "有明确多步骤的业务流程（含条件分支 / 循环）",
    ],
    example:
      "Schedule 触发 → HTTP 拉 API → Code 解析 → If/Else 分流 → 写 Variable → File Output 落盘",
    starterHint:
      "起手画布：仅一个 trigger 节点；下游节点（HTTP / Code / If/Else / Output…）你自己从左侧拖",
  },
];

/* ===================================================================
 * Trigger 类型
 *
 * 设计要点：
 * 1. triggerType 不由用户在右侧面板手填——它由画布上的 **Trigger 节点** derive。
 * 2. 一个 flow 只能有一个 Trigger 节点（在 FlowEditor.onDrop 里强制）。
 *    - 拖入 Chat Input → triggerType = "chat"
 *    - 拖入 Manual Trigger → triggerType = "manual"
 *    - 拖入 Schedule Trigger → triggerType = "schedule"
 *    - 拖入 Webhook Trigger → triggerType = "webhook"
 * 3. 这样 flow 的"被怎么触发"是图结构本身的一部分，跟节点类型一一对应，
 *    不存在"triggerType 选了 chat 但画布上是 webhook trigger"这类不一致状态。
 * =================================================================== */

export type TriggerType = "chat" | "manual" | "schedule" | "webhook";

export const TRIGGER_TYPES: ReadonlyArray<{
  value: TriggerType;
  label: string;
  description: string;
  available: boolean;
}> = [
  {
    value: "chat",
    label: "Chat",
    description: "聊天界面触发：用户消息直接进入 flow，流式返回 LLM 答案",
    available: true,
  },
  {
    value: "manual",
    label: "Manual",
    description: "手动按钮触发：用户在运行页填好 params 后点 Run",
    available: true,
  },
  {
    value: "schedule",
    label: "Schedule",
    description: "定时任务触发：master_data 调度器按 cron 表达式定时拉起",
    available: true,
  },
  {
    value: "webhook",
    label: "Webhook",
    description: "Webhook 触发：外部系统 POST 到自动生成的路径来启动 flow",
    available: true,
  },
];

/* ===================================================================
 * 全局变量
 *
 * 设计参考 dify / langflow / n8n：把 variables 声明为带 type 的数组，
 * 而非 { [name]: any }，便于：
 *   - 渲染表单（按 type 选控件）
 *   - 序列化校验（type 有限闭集）
 *   - 未来引用语法稳定（{{var.foo}} 静态可解）
 * =================================================================== */

export type FlowVariableType = "string" | "number" | "boolean" | "json";

export type FlowVariable = {
  /** 标识符：字母/数字/下划线，首字符不可为数字 */
  name: string;
  type: FlowVariableType;
  /** 可选默认值；运行时被节点 / 模板引用前生效 */
  defaultValue?: string | number | boolean | unknown[] | Record<string, unknown> | null;
  description?: string;
};

/** 校验变量名是否合法标识符（让 UI 提前拦） */
export function isValidVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/* ===================================================================
 * 节点 data
 * =================================================================== */

export type LLMNodeData = {
  label?: string;
  backend?: string;
  model?: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
};

/** Tool 节点：函数式工具（function calling）。
 *  `name` 与 model_server `/v1/library/tools/list` 中的 name 对齐；provider 通常是 `local`。
 *  MCP 暴露的工具请用 MCP 节点（按 server 整体接入；那条路仍归 flow_engine 管）。
 *
 *  `paramOverrides` —— flow 设计期写死的参数值，运行时**覆盖** LLM 传的同名参数。
 *  典型用法：把 TTS 的 voice 锁成 ZH-M、speed 锁成 1.2，使整个 flow 的语音风格统一，
 *  不被 LLM 每次自由选择搞得忽男忽女。语义：
 *    - 未出现的 key → LLM 自由决定
 *    - 值为 `undefined`、`null`、空字符串 → 视作未设置（不覆盖）
 *    - 其它值 → 强制覆盖 LLM 的同名 arg
 *  约定上只覆盖 JSON Schema 里**非 required** 的参数（required 的参数语义上是用户输入，
 *  覆盖会让 tool 行为完全失去与用户意图的联系）；UI 层只渲染非 required 字段强化这点。
 */
export type ToolNodeData = {
  label?: string;
  name: string;
  paramOverrides?: Record<string, unknown>;
};

/** Prompt 节点：图上的一段 system 提示文字。
 *  通过右端 source 拉到 LLM 的 system 分区 target；运行时被合并到 system message。
 */
export type PromptNodeData = {
  label?: string;
  /** 提示正文（多行，会按出现顺序拼接进 system message） */
  content: string;
};

/** Skill 节点：引用 model_server `/v1/library/skills/list` 中的 playbook（.md）。
 *  通过右端 source 拉到 LLM 的 skills 分区 target；运行时由 flow_engine 拉取
 *  skill body 并注入 system。`name` 必须命中 SkillRegistry，否则 flow_engine 会忽略。
 */
export type SkillNodeData = {
  label?: string;
  name: string;
};

/** MCP 节点：在图里挂一个 MCP server，所有该 server 暴露的 tool 都会作为 LLM 可用工具。
 *  serverName 必须和 flow_engine 配置中的 MCP server 名一致；
 *  运行时如果该 server 还没 connect，flow_engine 那边只是返回空 tool 集（不会崩）。
 */
export type MCPNodeData = {
  label?: string;
  serverName: string;
};

export type IONodeData = {
  label?: string;
};

/** Knowledge 节点：图里的一个 KB 引用入口。
 *
 *  数据语义：
 *    - 一个 Knowledge 节点 = 一组 KB 的逻辑分组；可选多个 kbId
 *    - 通过右端 source 拉到 LLM 的 knowledge 分区 target
 *    - 运行时 flow_engine 会对每个 KB 做：
 *        · effective_mode=inline  → 整文拼进 system prompt
 *        · effective_mode=search  → 用户最近一句话取 top-k 拼进 system
 *        · 同时给每个 KB 暴露 kb_search_<name> 工具供 LLM 主动调用
 *
 *  为什么允许"一个节点多 KB"而不是"一节点一 KB"：
 *    KB 数量易爆（10+），节点和连线视觉成本太高；用 chip 多选交互体验更好。
 *    如果想 per-KB 单独可视化，就拖多个 Knowledge 节点连同一个 LLM 即可。
 */
export type KnowledgeNodeData = {
  label?: string;
  /** 选中的 KB id 列表；找不到的 id 会在运行时被过滤（KB 可能被用户删了） */
  kbIds: string[];
};

/** FileOutput 节点：终点节点，把上游 LLM 这一 turn 的最终文本变成可下载文件。
 *
 *  设计要点：
 *  - **不持久化产物**：runtime 的预览 / Blob 都活在内存（lib/flowRuntimeStore），
 *    刷新页面就没了——是 chat 类 flow 的"次级输出"，不是核心数据。
 *  - **左侧 1 个 input handle**，无 source（终点）。
 *  - **filename 模板**：MVP 阶段固定时间戳模板 `{prefix}-YYYYMMDD-HHmmss.{ext}`,
 *    用户可在节点面板覆盖前缀和扩展名；将来可加 `${name}` 之类的 placeholder。
 *
 *  Format：决定后缀 + 预览渲染方式
 *    - "md"   : Markdown（在 modal 里走 react-markdown）
 *    - "txt"  : 纯文本
 *    - "json" : 当成 JSON（modal 里 pretty print）
 *    - "auto" : 看 LLM 输出，frontmatter `---` 开头 → md；JSON 可解 → json；否则 txt
 */
/** FileOutput 节点支持的产物格式
 *  - md / txt / json : 文本类，直接把 LLM 文本写盘
 *  - media           : 二进制类，从 LLM 文本里抽出第一个 markdown 媒体 URL（音/图/视/PDF），
 *                      fetch 后按真实扩展名落盘
 *  - auto            : 优先按 media 探测（文本里发现媒体 URL → 走 media）；否则按文本启发判断 md/json/txt
 */
export type FileOutputFormat = "md" | "txt" | "json" | "media" | "auto";

export type FileOutputNodeData = {
  label?: string;
  /** 文件名前缀；最终 = `${prefix}-YYYYMMDD-HHmmss.${ext}` */
  filenamePrefix?: string;
  format?: FileOutputFormat;
};

/** Response 节点：DAG 的终点节点之一，把上游数据按模板渲染成 JSON 响应体，
 *  作为本次触发（webhook / manual / schedule）的 HTTP 返回值。
 *
 *  字段语义：
 *    - statusCode   : HTTP 状态码（默认 200）；常见 200 / 201 / 400 / 404 / 500
 *    - bodyTemplate : 响应体模板，支持 mustache 风格的占位：
 *                       `{{trigger.x}}`              当次触发负载
 *                       `{{<上游 node id>.foo}}`      上游节点输出
 *                       `{{var.flag}}`               flow 全局变量
 *                     模板应该是合法 JSON；引擎渲染时把 `{{xxx}}` 替换为对应值后
 *                     按 JSON parse 一遍再 stringify 输出，避免引号污染。
 *    - headers      : 额外响应头 KV；引擎会自动加 `Content-Type: application/json`，
 *                     这里只填业务自定义的（如 X-Request-Id）。
 *
 *  约束：
 *    - 没有 output handle（叶子节点）；只有左侧 input handle
 *    - 一条 webhook flow 通常有 1~N 个 Response 节点（IfElse 分支各一个）；
 *      执行到哪条分支的 Response 节点，它的渲染结果就是 HTTP 响应
 *
 *  当前阶段：前端只锁 schema + UI；运行时由后续的 DAG 引擎消费。
 */
export type ResponseNodeData = {
  label?: string;
  /** HTTP 状态码；默认 200 */
  statusCode?: number;
  /** JSON 模板字符串；渲染后必须是合法 JSON */
  bodyTemplate?: string;
  /** 额外响应头 KV；引擎默认加 Content-Type: application/json */
  headers?: Record<string, string>;
};

/* ===================================================================
 * DAG 通用节点的 data（5 个 MVP 节点）
 *
 * 这五个是 DAG flow 最常用的"5 件套"：
 *   - Data Source : File Input / HTTPRequest / Variable
 *   - Process     : Code
 *   - Flow        : IfElse
 *
 * 当前阶段前端只锁 schema + UI；真跑由 flow_engine 的 DAG 引擎接通
 * （还没做）。schema 设计原则：跟 master_data.Flows.definition.nodes[].data
 * 一一对应——后端拿到 JSON 直接是 .NET DTO 形态。
 * =================================================================== */

/** File Input 节点：跟 LLM 的输入耦合在一起 —— 用户在 chat 或画布上挑的文件
 *  会跟 user message 拼在一起发给 LLM。归到 NodePalette 的 "LLM" 组。
 *
 *  使用场景（已实装的）：
 *    - chat flow：FileInput.output → LLM.input 同时存在 ChatInput → LLM.input
 *      时，Chat 面板自动出现"附件 picker"，用户在发送时把文件附在文本一起送给 LLM。
 *    - 画布 inline run：FileInput 节点上有 "Test files" picker，挑了文件 → Run 时
 *      跟 testInput 一起合成 user message。
 *
 *    parseAs=text → 文件 UTF-8 文本直接拼进 user message；其它 parseAs（raw/chunks）
 *    仅生成"附件占位 + 元信息"塞进 user message（避免大 base64 撑爆 token）。
 */
export type FileInputNodeData = {
  label?: string;
  /** 允许 mime 通配，逗号分隔，如 "text/*,application/json"；空 = 不限 */
  acceptMime?: string;
  /** 单文件最大字节；0 / 缺省 = 不限 */
  maxBytes?: number;
  /** 是否允许多文件 */
  multiple?: boolean;
  /** 拿到文件后做什么解析 */
  parseAs?: "raw" | "text" | "chunks";
};

/** Upload Excel 节点：表格类静态数据源 —— 用户在画布上传一个 Excel / CSV 文件，
 *  解析成"sheet 名 → 行数组"的对象，作为下游 DAG 节点（Code / Transform / SQL 等）
 *  的输入。归到 NodePalette 的 "Data Source" 组。
 *
 *  跟 FileInput 的对比：
 *    - File Input   → 跟 LLM 输入耦合；带完整约束（accept / size / multiple / parseAs）
 *    - Upload Excel → 纯数据通道；只接受 xlsx / xls / xlsm / csv / tsv
 *
 *  输出契约（runtime 输出对象形态）：
 *      {
 *        [sheetName: string]: Row[]
 *      }
 *    CSV / TSV 视为只有一个 sheet，名字默认 "Sheet1"。
 *
 *  `activeSheet`：当文件含多 sheet 时，作为下游"单表消费节点"（如 Transform 预览）
 *  的默认 sheet。未设置时取第一个 sheet。
 *
 *  文件本体存进 useFlowRuntime.flow.testFiles[id]，DAG 引擎接通后从同一张表里读。
 *
 *  历史：本节点 type 仍叫 `upload`（不改 kind 名以避免破坏旧 flow 存档），
 *  但展示文案 / 调色板分组 / 配置 UI 都已围绕 Excel 语义重做。
 */
export type UploadNodeData = {
  label?: string;
  /** 多 sheet 文件中，下游"单表消费节点"默认读哪个 sheet。 */
  activeSheet?: string;
  /** master_data /api/upload 返回的访问 URL。
   *
   *  设计目的：让节点的"文件"成为可被后端消费的持久资源——webhook 触发 / 定时任务 /
   *  cross-machine 协作时，flow_engine 直接按这个 URL 下载文件。
   *
   *  生命周期：用户在画布或属性面板选文件 → 浏览器立即放进 useFlowRuntime.flow.testFiles
   *  做即时预览 → 同时 POST 到 BFF /api/upload（转发到 master_data）→ 拿到 URL 写回这里。
   *
   *  重新打开 flow 时：testFiles 是空的，但本 URL 还在；UploadEditor 会按 URL 抓回
   *  Blob 重新填进 testFiles 给预览用。 */
  fileUrl?: string;
  /** 上传时的原文件名（master_data 返回的 originalName）。展示用。 */
  fileName?: string;
  /** 文件大小（字节）。展示用 + 防呆。 */
  fileSize?: number;
  /** Content-Type；master_data 返回什么写什么，不强校验。 */
  fileType?: string;
  /** 上传完成时间（ISO 字符串）。 */
  uploadedAt?: string;
};

/** HTTP Request 节点：调用外部 REST API，结果走下游。
 *
 *  payload 形态：
 *    { status, headers: {}, body: any }
 *
 *  body 字段值 + headers / queryParams 都支持 `{{trigger.xxx}}` /
 *  `{{<前节点>.foo}}` 的模板插值（DAG 引擎那边渲染；前端只负责写）。
 */
export type HttpRequestNodeData = {
  label?: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  /** 简单 KV 编辑；按出现顺序拼到请求头 */
  headers?: Record<string, string>;
  /** 简单 KV 编辑；按出现顺序拼到 query string */
  queryParams?: Record<string, string>;
  /** body 类型；none = 不发 body（GET 默认），json = JSON.stringify(body) */
  bodyType?: "none" | "json" | "form" | "text";
  /** body 原文：bodyType=json 时是 JSON 字符串，form 时是 a=1&b=2，text 时是纯文本 */
  body?: string;
  /** 超时毫秒；0 / 缺省 = 默认 30s */
  timeoutMs?: number;
};

/* ===================================================================
 * SQL 节点 —— 数据库查询数据源（v2 · Connection 引用模式）
 *
 * v2 设计：把"连接"从节点配置中抽离到独立的 Connection 资产（master_data 持久化、
 * 密码加密、跨 flow 复用），节点本身仅保留：
 *   - 引用一个 connectionId
 *   - mode = "table"（自动 SELECT * FROM 某表）或 "query"（手写 SQL）
 *   - mode=table 时填 table；mode=query 时填 query
 *
 * 输出契约：`{ columns, rows, rowCount, elapsedMs, truncated, connectionId, kind }`
 *
 * v1 transitional 字段（host / port / username / password / dialect ...）**已彻底移除**——
 * `migrateSqlNodeData` 会把任何老形态强行降级成 mode=query / connectionId=""，
 * 用户必须在 PropertyPanel 重新选连接，否则节点报错。
 * =================================================================== */

/** SQL 节点引用的 DB 方言；跟 ConnectionKind 对齐（不含 postgres，v1 不上） */
export type SqlDialect = "mssql" | "mysql" | "oracle";

/** UI 用的方言元数据：Connection 编辑表单按 kind 给默认端口 / 显示 ServiceName。 */
export const SQL_DIALECTS: Array<{
  value: SqlDialect;
  label: string;
  defaultPort: number;
  needsServiceName?: boolean;
}> = [
  { value: "mssql", label: "MSSQL (SQL Server)", defaultPort: 1433 },
  { value: "mysql", label: "MySQL / MariaDB", defaultPort: 3306 },
  { value: "oracle", label: "Oracle", defaultPort: 1521, needsServiceName: true },
];

export type SqlNodeData = {
  label?: string;
  /** 必填：引用 master_data 的 Connection.id。为空时节点会报"未选 connection"错误。 */
  connectionId: string;
  /** "table"：自动 `SELECT * FROM <table>`；"query"：手写 SQL 串。默认 query。 */
  mode: "table" | "query";
  /** mode=table 时使用。可带 schema 前缀（MSSQL 形如 `dbo.users`）。 */
  table?: string;
  /** mode=query 时使用。支持 :name 命名参数；未来会接 `{{trigger.xxx}}` 模板插值。 */
  query?: string;
  /** 执行超时毫秒；0 / 缺省 = 引擎默认（一般 30s） */
  timeoutMs?: number;
};

/** 把任意老形态 / 不合法 sql 节点 data 规整成 v2 SqlNodeData。
 *
 *  迁移策略（用户决议 3c · 切干净）：
 *  - 任何 v1 transitional 字段（host / port / username / password / dialect / options）一律丢弃
 *  - mode 不在白名单 → "query"
 *  - connectionId 必为字符串（缺省 ""）
 *  - 保留 label / table / query / timeoutMs
 *
 *  幂等；可以反复调用。供 migrateLegacyFlow 在加载时清洗节点 data。
 */
export function migrateSqlNodeData(raw: unknown): SqlNodeData {
  const o = (raw ?? {}) as Record<string, unknown>;
  const mode = o.mode === "table" || o.mode === "query" ? (o.mode as "table" | "query") : "query";
  const out: SqlNodeData = {
    connectionId: typeof o.connectionId === "string" ? o.connectionId : "",
    mode,
  };
  if (typeof o.label === "string") out.label = o.label;
  if (typeof o.table === "string") out.table = o.table;
  if (typeof o.query === "string") out.query = o.query;
  if (typeof o.timeoutMs === "number") out.timeoutMs = o.timeoutMs;
  return out;
}

/** Global Variables 节点：flow.variables 的 编辑面板入口。
 *
 *  设计动机：把"全局变量的增删改"从 FlowOverview（无选中节点的右侧面板）挪到这个
 *  节点本身，使它成为变量维护的"单一入口"。FlowOverview 退化为只读的 key 概览。
 *
 *  执行语义：不参与 DAG 执行（没有 input / output handle），运行期对它无感知。
 *  画布上仅作为可视化的变量清单 + 配置面板触发器。
 *
 *  历史字段（mode / varName / valueExpr）已废弃：
 *    - 旧版本里这个节点是"读 / 写一个变量"的运行时节点
 *    - 现在变量读写靠模板 `{{var.xxx}}` / Code 的 `vars` 隐式参数完成，节点身上不再
 *      承担运行逻辑。老数据可以原样保留，加载时直接忽略，不影响渲染。
 */
export type VariableNodeData = {
  label?: string;
  /** @deprecated 旧 read/write 模式已移除；字段保留只为兼容历史 flow JSON。 */
  mode?: "read" | "write";
  /** @deprecated 旧 varName 已移除；保留兼容字段。 */
  varName?: string;
  /** @deprecated 旧 valueExpr 已移除；保留兼容字段。 */
  valueExpr?: string;
};

/** Code 节点：执行一段 JS / Python，对上游 inputs 做任意处理。
 *
 *  执行模型（DAG 引擎接入后约定）：
 *    - 输入对象 `inputs` 是上游所有节点 output 的合并 record（按节点 id 分键）
 *    - JS：调用方法 `(inputs) => any`；返回值 = 节点 output
 *    - Python：执行体内可访问 `inputs` / `globals`，最后赋 `output = ...`
 *
 *  当前阶段前端只保存 code 字符串；真跑要走 flow_engine 的沙箱（后续）。
 */
export type CodeNodeData = {
  label?: string;
  language: "javascript" | "python";
  code: string;
  timeoutMs?: number;
};

/** If/Else 节点：二路条件分支。
 *
 *  设计：
 *    - 节点有 1 个左侧 input target（接上游），2 个右侧 source（id="true" / "false"）
 *    - condition 是个表达式字符串，DAG 引擎把它跟 inputs / variables 一起 eval
 *    - 表达式语法（前端只校验非空，不真正解析）：
 *        {{trigger.params.region}} == "cn"
 *        {{node_xxx.body.score}} > 0.8
 *        {{var.flag}} && {{trigger.params.x}}
 *
 *  下游分两支：true 分支接到 "true" handle，false 分支接到 "false" handle。
 */
export type IfElseNodeData = {
  label?: string;
  condition: string;
};

/** Switch 节点：多路条件分支 + 固定的 default 兜底。
 *
 *  跟 IfElse 的关系：
 *    - IfElse = 单条件 → true / false（2 路）
 *    - Switch = 单表达式 + N 个候选值 → case_<id> + default（N+1 路）
 *
 *  匹配规则（与服务端 switch.py 对齐）：
 *    1. expression 和每个 case.value 都过 `{{...}}` 模板替换
 *    2. 双方 strip 首尾空白 + 配对去除外层引号
 *    3. 字符串等值 → 命中；按 cases 数组顺序首个匹配即止
 *    4. 都不中 → default 分支
 *
 *  Handle 约定（v2 合并字段后）：
 *    - input  (target) ：上游接入
 *    - <case.value> (source) ：每个 case 一个；**handle id 直接复用 case.value 字面量**
 *      （历史上有过单独的 case.id 字段，v2 合掉了——见 migrateLegacyFlow 的迁移逻辑）
 *    - default (source) ：固定存在，找不到匹配时走这里
 *
 *  case.value 约束：
 *    - 非空：留空的 case 在画布上不渲染 source handle（连不出去）
 *    - 在同一 Switch 节点内**应当唯一**：重复时只有第一条生效，其它行红字告警
 *    - 内容不限：字面量 / 引号字符串 / 数字 / `{{...}}` 模板都可以；
 *      backend 在比较前会 strip 引号 + 配对剥一层（详见 switch.py 的 normalize 逻辑）
 *
 *  改 value = 改这条分支的语义；如果已经有连线挂在上面，连线会断（sourceHandle
 *  对不上）—— PropertyPanel 会显示 "⚠ 已有 N 条下游连接，修改会断开它们" 提示。
 */
export type SwitchCase = {
  /** 候选值 = 比较项 + source handle id。支持 `{{trigger.x}}` 等模板插值 */
  value: string;
};

export type SwitchNodeData = {
  label?: string;
  /** 主表达式；支持 `{{...}}` 模板；推荐形式 `{{trigger.params.region}}` 这种单占位 */
  expression: string;
  /** 用户配的 case 列表；按数组顺序首个匹配生效 */
  cases: SwitchCase[];
};

/** Merge 节点：多分支合流。
 *
 *  典型拓扑（接在 IfElse / Switch 之后把分支收回主流）：
 *
 *    If/Else ─true──→ A ──┐
 *            ─false─→ B ──┴─→ Merge ──→ ...
 *
 *  服务端调度（dag_executor v2）：所有入边一律 decrement in_deg，归零后由 executor
 *  决定"跑或跳"——Merge 在 dag_executor 里被特殊豁免：哪怕零携带也跑。
 *
 *  Output 语义：
 *    - 单上游成功 → 透传该上游 output（最常见，下游 Code 直接用 `prev`）
 *    - 多上游成功 → 字典 {source_id: output, ...}
 *    - 零上游成功 → null（极端兜底）
 *
 *  无配置项；节点本身没有 condition / params 之类的状态。
 */
export type MergeNodeData = {
  label?: string;
};

/** Transform 节点的操作链 —— 类 Power Query / pandas pipeline。
 *
 *  设计要点：
 *    - **顺序敏感**：ops 按数组下标依次应用，前一步的输出是后一步的输入
 *    - **可单独禁用**：每个 op 可 `enabled=false` 临时跳过（保留配置便于切回）
 *    - **类型感知**：filter 的 op 集合随列类型变化（详见 lib/transform.ts.opsForType）
 *    - **失败兜底**：changeType 解析失败时保留原值 + 单元格画淡红角标（不抛错打断流水线）
 *
 *  各 op kind 字段含义：
 *    rename            : 把 column 重命名成 to（新名字不能跟现有列重复）
 *    duplicate         : 复制 column 到 as（新列追加在末尾）
 *    delete            : 直接删除 column
 *    changeType        : 把 column 转成 type；datetime 可选 format（如 "YYYY-MM-DD"，
 *                        缺省用 Date 构造函数自动判断）
 *    replace           : 在 column 上做 from→to 替换；useRegex=true 时 from 作正则
 *    removeDuplicates  : 去重；columns 不传 = 按全表去重，传则按这些列组合去重
 *    filter            : 保留满足条件的行；op 集合按列类型不同：
 *                        - string  : eq/neq/contains/startsWith/endsWith/isEmpty/isNotEmpty
 *                        - number  : eq/neq/gt/gte/lt/lte/isEmpty/isNotEmpty
 *                        - datetime: before/after/eq/neq/isEmpty/isNotEmpty
 *                        - boolean : eq/neq/isEmpty/isNotEmpty
 */
export type TransformOp =
  | { kind: "rename";    column: string; to: string }
  | { kind: "duplicate"; column: string; as: string }
  | { kind: "delete";    column: string }
  | {
      kind: "changeType";
      column: string;
      type: "string" | "float" | "int" | "datetime" | "boolean";
      format?: string;
    }
  | {
      kind: "replace";
      column: string;
      from: string;
      to: string;
      useRegex?: boolean;
    }
  | { kind: "removeDuplicates"; columns?: string[] }
  | {
      kind: "filter";
      column: string;
      op:
        | "eq" | "neq"
        | "gt" | "gte" | "lt" | "lte"
        | "contains" | "startsWith" | "endsWith"
        | "before" | "after"
        | "isEmpty" | "isNotEmpty";
      value?: string;
    };

/** Transform 节点：1 维表的数据处理流水线。
 *
 *  入：上游节点的 `{ rows: [{...}, ...] }`
 *  出：按 ops 依次应用后的 `{ rows: [{...}, ...] }`
 *
 *  设计时预览：PropertyPanel 自动探测上游节点（upload / httpRequest / sql ...），
 *  拿一份样本 rows 跑 applyOps 实时刷新预览表；用户改 ops 立刻看到效果。
 */
export type TransformNodeData = {
  label?: string;
  /** 操作链；按下标顺序应用。enabled 为 false 的步骤跳过但保留配置。 */
  ops: Array<TransformOp & { enabled?: boolean }>;
};

/* ===================================================================
 * 三种新 trigger 节点的 data
 *
 * 公共字段：`userMessageTemplate`
 *   ReAct flow 的 LLM input handle 只吃一句话用户消息。chat trigger 直接拿
 *   user message；非 chat 的 trigger（manual/schedule/webhook）拿到的是结构化
 *   payload，需要先渲染成自然语言塞给 LLM。这个字段就是 mustache 风格的模板，
 *   渲染时把 `{{trigger.xxx}}` 替换为对应字段。
 *
 *   DAG flow 用不到这个字段——下游节点直接读 trigger.params 即可。
 * =================================================================== */

/** Manual Trigger：用户点 Run 时手填 params。
 *
 *  paramsSchema 复用 FlowVariable 的 schema 形态：name + type + 默认值，
 *  运行时弹一个 modal 让用户按字段类型填表单，提交后产生 payload.params。
 */
export type ManualTriggerNodeData = {
  label?: string;
  /** 运行时让用户填的字段；空数组 = 直接按"无 params 任务"启动 */
  paramsSchema: FlowVariable[];
  /** ReAct 用：把 payload 渲染成 user message。空字符串 = 用默认模板 */
  userMessageTemplate?: string;
};

/** Schedule Trigger：flow_engine 内置 APScheduler 按 cron 拉起。
 *
 *  这里声明的字段会进 flow.definition 落库；flow_engine 启动 / 周期 refresh 时
 *  读出来注册成 cron job（详见 flow_engine/core/scheduler.py）。
 *
 *  ⚠ 历史字段已移除（保留兼容性说明，避免回滚时困惑）：
 *  - `enabled?: boolean`        —— 跟 Flow 级 `isEnabled` 重复；统一由后者决定
 *                                  "任务是否注册到调度器"
 *  - `userMessageTemplate?: string` —— ReAct (chat) 专用字段；schedule 是 DAG-only
 *                                  触发器从不走 ReAct 链路，留着只会误导用户
 *                                  写出 `{{trigger.params|json}}` 这种代码
 *  老 flow 数据里这俩字段还可能存在；UI 不再读取，落库时也不会回写。
 */
export type ScheduleTriggerNodeData = {
  label?: string;
  /** cron 表达式，5 字段 unix 风格："分 时 日 月 周"。例 `0 9 * * 1-5` */
  cron: string;
  /** IANA 时区名；默认 Asia/Shanghai */
  timezone?: string;
  /** 调度器每次拉起带的固定 params（JSON 字符串，让用户用 monaco / textarea 编辑）。
   *  解析后塞进 `trigger.params`——Code 节点用 `trigger["params"]` 读取。 */
  paramsJson?: string;
};

/** Webhook Trigger：外部 HTTP 调用拉起。
 *
 *  path 由后端按 flow.id 自动生成（前端只读展示）；auth 选 bearer 时显示一个
 *  自动生成的 token——这个 token 真正生成与持久化在 master_data 阶段 3 接入；
 *  当前阶段只是 UI 占位。
 */
export type WebhookTriggerNodeData = {
  label?: string;
  /** HTTP 方法。POST = 参数从请求 body 取；GET = 参数从 URL query 取。默认 POST。
   *
   *  这个选择同时决定：
   *  - 画布上 "Test request" 区域显示哪个输入框（body 或 query）
   *  - cURL 示例的方法/参数位置
   *  - 真实路由的 method 注册（flow_engine 同时挂了 GET/POST，但语义对齐由此控制）
   *
   *  保留单一 method 而不是同时支持两种，是为了让节点的"参数来源"语义清晰：
   *  webhook 当数据收口时，用户在 PropertyPanel 选一次，下游 {{trigger.body.x}} 或
   *  {{trigger.query.x}} 写法就有确定来源。 */
  method?: "GET" | "POST";
  /** none / bearer / hmac，MVP 主要做 bearer */
  auth?: "none" | "bearer" | "hmac";
  /** ReAct 用 */
  userMessageTemplate?: string;
};

export type FlowNodeKind =
  | "input"
  | "manualTrigger"
  | "scheduleTrigger"
  | "webhookTrigger"
  | "prompt"
  | "skill"
  | "knowledge"
  | "llm"
  | "tool"
  | "mcp"
  | "output"
  | "fileOutput"
  | "response"
  | "fileInput"
  // ── DAG 通用节点（前端先做 UI + schema；真跑由 flow_engine DAG 引擎接通）
  | "upload"
  | "httpRequest"
  | "sql"
  | "variable"
  | "code"
  | "ifElse"
  | "switch"
  | "merge"
  | "transform";

/* ===================================================================
 * Trigger ↔ TriggerType 映射
 *
 * 一个 trigger 节点 = 一个 flow 触发方式。
 *
 * **唯一性约束在 FlowEditor.onDrop 里强制**：拖入 trigger 节点前先检查
 * 画布是否已有同类节点，如有则拒绝。
 * =================================================================== */

export const TRIGGER_KIND_TO_TYPE: Readonly<Partial<Record<FlowNodeKind, TriggerType>>> = {
  input: "chat",
  manualTrigger: "manual",
  scheduleTrigger: "schedule",
  webhookTrigger: "webhook",
};

/** 反向映射：TriggerType → 默认应该使用的节点 kind。
 *  新建 flow 弹窗里"选完 triggerType 自动生成 starter"会用到。
 */
export const TRIGGER_TYPE_TO_KIND: Readonly<Record<TriggerType, FlowNodeKind>> = {
  chat: "input",
  manual: "manualTrigger",
  schedule: "scheduleTrigger",
  webhook: "webhookTrigger",
};

export const TRIGGER_KINDS: ReadonlyArray<FlowNodeKind> =
  Object.keys(TRIGGER_KIND_TO_TYPE) as FlowNodeKind[];

export function isTriggerKind(kind: string): kind is FlowNodeKind {
  return kind in TRIGGER_KIND_TO_TYPE;
}

/** 从画布节点列表里反推应该使用的 triggerType。
 *  返回 null 表示画布上没有任何 trigger 节点（flow 处于"未配置触发方式"的过渡态）。
 */
export function inferTriggerTypeFromNodes(
  nodes: { type?: string }[]
): TriggerType | null {
  for (const n of nodes) {
    if (!n.type) continue;
    const t = TRIGGER_KIND_TO_TYPE[n.type as FlowNodeKind];
    if (t) return t;
  }
  return null;
}

/** 找到画布上现有的 trigger 节点（可能没有；按理也最多一个） */
export function findTriggerNode<T extends { type?: string }>(nodes: T[]): T | null {
  return nodes.find((n) => n.type && (n.type as FlowNodeKind) in TRIGGER_KIND_TO_TYPE) ?? null;
}

export type FlowNode = {
  id: string;
  type: FlowNodeKind;
  position: { x: number; y: number };
  data:
    | LLMNodeData
    | ToolNodeData
    | MCPNodeData
    | PromptNodeData
    | SkillNodeData
    | KnowledgeNodeData
    | IONodeData
    | FileOutputNodeData
    | ResponseNodeData
    | ManualTriggerNodeData
    | ScheduleTriggerNodeData
    | WebhookTriggerNodeData
    | FileInputNodeData
    | UploadNodeData
    | HttpRequestNodeData
    | SqlNodeData
    | VariableNodeData
    | CodeNodeData
    | IfElseNodeData
    | SwitchNodeData
    | MergeNodeData
    | TransformNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  /** 多 handle 节点（如 LLM）必填：标识从哪个分区拉出的连线。 */
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
};

/* ===================================================================
 * Agent Spec —— 把 Flow 包装成可被其他 Agent 调用的"下属"
 *
 *  设计语义（M1 · Manager-Subordinate / Agent-as-Tool）：
 *
 *    一个 Flow（ReAct 或 DAG）只要 `agentSpec.callable === true`，就会被
 *    flow_engine 的 `FlowAsToolProvider` 暴露为 LLM 可调用的 function tool。
 *    leader Agent 在 ReAct loop 中可以像调 builtin tool 一样调它，下属跑完
 *    把结果当 tool_result 返回。
 *
 *  字段说明：
 *
 *    callable      : 是否进 leader 的 tools 列表。默认 false —— 不开就跟当前
 *                    没有 agent 概念时完全一致，存量 flow 行为不变。
 *
 *    role          : 一句话角色定位（"Researcher" / "审稿人" / "下单 SOP"），
 *                    leader 的 LLM 看到的是 `agent_<flowId>` 这种 tool name +
 *                    role + description 的组合，role 是它选 tool 的关键信号。
 *
 *    description   : 工具用途的详细描述。倾向于直接给"什么时候应该调我"——
 *                    "搜集互联网公开资料并按要点归纳，每条带来源 URL"。
 *
 *    inputSchema   : JSON Schema (object)，描述 leader 调下属时要传什么。
 *                    没有 schema 时默认 `{ "type": "object" }`（任意 dict）。
 *                    leader 调下属时，args 会作为 trigger.params 注入（DAG）
 *                    或拼成 user message（ReAct，依模板渲染）。
 *
 *    outputSchema  : 可选，主要给文档/校验用。运行时下属把 response 节点产物
 *                    或 final assistant text 包成 `{ output, text }` 返给 leader，
 *                    不做强 schema 校验。
 *
 *    maxIterations : 下属如果是 ReAct flow，限制它的 ReAct loop 上限。默认 5。
 *
 *    timeoutSec    : 单次 sub-call 的 wall-clock timeout，超时上层抛 tool_error。
 *                    默认 60。
 *
 *  关于 subAgents：
 *
 *    Flow 顶层另一个字段 `subAgents` 是当前 flow（作为 leader）能调用的下属
 *    flow ID 白名单。**显式白名单**而非自动发现是为了：
 *      - 控制 leader 的 tools 列表大小（LLM prompt 不爆）
 *      - 让 leader 的"团队"语义在 UI 上明确可见
 *      - 防止误调高权限 / 高成本 flow
 *
 *    白名单里的 flow 必须满足：visibility 允许当前用户访问 + agentSpec.callable=true。
 *    运行时 flow_engine 会二次过滤，权限不足的 ID 静默丢掉。
 * =================================================================== */

export type AgentSpec = {
  /** 是否允许被其他 flow 当 sub-agent 调用。默认 false（不开 = 完全不影响存量）。 */
  callable?: boolean;
  /** 一句话角色定位，e.g. "Researcher" / "审稿人" / "下单 SOP"。 */
  role?: string;
  /** 工具描述：LLM 看到这段决定要不要调。倾向于"什么时候应该调我"。 */
  description?: string;
  /** JSON Schema (object)：leader 调下属时要传的参数。缺省 = 任意 dict。 */
  inputSchema?: Record<string, unknown>;
  /** 可选 outputSchema（文档/校验用，运行时不强校验）。 */
  outputSchema?: Record<string, unknown>;
  /** ReAct 下属的 ReAct loop 迭代上限；默认 5。 */
  maxIterations?: number;
  /** 单次 sub-call 的 wall-clock timeout 秒数；默认 60。 */
  timeoutSec?: number;
};

/** AgentSpec 字段的兜底默认值（创建新 callable flow 时使用）。 */
export const DEFAULT_AGENT_SPEC: AgentSpec = {
  callable: false,
  role: "",
  description: "",
  maxIterations: 5,
  timeoutSec: 60,
};

/* ===================================================================
 * Flow 顶层
 * =================================================================== */

/** flow 的可见性：跟 master_data 的 Flow.Visibility 字段对齐。
 *  - private  : 仅作者可见（默认）
 *  - shared   : 团队 / 项目内可见
 *  - public   : 全租户可见
 *  第一阶段后端只用 private，前端先把枚举打开。
 */
export type FlowVisibility = "private" | "shared" | "public";

/* ===================================================================
 * (trigger_type × visibility) 派生字段
 *
 * 这套字段属于"特定 (trigger × visibility) 组合才需要"——其余组合下保留为空，
 * 不展示在 UI 上。把所有派生字段平铺在 Flow 顶层而不是嵌套是为了：
 *   1. master_data 序列化简单（不用为每种组合定义子结构）
 *   2. 切换 visibility / triggerType 时，已经填好的数据不消失（用户改回去
 *      还能看到之前的设置），避免误删
 *
 * 渲染层（PropertyPanel）按 (triggerType, visibility) 短路决定显隐：
 *   - visibility === "shared"          → 显示 sharedUsers
 *   - triggerType === "webhook"        → 显示 webhookAuth + webhookSecrets
 *       且 visibility === "public"     → webhookAuth 锁死 "none"
 *
 * v1 纯前端：这些字段会被 stringify 进 master_data 的 Definition JSON 字段。
 * v2 backend 上线时，secret value 会改成 hashed_secret，存独立子表。
 * =================================================================== */

/** webhook 入口的鉴权方式（仅 trigger=webhook 时有意义）。
 *  - none       : 公开调用，URL = 凭据
 *  - bearer     : Header `Authorization: Bearer <secret>` 比对
 *  - hmac       : 请求体 + 时间戳 用 secret 做 HMAC-SHA256 签名，
 *                 客户端走 `X-Flow-Signature` header
 *  - signed_url : URL 自带 ?sig=... ；不需要客户端配置 header，但泄露 URL = 泄露凭据
 */
export type WebhookAuthKind = "none" | "bearer" | "hmac" | "signed_url";

export const WEBHOOK_AUTH_OPTIONS: ReadonlyArray<{
  value: WebhookAuthKind;
  label: string;
  hint: string;
}> = [
  { value: "none", label: "None", hint: "无鉴权 · 仅 visibility=public 允许" },
  { value: "bearer", label: "Bearer Token", hint: "`Authorization: Bearer <secret>` 头比对" },
  { value: "hmac", label: "HMAC-SHA256", hint: "请求体 + 时间戳签名，避免重放" },
  { value: "signed_url", label: "Signed URL", hint: "URL 内置 ?sig=...，便捷但泄露 URL = 泄露凭据" },
];

/** webhook secret 条目。
 *
 *  v1 纯前端：`value` 字段是明文，序列化进 Definition JSON。
 *  v2 backend：`value` 会被换成只在创建时返回一次的明文 + 服务端只持久化 hash。
 *
 *  `id` 用 nanoid 在创建时生成，作为吊销 / 编辑的稳定 key。
 */
export type WebhookSecret = {
  id: string;
  label: string;
  /** v1 only · 明文。v2 后端落库时会改成 hashed。 */
  value: string;
  createdAt: string;
  /** 谁创建的（user_id / email）。前端目前没接 auth，暂留空。 */
  createdBy?: string;
};

export type Flow = {
  // 元数据
  id: string;
  name: string;
  description?: string;
  /** 执行模型：react = LLM 自主代理；dag = 你定义的工作流。**创建时定型，不可改**。 */
  flowType: FlowType;
  triggerType: TriggerType;
  /** 可见性范围。默认 "private"。 */
  visibility: FlowVisibility;
  /** 是否启用。关掉相当于"暂停"——保留配置、不再被调度器 / 触发器召唤。 */
  isEnabled: boolean;
  // 审计三件套（master_data 写入，前端只读）
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
  /** 软删除：DeletedAt 非空表示已删除。常规列表不会出现，但单条 GET 可能拿到。 */
  deletedBy?: string;
  deletedAt?: string;
  /** visibility=shared 时的授权用户列表（user_id / email）。其它 visibility 下保留不清空。 */
  sharedUsers?: string[];
  /** triggerType=webhook 时的鉴权方式。visibility=public 时强制为 "none"。 */
  webhookAuth?: WebhookAuthKind;
  /** triggerType=webhook + webhookAuth!=none 时的密钥列表。 */
  webhookSecrets?: WebhookSecret[];
  /** Agent-as-Tool 元数据。可选；agentSpec.callable=true 才会出现在其他 flow 的 sub-agent 候选里。 */
  agentSpec?: AgentSpec;
  /** 本 flow（作为 leader）能调用的下属 flow ID 白名单。运行时 flow_engine 二次过滤权限。 */
  subAgents?: string[];
  // 主体
  variables: FlowVariable[];
  nodes: FlowNode[];
  edges: FlowEdge[];
};

/** LLM 节点 data 的默认值（建新 LLM 节点时使用）。
 *  注意：backend / model 默认 undefined——逼用户显式选模型，避免"看上去能跑实际啥都没配"。
 */
export const DEFAULT_LLM_DATA: LLMNodeData = {
  label: "LLM",
  backend: undefined,
  model: undefined,
  system: "你是一个会调用工具的助手。优先使用工具完成数学计算与查询时间。",
  temperature: 0.3,
  max_tokens: 1024,
  max_iterations: 6,
};

/** 各 trigger 节点的默认 user message 模板。
 *  ReAct flow 用：把 trigger payload 渲染成一句话用户消息。
 */
export const DEFAULT_USER_MESSAGE_TEMPLATES: Readonly<Record<TriggerType, string>> = {
  chat: "{{trigger.message}}",
  manual: "用户手动触发任务，参数：{{trigger.params|json}}，请处理。",
  schedule: "定时任务于 {{trigger.schedule.scheduledAt}} 触发，参数：{{trigger.params|json}}，请执行。",
  webhook: "收到 webhook 调用：{{trigger.body|json}}，请处理。",
};

/* ===================================================================
 * Starter flow 生成
 *
 * 按 (flowType, triggerType) 生成不同起手画布：
 *   - react : 完整的 ReAct 5 件套（trigger + 2 tool + LLM + output），用户开箱即跑
 *   - dag   : 极简——只放 trigger 节点，下游让用户自己拖（DAG 重点是「编排」，
 *             起手不该塞预设结构）
 * =================================================================== */

function makeTriggerNode(
  kind: FlowNodeKind,
  position: { x: number; y: number }
): FlowNode {
  switch (kind) {
    case "input":
      return {
        id: "input",
        type: "input",
        position,
        data: { label: "User Input" } as IONodeData,
      };
    case "manualTrigger":
      return {
        id: "manualTrigger",
        type: "manualTrigger",
        position,
        data: {
          label: "Manual Trigger",
          paramsSchema: [],
          userMessageTemplate: DEFAULT_USER_MESSAGE_TEMPLATES.manual,
        } as ManualTriggerNodeData,
      };
    case "scheduleTrigger":
      return {
        id: "scheduleTrigger",
        type: "scheduleTrigger",
        position,
        data: {
          label: "Schedule Trigger",
          cron: "0 9 * * 1-5",
          timezone: "Asia/Shanghai",
          paramsJson: "{}",
        } as ScheduleTriggerNodeData,
      };
    case "webhookTrigger":
      return {
        id: "webhookTrigger",
        type: "webhookTrigger",
        position,
        data: {
          label: "Webhook Trigger",
          auth: "none",
          userMessageTemplate: DEFAULT_USER_MESSAGE_TEMPLATES.webhook,
        } as WebhookTriggerNodeData,
      };
    default:
      // 不应该走到这里；fallback 到 chat input
      return {
        id: "input",
        type: "input",
        position,
        data: { label: "User Input" } as IONodeData,
      };
  }
}

export function makeStarterFlow(
  id: string,
  name: string,
  triggerType: TriggerType = "chat",
  flowType: FlowType = "react"
): Flow {
  const now = new Date().toISOString();
  const triggerKind = TRIGGER_TYPE_TO_KIND[triggerType];
  const triggerNode = makeTriggerNode(triggerKind, { x: 40, y: 60 });

  if (flowType === "dag") {
    // DAG 起手只放 trigger 节点：下游 HTTP / Code / If/Else / Output 让用户自己拖。
    // 不预设 output——很多 DAG 终点是「写库 / 推送 webhook」而非 chat output 节点。
    return {
      id,
      name,
      description: `Starter DAG flow (${triggerType})`,
      flowType: "dag",
      triggerType,
      visibility: "private",
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
      sharedUsers: [],
      // webhook trigger 默认上一道 bearer 锁；其它 trigger 不存这俩字段（PropertyPanel 也不渲染它们）
      webhookAuth: triggerType === "webhook" ? "bearer" : undefined,
      webhookSecrets: [],
      variables: [],
      nodes: [triggerNode],
      edges: [],
    };
  }

  // react：trigger + calculator + now + LLM + output 五件套
  const triggerId = triggerNode.id;
  const nodes: FlowNode[] = [
    triggerNode,
    {
      id: "tool-calc",
      type: "tool",
      position: { x: 40, y: 260 },
      data: { name: "calculator", label: "calculator" } as ToolNodeData,
    },
    {
      id: "tool-now",
      type: "tool",
      position: { x: 40, y: 420 },
      data: { name: "now", label: "now" } as ToolNodeData,
    },
    {
      id: "llm",
      type: "llm",
      position: { x: 380, y: 120 },
      data: { ...DEFAULT_LLM_DATA } as LLMNodeData,
    },
    {
      id: "output",
      type: "output",
      position: { x: 740, y: 220 },
      data: { label: "Output" } as IONodeData,
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e1", source: triggerId, target: "llm", targetHandle: "input" },
    { id: "e2", source: "tool-calc", target: "llm", targetHandle: "tools" },
    { id: "e3", source: "tool-now", target: "llm", targetHandle: "tools" },
    {
      id: "e4",
      source: "llm",
      target: "output",
      sourceHandle: "output",
      targetHandle: "input",
    },
  ];

  return {
    id,
    name,
    description: `Starter ReAct flow (${triggerType})`,
    flowType: "react",
    triggerType,
    visibility: "private",
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    sharedUsers: [],
    webhookAuth: triggerType === "webhook" ? "bearer" : undefined,
    webhookSecrets: [],
    variables: [],
    nodes,
    edges,
  };
}

/* ===================================================================
 * 老 flow → 新 flow 迁移（store.ts 加载时 + FlowEditor 加载时调用）
 *
 * 处理几类历史包袱：
 *   - 顶层 `config` 字段：把 backend/model/system/temperature/max_tokens/max_iterations
 *     拷到第一个 LLM 节点 data（如果该 LLM 节点缺失对应字段）；config 字段整体删除
 *   - 顶层 `category` 字段：rename 成 `triggerType`（前后端统一字段名）
 *   - 缺失的 flowType 字段：按图反推（有 LLM 节点 → react；否则 → dag）后兜底 react
 *   - 缺失的 triggerType / variables 字段：按图反推 / 默认值
 *
 * 旧的 config.tools / config.skills / config.playbooks 直接抹掉——启用集已经
 * 完全图驱动（见 lib/flowEngine.ts），这些字段没有运行时意义。
 * =================================================================== */

type LegacyFlowConfig = {
  backend?: string;
  model?: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  tools?: unknown;
  skills?: unknown;
  playbooks?: unknown;
};

type LegacyFlow = Partial<Flow> & {
  config?: LegacyFlowConfig;
  /** 旧字段：被 rename 成 triggerType */
  category?: TriggerType;
  /** 旧字段：可能不存在（早期没有 flowType 概念） */
  flowType?: FlowType;
  /** v1.5 新增（兼容写法）：agent 元数据可能以未知形态存在 */
  agentSpec?: unknown;
  subAgents?: unknown;
};

/** 单次迁移：把 v1 的 SwitchCase {id, value} 收敛成 v2 的 {value}，**同时改写**所有
 *  指向旧 case.id 的 edge.sourceHandle，避免分支连线断掉。
 *
 *  约束：
 *  - 只处理 type==='switch' 的节点
 *  - 同节点内 case.id → case.value 一一映射；映射后 case 没有 value 的就丢掉（不能
 *    用作 handle id，前端也不会渲染该行的 handle）
 *  - edges 改写仅匹配 (source === switch.id && sourceHandle === oldCaseId) 的边
 *
 *  返回值：可能新建的 nodes / edges 数组（不变时**原样返回**，避免下游 hook 误判 changed）。
 */
function migrateSwitchCases(
  nodes: FlowNode[],
  edges: FlowEdge[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  let edgesMut: FlowEdge[] = edges;
  let touchedEdges = false;
  let touchedNodes = false;

  const nextNodes = nodes.map((n) => {
    if (n.type !== "switch") return n;
    const data = (n.data || {}) as Record<string, unknown>;
    const cases = Array.isArray(data.cases) ? (data.cases as unknown[]) : [];
    let nodeTouched = false;

    const nextCases: SwitchCase[] = [];
    for (const raw of cases) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      const hasOldId = typeof c.id === "string";
      // handle id 用 trimmed 形式（跟 SwitchNode 的 `v = c.value.trim()` 对齐），
      // 避免老数据里夹了首尾空白时迁移后 handle id ≠ edge.sourceHandle 的"看不见的失配"
      const rawValue = typeof c.value === "string" ? c.value : "";
      const value = rawValue.trim();

      if (hasOldId) {
        nodeTouched = true;
        const oldId = String(c.id || "");
        if (oldId && value && oldId !== value) {
          edgesMut = edgesMut.map((e) => {
            if (e.source === n.id && e.sourceHandle === oldId) {
              touchedEdges = true;
              return { ...e, sourceHandle: value };
            }
            return e;
          });
        }
      }

      // 没 value 的 case 丢掉——v2 里这种行没法连线，留着只会迷惑
      if (value) nextCases.push({ value });
    }

    if (!nodeTouched) return n;
    touchedNodes = true;
    return { ...n, data: { ...data, cases: nextCases } } as FlowNode;
  });

  return {
    nodes: touchedNodes ? nextNodes : nodes,
    edges: touchedEdges ? edgesMut : edges,
  };
}

export function migrateLegacyFlow(raw: unknown): Flow {
  const f = (raw || {}) as LegacyFlow;

  // 把老 config 拷到第一个 LLM 节点 data（如果节点 data 没显式设过对应字段）
  const nodes = (f.nodes || []) as FlowNode[];
  const llm = nodes.find((n) => n.type === "llm");
  if (llm && f.config) {
    const cfg = f.config;
    const d = llm.data as LLMNodeData;
    const nextLLMData: LLMNodeData = {
      ...d,
      backend: d.backend ?? cfg.backend,
      model: d.model ?? cfg.model,
      system: d.system ?? cfg.system,
      temperature: d.temperature ?? cfg.temperature,
      max_tokens: d.max_tokens ?? cfg.max_tokens,
      max_iterations: d.max_iterations ?? cfg.max_iterations,
    };
    llm.data = nextLLMData as FlowNode["data"];
  }

  // triggerType 优先级：图反推 → 顶层 triggerType → 顶层 category（老字段）→ 兜底 chat
  const inferred = inferTriggerTypeFromNodes(nodes);
  const triggerType: TriggerType =
    inferred ?? f.triggerType ?? f.category ?? "chat";

  // flowType 优先级：顶层 flowType（新字段）→ 兜底 react
  // 老数据没有 flowType 概念，全是 ReAct chat flow；dag 一定是显式声明的新字段。
  const flowType: FlowType =
    f.flowType === "react" || f.flowType === "dag" ? f.flowType : "react";

  // visibility / isEnabled 都给后端默认值兜底——老 flow 里大概率没存
  const visibility: FlowVisibility =
    f.visibility === "shared" || f.visibility === "public"
      ? f.visibility
      : "private";
  const isEnabled = typeof f.isEnabled === "boolean" ? f.isEnabled : true;

  // (trigger × visibility) 派生字段：老数据没存就用 sensible defaults。
  // 注意：迁移阶段保留用户已填的字段值，即便当前 visibility / triggerType 下"用不上"——
  // 用户改回原组合时数据还在。强一致由保存后端做，前端只负责呈现。
  const sharedUsers: string[] = Array.isArray(f.sharedUsers)
    ? (f.sharedUsers as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const webhookAuth: WebhookAuthKind | undefined =
    f.webhookAuth === "none" ||
    f.webhookAuth === "bearer" ||
    f.webhookAuth === "hmac" ||
    f.webhookAuth === "signed_url"
      ? f.webhookAuth
      : triggerType === "webhook"
        ? "bearer"
        : undefined;
  const webhookSecrets: WebhookSecret[] = Array.isArray(f.webhookSecrets)
    ? (f.webhookSecrets as unknown[]).filter(
        (x): x is WebhookSecret =>
          !!x &&
          typeof x === "object" &&
          typeof (x as WebhookSecret).id === "string" &&
          typeof (x as WebhookSecret).label === "string",
      )
    : [];

  // agentSpec / subAgents —— v1 引入的 Agent-as-Tool 元数据，老 flow 默认不开
  const rawAgent = (f as Record<string, unknown>).agentSpec;
  const agentSpec: AgentSpec | undefined = (() => {
    if (!rawAgent || typeof rawAgent !== "object") return undefined;
    const a = rawAgent as Record<string, unknown>;
    const out: AgentSpec = {};
    if (typeof a.callable === "boolean") out.callable = a.callable;
    if (typeof a.role === "string") out.role = a.role;
    if (typeof a.description === "string") out.description = a.description;
    if (a.inputSchema && typeof a.inputSchema === "object")
      out.inputSchema = a.inputSchema as Record<string, unknown>;
    if (a.outputSchema && typeof a.outputSchema === "object")
      out.outputSchema = a.outputSchema as Record<string, unknown>;
    if (typeof a.maxIterations === "number") out.maxIterations = a.maxIterations;
    if (typeof a.timeoutSec === "number") out.timeoutSec = a.timeoutSec;
    return out;
  })();
  const subAgents: string[] = Array.isArray((f as Record<string, unknown>).subAgents)
    ? ((f as Record<string, unknown>).subAgents as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      )
    : [];

  return {
    id: String(f.id || ""),
    name: String(f.name || "Untitled"),
    description: f.description,
    flowType,
    triggerType,
    visibility,
    isEnabled,
    createdBy: f.createdBy,
    createdAt: f.createdAt || new Date().toISOString(),
    updatedBy: f.updatedBy,
    updatedAt: f.updatedAt || new Date().toISOString(),
    deletedBy: f.deletedBy,
    deletedAt: f.deletedAt,
    sharedUsers,
    webhookAuth,
    webhookSecrets,
    agentSpec,
    subAgents,
    ...(() => {
      // Switch case 字段收敛：把 v1 {id, value} 改成 v2 {value}，连带改写 edge.sourceHandle。
      // 在这里做（而不是早早赋给 const）是为了保证传给 migrateSwitchCases 的就是最终
      // 决定要写回 Flow 的那份 edges/nodes。
      const migrated = migrateSwitchCases(nodes, (f.edges || []) as FlowEdge[]);
      // SQL 节点：v1 inline 配置（host/port/username/password/...）全部丢弃，转 v2 connectionId 形态
      // 用户决议 3c · 切干净——老节点 connectionId="" 在 PropertyPanel 里会看到"未选连接"提示
      const sqlMigrated = migrated.nodes.map((n) => {
        if (n.type !== "sql") return n;
        const next = migrateSqlNodeData(n.data);
        // 严格对比：迁移前后 data 完全一致就原样返回，避免触发不必要的 store 写入
        const before = n.data as Record<string, unknown>;
        const sameKeys =
          Object.keys(before).length === Object.keys(next).length &&
          Object.entries(next).every(([k, v]) => before[k] === v);
        if (sameKeys) return n;
        return { ...n, data: next as FlowNode["data"] };
      });
      return {
        variables: Array.isArray(f.variables) ? (f.variables as FlowVariable[]) : [],
        nodes: sqlMigrated,
        edges: migrated.edges,
      };
    })(),
  };
}
