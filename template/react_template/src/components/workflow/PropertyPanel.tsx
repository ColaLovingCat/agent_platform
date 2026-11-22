"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  CodeNodeData,
  FileOutputNodeData,
  Flow,
  FlowVariable,
  FlowVariableType,
  HttpRequestNodeData,
  IfElseNodeData,
  IONodeData,
  KnowledgeNodeData,
  LLMNodeData,
  ManualTriggerNodeData,
  MCPNodeData,
  MergeNodeData,
  PromptNodeData,
  ResponseNodeData,
  ScheduleTriggerNodeData,
  SqlNodeData,
  SwitchCase,
  SwitchNodeData,
  TransformNodeData,
  TransformOp,
  SkillNodeData,
  ToolNodeData,
  FileInputNodeData,
  UploadNodeData,
  VariableNodeData,
  WebhookTriggerNodeData,
} from "./lib/types";
import {
  DEFAULT_USER_MESSAGE_TEMPLATES,
  FLOW_TYPES,
  TRIGGER_TYPES,
  WEBHOOK_AUTH_OPTIONS,
  findTriggerNode,
  isValidVariableName,
} from "./lib/types";
import { useConnections } from "./lib/connectionsStore";
import type { WebhookAuthKind, WebhookSecret } from "./lib/types";
import { nanoid } from "nanoid";
import type {
  KnowledgeBase,
  MCPServer,
  ModelOption,
  Skill,
  Tool,
} from "./lib/flowEngine";
import { RuntimePanel } from "./RuntimeView";
import {
  applyOps,
  describeOp,
  inferColumnType,
  opsForType,
  type ApplyResult,
  type ColumnType,
  type Row,
} from "./lib/transform";
import { sampleUpstream, type SampleResult } from "./lib/transformPreview";
import {
  EXCEL_ACCEPT_ATTR,
  EXCEL_ACCEPT_EXTENSIONS,
  isExcelLikeFilename,
  parseExcelFile,
  type ExcelParseResult,
} from "./lib/excelParse";
import { uploadFile, fetchUploadedFile } from "./lib/uploadClient";
import { useFlowRuntime } from "./lib/flowRuntimeStore";
import { WEBHOOK_PUBLIC_URL } from "./lib/publicConfig";

/* ===================================================================
 * RuntimePanel 在哪些节点类型上展示？
 *
 * 只在那些会写 runtime 的节点上展示——不然会出现一堆永远显示"尚未运行"的占位，
 * 反而成为视觉噪音。两条写入路径：
 *
 *   1. flowRunner.ts（Chat / ReAct flow）：
 *        input  : 触发时 running，turn 结束 ok
 *        llm    : running + text + toolCalls + iterations → ok / error
 *        tool   : running + args → ok + result / error
 *        output : sink，turn 结束写入最终文本
 *        fileOutput : sink，跟 output 同步
 *
 *   2. dagSimulators.ts（DAG flow，前端模拟器）：
 *        webhookTrigger : 透传 testRequests body，写 outputData
 *        ifElse         : 评估 condition，写 branch + outputData
 *        upload         : 解析 Excel → {sheet: rows[]}，写 outputData
 *        code           : new Function 跑 JS，返回值即 outputData
 *        response       : 渲染 bodyTemplate，写 outputData={statusCode,headers,body}
 *
 * Prompt / Skill / Knowledge / MCP 节点是"配置型"——它们的内容在 build payload
 * 阶段就被读取注入，运行时根本没有"个人 turn 状态"，所以不显示 RuntimePanel。
 *
 * Trigger 类 manual / schedule 当前的 DAG simulator 是占位 pass-through，
 * 也不挂 RuntimePanel——等真接通调度器再加。
 * =================================================================== */
const NODE_TYPES_WITH_RUNTIME = new Set([
  // chat / ReAct
  "input",
  "llm",
  "tool",
  "output",
  "fileOutput",
  // DAG
  "webhookTrigger",
  "ifElse",
  "switch",
  "merge",
  "upload",
  "code",
  "response",
  "sql",
  "httpRequest",
]);

type Props = {
  flow: Flow;
  selected: Node | null;
  models: ModelOption[];
  /** 函数式工具（含 local + MCP 暴露的） */
  tools: Tool[];
  /** Skill (md playbook) 列表 */
  skills: Skill[];
  /** 知识库列表（KB 节点选择用） */
  knowledgeBases: KnowledgeBase[];
  mcpServers: MCPServer[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  onUpdateFlowMeta: (
    patch: Partial<
      Pick<
        Flow,
        | "name"
        | "description"
        | "triggerType"
        | "visibility"
        | "isEnabled"
        | "sharedUsers"
        | "webhookAuth"
        | "webhookSecrets"
      >
    >
  ) => void;
  onUpdateVariables: (next: FlowVariable[]) => void;
  /** 让节点编辑器内的"已连接节点"列表可点击跳转。可选；不传则禁用跳转。 */
  onSelectNode?: (nodeId: string) => void;
};

/* ===================================================================
 * PropertyPanel · 画布右侧悬浮抽屉（drawer）
 *
 * 形态：absolute 定位、浮在 ReactFlow 之上、宽度由父组件（FlowEditor）持有
 *      并存进 localStorage。左边缘有一根半透明 hit-zone + 中央一个 grip 图标
 *      支持拖拽实时改宽。
 *
 * 为什么把宽度托管给父组件：
 *   - 抽屉宽度会影响画布顶部 header bar 的 right offset、MiniMap 的 right offset，
 *     这些都跟 FlowEditor 同一层渲染，统一在父层管最省心
 *   - PropertyPanel 本身只关心"拖拽事件 → 调父 state"，不持久化、不读窗口尺寸
 *
 * 宽度上下限：见 FlowEditor 里的 DRAWER_MIN_W / DRAWER_MAX_W 常量。
 * =================================================================== */
export function PropertyPanel({
  flow,
  selected,
  models,
  tools,
  skills,
  knowledgeBases,
  mcpServers,
  onUpdateNodeData,
  onUpdateFlowMeta,
  onUpdateVariables,
  onSelectNode,
  width,
  onResizeStart,
}: Props & {
  /** 当前宽度（px）—— 父组件持有并持久化。 */
  width: number;
  /** 左边缘把手 mousedown 时回调。父组件接管 mousemove/mouseup 完成拖拽逻辑。 */
  onResizeStart: (e: React.MouseEvent) => void;
}) {
  return (
    <aside
      className="absolute top-0 right-0 bottom-0 bg-white border-l border-slate-200 shadow-xl flex flex-col z-20"
      style={{ width }}
    >
      {/* 左边缘整条 hit zone：4px 宽透明区，hover 时显示一道浅色高亮 + col-resize 鼠标 */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/40 transition-colors z-10"
        onMouseDown={onResizeStart}
        aria-hidden
      />
      {/* 居中的拖拽图标：更显眼的视觉提示，悬浮 / 拖拽都行 */}
      <button
        type="button"
        onMouseDown={onResizeStart}
        className="absolute top-1/2 -translate-y-1/2 -left-3 w-3 h-12 bg-white border border-slate-300 rounded shadow-sm
                   flex items-center justify-center cursor-col-resize hover:border-brand-400 hover:bg-brand-50 z-20"
        aria-label="拖动调整宽度"
        title="拖动调整宽度"
      >
        <svg width="3" height="20" viewBox="0 0 3 20" className="text-slate-400" aria-hidden>
          <circle cx="1.5" cy="3" r="1" fill="currentColor" />
          <circle cx="1.5" cy="10" r="1" fill="currentColor" />
          <circle cx="1.5" cy="17" r="1" fill="currentColor" />
        </svg>
      </button>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <NodeEditor
            node={selected}
            models={models}
            tools={tools}
            skills={skills}
            knowledgeBases={knowledgeBases}
            mcpServers={mcpServers}
            flow={flow}
            onUpdateNodeData={onUpdateNodeData}
            onUpdateVariables={onUpdateVariables}
            onSelectNode={onSelectNode}
          />
        ) : (
          <FlowOverview
            flow={flow}
            onUpdateFlowMeta={onUpdateFlowMeta}
          />
        )}
      </div>
    </aside>
  );
}

/* ===================================================================
 * 未选中节点：编辑 flow 的元信息 + 全局变量
 *
 * 元信息：name / description / triggerType
 * 主体：variables（增删改）
 * 节点 / 连线统计
 *
 * 不展示 LLM / tools / skills 配置——这些跟着对应节点走。
 * =================================================================== */
function FlowOverview({
  flow,
  onUpdateFlowMeta,
}: {
  flow: Flow;
  onUpdateFlowMeta: (
    patch: Partial<
      Pick<
        Flow,
        | "name"
        | "description"
        | "triggerType"
        | "visibility"
        | "isEnabled"
        | "sharedUsers"
        | "webhookAuth"
        | "webhookSecrets"
      >
    >
  ) => void;
}) {
  // ReAct 关心"按节点类型分类的数量"——LLM / Tool / Skill 等是它的"工具腰带"，
  // 用户经常需要快速核对"我接了几个 tool"；DAG 强调的是编排拓扑（节点/边总数），
  // 节点类型细分意义不大，反而把信息密度稀释。两种 flow 给两套面板。
  const isReact = flow.flowType === "react";
  const counts = {
    nodes: flow.nodes.length,
    edges: flow.edges.length,
    llm: flow.nodes.filter((n) => n.type === "llm").length,
    tool: flow.nodes.filter((n) => n.type === "tool").length,
    skill: flow.nodes.filter((n) => n.type === "skill").length,
    knowledge: flow.nodes.filter((n) => n.type === "knowledge").length,
    mcp: flow.nodes.filter((n) => n.type === "mcp").length,
    prompt: flow.nodes.filter((n) => n.type === "prompt").length,
    fileOutput: flow.nodes.filter((n) => n.type === "fileOutput").length,
  };
  return (
    <div className="p-3 space-y-3">
      <div className="text-xs text-slate-500">Flow</div>

      <Field label="Name">
        <input
          className="w-full text-sm font-semibold border rounded px-2 py-1"
          value={flow.name}
          onChange={(e) => onUpdateFlowMeta({ name: e.target.value })}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="w-full text-xs border rounded px-2 py-1"
          rows={2}
          placeholder="一句话说明这个 flow 干什么"
          value={flow.description || ""}
          onChange={(e) => onUpdateFlowMeta({ description: e.target.value })}
        />
      </Field>

      <FlowTypeField flow={flow} />
      <TriggerTypeField flow={flow} />
      <VisibilityField flow={flow} onUpdateFlowMeta={onUpdateFlowMeta} />
      <EnabledField flow={flow} onUpdateFlowMeta={onUpdateFlowMeta} />

      {/* (trigger × visibility) 派生字段。组件内部判定显隐——把决策逻辑收敛到一处。 */}
      <SharedUsersField flow={flow} onUpdateFlowMeta={onUpdateFlowMeta} />
      <WebhookConfigField flow={flow} onUpdateFlowMeta={onUpdateFlowMeta} />

      {/* Agent / Team 维度：flow 本身不再决定"作为下属的角色"或"能调谁"。
       *  那些都搬到了 /teams 管理界面：在那里建团队 → 任命角色 → 分配 flow → 指定 leader。
       *  这里只保留 flow 自身的画布配置。 */}

      <VariablesSummary
        variables={flow.variables}
        hasNode={flow.nodes.some((n) => n.type === "variable")}
      />

      <FlowStats flow={flow} counts={counts} isReact={isReact} />

      <FlowAuditInfo flow={flow} />

      <div className="text-[11px] text-slate-400 leading-relaxed">
        提示：模型选择 / system prompt / 启用的 tools 与 skills 都跟随
        <span className="text-slate-600 font-medium"> LLM 节点</span>
        ，选中 LLM 节点后在此处编辑。
      </div>
    </div>
  );
}

/* ===================================================================
 * VisibilityField · 编辑 flow.visibility
 *
 * private  : 仅作者可见（默认，第一阶段后端只用这个）
 * shared   : 团队 / 项目内可见
 * public   : 全租户可见
 * =================================================================== */
const VISIBILITY_OPTIONS: ReadonlyArray<{
  value: Flow["visibility"];
  label: string;
  desc: string;
}> = [
  { value: "private", label: "Private", desc: "仅作者可见" },
  { value: "shared", label: "Shared", desc: "团队 / 项目内可见" },
  { value: "public", label: "Public", desc: "全租户可见" },
];

function VisibilityField({
  flow,
  onUpdateFlowMeta,
}: {
  flow: Flow;
  onUpdateFlowMeta: (patch: Partial<Pick<Flow, "visibility">>) => void;
}) {
  const meta = VISIBILITY_OPTIONS.find((o) => o.value === flow.visibility);
  return (
    <Field
      label="Visibility · 可见性"
      hint="决定谁能在 flow 列表里看到这个 flow。private = 仅作者；shared = 团队；public = 全租户。"
    >
      <select
        className="w-full text-sm border rounded px-2 py-1.5 bg-white"
        value={flow.visibility}
        onChange={(e) =>
          onUpdateFlowMeta({ visibility: e.target.value as Flow["visibility"] })
        }
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {meta?.desc && (
        <div className="text-[11px] text-slate-500 mt-1">{meta.desc}</div>
      )}
    </Field>
  );
}

/* ===================================================================
 * EnabledField · 启用 / 暂停
 *
 * 关掉 = 暂停：保留配置，但调度器 / 触发器不会再召唤它。
 * 用 toggle 而不是 checkbox——这是"严重影响业务"的开关，视觉上要够显眼。
 * =================================================================== */
function EnabledField({
  flow,
  onUpdateFlowMeta,
}: {
  flow: Flow;
  onUpdateFlowMeta: (patch: Partial<Pick<Flow, "isEnabled">>) => void;
}) {
  return (
    <Field
      label="Enabled · 启用状态"
      hint="关掉 = 暂停（保留全部配置，但调度器 / webhook / chat 入口都不会再触发这个 flow）。"
    >
      <button
        type="button"
        role="switch"
        aria-checked={flow.isEnabled}
        onClick={() => onUpdateFlowMeta({ isEnabled: !flow.isEnabled })}
        className={
          "w-full text-sm rounded px-2 py-1.5 flex items-center gap-2 border transition-colors " +
          (flow.isEnabled
            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100")
        }
      >
        <span
          className={
            "inline-flex items-center justify-center w-8 h-4 rounded-full transition-colors " +
            (flow.isEnabled ? "bg-emerald-500" : "bg-slate-300")
          }
        >
          <span
            className={
              "block w-3 h-3 rounded-full bg-white transition-transform " +
              (flow.isEnabled ? "translate-x-2" : "-translate-x-2")
            }
          />
        </span>
        <span className="font-medium">
          {flow.isEnabled ? "已启用" : "已暂停"}
        </span>
        <span className="ml-auto text-[11px] text-slate-500">
          {flow.isEnabled ? "点击暂停" : "点击启用"}
        </span>
      </button>
    </Field>
  );
}

/* ===================================================================
 * SharedUsersField · 仅在 visibility=shared 时显示
 *
 * 在 v1 阶段：用户 ID 用自由文本输入（email / user_id 都行）。等接通 master_data
 * 的 UserInfo 表后会换成 combobox 异步搜索，组件 API 保持兼容（依然是 string[]）。
 *
 * 行为细节：
 *   - 输入框按回车或点击 + 加一条；空串 / 已存在不重复加
 *   - chip 上的 × 删一条
 *   - 当 visibility 切走时不清空数据——用户改回 shared 还能看到旧名单
 * =================================================================== */
function SharedUsersField({
  flow,
  onUpdateFlowMeta,
}: {
  flow: Flow;
  onUpdateFlowMeta: (
    patch: Partial<Pick<Flow, "sharedUsers">>
  ) => void;
}) {
  const [draft, setDraft] = useState("");
  if (flow.visibility !== "shared") return null;
  const list = flow.sharedUsers ?? [];

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (list.includes(v)) {
      setDraft("");
      return;
    }
    onUpdateFlowMeta({ sharedUsers: [...list, v] });
    setDraft("");
  }

  function removeAt(idx: number) {
    onUpdateFlowMeta({ sharedUsers: list.filter((_, i) => i !== idx) });
  }

  return (
    <Field
      label={`Shared with · 授权用户 (${list.length})`}
      hint="visibility=shared 时生效：只有名单内的用户能在 /chat、/flows 看到这个 flow。v1 用自由文本（email / user_id 都行），接 UserInfo 表后换异步搜索。"
    >
      <div className="flex items-center gap-1">
        <input
          className="flex-1 min-w-0 text-sm border rounded px-2 py-1"
          value={draft}
          placeholder="email 或 user_id"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="text-[11px] rounded border border-slate-200 hover:border-brand-400 hover:bg-brand-50 px-2 py-1"
          onClick={add}
          disabled={!draft.trim()}
        >
          + 添加
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic mt-1">
          名单为空 · 没人能用这个 shared flow（除作者外）
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1">
          {list.map((u, i) => (
            <span
              key={`${u}-${i}`}
              className="inline-flex items-center gap-1 rounded border bg-white px-1.5 py-0.5 text-[11px] text-slate-700"
            >
              <span className="truncate max-w-[160px]" title={u}>
                {u}
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-rose-600 leading-none"
                onClick={() => removeAt(i)}
                aria-label={`移除 ${u}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </Field>
  );
}

/* ===================================================================
 * WebhookConfigField · 仅在 triggerType=webhook 时显示
 *
 * 三块：endpoint URL（只读 + 复制）/ 鉴权方式选择 / 密钥列表
 *
 * (trigger=webhook × visibility) 短路规则：
 *   - visibility=public  → webhookAuth 锁死 "none"，selector 灰掉，给用户解释
 *   - visibility=private → 默认 bearer；可改成 hmac / signed_url
 *   - visibility=shared  → 默认 bearer；将来 v2 backend 接通后每个 share_user 一把
 *
 * 密钥列表（v1 明文存）：每条 { id, label, value, createdAt }；红条警告 v1 性质。
 * =================================================================== */
function WebhookConfigField({
  flow,
  onUpdateFlowMeta,
}: {
  flow: Flow;
  onUpdateFlowMeta: (
    patch: Partial<Pick<Flow, "webhookAuth" | "webhookSecrets">>
  ) => void;
}) {
  if (flow.triggerType !== "webhook") return null;
  const isPublic = flow.visibility === "public";
  const effectiveAuth: WebhookAuthKind = isPublic
    ? "none"
    : flow.webhookAuth ?? "bearer";
  const secrets = flow.webhookSecrets ?? [];

  function setAuth(next: WebhookAuthKind) {
    onUpdateFlowMeta({ webhookAuth: next });
  }

  function addSecret() {
    const label = window.prompt("Secret 标签（自己看的名字，比如 'prod-zapier'）", "");
    if (label === null) return; // 用户取消
    const trimmed = label.trim() || `secret-${secrets.length + 1}`;
    const next: WebhookSecret = {
      id: nanoid(8),
      label: trimmed,
      value: randomSecret(),
      createdAt: new Date().toISOString(),
    };
    onUpdateFlowMeta({ webhookSecrets: [...secrets, next] });
  }

  function updateSecret(id: string, patch: Partial<WebhookSecret>) {
    onUpdateFlowMeta({
      webhookSecrets: secrets.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });
  }

  function removeSecret(id: string) {
    onUpdateFlowMeta({ webhookSecrets: secrets.filter((s) => s.id !== id) });
  }

  // endpoint URL：外部调用方直接打 flow_engine 的 /webhooks/{flow_id}（不经过 BFF）。
  //   - dev 默认 `http://localhost:9730`（flow_engine 本机端口）
  //   - prod 通过 NEXT_PUBLIC_WEBHOOK_PUBLIC_URL 改成反代后的公网域名
  // 不用 window.location.origin（那是 9750 / BFF 端口，BFF 上没挂 /webhooks 路由）。
  const fullEndpoint = `${WEBHOOK_PUBLIC_URL}/webhooks/${flow.id}`;

  return (
    <div className="rounded border border-slate-200 bg-slate-50/40 p-2 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
        <span>Webhook</span>
        <InfoTip text="triggerType=webhook 才出现。endpoint URL + 鉴权方式 + 密钥列表。" />
      </div>

      <Field label="Endpoint">
        <div className="flex items-center gap-1">
          <input
            readOnly
            className="flex-1 min-w-0 text-xs font-mono border border-slate-200 rounded px-2 py-1 bg-white text-slate-700"
            value={fullEndpoint}
            onFocus={(e) => e.target.select()}
          />
          <CopyButton text={fullEndpoint} title="复制完整 URL" />
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          外部直接调用 flow_engine /webhooks/{`{flow_id}`} 入口（不经 BFF）。
          生产部署 nginx 反代后由 <code>NEXT_PUBLIC_WEBHOOK_PUBLIC_URL</code> 覆盖。
        </div>
      </Field>

      <Field
        label="Auth · 鉴权方式"
        hint={
          isPublic
            ? "visibility=public 时强制 None。改鉴权请先把 visibility 切回 private / shared。"
            : "private / shared 下推荐 bearer 或 hmac；signed_url 简单但泄露 URL = 泄露凭据。"
        }
      >
        <select
          className="w-full text-sm border rounded px-2 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-500"
          value={effectiveAuth}
          disabled={isPublic}
          onChange={(e) => setAuth(e.target.value as WebhookAuthKind)}
        >
          {WEBHOOK_AUTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {WEBHOOK_AUTH_OPTIONS.find((o) => o.value === effectiveAuth)?.hint}
        </div>
      </Field>

      {effectiveAuth !== "none" && (
        <div className="space-y-1.5">
          <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 leading-snug">
            <b>v1 警告</b>：密钥明文存进 Flow JSON。v2 后端上线后会改成"创建时返回一次明文 + 服务端只存 hash"。
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Secrets ({secrets.length})
            </span>
            <button
              type="button"
              className="text-[11px] rounded border border-slate-200 hover:border-brand-400 hover:bg-brand-50 px-2 py-0.5"
              onClick={addSecret}
            >
              + 新建 secret
            </button>
          </div>
          {secrets.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic">
              还没有 secret · 点上方新建
            </div>
          ) : (
            <div className="space-y-1">
              {secrets.map((s) => (
                <SecretRow
                  key={s.id}
                  secret={s}
                  onChange={(patch) => updateSecret(s.id, patch)}
                  onRemove={() => removeSecret(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** SecretRow · webhook secret 单行编辑器
 *  label 可改、value 可显隐 + 复制、× 删除。createdAt 紧贴 label 右边以小灰字呈现。
 */
function SecretRow({
  secret,
  onChange,
  onRemove,
}: {
  secret: WebhookSecret;
  onChange: (patch: Partial<WebhookSecret>) => void;
  onRemove: () => void;
}) {
  const [show, setShow] = useState(false);
  const dateLabel = (() => {
    try {
      return new Date(secret.createdAt).toLocaleDateString();
    } catch {
      return "";
    }
  })();

  return (
    <div className="rounded border border-slate-200 bg-white p-1.5 space-y-1">
      <div className="flex items-center gap-1">
        <input
          className="flex-1 min-w-0 text-xs border border-slate-200 rounded px-1.5 py-0.5"
          value={secret.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="secret label"
        />
        <span className="text-[10px] text-slate-400 shrink-0" title={secret.createdAt}>
          {dateLabel}
        </span>
        <button
          type="button"
          className="text-[11px] text-slate-400 hover:text-rose-600 px-1 leading-none"
          onClick={onRemove}
          title="删除该 secret"
          aria-label="删除该 secret"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-1">
        <input
          readOnly
          type={show ? "text" : "password"}
          className="flex-1 min-w-0 text-xs font-mono border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50"
          value={secret.value}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="text-[11px] rounded border border-slate-200 hover:border-slate-400 px-1.5 py-0.5 text-slate-600 leading-none"
          title={show ? "隐藏" : "显示"}
          aria-label={show ? "隐藏" : "显示"}
        >
          {show ? "🙈" : "👁"}
        </button>
        <CopyButton text={secret.value} title="复制密钥" />
      </div>
    </div>
  );
}

/** CopyButton · 一键复制 + 1.5s 内显示 ✓ 反馈。
 *  优先 navigator.clipboard（HTTPS/localhost 才有），兜底走 textarea trick。
 */
function CopyButton({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const reset = () => setTimeout(() => setCopied(false), 1500);
    try {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          reset();
        });
        return;
      }
    } catch {
      /* fallthrough to legacy */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      reset();
    } catch {
      /* give up silently */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-[11px] rounded border border-slate-200 hover:border-slate-400 px-1.5 py-0.5 text-slate-600 leading-none"
      title={title || "复制"}
      aria-label={title || "复制"}
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}

/** v1 密钥生成：32 字节随机 → base64url。后端上线后这步改服务端，前端只接收一次性返回值。 */
function randomSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ===================================================================
 * REMOVED · AgentSpecField / SubAgentsField
 *
 *  历史：v1 这里有两个组件——AgentSpecField 让 flow 自己声明 callable+role；
 *  SubAgentsField 让 flow 作为 leader 时选下属白名单。
 *
 *  现在：Flow 不再决定"自己的角色"和"自己的团队"——这俩都搬到 /teams 管理页：
 *  在那里新建 team → 起名 → 加入成员（flow + role）→ 指定 leader → 跟 team 对话。
 *  Flow 编辑器只关心画布本身（trigger、节点、变量、连线、可见性）。
 *
 *  数据兼容：Flow.agentSpec / Flow.subAgents 字段在 types.ts 中暂保留（旧数据 round-trip
 *  不丢失），但 UI 上不再可见、保存时不再写入；后端 master_data 也允许它们继续存在
 *  （读不影响、写不强求），等老数据自然淘汰。
 * =================================================================== */

/* ===================================================================
 * FlowStats · 节点 / 连线统计
 *
 * 两种 flowType 走不同显示：
 *   - react : 显示按节点类型分组（LLM / Tool / Skill 等），帮用户清点工具腰带
 *   - dag   : 只显示节点 / 连线总数，DAG 关心的是拓扑而非节点种类
 * =================================================================== */
function FlowStats({
  flow,
  counts,
  isReact,
}: {
  flow: Flow;
  counts: {
    nodes: number;
    edges: number;
    llm: number;
    tool: number;
    skill: number;
    knowledge: number;
    mcp: number;
    prompt: number;
    fileOutput: number;
  };
  isReact: boolean;
}) {
  return (
    <div className="rounded border bg-slate-50 p-2 space-y-1 text-xs text-slate-500">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1">
        <span>Stats</span>
        <span className="text-slate-400 font-normal normal-case tracking-normal">
          · {flow.flowType.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center">
        <span>节点</span>
        <span className="ml-auto font-mono text-slate-700">{counts.nodes}</span>
      </div>
      <div className="flex items-center">
        <span>连线</span>
        <span className="ml-auto font-mono text-slate-700">{counts.edges}</span>
      </div>
      {isReact && (
        <>
          <div className="border-t my-1" />
          <SmallStat label="LLM"         value={counts.llm}        color="text-brand-700" />
          <SmallStat label="Prompt"      value={counts.prompt}     color="text-sky-700" />
          <SmallStat label="Skill"       value={counts.skill}      color="text-lime-700" />
          <SmallStat label="Knowledge"   value={counts.knowledge}  color="text-teal-700" />
          <SmallStat label="Tool"        value={counts.tool}       color="text-amber-700" />
          <SmallStat label="MCP"         value={counts.mcp}        color="text-violet-700" />
          <SmallStat label="File Output" value={counts.fileOutput} color="text-orange-700" />
        </>
      )}
    </div>
  );
}

/* ===================================================================
 * FlowAuditInfo · 审计信息（只读）
 *
 * 字段全部来自 master_data：CreatedBy/At、UpdatedBy/At、DeletedBy/At。
 * 显示策略：
 *   - 时间统一走 formatAuditTime（"YYYY-MM-DD HH:mm"）；前端不展示秒和毫秒
 *   - 操作人是 GUID（master_data 还没接用户表），截短显示前 8 位避免占满行
 *   - DeletedBy/At 只在确实有值时显示——常规列表里的 flow 必然未删
 * =================================================================== */
function FlowAuditInfo({ flow }: { flow: Flow }) {
  const rows: Array<{ label: string; who?: string; when?: string }> = [
    { label: "创建", who: flow.createdBy, when: flow.createdAt },
    { label: "更新", who: flow.updatedBy, when: flow.updatedAt },
  ];
  if (flow.deletedAt || flow.deletedBy) {
    rows.push({ label: "删除", who: flow.deletedBy, when: flow.deletedAt });
  }
  return (
    <div className="rounded border bg-slate-50/60 p-2 space-y-1 text-[11px] text-slate-500">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1">
        <span>Audit</span>
        <InfoTip text="审计信息由 master_data 自动维护，前端不可编辑。" />
      </div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-slate-400 shrink-0 w-8">{r.label}</span>
          <span className="font-mono text-slate-600 text-[10px] truncate">
            {shortAuditWho(r.who)}
          </span>
          <span className="ml-auto font-mono text-slate-700 text-[10px]">
            {formatAuditTime(r.when)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 把 GUID 缩成前 8 位（master_data 还没用户表，先这么显示） */
function shortAuditWho(v: string | undefined): string {
  if (!v) return "—";
  const s = String(v).replace(/[{}"]/g, "");
  if (s.length <= 10) return s;
  return s.slice(0, 8) + "…";
}

/** ISO datetime → "YYYY-MM-DD HH:mm"；解析失败时回退原值。 */
function formatAuditTime(v: string | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/* ===================================================================
 * FlowTypeField · 只读展示 flow.flowType
 *
 * flowType 是创建 flow 时定型的——画布形态、运行模型、可放节点都不同，
 * 不能在画布里改。这里展示当前值 + tagline，方便用户在编辑时随时确认
 * "我在编辑的是哪种类型的 flow"。
 * =================================================================== */
function FlowTypeField({ flow }: { flow: Flow }) {
  const meta = FLOW_TYPES.find((ft) => ft.value === flow.flowType);
  // 把"执行模式" + "创建后不可改" + 当前 flowType 的 tagline 拼成一段悬浮说明，
  // 标题区域保持极简（只剩 "Flow Type"）。
  const hint =
    "执行模式（创建后不可改）" +
    (meta?.tagline ? `\n${meta.tagline}` : "");
  return (
    <Field label="Flow Type" hint={hint}>
      <div className="w-full text-sm rounded px-2 py-1.5 flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-700">
        <span className="font-mono">{flow.flowType}</span>
        <span className="ml-auto text-[11px] text-slate-500 truncate">
          {meta?.label ?? flow.flowType}
        </span>
      </div>
    </Field>
  );
}

/* ===================================================================
 * TriggerTypeField · 只读展示 flow.triggerType
 *
 * triggerType 是从画布上的 Trigger 节点 derive 的——拖入 Chat Input → chat，
 * 等等。这里展示当前值 + 当前 trigger 节点信息 + 操作引导。如果画布上没有 trigger
 * 节点，给出明显的红色提示让用户去左侧拖一个。
 * =================================================================== */
function TriggerTypeField({ flow }: { flow: Flow }) {
  const trigger = findTriggerNode(flow.nodes as { type?: string; id: string }[]);
  const meta = TRIGGER_TYPES.find((c) => c.value === flow.triggerType);

  // Trigger 节点上的友好显示名（避免单纯展示 "input" 这种内部 kind）
  const triggerLabel = trigger?.type
    ? TRIGGER_LABELS[trigger.type] ?? trigger.type
    : null;

  // 把"触发方式" + meta.description 合并进悬浮说明；标题区域只剩 "Trigger Type"。
  // "未配置 trigger" 是状态告警（不是描述性文字），保留可见以引导操作。
  const hint =
    "触发方式（由画布上的 Trigger 节点种类决定）" +
    (meta?.description ? `\n${meta.description}` : "");

  return (
    <Field label="Trigger Type" hint={hint}>
      <div
        className={
          "w-full text-sm rounded px-2 py-1.5 flex items-center gap-2 " +
          (trigger
            ? "bg-slate-50 border border-slate-200 text-slate-700"
            : "bg-rose-50 border border-rose-200 text-rose-700")
        }
      >
        <span className="font-mono">{flow.triggerType}</span>
        {trigger ? (
          <span className="ml-auto text-[11px] text-slate-500">
            ← {triggerLabel}
          </span>
        ) : (
          <span className="ml-auto text-[11px]">未配置 trigger</span>
        )}
      </div>
      {!trigger && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-1 mt-1 leading-relaxed">
          画布上没有 trigger 节点。从左侧 <b>Trigger</b> 组拖一个进来——它的种类决定 flow.triggerType。
        </div>
      )}
    </Field>
  );
}

/** Trigger 节点 kind → 在右侧面板里显示的人话名字
 *  跟 NodePalette 里的 label 保持一致，未来加新 trigger 类型记得同步两边。
 */
const TRIGGER_LABELS: Partial<Record<string, string>> = {
  input: "Chat Input",
  manualTrigger: "Manual Trigger",
  scheduleTrigger: "Schedule Trigger",
  webhookTrigger: "Webhook Trigger",
};

function SmallStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center">
      <span className={color}>{label}</span>
      <span className="ml-auto font-mono text-slate-700">{value}</span>
    </div>
  );
}

/* ===================================================================
 * Variables 编辑器（增 / 删 / 改）
 *
 * 字段：name (string) / type (string|number|boolean|json) / default / desc
 *
 * 注意：这次先落 schema 与 UI 骨架，运行时模板插值（{{var.foo}}）留给后续。
 * 提前把这块固化下来，避免后面写引用语法时数据形态再变。
 * =================================================================== */
/* ===================================================================
 * VariablesSummary · FlowOverview 用的只读概览
 *
 * 全局变量的增删改集中到 Global Variables 节点；这里仅展示 key + type，
 * 引导用户去对应节点编辑（或者拖一个到画布上）。
 * =================================================================== */
function VariablesSummary({
  variables,
  hasNode,
}: {
  variables: FlowVariable[];
  /** 画布上是否已经有 Global Variables 节点——决定底部提示文案 */
  hasNode: boolean;
}) {
  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Variables
        </span>
        <span className="text-[10px] text-slate-400">
          ({variables.length})
        </span>
      </div>
      <div className="p-2 space-y-1">
        {variables.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic px-1">
            还没有变量。
          </div>
        ) : (
          <div className="space-y-0.5">
            {variables.map((v) => (
              <div
                key={v.name}
                className="flex items-center gap-1.5 text-xs px-1"
              >
                <span className="font-mono text-slate-800 truncate">
                  {v.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  {v.type}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="text-[11px] text-slate-500 leading-relaxed pt-1">
          {hasNode
            ? "在画布上的 Global Variables 节点里增删 / 编辑。"
            : "拖一个 Global Variables 节点到画布上即可增删 / 编辑。"}
        </div>
      </div>
    </div>
  );
}

function VariablesEditor({
  variables,
  onChange,
}: {
  variables: FlowVariable[];
  onChange: (next: FlowVariable[]) => void;
}) {
  function add() {
    // 自动起个不重复的名字
    let i = variables.length + 1;
    let name = `var_${i}`;
    const taken = new Set(variables.map((v) => v.name));
    while (taken.has(name)) {
      i += 1;
      name = `var_${i}`;
    }
    onChange([
      ...variables,
      { name, type: "string", defaultValue: "" } satisfies FlowVariable,
    ]);
  }
  function update(idx: number, patch: Partial<FlowVariable>) {
    onChange(variables.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }
  function remove(idx: number) {
    onChange(variables.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Variables
        </span>
        <span className="text-[10px] text-slate-400">
          ({variables.length})
        </span>
        <button
          type="button"
          onClick={add}
          className="ml-auto text-[11px] text-brand-600 hover:text-brand-700 font-medium"
        >
          + 添加
        </button>
      </div>
      <div className="p-2 space-y-2">
        {variables.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic px-1">
            还没有变量。运行时节点 / 模板可以引用它们（即将支持 <code>{`{{var.name}}`}</code>）。
          </div>
        ) : (
          variables.map((v, idx) => (
            <VariableRow
              key={idx}
              v={v}
              allNames={variables.map((x) => x.name).filter((_, i) => i !== idx)}
              onChange={(patch) => update(idx, patch)}
              onRemove={() => remove(idx)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function VariableRow({
  v,
  allNames,
  onChange,
  onRemove,
}: {
  v: FlowVariable;
  /** 同 flow 内的其它变量名（用来检测重名） */
  allNames: string[];
  onChange: (patch: Partial<FlowVariable>) => void;
  onRemove: () => void;
}) {
  const nameValid = isValidVariableName(v.name);
  const nameDup = allNames.includes(v.name);
  const nameError = !nameValid
    ? "变量名只能含字母、数字、下划线，且不可数字开头"
    : nameDup
    ? "与已有变量同名"
    : null;

  return (
    <div className="rounded border bg-white p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <input
          className={
            "flex-1 text-xs font-mono border rounded px-1.5 py-1 " +
            (nameError ? "border-rose-400" : "border-slate-200")
          }
          value={v.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="name"
        />
        <select
          className="text-[11px] border rounded bg-white px-1 py-1"
          value={v.type}
          onChange={(e) =>
            onChange({ type: e.target.value as FlowVariableType })
          }
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="json">json</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-slate-400 hover:text-rose-600 px-1"
          title="删除变量"
        >
          ×
        </button>
      </div>
      {nameError && (
        <div className="text-[11px] text-rose-600">{nameError}</div>
      )}
      <DefaultValueInput v={v} onChange={onChange} />
      <input
        className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-0.5"
        value={v.description || ""}
        placeholder="描述（可选）"
        onChange={(e) => onChange({ description: e.target.value })}
      />
    </div>
  );
}

function DefaultValueInput({
  v,
  onChange,
}: {
  v: FlowVariable;
  onChange: (patch: Partial<FlowVariable>) => void;
}) {
  // 类型不同 UI 不同——保持 defaultValue 的 schema 一致：
  //   string → string；number → number；boolean → boolean；json → unknown(parse 失败时 keep 原文本)
  if (v.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={!!v.defaultValue}
          onChange={(e) => onChange({ defaultValue: e.target.checked })}
        />
        <span className="text-[11px] text-slate-500">default</span>
      </label>
    );
  }
  if (v.type === "number") {
    return (
      <input
        type="number"
        className="w-full text-xs border rounded px-1.5 py-1"
        value={typeof v.defaultValue === "number" ? v.defaultValue : ""}
        placeholder="default value (number)"
        onChange={(e) => {
          const t = e.target.value;
          onChange({
            defaultValue: t === "" ? undefined : Number(t),
          });
        }}
      />
    );
  }
  if (v.type === "json") {
    const text =
      typeof v.defaultValue === "string"
        ? v.defaultValue
        : v.defaultValue == null
        ? ""
        : JSON.stringify(v.defaultValue, null, 2);
    return (
      <textarea
        rows={2}
        className="w-full text-[11px] font-mono border rounded px-1.5 py-1"
        value={text}
        placeholder={'default JSON, e.g. {"a": 1}'}
        onChange={(e) => {
          const t = e.target.value;
          // 先尝试 parse，parse 不动就以原文本保存（让用户可以保存"半成品 JSON"继续编辑）
          try {
            onChange({ defaultValue: t ? JSON.parse(t) : undefined });
          } catch {
            onChange({ defaultValue: t });
          }
        }}
      />
    );
  }
  // string
  return (
    <input
      className="w-full text-xs border rounded px-1.5 py-1"
      value={typeof v.defaultValue === "string" ? v.defaultValue : ""}
      placeholder="default value (string)"
      onChange={(e) => onChange({ defaultValue: e.target.value })}
    />
  );
}

/* ===================================================================
 * 节点编辑器
 * =================================================================== */

/** 图里 LLM 是否被 Prompt 节点连入 system handle。
 *  用途：LLM 节点 data.system textarea 旁的提示——告诉用户"运行时 system 来自图，
 *  这里的文本只在没连图时生效"。
 */
function hasGraphSystemLink(flow: Flow, llmId: string): boolean {
  return flow.edges.some(
    (e) => e.target === llmId && e.targetHandle === "system"
  );
}

function NodeEditor({
  node,
  models,
  tools,
  skills,
  knowledgeBases,
  mcpServers,
  flow,
  onUpdateNodeData,
  onUpdateVariables,
  onSelectNode,
}: {
  node: Node;
  models: ModelOption[];
  tools: Tool[];
  skills: Skill[];
  knowledgeBases: KnowledgeBase[];
  mcpServers: MCPServer[];
  flow: Flow;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  /** Global Variables 节点编辑器要用——把变量集合写回 flow。 */
  onUpdateVariables: (next: FlowVariable[]) => void;
  onSelectNode?: (nodeId: string) => void;
}) {
  if (node.type === "llm") {
    const d = (node.data || {}) as LLMNodeData;
    return (
      <div className="p-3 space-y-3">
        <NodeHeaderBar kindLabel="LLM (ReAct)" nodeId={node.id} />

        <Field label="Label">
          <input
            className="w-full text-sm border rounded px-2 py-1"
            value={d.label || ""}
            onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
          />
        </Field>

        {/* Model 配置组：把 backend/model 选择 + T / max_tokens / max_iter 三个采样
         *  参数收在一个浅灰盒子里，每行都有 ⓘ 悬浮说明，让"配置脑子"这件事自成一块。 */}
        <ModelConfigGroup
          models={models}
          backend={d.backend}
          model={d.model}
          temperature={d.temperature}
          max_tokens={d.max_tokens}
          max_iterations={d.max_iterations}
          onChange={(patch) => onUpdateNodeData(node.id, patch)}
        />

        <Field
          label="System"
          hint="未连 Prompt 节点时的 system message 兜底文本；连了 Prompt 节点则以图为准。"
        >
          <textarea
            className="w-full text-sm border rounded px-2 py-1"
            rows={4}
            value={d.system ?? ""}
            onChange={(e) =>
              onUpdateNodeData(node.id, { system: e.target.value })
            }
          />
          {hasGraphSystemLink(flow, node.id) && (
            <div className="text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded px-1.5 py-1 mt-1">
              已有 Prompt 节点连入 LLM 的 system 端点，运行时以图为准；此处文本仅作回退。
            </div>
          )}
        </Field>

        <ConnectionsSummary flow={flow} llmId={node.id} />

        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      </div>
    );
  }

  if (node.type === "tool") {
    return (
      <ToolEditor
        node={node}
        tools={tools}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "mcp") {
    return (
      <MCPEditor
        node={node}
        tools={tools}
        mcpServers={mcpServers}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "prompt") {
    const d = (node.data || {}) as PromptNodeData;
    return (
      <div className="p-3 space-y-3">
        <NodeHeaderBar kindLabel="Prompt" nodeId={node.id} />
        <Field label="Label">
          <input
            className="w-full text-sm border rounded px-2 py-1"
            value={d.label || ""}
            placeholder="可选展示名"
            onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
          />
        </Field>
        <Field label="Content (会被注入到 LLM 的 system)">
          <textarea
            className="w-full text-sm border rounded px-2 py-1 font-mono"
            rows={10}
            placeholder={
              "示例：\n你是一名严谨的代码审查助手，回答须包含问题定位、原因和修复建议。\n如涉及实时信息，请先调用工具，不允许凭记忆作答。"
            }
            value={d.content || ""}
            onChange={(e) => onUpdateNodeData(node.id, { content: e.target.value })}
          />
        </Field>
        <div className="text-[11px] text-slate-500">
          连接：把右侧的青色端点拖到 LLM 节点的 <b>System</b> 端点。
          多个 Prompt 节点会按"先连先到"顺序拼接。
        </div>
      </div>
    );
  }

  if (node.type === "skill") {
    return (
      <SkillEditor
        node={node}
        skills={skills}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "knowledge") {
    return (
      <KnowledgeEditor
        node={node}
        knowledgeBases={knowledgeBases}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "fileOutput") {
    return (
      <FileOutputEditor
        node={node}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "response") {
    return <ResponseEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "manualTrigger") {
    return (
      <ManualTriggerEditor node={node} onUpdateNodeData={onUpdateNodeData} />
    );
  }

  if (node.type === "scheduleTrigger") {
    return (
      <ScheduleTriggerEditor node={node} onUpdateNodeData={onUpdateNodeData} />
    );
  }

  if (node.type === "webhookTrigger") {
    return (
      <WebhookTriggerEditor
        node={node}
        flow={flow}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "fileInput") {
    return <FileInputEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "upload") {
    return <UploadEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "httpRequest") {
    return <HttpRequestEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "sql") {
    return <SqlEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "variable") {
    return (
      <VariableEditor
        node={node}
        flow={flow}
        onUpdateNodeData={onUpdateNodeData}
        onUpdateVariables={onUpdateVariables}
      />
    );
  }

  if (node.type === "code") {
    return <CodeEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "ifElse") {
    return <IfElseEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "switch") {
    return (
      <SwitchEditor
        node={node}
        edges={flow.edges}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  if (node.type === "merge") {
    return <MergeEditor node={node} onUpdateNodeData={onUpdateNodeData} />;
  }

  if (node.type === "transform") {
    return (
      <TransformEditor
        node={node}
        flow={flow}
        onUpdateNodeData={onUpdateNodeData}
      />
    );
  }

  // input / output
  const d = (node.data || {}) as IONodeData;
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel={node.type || "?"} nodeId={node.id} />
      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>
      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * CapabilityEditor · Skill / Tool / Knowledge / MCP 共用模板
 *
 * 四类节点都是"挂到 LLM 上的能力"，UI 节奏一致：
 *   ┌─ 节点 · <kind 名> ─────────────┐
 *   │ Label          ← 用户自定义标题（可空，回退到 NAME）│
 *   │ <子组件：下拉选项 / 多选 chips>     │
 *   │ <选中后的淡色描述>                  │
 *   │ <可选：配置卡（Tool 参数覆盖等）>     │
 *   └────────────────────────────┘
 *
 * **不**挂 RuntimePanel——这四种节点要么是 config-only（Skill/Knowledge/MCP），
 * 要么真正运行时数据看聊天气泡 / Tool 调用日志更直观（Tool）。
 *
 * 画布上的节点 title 统一显示**选中项的 NAME**，Label 仅在与 NAME 不同时作小字副标题。
 * =================================================================== */
function CapabilityEditor({
  kindLabel,
  node,
  onUpdateNodeData,
  children,
}: {
  /** 顶部"节点 · X"那行的显示名 */
  kindLabel: string;
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  children?: React.ReactNode;
}) {
  const d = (node.data || {}) as { label?: string };
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel={kindLabel} nodeId={node.id} />
      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名 · 留空则用下方选中的 NAME"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>
      {children}
    </div>
  );
}

/** 选中条目后的"淡色描述"块——所有 CapabilityEditor 共用。
 *  样式跟整张面板的"提示/说明"层级一致：浅灰底 + 11px 文本 + 行高松。 */
function CapabilityDescription({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
      {text}
    </div>
  );
}

/* ===================================================================
 * ToolEditor · 节点 · Tool（本地函数）
 *
 * 三段式：
 *   1. Tool name 下拉（只列 provider=="local"；MCP 工具走 MCP 节点）
 *   2. 描述（来自 model_server 的 ToolSpec.description）
 *   3. **参数覆盖面板** —— 把工具 JSON Schema 里**非 required** 的参数渲染成表单，
 *      让 flow 设计期可以"锁住" voice / speed 之类的运行时风格参数。
 *      required 参数（如 TTS 的 text）不渲染，因为它们语义上等于"用户当下想合成的文本"，
 *      锁了就让 tool 失去与用户意图的联系。
 *
 * 数据归属：覆盖值存在 ToolNodeData.paramOverrides 里；空值视作"未设置"。
 * 运行时：flow_engine 在 _act 里把这些覆盖 merge 进 LLM 给的 args（覆盖优先）。
 * =================================================================== */
function ToolEditor({
  node,
  tools,
  onUpdateNodeData,
}: {
  node: Node;
  tools: Tool[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as ToolNodeData;
  // Tool 节点只能选 provider=="local" 的函数；MCP 工具走 MCP 节点（按 server 整体接入）
  const localTools = tools.filter((t) => t.provider === "local");
  const picked = d.name ? localTools.find((t) => t.name === d.name) : undefined;
  const overrides = d.paramOverrides || {};

  function setOverrides(next: Record<string, unknown>) {
    onUpdateNodeData(node.id, { paramOverrides: next });
  }
  function clearAllOverrides() {
    onUpdateNodeData(node.id, { paramOverrides: {} });
  }

  return (
    <CapabilityEditor
      kindLabel="Tool（本地函数）"
      node={node}
      onUpdateNodeData={onUpdateNodeData}
    >
      <Field label="Tool name">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={d.name || ""}
          onChange={(e) => {
            const next = e.target.value;
            // 换 tool 时清空旧的 paramOverrides——旧 key 在新 schema 里多半不存在了
            onUpdateNodeData(node.id, {
              name: next,
              paramOverrides: {},
            });
          }}
        >
          <option value="">-- 选择 tool --</option>
          {localTools.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      {d.name && (
        <CapabilityDescription
          text={
            picked?.description ||
            "(tool 未在 flow_engine 中找到 — 可能未启动或 MCP 工具需用 MCP 节点)"
          }
        />
      )}

      <ToolParamOverrides
        schema={picked?.parameters}
        overrides={overrides}
        onChange={setOverrides}
        onClearAll={clearAllOverrides}
      />
    </CapabilityEditor>
  );
}

/* ===================================================================
 * SkillEditor · 节点 · Skill (md playbook)
 *
 * 选中 model_server 里某个 .md skill，运行时 flow_engine 拉取 body 注入 system message。
 * 配置：仅 name；Skill 本身没有"运行时参数"。
 * =================================================================== */
function SkillEditor({
  node,
  skills,
  onUpdateNodeData,
}: {
  node: Node;
  skills: Skill[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as SkillNodeData;
  const picked = d.name ? skills.find((s) => s.name === d.name) : undefined;
  return (
    <CapabilityEditor
      kindLabel="Skill (md playbook)"
      node={node}
      onUpdateNodeData={onUpdateNodeData}
    >
      <Field label="Skill name">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={d.name || ""}
          onChange={(e) => onUpdateNodeData(node.id, { name: e.target.value })}
        >
          <option value="">-- 选择 skill --</option>
          {skills.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        {skills.length === 0 && (
          <div className="text-[11px] text-amber-700 mt-1">
            model_server 还没有任何 skill md。把 .md 放到&nbsp;
            <code className="bg-slate-100 rounded px-1">
              model_server/assets/library/skills/
            </code>
            &nbsp;再 POST /v1/library/skills/reload。
          </div>
        )}
      </Field>

      {picked && (
        <>
          <CapabilityDescription text={picked.description} />
          {picked.tags && picked.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {picked.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-px rounded bg-lime-100 text-lime-700 border border-lime-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </CapabilityEditor>
  );
}

/* ===================================================================
 * MCPEditor · 节点 · MCP Server
 *
 * 选中一个 MCP server，flow_engine 把该 server 暴露的所有 tool 都作为 LLM 可调用项。
 * 配置：仅 serverName；server 是否 active 是运行时状态（编辑面板里只读展示）。
 * =================================================================== */
function MCPEditor({
  node,
  tools,
  mcpServers,
  onUpdateNodeData,
}: {
  node: Node;
  tools: Tool[];
  mcpServers: MCPServer[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as MCPNodeData;
  const exposedTools = d.serverName
    ? tools.filter((t) => t.provider === d.serverName)
    : [];
  const picked = d.serverName
    ? mcpServers.find((s) => s.name === d.serverName)
    : undefined;
  return (
    <CapabilityEditor
      kindLabel="MCP Server"
      node={node}
      onUpdateNodeData={onUpdateNodeData}
    >
      <Field label="Server name">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={d.serverName || ""}
          onChange={(e) =>
            onUpdateNodeData(node.id, { serverName: e.target.value })
          }
        >
          <option value="">-- 选择 MCP server --</option>
          {mcpServers.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.active ? "  · active" : ""}
            </option>
          ))}
        </select>
        {mcpServers.length === 0 && (
          <div className="text-[11px] text-amber-700 mt-1">
            没有可用的 MCP server。请先在 flow_engine 配置 MCP_SERVERS 并连接。
          </div>
        )}
      </Field>

      {picked && (
        <CapabilityDescription
          text={
            picked.active
              ? `已连接 · 暴露 ${exposedTools.length} 个 tool`
              : "该 server 还未连接。运行时 LLM 不会拿到任何 tool。"
          }
        />
      )}

      {d.serverName && exposedTools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {exposedTools.map((t) => (
            <span
              key={t.name}
              title={t.description}
              className="text-[10px] px-1.5 py-px rounded bg-violet-100 text-violet-700 border border-violet-200"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
    </CapabilityEditor>
  );
}

/* ===================================================================
 * ToolParamOverrides · 工具参数动态表单
 *
 * 把 JSON Schema 里 `properties` 中**非 required** 的字段渲染成表单。
 *
 * 类型映射：
 *   string  + enum     → <select>
 *   string             → <input type="text">
 *   number / integer   → <input type="number">（min/max/step 来自 schema）
 *   boolean            → <select [unset|true|false]>（三态比 checkbox 更明确）
 *   array / object     → <textarea> 编辑原始 JSON
 *
 * 三态语义（关键）：
 *   - 该 key **不在** overrides → "未设置"（LLM 自由决定）
 *   - 该 key 在 overrides 且值合法 → "已锁定"（运行时强制使用）
 *   - 该 key 在 overrides 但值无效（空字符串等）→ 等同于未设置（runtime computeToolOverridesFromGraph 会剔除）
 *
 * 每行右侧有个清除按钮（×），点击删除该 key 让它回到"未设置"状态。
 * =================================================================== */
type JsonSchemaProp = {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
};

type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
};

function ToolParamOverrides({
  schema,
  overrides,
  onChange,
  onClearAll,
}: {
  schema: unknown;
  overrides: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onClearAll: () => void;
}) {
  // 把 unknown 收窄成可用结构；防御性 cast，schema 不规范时直接给"没有可配置参数"
  const s = (schema && typeof schema === "object" ? schema : {}) as JsonSchemaObject;
  const props = s.properties ?? {};
  const required = new Set<string>(Array.isArray(s.required) ? s.required : []);
  const optionalEntries = Object.entries(props).filter(([k]) => !required.has(k));
  const setKeys = Object.keys(overrides).filter((k) => {
    const v = overrides[k];
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  });

  function updateKey(key: string, value: unknown) {
    const next = { ...overrides };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  }
  function unsetKey(key: string) {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          参数覆盖
        </span>
        <span className="text-[10px] text-slate-400">
          ({setKeys.length}/{optionalEntries.length})
        </span>
        {setKeys.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto text-[11px] text-slate-500 hover:text-rose-600"
            title="清空所有覆盖（恢复为'未设置'，由 LLM 决定）"
          >
            清空
          </button>
        )}
      </div>

      <div className="p-2 space-y-2">
        {optionalEntries.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic px-1 leading-relaxed">
            {schema
              ? "该 tool 没有可配置的可选参数（required 参数由 LLM 决定）。"
              : "选择 tool 后才能配置参数。"}
          </div>
        ) : (
          optionalEntries.map(([name, prop]) => (
            <ParamRow
              key={name}
              name={name}
              prop={prop}
              value={overrides[name]}
              isSet={name in overrides}
              onChange={(v) => updateKey(name, v)}
              onUnset={() => unsetKey(name)}
            />
          ))
        )}

        {optionalEntries.length > 0 && (
          <div className="text-[11px] text-slate-500 leading-relaxed pt-1">
            说明：设置的参数会在运行时**强制覆盖** LLM 给的同名 arg；
            清空（×）某个字段则回到 LLM 自由决定。
          </div>
        )}
      </div>
    </div>
  );
}

function ParamRow({
  name,
  prop,
  value,
  isSet,
  onChange,
  onUnset,
}: {
  name: string;
  prop: JsonSchemaProp;
  value: unknown;
  isSet: boolean;
  onChange: (v: unknown) => void;
  onUnset: () => void;
}) {
  const type = normalizeType(prop.type);
  const defaultHint =
    prop.default !== undefined ? `默认 ${formatDefault(prop.default)}` : "由 LLM 决定";

  return (
    <div className="rounded border bg-white p-2 space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono text-slate-700">{name}</span>
        {/* 说明走 native title 悬浮提示，零依赖、跨浏览器一致、可访问性也 OK。
            没 description 时不渲染图标，避免一堆"裸"的 ⓘ 让面板乱。 */}
        {prop.description && <InfoTip text={prop.description} />}
        <span className="text-[10px] text-slate-400 font-mono">
          {Array.isArray(prop.type) ? prop.type.join("|") : prop.type || "string"}
        </span>
        <span
          className={
            "ml-auto text-[10px] font-mono " +
            (isSet ? "text-amber-700" : "text-slate-400")
          }
        >
          {isSet ? "已锁定" : defaultHint}
        </span>
        {isSet && (
          <button
            type="button"
            onClick={onUnset}
            className="text-[11px] text-slate-400 hover:text-rose-600 px-1"
            title="清除此覆盖，由 LLM 自由决定"
          >
            ×
          </button>
        )}
      </div>

      <ParamInput type={type} prop={prop} value={value} onChange={onChange} />
    </div>
  );
}

/** 小 info 图标 + native title tooltip。
 *  - 用 `title` 属性触发浏览器原生 tooltip：零 JS、零 CSS、可访问性默认达标
 *  - 视觉上是一个浅灰的 ⓘ 字符，hover 时变深；圆 hover 区比单字符大一圈方便鼠标抓
 *  - 跟 NodePalette / RuntimePanel 风格对齐：不引入 lucide-react / heroicons 这种依赖
 */
function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] leading-none text-slate-400 hover:text-slate-700 cursor-help select-none"
      aria-label={text}
    >
      ⓘ
    </span>
  );
}

/** 把可能是 "string" / ["string","null"] / undefined 的 type 规整成单值 */
function normalizeType(t: string | string[] | undefined): string {
  if (Array.isArray(t)) {
    // 取第一个非 null 的；都不可用就 fallback string
    const real = t.find((x) => x !== "null");
    return real || "string";
  }
  return t || "string";
}

function formatDefault(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null) return "null";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function ParamInput({
  type,
  prop,
  value,
  onChange,
}: {
  type: string;
  prop: JsonSchemaProp;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  // 1) enum：不论 type 是啥，统一给 select；让用户从选项里挑（首项 "-- 由 LLM 决定 --" 即 unset）
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    const cur = value === undefined ? "" : String(value);
    return (
      <select
        className="w-full text-xs border rounded px-1.5 py-1 bg-white"
        value={cur}
        onChange={(e) => {
          const t = e.target.value;
          if (t === "") onChange(undefined);
          else {
            // 把字符串还原回 schema 里 enum 项的原 type（数字 vs 字符串）
            const matched = (prop.enum || []).find((v) => String(v) === t);
            onChange(matched ?? t);
          }
        }}
      >
        <option value="">-- 由 LLM 决定 --</option>
        {prop.enum.map((opt, i) => (
          <option key={i} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (type === "number" || type === "integer") {
    const v = typeof value === "number" ? value : "";
    return (
      <input
        type="number"
        className="w-full text-xs border rounded px-1.5 py-1"
        value={v}
        min={prop.minimum}
        max={prop.maximum}
        step={prop.multipleOf ?? (type === "integer" ? 1 : "any")}
        placeholder={
          prop.default !== undefined ? `默认 ${formatDefault(prop.default)}` : ""
        }
        onChange={(e) => {
          const t = e.target.value;
          if (t === "") onChange(undefined);
          else {
            const n = type === "integer" ? parseInt(t, 10) : parseFloat(t);
            onChange(Number.isFinite(n) ? n : undefined);
          }
        }}
      />
    );
  }

  if (type === "boolean") {
    // 三态：'' = unset，'true' / 'false' = locked
    const cur = value === undefined ? "" : value ? "true" : "false";
    return (
      <select
        className="w-full text-xs border rounded px-1.5 py-1 bg-white"
        value={cur}
        onChange={(e) => {
          const t = e.target.value;
          if (t === "") onChange(undefined);
          else onChange(t === "true");
        }}
      >
        <option value="">-- 由 LLM 决定 --</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (type === "array" || type === "object") {
    const text =
      value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : safeJsonStringify(value);
    return (
      <textarea
        rows={3}
        className="w-full text-[11px] font-mono border rounded px-1.5 py-1"
        value={text}
        placeholder={type === "array" ? "JSON 数组，例 [1,2]" : 'JSON 对象，例 {"k":"v"}'}
        onChange={(e) => {
          const t = e.target.value;
          if (t.trim() === "") {
            onChange(undefined);
            return;
          }
          // parse 不动就以原字符串保存（用户可继续编辑），但语义上等同于"未设置"
          // —— runtime computeToolOverridesFromGraph 会保留它；如果 parse 失败传上去，
          //    flow_engine 端透传 dict 时会报错。这里用一个"成功才覆盖"的策略避免送残废 JSON。
          try {
            const parsed = JSON.parse(t);
            onChange(parsed);
          } catch {
            // 保留原文本，但保存格式还是字符串——用户能看到自己输入的内容，
            // 不会被 React 强行 overwrite。下次他改完成功 parse 即可正常写入。
            onChange(t);
          }
        }}
      />
    );
  }

  // string fallback
  const cur = typeof value === "string" ? value : value === undefined ? "" : String(value);
  return (
    <input
      type="text"
      className="w-full text-xs border rounded px-1.5 py-1"
      value={cur}
      placeholder={
        prop.default !== undefined ? `默认 ${formatDefault(prop.default)}` : ""
      }
      onChange={(e) => {
        const t = e.target.value;
        if (t === "") onChange(undefined);
        else onChange(t);
      }}
    />
  );
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/* ===================================================================
 * KnowledgeEditor · 节点 · Knowledge (RAG)
 *
 * 编辑项：
 *   - Label
 *   - KB 多选（chip 列表 + dropdown）
 *
 * 校验：
 *   - 选中的 KB 不在 knowledgeBases 列表里 → 标红"已删除"，可一键清理
 *   - knowledgeBases 为空 → 提示"去 KB 管理页创建"
 *
 * 信息展示：
 *   - 每个选中的 KB 一行：name + effective_mode + source 数 + chunk 数
 *   - 让用户一眼看出"接的 KB 是 inline 还是 search 模式 + 大小"
 *
 * 抽出来作为独立组件原因同 FileOutputEditor：避免在 NodeEditor 大函数里
 * 嵌套过多分支让 hook 顺序难以维护。
 * =================================================================== */
function KnowledgeEditor({
  node,
  knowledgeBases,
  onUpdateNodeData,
}: {
  node: Node;
  knowledgeBases: KnowledgeBase[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || { kbIds: [] }) as KnowledgeNodeData;
  const selected = d.kbIds || [];
  const kbById = new Map(knowledgeBases.map((k) => [k.id, k]));
  const stale = selected.filter((id) => !kbById.has(id));
  const available = knowledgeBases.filter((k) => !selected.includes(k.id));

  function setKbIds(next: string[]) {
    onUpdateNodeData(node.id, { kbIds: next });
  }

  return (
    <CapabilityEditor
      kindLabel="Knowledge (RAG)"
      node={node}
      onUpdateNodeData={onUpdateNodeData}
    >
      <Field label="Add KB">
        {knowledgeBases.length === 0 ? (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1 leading-relaxed">
            还没有任何 KB。
            <a
              href="/knowledge"
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:text-brand-700 ml-1 underline"
            >
              去 KB 管理页
            </a>
            创建一个，然后回来选。
          </div>
        ) : available.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic">
            所有 KB 都已加入。
          </div>
        ) : (
          <select
            className="w-full text-sm border rounded px-2 py-1 bg-white"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (selected.includes(v)) return;
              setKbIds([...selected, v]);
            }}
          >
            <option value="">-- 选 KB 加入 --</option>
            {available.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} · {k.effective_mode} · {k.source_count} 文件
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* 选中列表 · 跟 Tool/Skill/MCP 的"选中后的淡色描述"是同一节奏：
       *   一段浅灰盒子里展示当前选中项；KB 是多选，所以盒子里是 chip 列表而非一段文字。
       */}
      {(selected.length > 0 || stale.length > 0) && (
        <div className="rounded border bg-slate-50/60">
          <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              已选 KB
            </span>
            <span className="text-[10px] text-slate-400">
              ({selected.length})
            </span>
            {stale.length > 0 && (
              <button
                type="button"
                onClick={() => setKbIds(selected.filter((id) => kbById.has(id)))}
                className="ml-auto text-[11px] text-rose-600 hover:text-rose-700 font-medium"
                title="清理已失效引用"
              >
                清理 {stale.length}
              </button>
            )}
          </div>
          <div className="p-2 space-y-1">
            {selected.map((id) => {
              const kb = kbById.get(id);
              return (
                <div
                  key={id}
                  className={
                    "flex items-center gap-1.5 text-[11px] rounded border px-2 py-1.5 " +
                    (kb
                      ? "bg-teal-50 border-teal-200"
                      : "bg-rose-50 border-rose-200")
                  }
                >
                  {kb ? (
                    <>
                      <span className="font-medium text-teal-800 truncate">
                        {kb.name}
                      </span>
                      <span className="text-[10px] text-teal-700 font-mono">
                        {kb.effective_mode}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap">
                        {kb.source_count} 文件 · {kb.total_chunks} 块
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono truncate text-rose-700">
                        {id}
                      </span>
                      <span className="ml-auto text-[10px] text-rose-600">
                        已删除
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setKbIds(selected.filter((x) => x !== id))}
                    className="text-slate-400 hover:text-rose-600 px-1"
                    title="从此节点移除"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CapabilityEditor>
  );
}

/* ===================================================================
 * FileOutputEditor · 节点 · File Output
 *
 * 编辑项：
 *   - Label
 *   - Filename prefix（最终文件名 = `${prefix}-YYYYMMDD-HHmmss.${ext}`）
 *   - Format (md / txt / json / media / auto)
 *      · media 模式从 LLM 回复里抽出第一个媒体 URL，fetch 真二进制存盘；
 *        auto 模式优先按 media 探测，未命中再走文本启发判断。
 *
 * 运行时区域：
 *   统一用 RuntimePanel 展示（status / 完成时间 / 文本长度 / 错误等），
 *   预览 / 下载按钮仍保留在画布节点上作为操作入口。
 *
 * 抽出来作为独立组件是为了未来要在文件名 / 格式之间联动展示时方便扩展。
 * =================================================================== */
function FileOutputEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as FileOutputNodeData;

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="File Output" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field label="Filename prefix">
        <input
          className="w-full text-sm font-mono border rounded px-2 py-1"
          value={d.filenamePrefix || ""}
          placeholder="output"
          onChange={(e) =>
            onUpdateNodeData(node.id, { filenamePrefix: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">
          最终文件名 = <code className="bg-slate-100 px-1 rounded">
            {d.filenamePrefix || "output"}-YYYYMMDD-HHmmss.
            {d.format === "media"
              ? "<媒体扩展>"
              : d.format && d.format !== "auto"
                ? d.format
                : "md / <媒体扩展>"}
          </code>
        </div>
      </Field>

      <Field
        label="Format"
        hint="auto = 优先媒体探测，未命中按文本启发判断；media = 强制从回复中抽媒体 URL 下载二进制。"
      >
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={d.format || "auto"}
          onChange={(e) =>
            onUpdateNodeData(node.id, { format: e.target.value })
          }
        >
          <option value="auto">auto · 媒体 → 文本启发</option>
          <option value="md">md · Markdown（含 frontmatter）</option>
          <option value="txt">txt · 纯文本</option>
          <option value="json">json · JSON（自动 pretty print）</option>
          <option value="media">media · 音/图/视/PDF 等二进制</option>
        </select>
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          auto 规则：先扫 LLM 回复里的 <code>![](url)</code> / <code>[](url)</code>，URL
          扩展名命中白名单（wav/mp3/png/jpg/mp4/pdf 等）→ media；否则以
          <code>---</code> 开头 / 含 markdown 标志 → md；可 JSON.parse → json；剩余 → txt。
        </div>
      </Field>

      <RuntimePanel nodeId={node.id} nodeType="fileOutput" />

      <div className="text-[11px] text-slate-500 leading-relaxed">
        连接：把 LLM 节点右侧 <span className="font-mono">output</span> 端点拉到本节点左侧
        <span className="text-orange-600 font-medium"> Config </span>
        端点。本节点作为终点，不再向下游输出。预览 / 下载按钮在节点本体上。
      </div>
    </div>
  );
}

/* ===================================================================
 * ManualTriggerEditor · 节点 · Manual Trigger
 *
 * 编辑项：
 *   - Label
 *   - Params Schema：复用 FlowVariable 形态，定义"运行时让用户填什么"
 *   - User Message Template：ReAct 模式下，用模板把 params 渲染成 user message
 *
 * Params 编辑器跟 FlowOverview 的 VariablesEditor 形态一致——但作用域不同：
 *   - flow.variables 是全局变量，所有节点都能引用
 *   - paramsSchema 仅用于"trigger 时让用户填的字段"，作为 trigger payload 的种子
 * 这里直接复用 VariableRow 控件就好，避免重复维护两套表单。
 * =================================================================== */
function ManualTriggerEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d =
    (node.data || { paramsSchema: [] }) as ManualTriggerNodeData;
  const schema = d.paramsSchema || [];

  function setSchema(next: FlowVariable[]) {
    onUpdateNodeData(node.id, { paramsSchema: next });
  }

  function addField() {
    let i = schema.length + 1;
    let name = `param_${i}`;
    const taken = new Set(schema.map((v) => v.name));
    while (taken.has(name)) {
      i += 1;
      name = `param_${i}`;
    }
    setSchema([...schema, { name, type: "string", defaultValue: "" }]);
  }

  function update(idx: number, patch: Partial<FlowVariable>) {
    setSchema(schema.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function remove(idx: number) {
    setSchema(schema.filter((_, i) => i !== idx));
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Manual Trigger" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <div className="rounded border bg-slate-50/60">
        <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Params Schema
          </span>
          <span className="text-[10px] text-slate-400">({schema.length})</span>
          <button
            type="button"
            onClick={addField}
            className="ml-auto text-[11px] text-brand-600 hover:text-brand-700 font-medium"
          >
            + 添加字段
          </button>
        </div>
        <div className="p-2 space-y-2">
          {schema.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic px-1">
              没有声明字段；运行时点 Run 直接以无参数任务启动。
            </div>
          ) : (
            schema.map((v, idx) => (
              <VariableRow
                key={idx}
                v={v}
                allNames={schema.map((x) => x.name).filter((_, i) => i !== idx)}
                onChange={(patch) => update(idx, patch)}
                onRemove={() => remove(idx)}
              />
            ))
          )}
        </div>
      </div>

      <Field label="User Message Template (ReAct)">
        <textarea
          className="w-full text-xs font-mono border rounded px-2 py-1"
          rows={3}
          value={d.userMessageTemplate ?? ""}
          placeholder={DEFAULT_USER_MESSAGE_TEMPLATES.manual}
          onChange={(e) =>
            onUpdateNodeData(node.id, { userMessageTemplate: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          ReAct 用：把结构化 params 渲染成一句话给 LLM。可用占位符
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.params.<name>}}`}</code>
          或
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.params|json}}`}</code>。
        </div>
      </Field>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        连接：把右侧的 output 端点拖到 LLM 的 <b>Input</b>
        端点（ReAct）；DAG 模式下由下游节点直接读 trigger.params。
      </div>
    </div>
  );
}

/* ===================================================================
 * ScheduleTriggerEditor · 节点 · Schedule Trigger
 *
 * 编辑项：
 *   - Label
 *   - cron / timezone / paramsJson
 *
 * 已删除字段（保留在 node.data 但 UI 不再展示）：
 *   - enabled            : Flow 级 isEnabled 已经覆盖"任务是否注册到调度器"语义；
 *                          节点级 enabled 重复且容易让人误以为是 cron 一次性开关
 *   - userMessageTemplate: 这是 ReAct (chat trigger) 的 LLM 渲染字段；
 *                          schedule 是 DAG-only 触发器，从不会走 ReAct 链路
 *                          → 留着只会误导用户写出 {{trigger.params|json}} 这种代码
 *
 * MVP 阶段不做 cron 实时解析（不引入 cronstrue 依赖），用一个静态 hint 提示
 * 5 字段格式即可；真要可视化解析等接入 master_data 阶段再加。
 * =================================================================== */
function ScheduleTriggerEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || { cron: "" }) as ScheduleTriggerNodeData;
  const paramsJson = d.paramsJson ?? "{}";
  // 浅校验 paramsJson 是否合法 JSON——错了在下方红字提示，不阻塞输入
  let paramsErr: string | null = null;
  if (paramsJson.trim()) {
    try {
      JSON.parse(paramsJson);
    } catch (e) {
      paramsErr = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Schedule Trigger" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field label="Cron Expression">
        <input
          className="w-full text-sm font-mono border rounded px-2 py-1"
          value={d.cron || ""}
          placeholder="0 9 * * 1-5"
          onChange={(e) => onUpdateNodeData(node.id, { cron: e.target.value })}
        />
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          5 字段 unix cron：分 时 日 月 周。例
          <code className="bg-slate-100 px-1 mx-0.5 rounded">0 9 * * 1-5</code>
          = 周一到周五 09:00。
        </div>
      </Field>

      <Field label="Timezone">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.timezone || "Asia/Shanghai"}
          placeholder="Asia/Shanghai"
          onChange={(e) =>
            onUpdateNodeData(node.id, { timezone: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">
          IANA 时区名（如 <code>Asia/Shanghai</code> / <code>UTC</code>）。
        </div>
      </Field>

      <Field label="Params (JSON)">
        <textarea
          className={
            "w-full text-xs font-mono border rounded px-2 py-1 " +
            (paramsErr ? "border-rose-400" : "border-slate-300")
          }
          rows={3}
          value={paramsJson}
          placeholder='{"region": "cn"}'
          onChange={(e) =>
            onUpdateNodeData(node.id, { paramsJson: e.target.value })
          }
        />
        {paramsErr && (
          <div className="text-[11px] text-rose-600 mt-1">
            JSON 解析失败：{paramsErr}
          </div>
        )}
        <div className="text-[11px] text-slate-500 mt-1">
          调度器每次拉起带的固定 params。用户运行时不能改——要动态用 manual。
        </div>
      </Field>

    </div>
  );
}

/* ===================================================================
 * WebhookTriggerEditor · 节点 · Webhook Trigger
 *
 * 编辑项：
 *   - Label
 *   - auth (none / bearer / hmac)
 *   - User Message Template
 *   只读展示：path / curl 示例
 *
 * MVP 阶段 path 是 `POST /webhooks/{flow.id}` 的占位——真实路由由 master_data
 * 阶段 3 接入；token 同理。
 * =================================================================== */
function WebhookTriggerEditor({
  node,
  flow,
  onUpdateNodeData,
}: {
  node: Node;
  flow: Flow;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as WebhookTriggerNodeData;
  const auth = d.auth || "none";
  const method = d.method || "POST";
  const fullUrl = `${WEBHOOK_PUBLIC_URL}/webhooks/${flow.id}`;
  const path = `${method} ${fullUrl}`;
  // cURL 示例按 method 切换：POST 用 -d / GET 用 ?key=value；URL 来自 publicConfig，dev 默认 9730
  const curlExample =
    method === "POST"
      ? [
          `curl -X POST ${fullUrl} \\`,
          `  -H "Content-Type: application/json" \\`,
          auth === "bearer" ? `  -H "Authorization: Bearer <token>" \\` : null,
          `  -d '{"hello": "world"}'`,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `curl "${fullUrl}?id=1&foo=bar" \\`,
          auth === "bearer" ? `  -H "Authorization: Bearer <token>"` : null,
        ]
          .filter(Boolean)
          .join("\n");

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Webhook Trigger" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="Method"
        hint="HTTP 方法 · POST 时下游参数从 trigger.body 取；GET 时从 trigger.query 取。flow_engine 同时挂载了两种方法的路由，这里的选择只决定语义对齐。"
      >
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={method}
          onChange={(e) => onUpdateNodeData(node.id, { method: e.target.value })}
        >
          <option value="POST">POST · 参数来自请求 body</option>
          <option value="GET">GET · 参数来自 URL query</option>
        </select>
      </Field>

      <Field label="Endpoint (auto)">
        <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 break-all">
          {path}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          路径由 master_data 按 flow.id 注册（接入后即生效）。
        </div>
      </Field>

      <Field label="Auth">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={auth}
          onChange={(e) => onUpdateNodeData(node.id, { auth: e.target.value })}
        >
          <option value="none">none · 无校验（仅内部测试用）</option>
          <option value="bearer">bearer · Authorization: Bearer &lt;token&gt;</option>
          <option value="hmac">hmac · 请求头签名（待实现）</option>
        </select>
        {auth === "hmac" && (
          <div className="text-[11px] text-amber-700 mt-1">
            HMAC 模式 master_data 阶段 3 才接通；保存了但调用会按 none 处理。
          </div>
        )}
      </Field>

      <Field label="cURL 示例">
        <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 rounded px-2 py-1.5 leading-snug whitespace-pre overflow-x-auto">
          {curlExample}
        </pre>
      </Field>

      <Field label="User Message Template (ReAct)">
        <textarea
          className="w-full text-xs font-mono border rounded px-2 py-1"
          rows={3}
          value={d.userMessageTemplate ?? ""}
          placeholder={DEFAULT_USER_MESSAGE_TEMPLATES.webhook}
          onChange={(e) =>
            onUpdateNodeData(node.id, { userMessageTemplate: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          ReAct 用：可用
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.body|json}}`}</code>
          /
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.body.<field>}}`}</code>。
        </div>
      </Field>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 leading-relaxed">
        提示：webhook 路由 / token 持久化在 <b>master_data</b>{" "}
        接入后才会真正生效。当前阶段保存到 flow，作为图结构与配置占位。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * FileInputEditor · 节点 · File Input
 *
 * 编辑项：Label / Accept MIME / Max Bytes / Multiple / Parse As
 * 这些字段直接对齐 FileInputNodeData，保存即写。
 *
 * 已实装场景：节点 output 连到 LLM input + ChatInput → LLM input 同时存在时，
 * Chat 面板会展示附件 picker。约束（accept / maxBytes / multiple / parseAs）
 * 由本编辑器收集，运行时 ChatPanel 直接读取。
 * =================================================================== */
function FileInputEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as FileInputNodeData;
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="File Input" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field label="Accept MIME">
        <input
          className="w-full text-sm font-mono border rounded px-2 py-1"
          value={d.acceptMime || ""}
          placeholder="text/*,application/pdf"
          onChange={(e) =>
            onUpdateNodeData(node.id, { acceptMime: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">
          逗号分隔的 MIME 通配；空 = 不限。例 <code>text/*,application/json</code>
        </div>
      </Field>

      <Field label="Max bytes (单文件)">
        <input
          type="number"
          min={0}
          className="w-full text-sm border rounded px-2 py-1"
          value={d.maxBytes ?? 0}
          onChange={(e) =>
            onUpdateNodeData(node.id, {
              maxBytes: parseInt(e.target.value || "0", 10),
            })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">
          0 = 不限。例 1048576 = 1 MB。
        </div>
      </Field>

      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={!!d.multiple}
          onChange={(e) =>
            onUpdateNodeData(node.id, { multiple: e.target.checked })
          }
        />
        <span>允许多文件</span>
      </label>

      <Field label="Parse As">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={d.parseAs || "raw"}
          onChange={(e) => onUpdateNodeData(node.id, { parseAs: e.target.value })}
        >
          <option value="raw">raw · 原始 base64 / binary</option>
          <option value="text">text · UTF-8 解码后的字符串</option>
          <option value="chunks">chunks · rag_engine 切块器（按 KB 默认参数）</option>
        </select>
      </Field>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 leading-relaxed">
        提示：
        <br />
        · Chat 场景：节点 output 连到 LLM input 时（且画布上有 Chat Input）→
        聊天框出现附件 picker；发送时文件按 parseAs 拼进 user message。
        <br />
        · DAG 场景：真正落到下游 DAG 节点需要 flow_engine 的 DAG 引擎接通；当前
        阶段仅保存字段。
      </div>
    </div>
  );
}

/* ===================================================================
 * UploadEditor · 节点 · Upload Excel
 *
 * 表格类静态数据源的配置面板。两件事：
 *   1) 让用户选 / 替换文件（accept 只放 xlsx/xls/csv 等）；
 *   2) 解析后展示"sheet 名 → 行预览"，并让用户选一个 activeSheet 作为下游
 *      "单表消费节点"（Transform 预览等）的默认 sheet。
 *
 * 解析逻辑全部走 lib/excelParse.ts（动态 import 'xlsx'），跟 Transform 探针共享，
 * 避免行为漂移。
 *
 * 文件本体不进 node.data，存进 useFlowRuntime.flow.testFiles[id]，
 * 跟画布节点的"选择文件"按钮共用一份 state——画布上换文件、配置区立即看到。
 * =================================================================== */
function UploadEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as UploadNodeData;
  const files = useFlowRuntime((s) => s.flow.testFiles[node.id]) || [];
  const setTestFiles = useFlowRuntime((s) => s.setTestFiles);

  const file = files[0]; // Upload Excel 只用一个文件
  const [parsed, setParsed] = useState<ExcelParseResult | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传态：idle / uploading / error。成功的标志是 d.fileUrl 被写入，所以不另存 success 态。
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // "预览加载"态：用户点 Preview 按钮触发；fetch 完成后 testFiles 被写入，
  // 下面的解析 effect 自然跑起来。
  // ——为什么不自动 rehydrate：打开旧 flow 时，d.fileUrl 通常是几 MB 的远端 Excel，
  // 静默 fetch 浪费带宽且阻塞首屏；改成显式点击更可控。Run 节点时 dagSimulators.simUpload
  // 仍会按 fileUrl 兜底拉文件，不影响实际执行。
  const [loading, setLoading] = useState(false);
  async function loadFromUrl() {
    if (!d.fileUrl || loading) return;
    setLoading(true);
    setParseErr(null);
    try {
      const f = await fetchUploadedFile(
        d.fileUrl,
        d.fileName || "uploaded.bin",
      );
      setTestFiles(node.id, [f]);
    } catch (e) {
      setParseErr(
        `已落库文件无法下载（${e instanceof Error ? e.message : String(e)}）；可重新选择文件。`,
      );
    } finally {
      setLoading(false);
    }
  }

  // 文件改变 → 重新解析。带 cancel 标志防 unmount / 快速切文件时拿旧结果。
  useEffect(() => {
    if (!file) {
      setParsed(null);
      // 没文件不清 parseErr——可能正是 loadFromUrl 报的错（远端文件下载失败），
      // 要继续给用户看；下次选新文件 / 重试预览时再清。
      return;
    }
    let cancelled = false;
    setParsing(true);
    setParseErr(null);
    parseExcelFile(file)
      .then((res) => {
        if (cancelled) return;
        setParsed(res);
        // activeSheet 校正：如果不在当前文件的 sheet 列表里，自动落到首个 sheet
        if (!d.activeSheet || !res.sheetNames.includes(d.activeSheet)) {
          onUpdateNodeData(node.id, { activeSheet: res.sheetNames[0] });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setParsed(null);
        setParseErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setParsing(false);
      });
    return () => {
      cancelled = true;
    };
    // 仅依赖 file 引用与 node.id；activeSheet 校正用闭包里的当前值即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, node.id]);

  /** 把刚选/刚补传的 File 推到 master_data，把 URL 等元信息写回 node.data。 */
  async function persistFile(f: File) {
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const info = await uploadFile(f);
      onUpdateNodeData(node.id, {
        fileUrl: info.url,
        fileName: info.originalName || f.name,
        fileSize: info.size || f.size,
        fileType: info.type || f.type,
        uploadedAt: new Date().toISOString(),
      });
      setUploadStatus("idle");
    } catch (e) {
      setUploadStatus("error");
      setUploadError(e instanceof Error ? e.message : String(e));
    }
  }

  function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const accepted = Array.from(list).filter((f) => isExcelLikeFilename(f.name));
    if (accepted.length === 0) {
      setParseErr(
        `不支持的文件类型，仅支持 ${EXCEL_ACCEPT_EXTENSIONS.join(" / ")}`,
      );
      return;
    }
    const picked = accepted[0];
    // 旧 URL 立刻作废：避免 webhook 拿到的还是上一份文件
    onUpdateNodeData(node.id, {
      activeSheet: undefined,
      fileUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      uploadedAt: undefined,
    });
    setTestFiles(node.id, [picked]);
    void persistFile(picked);
  }

  function clearFile() {
    setTestFiles(node.id, []);
    onUpdateNodeData(node.id, {
      activeSheet: undefined,
      fileUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      uploadedAt: undefined,
    });
    setParsed(null);
    setParseErr(null);
    setUploadStatus("idle");
    setUploadError(null);
  }

  /** 用户点"重试上传"：内存有 file、d.fileUrl 缺失时可用。 */
  async function retryUpload() {
    if (!file) return;
    await persistFile(file);
  }

  const activeSheet =
    d.activeSheet && parsed?.sheets[d.activeSheet]
      ? d.activeSheet
      : parsed?.sheetNames[0];
  const activeRows = activeSheet ? parsed?.sheets[activeSheet] : undefined;

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Upload Excel" nodeId={node.id} />

      <Field
        label="Label"
        hint="可选展示名；不填用默认 'Upload Excel'。"
      >
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="Upload Excel"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="File"
        hint={`仅接受 ${EXCEL_ACCEPT_EXTENSIONS.join(" / ")}。CSV/TSV 视为单 sheet。`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={EXCEL_ACCEPT_ATTR}
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
        {file || d.fileUrl ? (
          // 文件行的两种来源：
          //   1) file（本地内存里的 File 对象）—— 刚选 / 刚预览加载完成
          //   2) d.fileUrl（已落库但浏览器内存还没拉回来）—— 打开旧 flow 时
          // 字段优先级：file 的属性 > node.data 里持久化的属性
          (() => {
            const displayName = file?.name ?? d.fileName ?? "—";
            const displaySize = file?.size ?? d.fileSize ?? 0;
            const isStoredOnly = !file && !!d.fileUrl;
            return (
              <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                <div className="min-w-0 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-slate-800" title={displayName}>
                      {displayName}
                    </div>
                    {uploadStatus === "uploading" && (
                      <span className="text-[10px] text-amber-600 shrink-0">
                        上传中…
                      </span>
                    )}
                    {uploadStatus === "idle" && d.fileUrl && (
                      <span className="text-[10px] text-emerald-600 shrink-0">
                        已落库
                      </span>
                    )}
                    {uploadStatus === "idle" && !d.fileUrl && file && (
                      <span className="text-[10px] text-rose-600 shrink-0">
                        仅本地
                      </span>
                    )}
                    {uploadStatus === "error" && (
                      <span className="text-[10px] text-rose-600 shrink-0">
                        上传失败
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {(displaySize / 1024).toFixed(1)} KB
                    {parsed
                      ? ` · ${parsed.sheetNames.length} sheet${
                          parsed.sheetNames.length > 1 ? "s" : ""
                        }`
                      : parsing
                        ? " · 解析中…"
                        : loading
                          ? " · 加载中…"
                          : isStoredOnly
                            ? " · 未加载"
                            : ""}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {/* "预览"按钮：仅在文件已落库但浏览器还没拉回来时出现。
                       点击后从 d.fileUrl 拉 Blob → 写入 testFiles → 触发解析 effect → 预览表自动出现。
                       拉成功后本按钮自然消失（file 变 truthy）。 */}
                  {isStoredOnly && (
                    <button
                      type="button"
                      className="text-[11px] rounded border border-purple-300 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 text-purple-800 disabled:opacity-60"
                      onClick={() => void loadFromUrl()}
                      disabled={loading}
                      title="从 master_data 拉回文件并展开预览"
                    >
                      {loading ? "加载中…" : "预览"}
                    </button>
                  )}
                  {uploadStatus === "error" && (
                    <button
                      type="button"
                      className="text-[11px] rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 text-amber-800"
                      onClick={() => void retryUpload()}
                    >
                      重试上传
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[11px] rounded border border-slate-200 hover:border-purple-400 hover:bg-purple-50 px-2 py-0.5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    更换
                  </button>
                  <button
                    type="button"
                    className="text-[11px] rounded border border-slate-200 hover:border-rose-400 hover:bg-rose-50 px-2 py-0.5 text-rose-700"
                    onClick={clearFile}
                  >
                    移除
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <button
            type="button"
            className="w-full text-xs rounded border border-dashed border-slate-300 hover:border-purple-400 hover:bg-purple-50 px-2 py-3 text-slate-600"
            onClick={() => fileInputRef.current?.click()}
          >
            选择文件 ·{" "}
            <span className="text-slate-400">
              {EXCEL_ACCEPT_EXTENSIONS.join(" / ")}
            </span>
          </button>
        )}
        {parseErr && (
          <div className="mt-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {parseErr}
          </div>
        )}
        {uploadError && (
          <div className="mt-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            上传失败：{uploadError}
          </div>
        )}
        {d.fileUrl && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
            <span className="text-slate-400 shrink-0">URL</span>
            <a
              href={d.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sky-700 hover:underline flex-1"
              title={d.fileUrl}
            >
              {d.fileUrl}
            </a>
            <CopyButton text={d.fileUrl} />
          </div>
        )}
      </Field>

      {parsed && parsed.sheetNames.length > 0 && (
        <Field
          label={`Sheets · ${parsed.sheetNames.length}`}
          hint="选中的 sheet 作为默认 sheet：下游 Transform 预览、Code 节点 `{{<id>.<sheet>}}` 模板都默认用它。"
        >
          <div className="flex flex-wrap gap-1">
            {parsed.sheetNames.map((name) => {
              const active = name === activeSheet;
              const rowCount = parsed.sheets[name]?.length ?? 0;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    onUpdateNodeData(node.id, { activeSheet: name })
                  }
                  className={
                    "text-[11px] rounded px-2 py-0.5 border " +
                    (active
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:border-purple-400")
                  }
                  title={`${rowCount} 行`}
                >
                  {name}
                  <span
                    className={
                      "ml-1 text-[10px] " +
                      (active ? "text-purple-100" : "text-slate-400")
                    }
                  >
                    {rowCount}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {activeRows && activeSheet && (
        <SheetPreviewTable rows={activeRows} sheetName={activeSheet} />
      )}

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 leading-relaxed">
        <b>输出契约</b>：本节点 output 形如{" "}
        <code className="bg-white border px-1 rounded">
          {"{ <sheetName>: Row[] }"}
        </code>
        ；CSV/TSV 用 <code className="bg-white border px-1 rounded">Sheet1</code>{" "}
        作为唯一 sheet 名。
        <br />
        <b>落库</b>：选好文件后会调{" "}
        <code className="bg-white border px-1 rounded">/api/upload</code>{" "}
        把文件存到 master_data，URL 写入节点 data；webhook / 定时任务 / 跨机器协作时
        flow_engine 直接按这个 URL 拉文件。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/** Upload Excel 的内嵌数据预览。
 *
 *  行 cap 10、列 cap 12——预览要的是"瞄一眼对不对"，不是完整数据浏览器；
 *  量大了既掉帧又抢右栏空间。下游 Transform 节点有更全的预览能力，那边再看完整数据。
 */
function SheetPreviewTable({
  rows,
  sheetName,
}: {
  rows: Row[];
  sheetName: string;
}) {
  const PREVIEW_ROWS = 10;
  const PREVIEW_COLS = 12;

  if (rows.length === 0) {
    return (
      <Field label={`Preview · ${sheetName}`}>
        <div className="text-[11px] text-slate-500 italic px-2 py-2 border border-dashed border-slate-200 rounded">
          该 sheet 为空（0 行）。
        </div>
      </Field>
    );
  }

  // 收集所有列名（保持出现顺序），cap 到 PREVIEW_COLS
  const colSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) colSet.add(k);
    if (colSet.size >= PREVIEW_COLS) break;
  }
  const cols = Array.from(colSet).slice(0, PREVIEW_COLS);
  const colsTruncated = colSet.size > PREVIEW_COLS;
  const visible = rows.slice(0, PREVIEW_ROWS);

  return (
    <Field
      label={`Preview · ${sheetName}`}
      hint={`显示前 ${Math.min(PREVIEW_ROWS, rows.length)} / ${rows.length} 行${
        colsTruncated ? `，仅前 ${PREVIEW_COLS} 列` : ""
      }。完整数据交给下游 Transform / Code 节点处理。`}
    >
      <div className="border border-slate-200 rounded overflow-auto max-h-64">
        <table className="text-[11px] w-full border-collapse">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left font-medium text-slate-600 px-2 py-1 border-b border-slate-200 whitespace-nowrap"
                  title={c}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
              >
                {cols.map((c) => (
                  <td
                    key={c}
                    className="px-2 py-1 border-b border-slate-100 text-slate-700 whitespace-nowrap max-w-[160px] truncate"
                    title={formatCell(row[c])}
                  >
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PREVIEW_ROWS && (
        <div className="mt-1 text-[10px] text-slate-400">
          … 还有 {rows.length - PREVIEW_ROWS} 行未显示
        </div>
      )}
    </Field>
  );
}


/* ===================================================================
 * HttpRequestEditor · 节点 · HTTP Request
 *
 * 编辑项：method / url / headers (KV) / queryParams (KV) / bodyType / body / timeout
 *
 * KV 编辑器是个轻量子组件 KvRows——前端没用 react-hook-form 之类的框架，
 * 直接在状态对象上做不可变更新，简单够用。
 * =================================================================== */
function HttpRequestEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d =
    (node.data || { method: "GET", url: "" }) as HttpRequestNodeData;
  const bodyType = d.bodyType || "none";
  // body 是否合法 JSON——bodyType=json 时给红字提示，不阻塞输入
  let bodyJsonErr: string | null = null;
  if (bodyType === "json" && (d.body ?? "").trim()) {
    try {
      JSON.parse(d.body!);
    } catch (e) {
      bodyJsonErr = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="HTTP Request" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-[80px_1fr] gap-2">
        <Field label="Method">
          <select
            className="w-full text-sm border rounded px-1 py-1 bg-white"
            value={d.method || "GET"}
            onChange={(e) =>
              onUpdateNodeData(node.id, { method: e.target.value })
            }
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </Field>
        <Field label="URL">
          <input
            className="w-full text-sm font-mono border rounded px-2 py-1"
            value={d.url || ""}
            placeholder="https://api.example.com/v1/items"
            onChange={(e) => onUpdateNodeData(node.id, { url: e.target.value })}
          />
        </Field>
      </div>
      <div className="text-[11px] text-slate-500 -mt-2">
        URL / headers / body 支持
        <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.xxx}}`}</code>
        /
        <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{<上游>.xxx}}`}</code>
        模板插值（DAG 引擎那边渲染）。
      </div>

      <KvRows
        title="Headers"
        rows={d.headers || {}}
        onChange={(next) => onUpdateNodeData(node.id, { headers: next })}
      />

      <KvRows
        title="Query Params"
        rows={d.queryParams || {}}
        onChange={(next) => onUpdateNodeData(node.id, { queryParams: next })}
      />

      <Field label="Body Type">
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={bodyType}
          onChange={(e) =>
            onUpdateNodeData(node.id, { bodyType: e.target.value })
          }
        >
          <option value="none">none · 不发 body</option>
          <option value="json">json · JSON 对象</option>
          <option value="form">form · application/x-www-form-urlencoded</option>
          <option value="text">text · 纯文本</option>
        </select>
      </Field>

      {bodyType !== "none" && (
        <Field label="Body">
          <textarea
            className={
              "w-full text-xs font-mono border rounded px-2 py-1 " +
              (bodyJsonErr ? "border-rose-400" : "border-slate-300")
            }
            rows={5}
            value={d.body || ""}
            placeholder={
              bodyType === "json"
                ? '{"key": "value"}'
                : bodyType === "form"
                ? "key1=value1&key2=value2"
                : "纯文本"
            }
            onChange={(e) => onUpdateNodeData(node.id, { body: e.target.value })}
          />
          {bodyJsonErr && (
            <div className="text-[11px] text-rose-600 mt-1">
              JSON 解析失败：{bodyJsonErr}
            </div>
          )}
        </Field>
      )}

      <Field label="Timeout (ms)">
        <input
          type="number"
          min={0}
          className="w-full text-sm border rounded px-2 py-1"
          value={d.timeoutMs ?? 0}
          onChange={(e) =>
            onUpdateNodeData(node.id, {
              timeoutMs: parseInt(e.target.value || "0", 10),
            })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">0 = 默认（30s）</div>
      </Field>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * SqlEditor · 节点 · SQL（v2 · Connection 引用模式）
 *
 * 不再在节点内编辑 host/port/credential——这些迁到了独立的 Connection 资产
 * （/connections 页面 + master_data 加密落库）。本节点只关心：
 *
 *   - 选哪个 connectionId（下拉，带"新建连接"快捷链接）
 *   - mode = table（自动 SELECT * FROM <table>，配合 Tables 下拉）
 *     或 query（手写 SQL，可点 Preview 抽样跑一下）
 *   - timeoutMs
 *
 * Preview 走 BFF /api/connections/{id}/query；不写入任何状态，只在面板内
 * 展示一张简表（最多 200 行）。
 * =================================================================== */

function SqlEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || { connectionId: "", mode: "query" }) as SqlNodeData;
  const mode: "table" | "query" = d.mode === "table" ? "table" : "query";
  const { list, loading: listLoading, error: listError, refresh } =
    useConnections();
  const selectedConn = d.connectionId ? list.find((c) => c.id === d.connectionId) : undefined;

  // table 模式：拉表清单 + 列清单（懒加载）
  const [tables, setTables] = useState<Array<{ schema: string; name: string; type: string }>>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "table" || !d.connectionId) {
      setTables([]);
      setTablesError(null);
      return;
    }
    let alive = true;
    setTablesLoading(true);
    setTablesError(null);
    fetch(`/api/connections/${encodeURIComponent(d.connectionId)}/tables`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(String(body?.detail || r.statusText));
        }
        return r.json() as Promise<{ data: Array<{ schema: string; name: string; type: string }> }>;
      })
      .then((body) => {
        if (!alive) return;
        setTables(body?.data || []);
      })
      .catch((e) => {
        if (!alive) return;
        setTablesError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setTablesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, d.connectionId]);

  // Preview：用同一个端点，限 50 行
  const [preview, setPreview] = useState<{
    columns: string[];
    rows: Array<Record<string, unknown>>;
    elapsedMs: number;
    truncated: boolean;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  async function runPreview() {
    if (!d.connectionId) {
      setPreviewError("请先选择 Connection");
      return;
    }
    const sql =
      mode === "table"
        ? `SELECT * FROM ${d.table || "<table>"}`
        : (d.query || "").trim();
    if (!sql || sql.includes("<table>")) {
      setPreviewError(mode === "table" ? "请选择 / 输入 table 名" : "SQL 不能为空");
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    try {
      const r = await fetch(`/api/connections/${encodeURIComponent(d.connectionId)}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit: 50 }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(String(body?.detail || r.statusText));
      }
      const body = (await r.json()) as {
        columns: string[];
        rows: Array<Record<string, unknown>>;
        elapsedMs: number;
        truncated: boolean;
      };
      setPreview(body);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="SQL" nodeId={node.id} />

      <Field label="Label" hint="可选展示名；不填用默认 'SQL'。">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="SQL"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="Connection"
        hint="引用 /connections 页面里建好的连接；密码不在此处编辑，由 master_data 加密保存。"
      >
        <div className="flex items-center gap-2">
          <select
            className="flex-1 min-w-0 text-sm border rounded px-2 py-1 bg-white"
            value={d.connectionId || ""}
            onChange={(e) => onUpdateNodeData(node.id, { connectionId: e.target.value })}
          >
            <option value="">— 未选择 —</option>
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.kind}] {c.name}
                {c.isEnabled ? "" : " (停用)"}
              </option>
            ))}
          </select>
          <a
            href="/connections"
            target="_blank"
            rel="noopener"
            className="text-[11px] rounded border border-slate-200 hover:border-slate-400 px-2 py-1 text-slate-600 leading-none whitespace-nowrap"
            title="跳到连接管理页面"
          >
            管理…
          </a>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={listLoading}
            className="text-[11px] rounded border border-slate-200 hover:border-slate-400 px-2 py-1 text-slate-600 leading-none disabled:opacity-50"
            title="重新拉取连接列表"
          >
            {listLoading ? "…" : "↻"}
          </button>
        </div>
        {listError ? (
          <div className="text-[11px] text-rose-600 mt-1">{listError}</div>
        ) : selectedConn ? (
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {selectedConn.kind} · {selectedConn.host}
            {selectedConn.port ? `:${selectedConn.port}` : ""}
            {selectedConn.kind === "oracle"
              ? selectedConn.serviceName
                ? ` / ${selectedConn.serviceName}`
                : ""
              : selectedConn.database
                ? ` / ${selectedConn.database}`
                : ""}
            {" · "}
            {selectedConn.username}
          </div>
        ) : (
          <div className="text-[11px] text-slate-400 mt-1">
            未选连接 · 在 <code className="bg-slate-100 rounded px-1">/connections</code> 新建后回到这里选择。
          </div>
        )}
      </Field>

      <Field label="Mode" hint="table = 自动 SELECT *；query = 手写 SQL。">
        <div className="inline-flex rounded border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => onUpdateNodeData(node.id, { mode: "table" })}
            className={`px-2 py-1 text-xs ${mode === "table" ? "bg-slate-200 text-slate-900" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => onUpdateNodeData(node.id, { mode: "query" })}
            className={`px-2 py-1 text-xs border-l border-slate-200 ${mode === "query" ? "bg-slate-200 text-slate-900" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Query
          </button>
        </div>
      </Field>

      {mode === "table" ? (
        <Field label="Table" hint="可手填，也可从拉取的清单里选；MSSQL 接受 schema.table 形式。">
          <div className="flex items-center gap-2">
            <input
              className="flex-1 min-w-0 text-sm font-mono border rounded px-2 py-1"
              value={d.table || ""}
              placeholder={selectedConn?.kind === "mssql" ? "dbo.users" : "users"}
              onChange={(e) => onUpdateNodeData(node.id, { table: e.target.value })}
            />
            <select
              className="text-xs border rounded px-2 py-1 bg-white max-w-[140px]"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) onUpdateNodeData(node.id, { table: v });
              }}
              disabled={!d.connectionId || tablesLoading || tables.length === 0}
              title={
                tablesLoading
                  ? "加载中…"
                  : tablesError
                    ? tablesError
                    : tables.length === 0
                      ? "无可选 table"
                      : `${tables.length} 个 table / view`
              }
            >
              <option value="">
                {tablesLoading
                  ? "Loading…"
                  : tablesError
                    ? "Error"
                    : tables.length === 0
                      ? "(no tables)"
                      : `${tables.length} tables`}
              </option>
              {tables.map((t) => {
                const qualified =
                  t.schema && t.schema !== "dbo" && t.schema !== selectedConn?.username
                    ? `${t.schema}.${t.name}`
                    : t.name;
                return (
                  <option key={`${t.schema}.${t.name}`} value={qualified}>
                    {qualified}
                    {t.type === "view" ? "  (view)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          {tablesError ? (
            <div className="text-[11px] text-rose-600 mt-1">{tablesError}</div>
          ) : null}
        </Field>
      ) : (
        <Field
          label="Query"
          hint="SQL 语句。可用 :name 命名参数（v1 暂不支持模板插值；params 通过运行时上下文注入）。"
        >
          <textarea
            className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1"
            rows={6}
            value={d.query || ""}
            placeholder={"SELECT id, name FROM items WHERE id = :id"}
            onChange={(e) => onUpdateNodeData(node.id, { query: e.target.value })}
          />
        </Field>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={previewing || !d.connectionId}
          className="text-xs rounded border border-slate-300 hover:border-slate-500 px-2 py-1 disabled:opacity-50"
        >
          {previewing ? "Querying…" : "Preview (≤50 rows)"}
        </button>
        {previewError ? (
          <span className="text-[11px] text-rose-600 truncate">{previewError}</span>
        ) : preview ? (
          <span className="text-[11px] text-slate-500">
            {preview.rows.length} 行 · {preview.elapsedMs}ms
            {preview.truncated ? " · 已截断" : ""}
          </span>
        ) : null}
      </div>

      {preview ? (
        <div className="border border-slate-200 rounded overflow-auto max-h-72">
          <table className="text-[11px] font-mono w-full">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                {preview.columns.map((c) => (
                  <th
                    key={c}
                    className="text-left px-2 py-1 border-b border-slate-200 text-slate-700 font-semibold whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  {preview.columns.map((c) => (
                    <td
                      key={c}
                      className="px-2 py-1 align-top text-slate-700 max-w-[240px] truncate"
                    >
                      {formatCellValue(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Field label="Timeout (ms)">
        <input
          type="number"
          min={0}
          className="w-full text-sm border rounded px-2 py-1"
          value={d.timeoutMs ?? 0}
          onChange={(e) =>
            onUpdateNodeData(node.id, {
              timeoutMs: parseInt(e.target.value || "0", 10),
            })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">0 = 引擎默认（30s）</div>
      </Field>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 leading-relaxed">
        <b>输出契约</b>：执行结果是{" "}
        <code className="bg-white border px-1 rounded">{`{ columns, rows, rowCount, elapsedMs, truncated }`}</code>
        ；下游 Code / Transform / Response 直接读 <code className="bg-white border px-1 rounded">rows</code>。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

function formatCellValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** KV 编辑器：用对象（非数组）作为 model，避免重复 key 这种异常状态。
 *  追加新行通过一个临时 "newKey" 占位，提交时合并到 rows——保持简单实现。
 */
function KvRows({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(rows);

  function add() {
    let i = entries.length + 1;
    let key = `key_${i}`;
    while (key in rows) {
      i += 1;
      key = `key_${i}`;
    }
    onChange({ ...rows, [key]: "" });
  }

  function updateKey(oldKey: string, newKey: string) {
    if (newKey === oldKey) return;
    if (newKey === "" || newKey in rows) {
      // 拒绝重名 / 空键——直接放弃这次重命名（用户继续编辑就行）
      return;
    }
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(rows)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  }

  function updateValue(key: string, val: string) {
    onChange({ ...rows, [key]: val });
  }

  function remove(key: string) {
    const next = { ...rows };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {title}
        </span>
        <span className="text-[10px] text-slate-400">({entries.length})</span>
        <button
          type="button"
          onClick={add}
          className="ml-auto text-[11px] text-brand-600 hover:text-brand-700 font-medium"
        >
          + 添加
        </button>
      </div>
      <div className="p-2 space-y-1">
        {entries.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic px-1">
            （没有条目）
          </div>
        ) : (
          entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <input
                className="flex-1 min-w-0 text-xs font-mono border border-slate-200 rounded px-1.5 py-1"
                defaultValue={k}
                placeholder="key"
                onBlur={(e) => updateKey(k, e.target.value.trim())}
              />
              <input
                className="flex-1 min-w-0 text-xs font-mono border border-slate-200 rounded px-1.5 py-1"
                value={v}
                placeholder="value"
                onChange={(e) => updateValue(k, e.target.value)}
              />
              <button
                type="button"
                onClick={() => remove(k)}
                className="text-[11px] text-slate-400 hover:text-rose-600 px-1"
                title="删除"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ===================================================================
 * VariableEditor · 节点 · Global Variables
 *
 * 形态：托管全局变量的增删改 UI（直接复用 VariablesEditor）。
 *
 * 设计：变量管理只有一个真正的入口——这个节点的右侧编辑器。FlowOverview
 * （未选中节点时的面板）退化成只读概览。
 *
 * 节点本身不参与 DAG 执行（无 input / output handle），更不存任何变量数据
 * 到 node.data；变量都存在 flow.variables。
 * =================================================================== */
function VariableEditor({
  node,
  flow,
  onUpdateNodeData,
  onUpdateVariables,
}: {
  node: Node;
  flow: Flow;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  onUpdateVariables: (next: FlowVariable[]) => void;
}) {
  const d = (node.data || {}) as VariableNodeData;
  const variables = flow.variables || [];

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Global Variables" nodeId={node.id} />

      <Field
        label="Label"
        info="仅画布展示用的别名，不影响变量名本身。"
      >
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="Global Variables"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <VariablesEditor variables={variables} onChange={onUpdateVariables} />

      <div className="text-[11px] text-slate-500 leading-relaxed">
        变量在运行期通过隐式参数 / 模板访问：
        <code className="bg-slate-100 px-1 mx-0.5 rounded">vars["name"]</code>
        （Code 节点）·
        <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{var.name}}`}</code>
        （Response / If-Else / 其它模板字段）。
      </div>

      <div className="text-[11px] text-slate-400 leading-relaxed">
        节点本身不参与 DAG 执行，没有输入 / 输出端口；删掉它也不影响变量本体（变量
        始终随 flow 保存）。
      </div>
    </div>
  );
}

/* ===================================================================
 * CodeEditor · 节点 · Code
 *
 * 编辑项：Label / language (select) / code (大 textarea) / timeout
 *
 * 当前不引入 monaco / codemirror（依赖太重）；用 textarea + 等宽字体足够；
 * 真要语法高亮等 DAG 引擎接通后再装包。
 * =================================================================== */
function CodeEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d =
    (node.data || { language: "python", code: "" }) as CodeNodeData;
  const lang = d.language || "python";
  // 旧 flow 可能存了 language="javascript"——展示个提示让用户切回 python
  const isLegacyJs = lang === "javascript";
  // placeholder：一份完整可跑的示例，覆盖 4 个常用动作 + 4 个 trigger 的 action 分支
  //   ① 取触发节点参数（trigger.*）—— 按 trigger["action"] 分支，每种入口字段不同
  //   ② 取前置节点产物（inputs[<上游节点ID>]）—— 节点 ID 在右侧 PropertyPanel 顶部 "#xxx" 可复制
  //   ③ 取全局变量（vars.get(<name>)）—— 来自 flow.variables 的 defaultValue
  //   ④ 返回值即 outputData —— 下游节点用 inputs["<本节点ID>"] 读到这个返回值
  //
  // 选择"用一个端到端例子串起来"而不是"四段孤立片段"：
  //   - 用户清空 placeholder 后开始写代码，残留几行能跑通的逻辑比 4 个独立 snippet 更有参考价值
  //   - 一眼能看出 `inputs / trigger / vars / return` 四个名字如何协同
  // 缺点：用户得自己删模板代码，比"展开式注释指南"略多一步。权衡后选了前者。
  //
  // trigger 形态部分跟 flow_engine/core/nodes/{webhook,schedule,manual}_trigger.py 的输出
  // 严格对齐——任何后端 trigger 字段变动都要同步更新这里。
  // placeholder：完整可跑示例，覆盖 5 个隐式参数的典型用法
  //   ① trigger.*                    取触发节点参数（按 trigger["action"] 分支）
  //   ② prev / inputs[<id>]          取直接上游产物（单上游用 prev，多上游用 inputs）
  //   ③ flow.find("<node_id>")       取**间接祖先**节点产物（沿 edges 反向可达 + 已成功）
  //   ④ vars.get(<name>)             取全局变量（flow.variables 的 defaultValue）
  //   ⑤ return                       返回值即本节点 outputData，下游用 inputs["<本节点ID>"] 取
  //
  // 跟 flow_engine/core/nodes/code.py 的 _HOST_SCRIPT 严格对齐——后端隐式参数
  // 一旦变动（增删 prev / flow / dig 等），这里 placeholder 必须同步更新。
  const placeholder = [
    "# ========================================================",
    "# Code 节点速查（删掉这段开始写你的代码）",
    "#",
    "# 隐式参数（不用 import / 不用声明）：",
    "#   inputs  : dict —— {<上游节点ID>: <该节点 outputData>}  只含**直接**上游",
    "#   trigger : 入口节点产物，按 trigger['action'] 分支：",
    '#     "webhook"  POST  → trigger["body"], trigger["headers"], trigger["method"]',
    '#                GET   → trigger["query"], trigger["headers"], trigger["method"]',
    '#     "schedule"       → trigger["params"], trigger["schedule"]["cron" | "timezone"',
    '#                                                            | "scheduledAt" | "firedAt"]',
    '#     "manual"         → trigger["params"]',
    "#   vars    : dict —— 全局变量（flow.variables 里定义的 name→defaultValue）",
    '#   prev    : 直接上游恰好 1 个时的快捷别名 = inputs[<that_id>]；多 / 零上游为 None',
    '#   flow    : 跨拓扑取数；flow.find("<node_id>") → 该节点 outputData（必须是当前节点的',
    "#             祖先，且已成功跑过；非祖先 / 未跑 → None）。也支持 flow['<id>'] / id in flow",
    "#",
    "# 返回值：return 的内容即本节点 outputData，下游节点用 inputs['<本节点ID>'] 取",
    "# ========================================================",
    "",
    "# ① 取触发节点参数（跨 trigger 类型都能用的取 id 例子）",
    'action = (trigger or {}).get("action")',
    'if action == "webhook" and trigger.get("method") == "GET":',
    '    id_value = trigger.get("query", {}).get("id")',
    'elif action == "webhook":',
    '    id_value = trigger.get("body", {}).get("id")',
    "else:  # schedule / manual",
    '    id_value = trigger.get("params", {}).get("id")',
    "",
    "if not id_value:",
    '    return {"found": False, "error": "missing id"}',
    "",
    "# ② 取直接上游产物（最常用）",
    "#    单上游：直接用 prev（最常见，比 inputs[<id>] 短得多）",
    "#    多上游：必须用 inputs['<上游节点ID>']（节点 ID 见右侧顶部 #xxx，点击可复制）",
    "upstream_data = prev or {}",
    '# upload = inputs.get("upload_xxx") or {}    # 多上游时这样写',
    "",
    "# ③ 取间接祖先节点产物（跨多层 / 旁路数据源 / 分支后汇合时用）",
    "#    经典场景：upload → ifElse → 这里。上游 ifElse 不含 upload 的数据，",
    "#    但 upload 是祖先，flow.find 能直接抓到。",
    '# upload = flow.find("upload_xxx") or {}',
    "",
    "# ④ 取全局变量（不存在时 .get 返回 None 或默认值）",
    'api_url = vars.get("API_URL", "https://api.example.com")',
    "",
    "# ⑤ 业务逻辑（这里假设 upstream_data 是含 rows 列表的对象）",
    'for r in upstream_data.get("rows", []):',
    '    if str(r.get("id")) == str(id_value):',
    '        return {"found": True, "row": r, "api": api_url}',
    "",
    "# 返回值（dict / list / str / int / None 都可；datetime 会被自动转 str）",
    'return {"found": False, "row": {}}',
  ].join("\n");
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Code" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="Language"
        hint="Code 节点在 flow_engine 子进程沙箱里跑。v1 仅支持 Python——JS 路径已废弃（旧本地模拟器特有，跟生产 Python 沙箱不兼容）。"
      >
        <select
          className="w-full text-sm border rounded px-2 py-1 bg-white"
          value={lang}
          onChange={(e) =>
            onUpdateNodeData(node.id, { language: e.target.value })
          }
        >
          <option value="python">Python</option>
        </select>
        {isLegacyJs && (
          <div className="text-[11px] text-amber-700 mt-1 leading-relaxed">
            ⚠ 当前 language = <code>javascript</code>（旧 flow 残留），
            服务端不支持。请把代码改写为 Python，再点上方下拉切换保存。
          </div>
        )}
      </Field>

      <Field
        label="Code"
        hint="函数签名：def __user_fn__(inputs, trigger, vars, prev, flow) —— return 的值就是本节点 outputData。inputs 是 {上游节点ID: 它的 outputData}（仅直接上游）；prev 是单上游时的快捷别名（多/零上游为 None）；trigger 形态按 trigger['action'] 分支（webhook/schedule/manual）；flow.find('<id>') 跨拓扑查任意祖先节点产物。详见 placeholder 注释。"
      >
        <textarea
          className="w-full text-xs font-mono border rounded px-2 py-1 bg-slate-900 text-slate-100"
          rows={14}
          value={d.code || ""}
          placeholder={placeholder}
          onChange={(e) => onUpdateNodeData(node.id, { code: e.target.value })}
          spellCheck={false}
        />
      </Field>

      <Field
        label="Timeout (ms)"
        hint="子进程执行上限，超时直接 kill。0 / 留空 = 默认 5000ms；上限 60000ms（60s）。"
      >
        <input
          type="number"
          min={0}
          className="w-full text-sm border rounded px-2 py-1"
          value={d.timeoutMs ?? 0}
          onChange={(e) =>
            onUpdateNodeData(node.id, {
              timeoutMs: parseInt(e.target.value || "0", 10),
            })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1">0 = 默认 5000ms</div>
      </Field>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 leading-relaxed">
        提示：代码会在 flow_engine 启动的独立 Python 子进程里跑（主进程
        与文件系统不做隔离，dev 环境）。脚本里 <code>print()</code> 的内容
        会出现在 Runtime 面板的 [stdout] 区。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * IfElseEditor · 节点 · If / Else
 *
 * 编辑项：Label / condition (textarea)
 *
 * 不真 eval condition——前端只校验非空 + 长度合理；真值由 DAG 引擎那边
 * 用 jsonata / vm2 / sandbox eval 执行（设计未定）。
 * =================================================================== */
function IfElseEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || { condition: "" }) as IfElseNodeData;
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="If / Else" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field label="Condition">
        <textarea
          className="w-full text-xs font-mono border rounded px-2 py-1"
          rows={4}
          value={d.condition || ""}
          placeholder={`例：\n{{trigger.params.region}} == "cn"\n{{<上游 node id>.body.score}} > 0.8\n{{var.flag}} && {{trigger.params.x}}`}
          onChange={(e) =>
            onUpdateNodeData(node.id, { condition: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          表达式语法（DAG 引擎接入后真 eval）：模板占位符{" "}
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{xxx}}`}</code>
          + 比较运算符 <code>==</code> / <code>!=</code> / <code>&gt;</code> /{" "}
          <code>&lt;</code> + 逻辑 <code>&&</code> / <code>||</code>。
        </div>
      </Field>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        连接：节点右侧有<b className="text-emerald-700"> true </b>和
        <b className="text-rose-700"> false </b>
        两个 source handle，分别接到下游对应分支。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * SwitchEditor · 节点 · Switch
 *
 * v2 设计：每个 case 只编辑一个字段 `value`——它既是匹配值，也是画布上 source
 * handle 的 id。这样：
 *   - 用户只填一处，不再纠结"id 跟 value 有什么区别"
 *   - sourceHandle 跟 case.value 字面量永远对得上，没有"id 跟 value 漂移"问题
 *
 * 代价：改了 value 等价于改了这条分支的语义，已挂连线的 sourceHandle 也就对不上
 * → 边断开。编辑器在有连线时显示 ⚠ 黄字告警；用户决定继续就继续。
 *
 * 校验：
 *   - value 必须非空、不能跟保留字撞（input / output / default）
 *   - 同节点内 value 应当唯一；重复时只有第一条会被命中，UI 红字标后续重复项
 * =================================================================== */
const SWITCH_RESERVED_VALUES = new Set(["input", "output", "default"]);

function SwitchEditor({
  node,
  edges,
  onUpdateNodeData,
}: {
  node: Node;
  edges: Edge[];
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d =
    (node.data || { expression: "", cases: [] }) as SwitchNodeData;
  const cases = Array.isArray(d.cases) ? d.cases : [];

  function patchCases(next: SwitchCase[]) {
    onUpdateNodeData(node.id, { cases: next });
  }

  function addCase() {
    patchCases([...cases, { value: "" }]);
  }

  function updateCase(idx: number, patch: Partial<SwitchCase>) {
    patchCases(cases.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCase(idx: number) {
    patchCases(cases.filter((_, i) => i !== idx));
  }

  /** 当前挂在某个 value 上的边数——用作"改值会断 N 条线"的告警 */
  function outgoingCount(caseValue: string): number {
    if (!caseValue) return 0;
    return edges.filter(
      (e) => e.source === node.id && e.sourceHandle === caseValue,
    ).length;
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Switch" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="Expression"
        info='主表达式；运行期解析后跟每个 case 的值做字符串等值匹配。推荐写单个 {{...}} 占位，例如 {{trigger.params.region}}。'
      >
        <textarea
          className="w-full text-xs font-mono border rounded px-2 py-1"
          rows={2}
          value={d.expression || ""}
          placeholder="{{trigger.params.region}}"
          onChange={(e) =>
            onUpdateNodeData(node.id, { expression: e.target.value })
          }
        />
        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          支持{" "}
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{trigger.x}}`}</code>{" "}
          /{" "}
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{var.x}}`}</code>{" "}
          /{" "}
          <code className="bg-slate-100 px-1 mx-0.5 rounded">{`{{<上游>.x}}`}</code>
          。
        </div>
      </Field>

      <div className="rounded border bg-slate-50/60">
        <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Cases
          </span>
          <span className="text-[10px] text-slate-400">({cases.length})</span>
          <button
            type="button"
            onClick={addCase}
            className="ml-auto text-[11px] text-brand-600 hover:text-brand-700 font-medium"
          >
            + 添加
          </button>
        </div>
        <div className="p-2 space-y-2">
          {cases.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic px-1">
              还没有 case。点 + 添加，填写匹配值。
            </div>
          ) : (
            cases.map((c, idx) => {
              const v = (c.value || "").trim();
              const isEmpty = !v;
              const isReserved = SWITCH_RESERVED_VALUES.has(v);
              const isDup =
                !isEmpty &&
                cases.findIndex(
                  (x, i) => i !== idx && (x.value || "").trim() === v,
                ) !== -1 &&
                cases.findIndex(
                  (x) => (x.value || "").trim() === v,
                ) !== idx;
              const valueError = isEmpty
                ? "请填匹配值（空 case 不会被命中，也不会渲染连线端点）"
                : isReserved
                ? `不能用保留字（${[...SWITCH_RESERVED_VALUES].join(" / ")}）`
                : isDup
                ? "与上面的 case 同值，本行不会被命中（首个匹配胜出）"
                : null;
              const outEdges = outgoingCount(c.value || "");
              return (
                <div
                  key={idx}
                  className="rounded border bg-white p-2 space-y-1.5"
                >
                  <div className="flex items-center gap-1">
                    <input
                      className={
                        "flex-1 text-xs font-mono border rounded px-1.5 py-1 " +
                        (valueError && !isDup
                          ? "border-rose-400"
                          : isDup
                          ? "border-amber-400"
                          : "border-slate-200")
                      }
                      value={c.value}
                      placeholder='匹配值（如 cn / "cn" / 200 / {{var.x}}）'
                      onChange={(e) =>
                        updateCase(idx, { value: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removeCase(idx)}
                      className="text-[11px] text-slate-400 hover:text-rose-600 px-1"
                      title={
                        outEdges > 0
                          ? `删除 case · 注意：当前有 ${outEdges} 条下游连接挂在这个 handle 上，删了会一起断开`
                          : "删除 case"
                      }
                    >
                      ×
                    </button>
                  </div>
                  {valueError && (
                    <div
                      className={
                        "text-[11px] " +
                        (isDup ? "text-amber-700" : "text-rose-600")
                      }
                    >
                      {valueError}
                    </div>
                  )}
                  {outEdges > 0 && (
                    <div className="text-[11px] text-amber-700">
                      ⚠ 已有 {outEdges} 条下游连接；修改 value 或删除会断开它们
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        连接：每个 case 在画布右侧对应一个 source handle（id = case.value
        字面量）；底部固定有个{" "}
        <b className="text-amber-700">default</b> handle，所有 case
        都未命中时走它。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * ResponseEditor · 节点 · Response
 *
 * 编辑项：Label / statusCode / bodyTemplate (JSON 模板) / headers
 *
 * - statusCode：select 几个常见档位 + 自定义数字框。语义：HTTP 返回码
 * - bodyTemplate：JSON 模板，支持 `{{trigger.x}}` / `{{<上游 node id>.foo}}`
 *   / `{{var.flag}}`。前端只做"非空 JSON 解析"轻校验（把模板里的占位先替换成
 *   一个无害 token 再 JSON.parse），失败时给红字提示，不阻塞用户输入。
 * - headers：复用 KvRows；引擎默认会加 Content-Type: application/json
 * =================================================================== */
const RESPONSE_STATUS_PRESETS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 200, label: "200 · OK" },
  { value: 201, label: "201 · Created" },
  { value: 204, label: "204 · No Content" },
  { value: 400, label: "400 · Bad Request" },
  { value: 401, label: "401 · Unauthorized" },
  { value: 403, label: "403 · Forbidden" },
  { value: 404, label: "404 · Not Found" },
  { value: 500, label: "500 · Internal Server Error" },
];

function ResponseEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as ResponseNodeData;
  const status = d.statusCode ?? 200;
  const isPreset = RESPONSE_STATUS_PRESETS.some((p) => p.value === status);

  // 把 bodyTemplate 里的 `{{xxx}}` 占位先替换成一个无害的 JSON-safe token，
  // 再尝试 JSON.parse。这样可以在用户还没填真值时也能粗略校验"模板自身的
  // 大括号 / 逗号 / 引号有没有写歪"。失败只显示红字，不阻塞输入。
  let bodyJsonErr: string | null = null;
  const tpl = (d.bodyTemplate ?? "").trim();
  if (tpl) {
    try {
      JSON.parse(tpl.replace(/\{\{[^}]+\}\}/g, '"__placeholder__"'));
    } catch (e) {
      bodyJsonErr = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Response" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <Field
        label="Status Code"
        hint="HTTP 返回码。常见 200/201/400/404/500；选择 Custom 后可填任意 100~599 的数字。"
      >
        <div className="flex gap-2">
          <select
            className="flex-1 text-sm border rounded px-2 py-1 bg-white"
            value={isPreset ? String(status) : "__custom__"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                // 切到自定义：保留当前值，让用户改右边的数字
                return;
              }
              onUpdateNodeData(node.id, { statusCode: Number(v) });
            }}
          >
            {RESPONSE_STATUS_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="__custom__">Custom · 自定义</option>
          </select>
          <input
            type="number"
            min={100}
            max={599}
            className="w-20 text-sm font-mono border rounded px-2 py-1 text-center"
            value={status}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onUpdateNodeData(node.id, { statusCode: Math.round(n) });
            }}
          />
        </div>
      </Field>

      <Field
        label="Body Template"
        hint={
          "JSON 模板，支持 mustache 风格占位：\n" +
          "  {{trigger.x}}            当次触发负载\n" +
          "  {{<上游 node id>.foo}}    上游节点输出\n" +
          "  {{var.flag}}             flow 全局变量\n" +
          "渲染后必须是合法 JSON；引擎自动加 Content-Type: application/json。"
        }
      >
        <textarea
          className={
            "w-full text-xs font-mono border rounded px-2 py-1 " +
            (bodyJsonErr ? "border-rose-400" : "border-slate-300")
          }
          rows={8}
          value={d.bodyTemplate ?? ""}
          placeholder={
            '{\n  "status": true,\n  "message": "",\n  "data": {{<上游 node id>.result}}\n}'
          }
          onChange={(e) =>
            onUpdateNodeData(node.id, { bodyTemplate: e.target.value })
          }
        />
        {bodyJsonErr && (
          <div className="text-[11px] text-rose-600 mt-1 leading-snug">
            JSON 解析失败（占位符已替换为字符串后仍不合法）：{bodyJsonErr}
          </div>
        )}
      </Field>

      <KvRows
        title="Headers"
        rows={d.headers || {}}
        onChange={(next) => onUpdateNodeData(node.id, { headers: next })}
      />

      <div className="text-[11px] text-slate-500 leading-relaxed">
        Response 是 DAG 叶子节点（无 output handle）；执行到本节点时，渲染后的
        body 即作为本次触发的 HTTP 响应返回给调用方。一条 flow 可以有多个 Response
        节点（不同 IfElse 分支各一个），只有被实际走到的那个会生效。
      </div>

      {node.type && NODE_TYPES_WITH_RUNTIME.has(node.type) && (
        <RuntimePanel nodeId={node.id} nodeType={node.type} />
      )}
    </div>
  );
}

/* ===================================================================
 * ModelConfigGroup · LLM 节点的"模型配置组"
 *
 * 把 backend/model 选择 + temperature / max_tokens / max_iterations 三个采样参数
 * 收在一个浅灰盒子里，每个字段都带 ⓘ 悬浮说明。这样"配置脑子"这件事自成一块，
 * 跟下面的 System textarea / 连接汇总 / Runtime 在视觉上拉开。
 * =================================================================== */
function ModelConfigGroup({
  models,
  backend,
  model,
  temperature,
  max_tokens,
  max_iterations,
  onChange,
}: {
  models: ModelOption[];
  backend?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  onChange: (patch: Partial<LLMNodeData>) => void;
}) {
  const value = backend && model ? `${backend}::${model}` : "";
  const grouped = new Map<string, ModelOption[]>();
  for (const m of models) {
    if (!grouped.has(m.backend)) grouped.set(m.backend, []);
    grouped.get(m.backend)!.push(m);
  }

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        Model
      </div>
      <div className="p-2 space-y-2">
        <Field
          label="Backend · Model"
          hint="选择哪个 backend 提供的哪个具体模型；运行时按 backend+model 路由到 model_server 对应实例。"
        >
          <select
            className="w-full text-sm border rounded px-2 py-1 bg-white"
            value={value}
            onChange={(e) => {
              const [b, ...rest] = e.target.value.split("::");
              onChange({ backend: b || "", model: rest.join("::") });
            }}
          >
            <option value="">-- 选择模型 --</option>
            {Array.from(grouped.entries()).map(([b, ms]) => (
              <optgroup key={b} label={b}>
                {ms.map((m) => (
                  <option key={`${b}::${m.id}`} value={`${b}::${m.id}`}>
                    {m.id}
                    {m.loaded ? "  · 已加载" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field
            label="T"
            hint="采样温度（temperature）：0=最稳定，1=较随机；推荐 0.2–0.5。"
          >
            <input
              type="number"
              step="0.05"
              className="w-full text-sm border rounded px-2 py-1"
              value={temperature ?? 0.3}
              onChange={(e) =>
                onChange({ temperature: parseFloat(e.target.value || "0") })
              }
            />
          </Field>
          <Field
            label="max_tok"
            hint="单次回答最大 token 数；超出会触发 finish_reason=length。"
          >
            <input
              type="number"
              className="w-full text-sm border rounded px-2 py-1"
              value={max_tokens ?? 1024}
              onChange={(e) =>
                onChange({ max_tokens: parseInt(e.target.value || "0", 10) })
              }
            />
          </Field>
          <Field
            label="iter"
            hint="ReAct 最大循环轮数；超过则强制终止（防死循环 / 烧 token）。"
          >
            <input
              type="number"
              className="w-full text-sm border rounded px-2 py-1"
              value={max_iterations ?? 6}
              onChange={(e) =>
                onChange({
                  max_iterations: parseInt(e.target.value || "1", 10),
                })
              }
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
 * ConnectionsSummary · LLM 节点的"接入汇总"
 *
 * 极简版的 "已连接节点反向视图"：每行 = 端口标签 + 数量。不列具体节点、不带跳转。
 * 详情看画布——画布上每个分区右上也有同样的数字 badge，跟这里对得上。
 * =================================================================== */
function ConnectionsSummary({ flow, llmId }: { flow: Flow; llmId: string }) {
  const counts = { input: 0, system: 0, skills: 0, knowledge: 0, tools: 0, mcp: 0 };
  for (const e of flow.edges) {
    if (e.target !== llmId) continue;
    const h = e.targetHandle ?? "input";
    if (h in counts) (counts as Record<string, number>)[h] += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const rows: { label: string; count: number; color: string }[] = [
    { label: "Input",     count: counts.input,     color: "text-slate-700" },
    { label: "System",    count: counts.system,    color: "text-sky-700" },
    { label: "Skills",    count: counts.skills,    color: "text-lime-700" },
    { label: "Knowledge", count: counts.knowledge, color: "text-teal-700" },
    { label: "Tools",     count: counts.tools,     color: "text-amber-700" },
    { label: "MCP",       count: counts.mcp,       color: "text-violet-700" },
  ];

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Connections
        </span>
        <span className="ml-auto text-[10px] text-slate-400 font-mono">
          {total}
        </span>
      </div>
      <div className="p-2 space-y-0.5 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center">
            <span className={r.color}>{r.label}</span>
            <span
              className={
                "ml-auto font-mono " +
                (r.count > 0 ? "text-slate-700" : "text-slate-400")
              }
            >
              {r.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  /** 可选悬浮说明——渲染成标题右侧的 ⓘ；不传则不渲染图标 */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
        <span>{label}</span>
        {hint && <InfoTip text={hint} />}
      </div>
      {children}
    </div>
  );
}

/** NodeHeaderBar · 每个节点编辑面板顶部的"节点 · X #id"行。
 *
 *  设计意图：让用户在编辑下游节点（如 Code / Response）的模板时能快速复制
 *  上游节点的 id。React Flow 的 node id 默认是 `<kind>_<nanoid>`，肉眼读容易看错，
 *  也不便于在 `{{<node id>.foo}}` 模板里手敲——加一个点击复制的小 tag 就方便很多。
 *
 *  复制行为：优先用 navigator.clipboard.writeText（HTTPS / localhost 才有）；
 *  老浏览器 / file:// 环境兜底走 textarea + document.execCommand("copy")。
 *  复制成功后 1.5s 内显示 ✓，过后回到默认 ⧉ 图标。
 */
function NodeHeaderBar({
  kindLabel,
  nodeId,
}: {
  kindLabel: string;
  nodeId: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = nodeId;
        // 避免 iOS 滚动 / 把元素移出视口
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* 实在没招就静默——title 里已经能看到完整 id */
      }
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(nodeId).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        fallback,
      );
    } else {
      fallback();
    }
  }
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-500 shrink-0">节点 · {kindLabel}</span>
      <button
        type="button"
        onClick={copy}
        title={copied ? "已复制" : `点击复制节点 id · ${nodeId}`}
        className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 px-1.5 py-0.5 rounded transition-colors min-w-0"
      >
        <span className="text-slate-400">#</span>
        <span className="truncate max-w-[140px]">{nodeId}</span>
        {copied ? (
          <span className="text-emerald-600 shrink-0" aria-label="已复制">
            ✓
          </span>
        ) : (
          <span className="text-slate-400 shrink-0" aria-label="复制">
            ⧉
          </span>
        )}
      </button>
    </div>
  );
}

/* ===================================================================
 * MergeEditor · 节点 · Merge
 *
 * Merge 没有可调参数——它只做"等所有入边解决 → 把跑通的那些上游汇成一个 output"。
 * 所以编辑区只有 Label + 一段说明，加上 RuntimePanel 看跑出来的结果。
 *
 * 说明文字里把语义 / 输出形状写清楚，避免用户误以为它能配"取哪条 / 优先级 / 等
 * 几个" 之类的；要那些行为请用 IfElse / Switch / Code 自己实现。
 * =================================================================== */
function MergeEditor({
  node,
  onUpdateNodeData,
}: {
  node: Node;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || {}) as MergeNodeData;
  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Merge" nodeId={node.id} />
      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          onChange={(e) =>
            onUpdateNodeData(node.id, { label: e.target.value })
          }
        />
      </Field>

      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600 space-y-1.5">
        <div className="font-medium text-slate-700">合流语义</div>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            等<strong>所有</strong>入边解决（包括"被分支裁掉" /
            "上游失败"两类无产物）后再向下继续。
          </li>
          <li>
            <strong>仅 1 个上游产出</strong>：透传该上游的 output —— 下游 Code 直接用{" "}
            <code className="px-1 rounded bg-white border text-slate-700">prev</code>{" "}
            就能拿到原始数据。
          </li>
          <li>
            <strong>多个上游产出</strong>（并行分支汇合）：output 是字典{" "}
            <code className="px-1 rounded bg-white border text-slate-700">
              {`{<上游 id>: <产物>, ...}`}
            </code>
            ；下游 Code 用{" "}
            <code className="px-1 rounded bg-white border text-slate-700">
              inputs[&quot;&lt;上游 id&gt;&quot;]
            </code>{" "}
            取具体一条。
          </li>
          <li>
            零上游产出（所有分支都没跑通）：output 为 <code>null</code>。
          </li>
        </ul>
      </div>

      <RuntimePanel nodeId={node.id} nodeType="merge" />
    </div>
  );
}

/* ===================================================================
 * TransformEditor · 节点 · Transform
 *
 * 三块结构：
 *   1. SourceBar  : 显示上游节点 + 样本来源 + 重新拉样本按钮 + 实时错误/状态
 *   2. PreviewTab : 顶部 sticky 列头（带类型徽章 + ▾ 菜单）；body 显示 rows
 *                   单元格转换失败时画淡红角标 + title 悬浮原因
 *   3. OpsList    : 已添加操作链；每行可 toggle 启用、展开内联编辑表单、上下移动、删除
 *
 * 数据流：
 *   sampleResult (异步拉) → samples Row[]
 *   samples + ops → applyOps → result { rows, cellWarnings, columns }
 *   PreviewTab 渲染 result；OpsList 直接编辑 ops 数组、保存回 nodeData
 *
 * 任何 op 修改都会触发 applyOps 重算（applyOps 是纯函数 + 数据量小到可接受），
 * 无需 debounce；只在重新拉样本时显示 loading。
 * =================================================================== */
const PREVIEW_ROW_CAP = 200;
const PREVIEW_DISPLAY_CAP = 50;

function TransformEditor({
  node,
  flow,
  onUpdateNodeData,
}: {
  node: Node;
  flow: Flow;
  onUpdateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
}) {
  const d = (node.data || { ops: [] }) as TransformNodeData;
  const ops = useMemo(() => d.ops ?? [], [d.ops]);

  // ── 上游样本：异步拉，refresh 按钮触发重拉
  const [sample, setSample] = useState<SampleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // 找到此 transform 节点的输入上游：edges.target === node.id && targetHandle === "input"
  const upstreamNode = useMemo(() => {
    const edge = flow.edges.find(
      (e) => e.target === node.id && (e.targetHandle ?? "input") === "input",
    );
    if (!edge) return null;
    return flow.nodes.find((n) => n.id === edge.source) ?? null;
  }, [flow.edges, flow.nodes, node.id]);

  // 用上游节点 id + data 的 JSON 串当依赖 key——这样只有"换了上游节点"或"上游
  // 节点配置变了"才会触发重拉样本；自身 ops 编辑 / 其它无关节点编辑 / 拖位置等
  // 都不会无谓地打 BFF。
  const upstreamDataKey = upstreamNode
    ? JSON.stringify({ id: upstreamNode.id, type: upstreamNode.type, data: upstreamNode.data })
    : "";

  useEffect(() => {
    if (!upstreamNode) {
      setSample(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    sampleUpstream(upstreamNode, flow)
      .then((r) => {
        if (cancelled) return;
        setSample(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // 故意不把 flow / upstreamNode 直接挂进依赖——依赖 upstreamDataKey 即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamDataKey, refreshTick]);

  // ── 跑 applyOps：拿 sample.rows + ops 算出预览结果
  const result: ApplyResult = useMemo(() => {
    const rows =
      sample?.status === "ok" ? sample.rows.slice(0, PREVIEW_ROW_CAP) : [];
    return applyOps(rows as Row[], ops);
  }, [sample, ops]);

  // ── 列的类型推断：基于 applyOps 后的数据，给 filter UI 用
  const columnTypes: Record<string, ColumnType> = useMemo(() => {
    const out: Record<string, ColumnType> = {};
    for (const c of result.columns) {
      out[c] = inferColumnType(result.rows, c);
    }
    return out;
  }, [result.columns, result.rows]);

  function updateOps(next: Array<TransformOp & { enabled?: boolean }>) {
    onUpdateNodeData(node.id, { ops: next });
  }

  function addOp(op: TransformOp) {
    updateOps([...ops, { ...op, enabled: true }]);
  }

  return (
    <div className="p-3 space-y-3">
      <NodeHeaderBar kindLabel="Transform" nodeId={node.id} />

      <Field label="Label">
        <input
          className="w-full text-sm border rounded px-2 py-1"
          value={d.label || ""}
          placeholder="可选展示名"
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
        />
      </Field>

      <TransformSourceBar
        upstreamNode={upstreamNode}
        sample={sample}
        loading={loading}
        onRefresh={() => setRefreshTick((n) => n + 1)}
      />

      <TransformPreview
        result={result}
        columnTypes={columnTypes}
        loading={loading}
        sampleStatus={sample?.status ?? null}
        onAddOp={addOp}
        totalSampleRows={sample?.status === "ok" ? sample.rows.length : 0}
      />

      <TransformOpsList
        ops={ops}
        columns={result.columns}
        columnTypes={columnTypes}
        onChange={updateOps}
      />
    </div>
  );
}

/** SourceBar —— 顶部状态条，告诉用户"预览数据从哪来" */
function TransformSourceBar({
  upstreamNode,
  sample,
  loading,
  onRefresh,
}: {
  upstreamNode: { type?: string; id: string; data?: { label?: string } } | null;
  sample: SampleResult | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  let line: React.ReactNode;
  let toneCls = "bg-slate-50 border-slate-200 text-slate-700";
  if (!upstreamNode) {
    line = "未连接上游——请把一个数据源节点的 output 拉到 Transform 的 input";
    toneCls = "bg-amber-50 border-amber-200 text-amber-800";
  } else if (loading) {
    line = `从 ${friendlyNode(upstreamNode)} 拉样本中…`;
  } else if (!sample) {
    line = `等待 ${friendlyNode(upstreamNode)} 数据…`;
  } else if (sample.status === "ok") {
    line = (
      <>
        <span className="text-slate-500">Source · </span>
        <span className="font-mono text-slate-700">{sample.sourceLabel}</span>
        <span className="text-slate-500"> · {sample.rows.length} 行</span>
      </>
    );
    toneCls = "bg-emerald-50 border-emerald-200 text-emerald-800";
  } else if (sample.status === "empty") {
    line = sample.reason;
    toneCls = "bg-slate-50 border-slate-200 text-slate-500";
  } else if (sample.status === "unsupported") {
    line = sample.reason;
    toneCls = "bg-amber-50 border-amber-200 text-amber-800";
  } else {
    line = sample.error;
    toneCls = "bg-rose-50 border-rose-200 text-rose-800";
  }
  return (
    <div
      className={
        "rounded border px-2 py-1.5 flex items-center gap-2 text-[11px] leading-snug " +
        toneCls
      }
    >
      <span className="flex-1 truncate">{line}</span>
      {upstreamNode && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[10px] uppercase tracking-wider text-slate-600 hover:text-slate-900 disabled:opacity-50"
          title="重新拉一份样本"
        >
          ↻ Refresh
        </button>
      )}
    </div>
  );
}

function friendlyNode(n: { type?: string; data?: { label?: string }; id: string }): string {
  const lbl = n.data?.label || n.type || "?";
  return `${lbl} (${n.id.slice(0, 6)})`;
}

/** PreviewTable —— 实时预览表
 *
 *  - sticky thead 含列名 + 类型徽章 + ▾ 触发 AddOpMenu
 *  - tbody 截前 PREVIEW_DISPLAY_CAP 行；超过部分给出"…剩余 N 行"提示
 *  - 单元格转换失败时画淡红色右上角小三角 + title 悬浮原因
 *  - 表整体横向滚动；列宽 min 80 / max 240
 */
function TransformPreview({
  result,
  columnTypes,
  loading,
  sampleStatus,
  onAddOp,
  totalSampleRows,
}: {
  result: ApplyResult;
  columnTypes: Record<string, ColumnType>;
  loading: boolean;
  sampleStatus: SampleResult["status"] | null;
  onAddOp: (op: TransformOp) => void;
  totalSampleRows: number;
}) {
  const [menuCol, setMenuCol] = useState<string | null>(null);
  const visibleRows = result.rows.slice(0, PREVIEW_DISPLAY_CAP);
  const hiddenCount = result.rows.length - visibleRows.length;

  if (sampleStatus !== "ok") {
    // 没样本时不渲染表骨架——TransformSourceBar 那条信息已经够
    return null;
  }

  return (
    <div className="rounded border bg-white relative">
      <div className="px-2 py-1 border-b flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <span>Preview</span>
        {loading && <span className="text-slate-400 normal-case">（拉新样本中…）</span>}
        <span className="ml-auto text-slate-400 font-mono normal-case tracking-normal">
          {result.rows.length} / {totalSampleRows} rows · {result.columns.length} cols
        </span>
      </div>
      <div className="overflow-auto max-h-72">
        <table className="text-[11px] border-collapse w-max min-w-full">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr>
              {result.columns.map((c) => (
                <th
                  key={c}
                  className="border-b border-r border-slate-200 text-left align-top px-2 py-1 font-medium"
                >
                  <button
                    type="button"
                    onClick={() => setMenuCol((cur) => (cur === c ? null : c))}
                    className="flex items-center gap-1 min-w-0 max-w-[200px] text-slate-700 hover:text-slate-900"
                    title={`${c} · ${columnTypes[c]}`}
                  >
                    <span className="truncate font-mono">{c}</span>
                    <span
                      className={
                        "text-[9px] font-mono px-1 rounded shrink-0 " +
                        typeBadgeCls(columnTypes[c])
                      }
                    >
                      {columnTypes[c]}
                    </span>
                    <span className="text-slate-400 shrink-0">▾</span>
                  </button>
                </th>
              ))}
              {result.columns.length === 0 && (
                <th className="px-2 py-1 text-slate-400 italic">
                  （样本里没有任何列；上游可能返回了空数组）
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, ridx) => (
              <tr key={ridx} className="hover:bg-slate-50/60">
                {result.columns.map((c) => {
                  const v = r[c];
                  const warn = result.cellWarnings[`${ridx}::${c}`];
                  return (
                    <td
                      key={c}
                      className="border-b border-r border-slate-100 px-2 py-1 align-top relative max-w-[240px]"
                      title={warn ? `转换失败：${warn}` : undefined}
                    >
                      <div className="truncate font-mono text-slate-700">
                        {formatCell(v)}
                      </div>
                      {warn && (
                        <span className="absolute top-0 right-0 border-t-[6px] border-t-rose-400 border-l-[6px] border-l-transparent" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, result.columns.length)}
                  className="px-2 py-3 text-center text-slate-400 italic"
                >
                  没有数据通过当前操作链（可能某步 filter 过严？）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className="px-2 py-1 text-[10px] text-slate-400 border-t">
          仅显示前 {PREVIEW_DISPLAY_CAP} 行；剩余 {hiddenCount} 行未展示
        </div>
      )}

      {menuCol && (
        <ColumnMenu
          column={menuCol}
          colType={columnTypes[menuCol] ?? "string"}
          allColumns={result.columns}
          onClose={() => setMenuCol(null)}
          onPick={(op) => {
            onAddOp(op);
            setMenuCol(null);
          }}
        />
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function typeBadgeCls(t: ColumnType | undefined): string {
  switch (t) {
    case "number":
      return "bg-blue-100 text-blue-700";
    case "datetime":
      return "bg-violet-100 text-violet-700";
    case "boolean":
      return "bg-amber-100 text-amber-700";
    case "string":
      return "bg-slate-200 text-slate-700";
    case "mixed":
    default:
      return "bg-slate-100 text-slate-500";
  }
}

/** ColumnMenu —— 列头 ▾ 弹出的工具组
 *
 *  按你的需求分三组：Column Operations / Change Type / Data Tools。
 *  点任一项 → 立即调 onAddOp 把对应 op 加到链尾；后续在 OpsList 里再细化参数。
 *
 *  实现细节：用 fixed 定位的浮层（不用 portal，足够简单）；点外部关闭走父组件 state。
 */
function ColumnMenu({
  column,
  colType,
  allColumns,
  onClose,
  onPick,
}: {
  column: string;
  colType: ColumnType;
  allColumns: string[];
  onClose: () => void;
  onPick: (op: TransformOp) => void;
}) {
  // ESC 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  function uniqColName(base: string): string {
    let i = 1;
    let cand = `${base}_copy`;
    while (allColumns.includes(cand)) {
      i += 1;
      cand = `${base}_copy${i}`;
    }
    return cand;
  }

  return (
    <>
      {/* 全屏背板捕获外部点击 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute z-50 top-full left-1 mt-1 w-56 rounded border border-slate-200 bg-white shadow-lg text-[11px]">
        <div className="px-2 py-1 border-b text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Column · <span className="font-mono normal-case tracking-normal">{column}</span>
        </div>
        <MenuGroup title="Column Operations">
          <MenuItem
            label="Rename"
            onClick={() =>
              onPick({ kind: "rename", column, to: `${column}_new` })
            }
          />
          <MenuItem
            label="Duplicate"
            onClick={() =>
              onPick({ kind: "duplicate", column, as: uniqColName(column) })
            }
          />
          <MenuItem
            label="Delete"
            tone="danger"
            onClick={() => onPick({ kind: "delete", column })}
          />
        </MenuGroup>
        <MenuGroup title="Change Type">
          {(
            [
              ["string", "String"],
              ["int", "Int"],
              ["float", "Float"],
              ["datetime", "Datetime"],
              ["boolean", "Boolean"],
            ] as const
          ).map(([t, lbl]) => (
            <MenuItem
              key={t}
              label={lbl}
              onClick={() =>
                onPick({ kind: "changeType", column, type: t })
              }
            />
          ))}
        </MenuGroup>
        <MenuGroup title="Data Tools">
          <MenuItem
            label="Replace…"
            onClick={() =>
              onPick({ kind: "replace", column, from: "", to: "" })
            }
          />
          <MenuItem
            label="Remove Duplicates (by this col)"
            onClick={() =>
              onPick({ kind: "removeDuplicates", columns: [column] })
            }
          />
          <MenuItem
            label="Filter…"
            onClick={() => {
              const defaultOp =
                colType === "number"
                  ? "gt"
                  : colType === "datetime"
                    ? "after"
                    : "contains";
              onPick({ kind: "filter", column, op: defaultOp, value: "" });
            }}
          />
        </MenuGroup>
      </div>
    </>
  );
}

function MenuGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1 border-b last:border-b-0">
      <div className="px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuItem({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone?: "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full text-left px-2 py-1 hover:bg-slate-100 " +
        (tone === "danger" ? "text-rose-700 hover:bg-rose-50" : "text-slate-700")
      }
    >
      {label}
    </button>
  );
}

/** OpsList —— 操作链编辑器（顺序 + 启用 + 内联编辑） */
function TransformOpsList({
  ops,
  columns,
  columnTypes,
  onChange,
}: {
  ops: Array<TransformOp & { enabled?: boolean }>;
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  onChange: (next: Array<TransformOp & { enabled?: boolean }>) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  function patch(idx: number, p: Partial<TransformOp & { enabled?: boolean }>) {
    onChange(
      ops.map((o, i) => (i === idx ? ({ ...o, ...p } as typeof o) : o)),
    );
  }
  function remove(idx: number) {
    onChange(ops.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= ops.length) return;
    const next = ops.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
    if (expandedIdx === idx) setExpandedIdx(j);
    else if (expandedIdx === j) setExpandedIdx(idx);
  }

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Pipeline
        </span>
        <span className="text-[10px] text-slate-400">({ops.length})</span>
        <InfoTip text="按顺序应用：上一步的输出是下一步的输入。点列头 ▾ 加新操作；这里可以重排 / 启用 / 编辑 / 删除。" />
      </div>
      {ops.length === 0 ? (
        <div className="p-2 text-[11px] text-slate-400 italic">
          空操作链 · 上游数据原样透传。从预览表的列头 ▾ 加第一步。
        </div>
      ) : (
        <div className="divide-y divide-slate-200/70">
          {ops.map((op, idx) => {
            const enabled = op.enabled !== false;
            const isOpen = expandedIdx === idx;
            return (
              <div key={idx} className="bg-white">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => patch(idx, { enabled: e.target.checked })}
                    title={enabled ? "启用中（取消可临时跳过这步）" : "已禁用"}
                  />
                  <span className="text-[10px] font-mono text-slate-400 w-5">
                    {idx + 1}.
                  </span>
                  <button
                    type="button"
                    className={
                      "flex-1 text-left text-[11px] truncate " +
                      (enabled ? "text-slate-700" : "text-slate-400 line-through")
                    }
                    onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    title={isOpen ? "收起" : "展开编辑"}
                  >
                    <span className="font-mono">{describeOp(op)}</span>
                  </button>
                  <div className="flex items-center gap-0.5 text-slate-400">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="hover:text-slate-700 disabled:opacity-30 w-5 h-5 leading-none"
                      title="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === ops.length - 1}
                      className="hover:text-slate-700 disabled:opacity-30 w-5 h-5 leading-none"
                      title="下移"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="hover:text-rose-600 w-5 h-5 leading-none"
                      title="删除这步"
                    >
                      ×
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="bg-slate-50/60 border-t border-slate-200/70 px-2 py-1.5">
                    <OpEditForm
                      op={op}
                      columns={columns}
                      columnTypes={columnTypes}
                      onChange={(p) => patch(idx, p)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 单个 op 的内联编辑表单 —— 按 kind 分支渲染对应字段。 */
function OpEditForm({
  op,
  columns,
  columnTypes,
  onChange,
}: {
  op: TransformOp & { enabled?: boolean };
  columns: string[];
  columnTypes: Record<string, ColumnType>;
  onChange: (p: Partial<TransformOp & { enabled?: boolean }>) => void;
}) {
  // 公共"选列"控件 —— 各 op 共用
  const ColumnPicker = (
    <select
      className="text-[11px] border rounded px-1 py-0.5 bg-white font-mono max-w-[140px]"
      value={(op as { column?: string }).column ?? ""}
      onChange={(e) => onChange({ column: e.target.value } as Partial<TransformOp>)}
    >
      <option value="" disabled>
        选列…
      </option>
      {columns.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  if (op.kind === "rename") {
    const dup = columns.includes(op.to) && op.to !== op.column;
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">column</span>
          {ColumnPicker}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">to</span>
          <input
            className={
              "flex-1 text-[11px] font-mono border rounded px-1 py-0.5 " +
              (dup ? "border-rose-400" : "border-slate-300")
            }
            value={op.to}
            onChange={(e) => onChange({ to: e.target.value } as Partial<TransformOp>)}
            placeholder="新列名"
          />
        </div>
        {dup && (
          <div className="text-rose-600">新名 "{op.to}" 已存在；此步会被静默跳过</div>
        )}
      </div>
    );
  }

  if (op.kind === "duplicate") {
    const dup = columns.includes(op.as);
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">column</span>
          {ColumnPicker}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">as</span>
          <input
            className={
              "flex-1 text-[11px] font-mono border rounded px-1 py-0.5 " +
              (dup ? "border-rose-400" : "border-slate-300")
            }
            value={op.as}
            onChange={(e) => onChange({ as: e.target.value } as Partial<TransformOp>)}
            placeholder="新列名"
          />
        </div>
        {dup && (
          <div className="text-rose-600">"{op.as}" 已存在；此步会被静默跳过</div>
        )}
      </div>
    );
  }

  if (op.kind === "delete") {
    return (
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-slate-500 w-12">delete</span>
        {ColumnPicker}
      </div>
    );
  }

  if (op.kind === "changeType") {
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">column</span>
          {ColumnPicker}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">as</span>
          <select
            className="text-[11px] border rounded px-1 py-0.5 bg-white font-mono"
            value={op.type}
            onChange={(e) =>
              onChange({ type: e.target.value as typeof op.type } as Partial<TransformOp>)
            }
          >
            <option value="string">string</option>
            <option value="int">int</option>
            <option value="float">float</option>
            <option value="datetime">datetime</option>
            <option value="boolean">boolean</option>
          </select>
        </div>
        <div className="text-slate-500 leading-snug">
          解析失败的单元格会保留原值，预览表上画淡红角标；不打断整条 pipeline。
        </div>
      </div>
    );
  }

  if (op.kind === "replace") {
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">column</span>
          {ColumnPicker}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">from</span>
          <input
            className="flex-1 text-[11px] font-mono border rounded px-1 py-0.5"
            value={op.from}
            onChange={(e) => onChange({ from: e.target.value } as Partial<TransformOp>)}
            placeholder={op.useRegex ? "/pattern/flags 或 pattern" : "要替换的字符串"}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">to</span>
          <input
            className="flex-1 text-[11px] font-mono border rounded px-1 py-0.5"
            value={op.to}
            onChange={(e) => onChange({ to: e.target.value } as Partial<TransformOp>)}
            placeholder="替换后的字符串"
          />
        </div>
        <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={!!op.useRegex}
            onChange={(e) =>
              onChange({ useRegex: e.target.checked } as Partial<TransformOp>)
            }
          />
          使用正则（from 作 RegExp 解析）
        </label>
      </div>
    );
  }

  if (op.kind === "removeDuplicates") {
    const keys = op.columns ?? [];
    function toggle(c: string) {
      const next = keys.includes(c) ? keys.filter((k) => k !== c) : [...keys, c];
      onChange({ columns: next.length > 0 ? next : undefined } as Partial<TransformOp>);
    }
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="text-slate-500">
          按下列列组合去重；不选 = 按全表所有列去重
        </div>
        <div className="flex flex-wrap gap-1">
          {columns.map((c) => {
            const on = keys.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={
                  "text-[10px] font-mono rounded px-1.5 py-0.5 border " +
                  (on
                    ? "bg-stone-200 border-stone-400 text-stone-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (op.kind === "filter") {
    const colType: ColumnType = columnTypes[op.column] ?? "string";
    const opts = opsForType(colType);
    const selected = opts.find((o) => o.value === op.op);
    return (
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">column</span>
          {ColumnPicker}
          <span
            className={
              "text-[9px] font-mono px-1 rounded " + typeBadgeCls(colType)
            }
          >
            {colType}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 w-12">op</span>
          <select
            className="text-[11px] border rounded px-1 py-0.5 bg-white font-mono flex-1"
            value={op.op}
            onChange={(e) =>
              onChange({ op: e.target.value as typeof op.op } as Partial<TransformOp>)
            }
          >
            {opts.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {selected?.needsValue && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 w-12">value</span>
            <input
              className="flex-1 text-[11px] font-mono border rounded px-1 py-0.5"
              value={op.value ?? ""}
              onChange={(e) =>
                onChange({ value: e.target.value } as Partial<TransformOp>)
              }
              placeholder={
                colType === "number"
                  ? "数字"
                  : colType === "datetime"
                    ? "YYYY-MM-DD 或 ISO 时间"
                    : "字符串"
              }
            />
          </div>
        )}
        <div className="text-slate-500 leading-snug">
          类型变 → op 选项也跟着变（数字列没有 startsWith；datetime 列有 before/after）。
        </div>
      </div>
    );
  }

  return null;
}
