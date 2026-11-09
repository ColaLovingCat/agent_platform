---
AIGC:
    Label: "1"
    ContentProducer: 001191110102MACQD9K64018705
    ProduceID: 1950992911316771_0-drive/240363584638347207/agent-platform/docs/architecture.md
    ReservedCode1: ""
    ContentPropagator: 001191110102MACQD9K64028705
    PropagateID: 1950992911316771#1793690660422
    ReservedCode2: ""
---
# Agent 平台架构设计

> 版本：v0.1（基于 8 轮方案讨论整理）
> 目标：模块化解耦、每个能力块独立可用、一块一块实现与插拔

## 0. 定位与边界

- 产品类型：自定义 Agent 平台（架构上解耦，一块一块实现）
- 首要用户：业务人员（其次是开发者、管理员）
- 差异化锚点：边界控制 L1-L4（L1 只读建议 / L2 低风险自主 / L3 高风险人工确认 / L4 审批流）

## 1. 功能模块清单（初期想法 → 落地服务）

| 初期想法 | 落地服务 | 职责 |
|---|---|---|
| LLM API（内外部模型） | model-gateway | 模型路由、Fallback、成本计量 |
| Agent+Skill+Tools Hub | hub | 定义管理（唯一事实来源） |
| Files 管理 | files | 文件上传/读取/生成/版本 |
| RAG+Knowledge 独立服务 | knowledge | 知识摄取、RAG 检索管道 |
| Workflow | workflow | 流程定义与编排执行 |
| ScheduleTask+Calendar | scheduler | 定时/周期/事件触发 |
| Chat+Multi Agent | api + runtime | 会话入口、单 Agent 执行循环、多 Agent 编排 |
| Artifactory | artifacts | 轻应用/制品全生命周期 |
| Code Sandbox | sandbox | 隔离代码执行环境 |

补充横向服务：auth（身份/租户/权限）、memory（记忆分层）、events（事件总线）。

## 2. 架构形态：模块化单体（可拆分部署）

**结论：以模块化单体起步，服务边界按独立部署单元设计，后期按需拆分。**
理由：初期单人/小团队，微服务分布式复杂度（服务发现、链路追踪、部署编排）会拖垮进度；但每个服务保持"可独立部署"能力，瓶颈出现时逐个拆出。

特殊处理：
- **sandbox 必须独立进程**（隔离安全边界，任何情况不与其他服务同进程）
- **model-gateway 建议独立**（持有外部模型密钥，独立扩容与审计）
- 其余服务默认同进程部署，但代码按服务边界隔离、可独立启动

## 3. 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 语言 | TypeScript 全栈 | 一人维护统一心智，前端顺手，LLM SDK 生态够用 |
| 服务框架 | Fastify | 轻量、插件化、性能好（不用 NestJS，避免过度框架） |
| 前端 | React + Vite（控制台） | 管理台/工作台 |
| 主库 | PostgreSQL + pgvector | 元数据 + 向量检索一体，初期不引入独立向量库 |
| 缓存/队列 | Redis（Streams） | 会话缓存、任务队列、事件总线 |
| 对象存储 | S3 兼容（本地 MinIO） | Files/Artifact 底层存储 |
| 沙箱 | 容器隔离（Docker/Podman） | 代码执行隔离 |
| 部署 | Docker Compose → K8s（后期） | 本地一键起全链路 |
| 观测 | OpenTelemetry + 结构化日志 | 全链路可观测 |

## 4. Monorepo 目录结构

```
agent-platform/
├── apps/                        # 可部署应用（对外入口）
│   ├── api/                     # API 网关 + Chat 入口（REST/SSE/WS）
│   ├── console/                 # 管理台前端（React + Vite）
│   └── scheduler/               # ScheduleTask + Calendar 调度服务
├── services/                    # 业务服务（每个可独立部署）
│   ├── auth/                    # 身份、租户、权限、Credential
│   ├── hub/                     # Agent / Skill / Tool 定义管理（唯一事实来源）
│   ├── runtime/                 # 单 Agent 执行循环 + 多 Agent 编排入口
│   ├── model-gateway/           # LLM 路由 / Fallback / 成本
│   ├── knowledge/               # 知识摄取 + RAG 管道
│   ├── memory/                  # 记忆分层（session/agent/user）
│   ├── files/                   # 文件服务
│   ├── artifacts/               # Artifactory（轻应用/制品）
│   ├── workflow/                # 流程定义与执行引擎
│   └── sandbox/                 # 隔离代码执行环境
├── packages/                    # 共享库（非部署单元）
│   ├── contracts/               # 领域类型 + OpenAPI / JSON Schema
│   ├── events/                  # 事件定义 + 总线客户端
│   ├── llm-adapters/            # OpenAI / Coze / 内部模型适配器
│   ├── sdk/                     # 服务间调用 SDK（类型安全）
│   └── db/                      # 迁移工具 + 通用仓储
├── infra/
│   ├── docker-compose.yml       # 本地一键启动全部
│   ├── .env.example
│   └── migrations/
├── docs/                        # 架构文档
└── .coze                        # Coze 部署配置（可选）
```

## 5. "独立可用"的标准（每个服务的验收线）

一个服务满足以下全部条件才算"独立可用"：

1. **独立启动**：有 `src/index.ts` 入口 + 自己的配置（env 前缀隔离，如 `HUB_`、`FILES_`）
2. **独立测试**：自己的 test suite，外部依赖用 mock/契约测试
3. **独立数据边界**：只读写自己的 schema/表，**不直接读其他服务数据库**
4. **独立 API 契约**：OpenAPI 文档，契约共享在 `packages/contracts`
5. **可独立部署**：有自己的 Dockerfile + 健康检查
6. **可独立演进**：修改不破坏其他服务（通过契约版本控制）

### 单个服务标准内部结构

```
services/hub/
├── src/
│   ├── index.ts          # 启动入口
│   ├── config.ts         # 环境配置（HUB_ 前缀）
│   ├── domain/           # 领域模型 + 业务服务
│   │   ├── agent/
│   │   ├── skill/
│   │   └── tool/
│   ├── api/              # HTTP 路由 + handlers
│   ├── events/           # 事件发布/订阅
│   └── db/               # 仓储 + 迁移
├── test/
├── Dockerfile
├── package.json
└── .env.example
```

## 6. 关键架构决策（前面讨论的结论在此固化）

1. **Hub 是唯一事实来源**：Agent/Skill/Tool 定义只存 Hub；运行时执行时拉取**不可变版本快照**（不依赖 Active 动态变化）
2. **单一写入方 + 事件驱动**：每个聚合根只有一个写入服务；状态变化发事件，审计/前端时间线是事件投影，不各写一份
3. **所有 LLM 调用过 model-gateway**：统一路由、Fallback、成本、审计；Agent/Workflow 不直接调模型
4. **RAG 引用溯源强制**：回答关键结论必须能指回知识源原文片段
5. **Runtime vs Workflow 分层**：Runtime = 单 Agent 执行循环（最小单元）；Workflow = 在其之上的多 Agent/流程编排；Agent 间消息走事件总线
6. **边界控制 L1-L4 挂在能力网关**：权限校验、配额、人工确认在能力调用入口统一处理
7. **Sandbox 永远独立进程**：隔离安全边界不可妥协

## 7. 分阶段路径（P0 优先）

**P0（最小闭环）**：auth（最小租户/用户）+ hub（Agent/Skill/Tool 定义）+ model-gateway + runtime（单 Agent 执行循环）+ api（Chat SSE 入口）+ files（最小上传/读取）
→ 验收：业务人员能在对话里让 Agent 用 1 个 Tool 完成 1 个任务，全程可审计

**P1**：knowledge（RAG）+ memory + artifacts（轻应用最小）+ workflow（线性流程）

**P2**：sandbox + scheduler（定时触发）+ multi-agent 编排 + console 完整管理台

**P3**：企业能力（RBAC 细化、审批流 L4、审计报表、多租户隔离）

## 8. 本地起步命令（目标）

```bash
docker compose up -d          # 拉起 PG / Redis / MinIO / sandbox
pnpm install                  # 安装依赖
pnpm dev                      # 全部服务本地开发模式（或按服务单独启动）
pnpm test                     # 各服务独立测试
```

---

*配套文档：领域模型、生命周期状态机、能力体系详见后续章节。*

---

> 本内容由 Coze AI 生成，请遵循相关法律法规及《人工智能生成合成内容标识办法》使用与传播。
