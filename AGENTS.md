# 成熟产品核心维度

## 产品能力全景图
回答：产品为什么存在、为谁服务、解决什么问题？
- 产品类型：
A. 通用型 Agent 问答
B. 企业 Agent Platform 能力（审计/SSO/审批流/私有化/计费）
C. 多 Agent 协作（编排器/角色/任务拆分） 
D. 流程自动化（触发器/定时/可视化编排）
E. 轻应用搭建（Vibe Coding：页面/表单/数据模型）
- 目标用户：普通用户、开发者、业务人员、管理员
- 核心场景：知识问答、流程自动化、数据分析、复杂任务执行、轻应用搭建
- 产品边界：什么由 Agent 自主完成，什么需要人类确认
- 成熟度目标：Demo、可用产品、企业级生产平台

## 总体架构与运行机制
回答：系统由哪些层组成，各层如何协作？
- 前端交互层：Web UI、工作台、Chatbot 界面
- 产品编排层: 轻应用搭建、多 Agent 协作、Workflow 流程自动化
- 平台核心层：Agent 管理、任务调度、运行时
- 智能执行层：执行引擎、LLM、Planning、Reasoning、工具调用
- 能力资源层：Skills、Tools、Knowledge 知识库、Memory 会话记忆
- 数据与基础设施层：数据库 DB、对象存储、消息队列 MQ、模型服务
- 横向治理层：安全、权限、可观测性、审计、成本控制

## 任务路径
```
触发器（API / Webhook / 聊天 / 定时）
  → 接入层创建 Task（带 agent 指定、参数、来源、租户、超时）
  → 任务调度：入 MQ，状态 → pending
  → Runtime 路由执行者（按任务类型选主/子 Agent，加载 System Prompt）
  → 组装上下文：任务参数 + 历史 + 知识检索 + 工具清单（按需注入）
  → 执行循环（ReAct，受预算控制：轮数/token/时间）：
       1. 调用模型（流式）
       2. 解析输出：
          - 最终答案 → 结束
          - 工具调用 → 校验参数/权限
                ├─ L1/L2 → 沙箱执行工具
                └─ L3 → 发 HumanConfirmationRequired 事件，状态 → waiting_human
          - 工具结果 → 回填上下文 → 回到步骤 1
       3. 任一步失败 → 按策略重试/降级
  → 每一步发类型化 Event（AgentStarted / ModelCalled / ToolCalled /
       ToolResult / HumanConfirmationRequired / AgentFinished / Error）
  → 事件推送：界面（SSE/WS 流式）+ Webhook + 事件总线（审计/监控）
  → 任务状态落库 → 结束
```

## 领域模型
回答：核心对象有哪些，谁拥有谁，哪份数据是事实来源？
- 组织对象：Tenant、Workspace、User
- 定义对象：Agent、AgentVersion、Release、Tool、Skill、KnowledgeSource
- 运行对象：Session、Task、Run、Step、Event
- 状态对象：MemoryItem、File、Approval、Credential
- 一次对话能否包含多个 Task；一个 Task 能否有多次 Run
- 运行绑定发布时的 AgentVersion，还是当前 Active 版本
- 文件、记忆、知识的归属是用户、会话、任务，还是工作区
生命周期原则：Session 结束清会话记忆，Task 完成清临时产物，Workspace 知识长期保留。
```
KnowledgeSource → Workspace（团队共享资产；Tenant 级可跨 workspace 共享）
MemoryItem      → 按作用域分：Agent 长期记忆归 Agent / 会话记忆归 Session / 用户偏好归 User
File            → 按来源分：用户上传附件归 User / Agent 产物归 Task / 共享文件归 Workspace
Credential      → 归 Tenant 或 Workspace（加密存储），Agent/工具只"引用"不"持有"
```
- 每个对象只有一个写入方。会话、任务、审计不各写一份互相冲突的状态
```
组织/用户     → 身份服务（唯一写入）
Agent 定义    → AgentVersion 快照（不可变，一旦发布只读）
运行状态      → Task/Run 聚合，TaskService 唯一写入
事实/审计     → Event 日志（不可变追加，所有"发生了什么"的唯一真相）
凭证         → Credential 服务（加密，专用写入）
记忆         → MemoryService（唯一写入）
文件         → FileService + 对象存储（唯一写入）
```

## Agent 生命周期与运行时
回答：一个 Agent 如何从创建走向稳定运行？
- 创建、配置、版本管理、发布、停用
- Agent 身份：Name、Description、Instructions、配置
- 执行循环：理解任务、规划、调用工具、观察结果、继续执行
- 单 Agent 如何运行 = "一个 Agent 的一次 Run"。多 Agent 的计划和 Agent 之间的消息归工作流与协作。编排器把 Task 拆成多个子任务 → 每个子任务路由给对应 Agent → 各自产生 Run → Agent 间消息走事件总线/工作流状态
- 任务状态、超时、重试、暂停、恢复、取消
- 长任务执行与人工介入。
```
长任务：异步 + 进度 Event 流 + 任务状态可随时查询
人工介入：waiting_human + Approval 对象 + 事件通知（界面按钮/Webhook）
等待超时：人工确认设超时（如 24h），超时按策略转 cancelled 或提醒重试
```
- 输出的内容包含可定义的category、内容、状态、进度、Plan等信息

定义状态与运行状态分开记。定义状态是 Draft、Validated、Tested、Published、Active or Deprecated、Archived。运行状态是 queued、running、waiting_tool、waiting_human、succeeded、failed、cancelled、timed_out。
- 暂停、取消的操作者是用户、管理员，还是系统策略
- 失败重试生成新 Run，还是在同一 Run 里增加 Step
- Validated 检查配置和权限，Tested 检查评测结果。两项各自的通过条件写清楚，才允许进入下一态
- 作者侧需要调试台、工具模拟，以及两个定义版本之间的差异

## Agent 能力体系
回答：Agent 可以使用哪些能力，以及如何扩展？
- Models：模型选择、统一接口、路由优先级、Fallback链
- Tools：注册信息（名称 + 参数 schema + 执行方式 + 权限等级 + 错误分类）、API、数据库、代码执行沙箱、外部系统、错误处理
- Skills：可复用的任务执行方法与专业能力，指令 + 编排逻辑 + 能力绑定，最小可插拔单元
- Code Sandbox：代码执行环境
- Knowledge：文档、业务数据、RAG、知识图谱
- RAG: 知识库检索，top-k 召回 + 重排序 + 引用溯源
- Memory：会话上下文、用户偏好、Session、长期记忆
- Files：文件上传、读取、生成、版本管理
- MCP / Integrations：外部工具协议和业务系统集成
- Orchestration / Workflow：编排与协作
- Scheduler & Channels：调度与通知
- Artifactory: 轻应用搭建，生成→ 验证→ 发布→ 嵌入

一句话总结能力体系的设计逻辑：输入侧 4 个（Models/Tools/Skills/Code Sandbox）→ 理解与记忆 3 个（Knowledge/RAG/Memory）→ 外部接入 2 个（MCP/Media）→ 输出侧 3 个（Artifactory/Files/Channels）→ 编排与触发横向贯穿（Orchestration/Scheduler）

### 执行语义
回答：恢复和重试时，副作用如何只发生一次？
- 工具写操作携带幂等键，避免恢复时重复下单或重复改数
- 检查点记到模型轮次、单次工具调用，还是工作流节点
- 执行循环放在进程内，还是交给可恢复的工作流引擎
- 多步骤中一步失败时，已成功的副作用是补偿、保留，还是交给人工

## 上下文组装
回答：每一轮送进模型的内容如何拼出来，什么不能进去？
- 拼装顺序：指令、技能、工具说明、记忆、检索、文件、历史
- 超出窗口时，先丢弃或摘要哪一段
- 工具结果超过多大被压缩，原文保存在 Event 还是文件工作区
- 密钥、其他租户数据、未授权文档在哪一层被挡住
- 长期记忆带来源、作用域和生命周期。历史消息按预算进入 Prompt，不整段永久注入

## 用户交互与应用体验
回答：用户如何使用 Agent，如何理解和控制执行过程？
- Chat、流式响应、多模态输入输出
- 会话列表、历史记录、上下文恢复
- 附件、文件工作区、结果预览与下载
- 任务进度、执行步骤、工具调用状态
- 人工确认、补充信息、任务中断和继续。停下来和继续的规则见人机协同，界面负责展示状态并收集补充信息
- Agent 工作台、模板、应用入口


## 主要功能点

- Agent 搭建、配套的 Skills / Tools Hub 的管理
- Agent Chat / Multi Agent 的 runtime，会话/Memory/缓存/文件等配合的优化
- RAG 及知识库的搭建
- 定时任务的创建和运行
- Workflow 中关于 DAG flow 的引擎编辑、测试、正式运行
- 基于 Vibe Coding Agent 的 Artifactory 
整体任务的拆分 → 项目文件目录的形成 → 自动部署 流程实现
- 模块化可插拔机制
基于 registry.py 的注释
模块间禁止互相 import



## 项目目录
```
agent-platform/
├── apps/
│   └── web/                        # [TS] React + Vite + AntD 控制台
│       └── src/views/              # 视图（与后端服务一一对应）
│           ├── chat/               # 对话工作台
│           ├── schedulers/         # 定时/日历
│           ├── agents/             # agents / skills / tools
│           ├── workflows/          # DAG Graph Editor
│           ├── artifacts/          # 轻应用/制品
│           ├── knowledges/         # 知识 + RAG
│           ├── resources/          # 工作区资源
│           │   ├── docs/           # 文件池
│           │   ├── connections/    # 数据池
│           │   └── models/         # 自定义模型接入配置
│           └── configs/            # 平台设置
│               ├── users/          # 用户及权限管理
│               ├── providers/      # 平台级模型提供商
│               └── system/         # 系统设置
├── services/
│   └── api/                        # [Py·FastAPI] 统一 API（monolith 聚合模式，可拆）
│   │   ├── main.py                 # 启动：读 ENABLED_MODULES → importlib 动态加载注册
│   │   ├── registry.py             # ★模块注册表（注释一行 = 屏蔽一块服务）
│   │   └── modules/                # 各业务模块（独立 router + models + 迁移 + 事件）
│   │       ├── identity/           # auth (login/token) + users + roles
│   │       ├── logs/               # 系统级日志
│   │       ├── files/              # 文件服务 upload(single/multi/chunk)/delete
│   │       ├── models/      # LLM 路由 + llm-harness（DeepSeek）+ 用户密钥/平台 provider
│   │       ├── connections/        # 数据源/连接器（数据库/API/MCP）create/test/credential
│   │       ├── memory/             # 记忆分层 expire
│   │       ├── runtime/            # 单 Agent 执行 run/session/task/step/human
│   │       ├── knowledge/          # RAG + Knowledge（LangChain + Qdrant）chunk/source
│   │       ├── hub/                # Agent/Skill/Tool 定义 (created/publish/active)
│   │       ├── workflow/           # DAG 编排引擎 run/node/trigger
│   │       ├── scheduler/          # ScheduleTask + Calendar create/trigger/request
│   │       ├── artifacts/          # 管理侧 Artifactory 制品库 create/publish/deploy/compose
│   │       ├── vibe/               # 生产侧 Factory Vibe Coding 生成循环（Workspace+Git）
│   │       └── sandbox/            # 代码沙箱（默认独立部署，安全边界）execution
│   └── deepseek-harness/           # 基于官方开源的 Chat 交互界面
│
├── packages/
│   ├── contracts/                  # OpenAPI 契约（双端生成 TS / pydantic）
│   ├── events/                     # 事件定义（JSON Schema）+ Redis Streams 客户端
│   ├── sdk-py/                     # Python 服务间调用 SDK
│   ├── db/                         # 迁移 + 通用仓储（Alembic / Prisma）
│   └── ui/                         # 前端共享组件
│
├── infrastructure/
│   ├── docker-compose.yml          # 一键起全链路
│   ├── postgres/  redis/  qdrant/  minio/
│   ├── migrations/
│   └── observability/              # OTel + Prometheus + Grafana + 日志
│
├── docs/                           # 架构文档
│
├── package.json
└── README.md
```

## 语言与框架选型

Frontend: React + TypeScript

| 技术             | 作用           | 推荐说明                            |
| --------------- | ------------   | ------------------------------- |
| React + Vite    | 前端基础框架     | SPA 应用、模块化页面                    |
| TypeScript      | 强类型语言        | 统一前后端数据类型                       |
| Ant Design      | UI 组件库       | 企业级后台管理界面                       |
| Tailwind CSS    | 样式库          | 原子化 CSS、灵活布局                    |
| Zustand         | 状态管理         | 全局状态、用户状态、UI 状态                 |
| TanStack Query  | 服务端状态管理      | API 请求、缓存、数据同步                  |
| Axios           | HTTP 通讯      | REST API 请求、拦截器                 |
| WebSocket / SSE | 实时通讯         | Agent 对话、Token Streaming、任务状态推送 |
| @xyflow/react   | Graph Editor | Workflow DAG、Agent Flow 编排      |
| Monaco Editor   | 代码与文本编辑器     | Prompt、代码、JSON、YAML 编辑          |
| xlsx            | Excel 文件处理   | Excel 导入、导出、解析                  |
| ECharts         | 数据可视化        | Dashboard、执行统计、运行监控             |
| @file-viewer    | 文件预览         | PDF、Word、Excel、Markdown、图片等     |
| Excalidraw      | 无限画布         | 架构图、流程草图、自由绘图                   |
| React Router    | 路由管理         | 页面路由、模块路由、权限控制                  |
| React Hook Form | 表单管理         | 复杂表单、动态配置表单                     |
| Zod             | 数据校验         | 前端 Schema 校验、表单验证               |
| i18next         | 国际化          | 多语言支持                           |
| Vitest          | 单元测试         | 前端组件和工具函数测试                     |
| Playwright      | E2E 测试       | 浏览器端自动化测试                       |

Backend: FastAPI + Uvicorn

 技术                               | 作用          | 推荐说明                           |
| -------------------------------- | ----------- | ------------------------------ |
| Python                           | 后端开发语言      | 统一业务 CRUD、AI Runtime、Workers   |
| FastAPI                          | Web API 框架  | REST API、异步接口、依赖注入             |
| Uvicorn                          | ASGI Server | FastAPI 运行服务器                  |
| Pydantic v2                      | 数据校验        | Request / Response Schema、配置校验 |
| SQLAlchemy 2.0                   | ORM         | 数据库模型、CRUD、事务管理                |
| Alembic                          | 数据库迁移       | Schema Version、Migration       |
| HTTPX                            | HTTP Client | 外部 API、第三方服务调用                 |
| Dependency Injector / FastAPI DI | 依赖注入        | 模块解耦、Provider 装配               |
| PyYAML                           | YAML 解析     | Plugin Manifest、系统配置           |
| Pytest                           | 单元与集成测试     | API、Service、Plugin 测试          |
| Ruff                             | 代码规范        | Lint、Format                    |
| Mypy                             | 静态类型检查      | Python 类型安全                    |

3. AI Runtime：LangChain + LangGraph / DeepSeek Harness / Pi Agent

用于构建统一的 Agent Runtime，支持单 Agent、多 Agent、工具调用、状态管理、会话管理及执行追踪。

| 技术                        | 作用                  | 推荐说明                                 |
| ------------------------- | ------------------- | ------------------------------------ |
| LangChain                 | Agent 基础框架          | Model、Prompt、Tools、Structured Output |
| LangGraph                 | Agent 工作流引擎         | State Graph、条件路由、循环执行、Checkpoint     |
| DeepSeek Harness          | Agent 执行框架          | 可作为独立 Runtime / Harness 方案进行集成评估     |
| Pi Agent                  | Agent Runtime       | 可作为另一种 Agent 实现或执行后端                 |
| LiteLLM                   | LLM Provider 统一接入   | OpenAI、DeepSeek、Anthropic、本地模型等      |
| Pydantic                  | Structured Output   | Agent 输出结构化数据                        |
| LangSmith / OpenTelemetry | Agent Observability | Trace、Token、耗时、Tool Call 追踪          |
| LangGraph Checkpointer    | 执行状态持久化             | Thread、Checkpoint、恢复执行               |

### Runtime 功能范围

| 功能                | 作用                                         |
| ----------------- | ------------------------------------------ |
| Chat              | 单 Agent 对话、流式输出、消息管理                       |
| Multi-Agent       | 多 Agent 协作、任务委派、结果汇总                       |
| Agent State       | Agent 运行状态管理                               |
| Runtime Context   | 当前执行上下文、用户、权限、环境                           |
| Memory            | 短期记忆、长期记忆                                  |
| Checkpointer      | 中断、恢复、状态持久化                                |
| Thread / Session  | 对话线程与会话管理                                  |
| Tools Runtime     | Tool 加载、调用、权限控制                            |
| Skills Runtime    | Skill 加载、解析、注入                             |
| Middleware        | Before Model、After Model、Wrap Model 等执行中间件 |
| Streaming         | Token、Tool Call、Agent Event 实时推送           |
| Human-in-the-loop | 人工审批、确认、中断与恢复                              |
| Execution Trace   | 模型调用、工具调用、节点执行记录                           |

4. Scheduler：任务调度

负责定时任务、周期任务、事件触发任务和后台任务执行。

| 技术          | 作用         | 推荐说明                       |
| ----------- | ---------- | -------------------------- |
| APScheduler | 定时任务调度     | Cron、Interval、Date Trigger |
| ARQ         | 异步任务队列     | 基于 Redis 的 Python Worker   |
| Redis       | 队列与锁       | 任务分发、分布式锁                  |
| Croniter    | Cron 表达式解析 | 自定义周期任务                    |
| Webhook     | 外部事件触发     | 接收外部系统任务触发请求               |

需要区分：

- Scheduler：决定任务何时执行。
- Queue：负责将任务分发给 Worker。
- Worker：真正执行任务。
- Workflow Engine：负责任务内部的流程编排。

5. Workflow：DAG Workflow Engine

负责用户可视化创建、配置、测试、发布和运行 DAG 工作流。

| 技术            | 作用                | 推荐说明                  |
| ------------- | ----------------- | --------------------- |
| @xyflow/react | Workflow Designer | 前端节点、连线、画布交互          |
| NetworkX      | DAG 图结构处理         | 拓扑排序、依赖分析、环路检测        |
| LangGraph     | Agent 节点执行        | 支持带状态的 Agent Workflow |
| Pydantic      | Node Schema       | 节点输入输出参数校验            |
| ARQ           | 异步执行              | Workflow Run 分发       |
| Redis         | 执行状态缓存            | 任务状态、锁、队列             |
| PostgreSQL    | 工作流持久化            | DAG 定义、版本、执行记录        |

### Workflow 核心能力

- DAG Designer：可视化流程编辑。
- Node Registry：节点类型注册。
- Node Executor：节点执行器。
- Edge Resolver：节点依赖解析。
- DAG Validator：环路、参数和依赖检查。
- Execution Engine：执行引擎。
- State Manager：运行状态管理。
- Retry / Timeout：重试、超时控制。
- Checkpoint：执行中断和恢复。
- Workflow Version：版本管理。
- Human Approval：人工审批节点。

6. Webhook：外部系统集成

负责平台与企业其他系统之间的双向通信。

| 技术         | 作用                 | 推荐说明          |
| ---------- | ------------------ | ------------- |
| FastAPI    | Webhook API        | 接收外部 HTTP 事件  |
| HTTPX      | HTTP Client        | 主动调用外部系统      |
| Pydantic   | Payload Validation | 请求数据校验        |
| Redis      | Event Queue        | 异步事件分发        |
| HMAC / JWT | 请求认证               | 签名验证、Token 验证 |
| Tenacity   | Retry              | 失败重试、退避策略     |

### Webhook 核心能力

- Webhook Endpoint 管理。
- Event Subscription。
- Event Publisher。
- Event Consumer。
- Signature Verification。
- Retry / Dead Letter Queue。
- Idempotency。
- Delivery Logs。

建议采用统一事件模型，使 Agent、Workflow、Scheduler 都可以发布或消费事件。

7. RAG + Knowledge：知识库与检索增强

负责企业知识库构建、文档处理、向量化、检索和上下文注入。

| 技术                                | 作用           | 推荐说明                            |
| --------------------------------- | ------------ | ------------------------------- |
| LangChain                         | RAG 框架       | Document Loader、Retriever、Chain |
| LangGraph                         | RAG Agent 流程 | Query Rewrite、检索、Rerank、生成      |
| PostgreSQL                        | 元数据存储        | Knowledge Base、Document、Chunk   |
| pgvector                          | 向量数据库扩展      | Embedding 存储、相似度检索              |
| MinIO                             | 文件存储         | 原始文档、解析文件                       |
| Docling                           | 文档解析         | PDF、Word、复杂布局文档                 |
| PyMuPDF                           | PDF 解析       | PDF 文本和页面提取                     |
| python-docx                       | Word 解析      | DOCX 文档处理                       |
| openpyxl                          | Excel 解析     | XLSX 数据提取                       |
| Unstructured                      | 多格式解析        | 复杂文档的备用解析方案                     |
| FastEmbed / Sentence Transformers | Embedding    | 文本向量化                           |
| Reranker Model                    | 重排序          | 提高检索相关性                         |
| BGE / Qwen Embedding              | Embedding 模型 | 可选择本地或远程模型                      |

### Knowledge 核心能力

- Knowledge Base Management。
- Data Source Connector。
- Document Ingestion。
- Document Parsing。
- Text Chunking。
- Embedding Generation。
- Vector Search。
- Hybrid Search（Keyword + Vector）。
- Reranking。
- Metadata Filtering。
- Retrieval Evaluation。
- Knowledge Graph（实体、关系、图谱检索）。

建议： 第一阶段 PostgreSQL + pgvector 即可。不要一开始同时部署 Qdrant、Milvus、Elasticsearch。后续如果向量数据规模、检索性能或多模态检索需求显著增加，再将向量存储抽象为可替换 Provider。

8. Artifact Factory / Vibe Coding

负责通过自然语言生成项目、修改文件、执行测试、构建和自动部署。

| 技术                          | 作用                         | 推荐说明                   |
| --------------------------- | -------------------------- | ---------------------- |
| LangGraph                   | Coding Agent Orchestration | 任务拆解、代码生成、迭代修复         |
| LangChain                   | LLM / Tools                | 模型调用、工具集成              |
| DeepSeek Harness / Pi Agent | Coding Agent Runtime       | 可作为可替换的执行后端            |
| Workspace                   | 项目工作空间                     | 每个任务独立文件目录             |
| GitPython                   | Git 操作                     | Commit、Branch、Diff、Tag |
| Git                         | 版本控制                       | 代码版本、历史记录、回滚           |
| Docker                      | 隔离执行                       | 项目构建、依赖安装、测试           |
| Docker SDK for Python       | 容器管理                       | 容器创建、执行、销毁             |
| HTTPX                       | 外部服务通信                     | Git 服务、部署平台 API        |
| Monaco Editor               | 代码编辑                       | 在线代码查看与修改              |
| xterm.js                    | Terminal UI                | 前端终端输出                 |
| Playwright                  | 自动化测试                      | Web 项目构建后的浏览器测试        |
| MinIO                       | 项目归档                       | 代码包、构建产物、文件归档          |

### Artifact Factory 核心流程

```
User Requirement
       |
       v
Task Decomposition
       |
       v
Project Planning
       |
       v
Workspace Initialization
       |
       v
Code Generation
       |
       v
Dependency Installation
       |
       v
Build / Test / Debug
       |
       v
Git Version Control
       |
       v
Preview / Deployment
       |
       v
Artifact Management
```

建议 Workspace、Coding Agent、Sandbox 分离：

- Workspace：文件管理。
- Coding Agent：负责决策和任务编排。
- Sandbox：负责执行代码。
- Git：负责版本管理。
- Deployment：负责部署和发布。

9. Database & Infrastructure

这一部分建议单独列出来，因为它不仅是数据库选型，还涉及缓存、消息队列、文件存储、隔离执行和系统可观测性。

| 技术             | 作用      | 推荐说明               |
| -------------- | ------- | ------------------ |
| PostgreSQL     | 关系型数据库  | 核心业务数据             |
| pgvector       | 向量检索    | RAG Embedding      |
| Redis          | 缓存与消息队列 | Cache、Queue、Lock   |
| MinIO          | 对象存储    | 文件、文档、Artifact     |
| Alembic        | 数据库迁移   | Schema Version     |
| SQLAlchemy 2.0 | ORM     | 数据访问层              |
| ARQ            | 后台任务    | 异步 Worker          |
| Redis Streams  | 事件总线    | 模块间事件传递起步方案        |
| Docker         | 容器化     | 服务部署和隔离执行          |
| Docker Compose | 部署编排    | 开发及初期生产部署          |
| Git            | 版本管理    | Artifact、Plugin 版本 |
| OpenTelemetry  | 可观测性    | Trace、Metrics、Logs |
| Prometheus     | 监控指标    | 服务与运行指标            |
| Grafana        | 可视化监控   | Dashboard          |
| Loki           | 日志聚合    | 集中化日志              |
| Pytest         | 后端测试    | 单元、集成测试            |

10. Plugin Architecture：可插拔模块架构

这是你提出的一个重要要求，建议独立作为技术选型类别，而不是仅仅把它放在 Backend 里。

| 技术 / 机制               | 作用    | 推荐说明                     |
| --------------------- | ----- | ------------------------ |
| Python ABC / Protocol | 接口定义  | 统一模块能力契约                 |
| Plugin Registry       | 插件注册  | 统一管理插件                   |
| Plugin Manifest       | 插件元数据 | YAML 配置、依赖、版本            |
| Dependency Injection  | 依赖注入  | 模块解耦                     |
| Importlib             | 动态加载  | Python 模块加载              |
| Pluggy                | 插件机制  | 可评估用于插件 Hook 管理          |
| Entry Points          | 插件发现  | 支持第三方 Python Package     |
| Pydantic              | 配置校验  | Plugin Config / Manifest |
| Semantic Versioning   | 版本管理  | 插件兼容性控制                  |
| Event Bus             | 事件通信  | 模块间异步协作                  |

### 插件化需要支持

- Module Enable / Disable。
- Plugin Register / Unregister。
- Plugin Replace。
- Plugin Version Management。
- Dependency Resolution。
- Lifecycle Management。
- Health Check。
- Capability Registry。
- Custom Plugin SDK。

例如：

```
Agent Runtime
    |
    +-- SkillProvider
    |       +-- DefaultSkillHub
    |       +-- EnterpriseSkillHub
    |
    +-- ToolProvider
    |       +-- DefaultToolHub
    |       +-- MCPToolProvider
    |
    +-- WorkflowEngine
            +-- DefaultWorkflowEngine
            +-- LangGraphWorkflowEngine
```

建议第一阶段使用 Python `Protocol / ABC + Plugin Registry + Dependency Injection`，不必为了插件化引入过多第三方框架。Pluggy 更适合 Hook 扩展机制，可以在需要时引入。

11. 最终技术栈汇总

## Recommended Technology Stack

Frontend

React · Vite · TypeScript · Ant Design · Tailwind CSS · Zustand · TanStack Query · React Flow · Monaco Editor · ECharts

Backend

Python · FastAPI · Uvicorn · Pydantic v2 · SQLAlchemy 2.0 · Alembic

AI Runtime

LangChain · LangGraph · LiteLLM · DeepSeek Harness / Pi Agent (可替换 Runtime)

Scheduler & Workflow

APScheduler · ARQ · Redis · NetworkX · React Flow · DAG Engine

RAG & Knowledge

LangChain · Docling · Embedding Models · Reranker · PostgreSQL · pgvector

Artifact Factory

LangGraph · Workspace · Git · Docker · Playwright · Monaco Editor

Database & Infrastructure

PostgreSQL · pgvector · Redis · MinIO · Docker Compose · OpenTelemetry · Prometheus · Grafana

Plugin Architecture

Python Protocol / ABC · Registry · Manifest · Dependency Injection · Importlib · Entry Points