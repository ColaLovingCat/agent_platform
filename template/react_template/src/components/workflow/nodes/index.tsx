"use client";

import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  CodeNodeData,
  FileOutputNodeData,
  HttpRequestNodeData,
  IfElseNodeData,
  FileInputNodeData,
  IONodeData,
  KnowledgeNodeData,
  LLMNodeData,
  ManualTriggerNodeData,
  MCPNodeData,
  MergeNodeData,
  PromptNodeData,
  ResponseNodeData,
  ScheduleTriggerNodeData,
  SkillNodeData,
  SqlNodeData,
  SwitchNodeData,
  ToolNodeData,
  TransformNodeData,
  UploadNodeData,
  VariableNodeData,
  WebhookTriggerNodeData,
} from "../lib/types";
import { useConnectionName } from "../lib/connectionsStore";
import { describeOp } from "../lib/transform";
import {
  useFlowRuntime,
  type NodeRunStatus,
} from "../lib/flowRuntimeStore";
import {
  buildDownloadInfo,
  formatBytes,
} from "./fileOutputUtils";
import { FileRow } from "../FileRow";
import { validateFilesAgainstConstraints } from "../lib/flowEngine";
import {
  EXCEL_ACCEPT_ATTR,
  EXCEL_ACCEPT_EXTENSIONS,
  isExcelLikeFilename,
} from "../lib/excelParse";
import { uploadFile } from "../lib/uploadClient";
import { runSingleNodeFromStore } from "../lib/dagSimulators";
import { useFlowContext, useUpdateNodeData } from "../nodeContext";
import { FilePreviewModal } from "../FilePreviewModal";

/* ====================================================================
 * 节点图标（inline SVG，lucide 风格）
 *
 * 不引入图标库，原因：
 *  1. 仅 7 个图标，单独装 lucide-react 性价比低
 *  2. inline SVG 用 stroke="currentColor"，外层 .node-card-icon.<kind>
 *     已经设置 text-*-700，颜色自动跟随分类，无需 props 传入
 *  3. 跨平台一致（emoji 在 Linux / Windows / Mac 上字形差异很大）
 *
 * 视觉规范：24×24 viewBox / strokeWidth=1.75 / round caps & joins。
 * ==================================================================== */
type IconKind =
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
  | "upload"
  | "httpRequest"
  | "sql"
  | "variable"
  | "code"
  | "ifElse"
  | "switch"
  | "merge"
  | "transform";

function NodeIcon({ name }: { name: IconKind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "input":
      // message-square-text：聊天起点
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M7 9h10" />
          <path d="M7 13h6" />
        </svg>
      );
    case "manualTrigger":
      // mouse-pointer-click：用户手动点
      return (
        <svg {...common}>
          <path d="M9 9 3 3l6 6" />
          <path d="m9 9-3.5 3.5" />
          <path d="M14.5 14.5 21 21" />
          <path d="M9 9l3 8 2.5-4.5L19 10z" />
        </svg>
      );
    case "scheduleTrigger":
      // clock：定时
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "webhookTrigger":
      // webhook：三圈联动
      return (
        <svg {...common}>
          <path d="M18 16.98h-5.99c-1.66 0-3.01-1.34-3.01-3s1.35-3 3.01-3H18" />
          <path d="m6 8.5 4 4 4-4" />
          <path d="M14 12.5 10 17l-4-4.5" />
        </svg>
      );
    case "output":
      // arrow-up-right-from-square：往外送出
      return (
        <svg {...common}>
          <path d="M21 3h-6" />
          <path d="M21 3v6" />
          <path d="M21 3 11 13" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      );
    case "prompt":
      // file-text：手写一段提示
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
          <path d="M10 9H8" />
        </svg>
      );
    case "skill":
      // book-open：磁盘上的 .md playbook
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "knowledge":
      // database：知识库（向量索引 + 原文存盘）
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" />
        </svg>
      );
    case "llm":
      // sparkles：LLM 推理
      return (
        <svg {...common}>
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M5.6 5.6 7.7 7.7" />
          <path d="M16.3 16.3 18.4 18.4" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M5.6 18.4 7.7 16.3" />
          <path d="M16.3 7.7 18.4 5.6" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "tool":
      // wrench：函数式 tool
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "mcp":
      // network：MCP server（多节点拓扑）
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="6" rx="1" />
          <rect x="2" y="16" width="6" height="6" rx="1" />
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
          <path d="M12 12V8" />
        </svg>
      );
    case "fileOutput":
      // file-down：文件 + 向下箭头（可下载）
      return (
        <svg {...common}>
          <path d="M14 3v4a1 1 0 0 0 1 1h4" />
          <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
          <path d="M12 11v6" />
          <path d="m9 14 3 3 3-3" />
        </svg>
      );
    case "response":
      // reply / log-out：花括号 + 向右箭头，传达"渲染 JSON 后从这里返回给调用方"
      return (
        <svg {...common}>
          <path d="M7 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h1" />
          <path d="M17 4h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1" />
          <path d="M9 12h7" />
          <path d="m13 9 3 3-3 3" />
        </svg>
      );
    case "fileInput":
      // file 形 + 向右箭头：表示"文件作为数据源 → 流入画布"，跟 fileOutput
      // 的"画布数据 → 文件"在视觉上对称。
      return (
        <svg {...common}>
          <path d="M14 3v4a2 2 0 0 0 2 2h4" />
          <path d="M11 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v3" />
          <path d="M14 17h7" />
          <path d="m18 13 4 4-4 4" />
        </svg>
      );
    case "upload":
      // file-spreadsheet：文件外形 + 折角 + 表格网格（贴合 Upload Excel 语义）
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h8" />
          <path d="M12 11v8" />
        </svg>
      );
    case "httpRequest":
      // globe-2：地球仪
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
        </svg>
      );
    case "sql":
      // database：三层圆柱（经典数据库图标）
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
          <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
        </svg>
      );
    case "variable":
      // braces：{} 表达式
      return (
        <svg {...common}>
          <path d="M8 3H7a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2v0a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1" />
          <path d="M16 3h1a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2v0a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-1" />
        </svg>
      );
    case "code":
      // code-2：</>
      return (
        <svg {...common}>
          <path d="m18 16 4-4-4-4" />
          <path d="m6 8-4 4 4 4" />
          <path d="m14.5 4-5 16" />
        </svg>
      );
    case "ifElse":
      // git-fork：分叉
      return (
        <svg {...common}>
          <circle cx="12" cy="18" r="2.5" />
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3" />
          <path d="M12 14.5V16" />
        </svg>
      );
    case "switch":
      // 类似 split：一个进入点 + 多个出口
      return (
        <svg {...common}>
          <path d="M5 3v18" />
          <path d="M5 5h6a4 4 0 0 1 4 4v0" />
          <path d="M5 12h6a4 4 0 0 1 4 4v0" />
          <path d="M5 19h6" />
          <circle cx="18" cy="9" r="1.5" />
          <circle cx="18" cy="16" r="1.5" />
          <circle cx="13" cy="19" r="1.5" />
        </svg>
      );
    case "merge":
      // git-merge：多入一出（左边三条线汇入右边一条）
      return (
        <svg {...common}>
          <circle cx="5" cy="5" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="5" cy="19" r="1.5" />
          <path d="M5 6.5v4a3 3 0 0 0 3 3h7" />
          <path d="M5 13.5v0" />
          <path d="M5 17.5v0a3 3 0 0 0 3-3" />
          <circle cx="18" cy="12" r="1.5" />
        </svg>
      );
    case "transform":
      // table-2：横竖网格——传达"对表格做处理"
      return (
        <svg {...common}>
          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
          <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
          <path d="M15 3h4a2 2 0 0 1 2 2v4" />
          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
          <path d="M3 12h18" />
          <path d="M12 3v18" />
        </svg>
      );
  }
}

/* ====================================================================
 * 统一的 NodeCard 模板
 *
 * 所有节点的视觉骨架完全一致：
 *   ┌─ Header ──────────── 🔘 ─┐  ← icon + title + run button
 *   │ 灰字 subtitle             │  ← 一行说明
 *   ├─ Section label ──────────┤  ← 主分区 / 附加分区
 *   │   主体内容                │
 *   ├─ ……                      │
 *   ├─ Footer · output ──────◯─┤  ← 底部右侧的 output handle
 *
 * 端点颜色按用途分类，主体颜色保持中性。
 * ==================================================================== */
type HandleSpec = { id: string; className: string };

function NodeCard({
  iconKind,
  title,
  subtitle,
  selected,
  onRun,
  outputHandle,
  status,
  streaming,
  children,
}: {
  iconKind: IconKind;
  title: string;
  subtitle?: string;
  selected?: boolean;
  /** 头部右侧的"单节点运行"按钮回调；不传则不渲染按钮（避免视觉噪音）。 */
  onRun?: () => void;
  /** 节点输出端点；不传则不渲染 footer。 */
  outputHandle?: HandleSpec;
  /** 来自 useFlowRuntime 的执行状态；undefined / "idle" 都按"无运行时"处理。 */
  status?: NodeRunStatus;
  /** 是否处于"持续动态输出"中——running + 已经在累积文字 / 未完成的 tool 调用。
   *  true → 头部用流式三点跳动动画；false → 普通 spinner。仅在 status==="running" 时生效。
   */
  streaming?: boolean;
  children?: ReactNode;
}) {
  const showStatus = status && status !== "idle";
  // 状态徽章变体：running + streaming 用 .streaming（额外样式 hook，未来想跟普通
  // running 颜色拉开差异时改 globals.css 即可），否则按 status 直接给类名。
  const indicatorClass =
    status === "running" && streaming ? "streaming" : status;
  return (
    <div
      className={clsx(
        "node-card",
        selected && "selected",
        showStatus && `status-${status}`
      )}
    >
      <div className="node-card-header">
        <div className={clsx("node-card-icon", iconKind)}>
          <NodeIcon name={iconKind} />
        </div>
        <div className="node-card-title" title={title}>
          {title}
        </div>
        {showStatus && (
          <span
            className={clsx("node-status-indicator", indicatorClass)}
            aria-label={
              status === "running" && streaming ? "streaming" : status
            }
            title={
              status === "running" && streaming
                ? "持续输出中…"
                : status === "running"
                  ? "运行中…"
                  : status === "ok"
                    ? "已完成"
                    : status === "error"
                      ? "出错"
                      : ""
            }
          >
            {status === "running" ? (
              streaming ? (
                <LiveStreamIcon />
              ) : (
                <SpinnerSvg />
              )
            ) : status === "ok" ? (
              "✓"
            ) : (
              "✗"
            )}
          </span>
        )}
        {onRun && (
          <button
            type="button"
            className="node-card-run nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            title="运行此节点（用上游节点已有的输出做输入）"
            aria-label="运行此节点"
          >
            <svg
              width={11}
              height={11}
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
        )}
      </div>
      {subtitle && <div className="node-card-subtitle">{subtitle}</div>}
      {children && <div className="node-card-body">{children}</div>}
      {outputHandle && (
        <div className="node-card-footer">
          <FooterOutputIcon />
          <Handle
            type="source"
            position={Position.Right}
            id={outputHandle.id}
            className={outputHandle.className}
          />
        </div>
      )}
    </div>
  );
}

/** Footer 区"output" 图标——一个朝右的指示符，跟节点右侧的 handle 视觉对位。
 *  替代原来的 "output" 文字，让 footer 在视觉上更轻、跟 header 的图标语言一致。
 *  尺寸 12px，颜色继承父级 .node-card-footer 的 text-slate-500（hover 不变深，
 *  因为 handle 才是真正的交互目标）。
 */
function FooterOutputIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="output"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/** 头部状态指示器里用的小转圈（status=running 但没有文字流入时） */
function SpinnerSvg() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** 节点正在持续输出（流式累积文字 / 工具调用进行中）时的"特殊动画图标"
 *
 *  视觉：三点跳动的 typing indicator，与 spinner 形成清晰差异：
 *   - spinner = "在运行，但还没有可见输出" （等候模型首 token / 等候工具返回）
 *   - 三点跳动 = "正在持续地往外送内容"
 *
 *  纯 CSS 动画（见 globals.css .streaming-dots），无 JS 计时器开销。
 */
function LiveStreamIcon() {
  return (
    <span className="streaming-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

/** 派生 "持续动态输出中" 状态：runtime 必须存在 + status===running +
 *  （文本已经开始累积 或 有未完成的 tool 调用）。
 *
 *  多个节点都会用到，集中实现以便逻辑同步——比如未来想把"工具进行中"踢出
 *  streaming 判定，只在这里改。
 */
function isStreaming(rt?: { status?: NodeRunStatus; text?: string; toolCalls?: { result?: string; error?: string }[] }) {
  if (!rt || rt.status !== "running") return false;
  if (rt.text && rt.text.length > 0) return true;
  if (
    rt.toolCalls &&
    rt.toolCalls.some((tc) => tc.result === undefined && tc.error === undefined)
  ) {
    return true;
  }
  return false;
}

/** 主分区 / 附加分区。
 *  附加分区可选地在左侧挂一个 target handle，用作"接入点"（tools / mcp 等）。
 *
 *  `hint` —— 标签右边的 ⓘ 悬浮提示文案。跟 PropertyPanel.tsx 的 InfoTip / ConnectedNodes
 *  的 PORTS.hint 共用同一套"hover 看长说明"语言，保持工具栏/画布/配置三处一致。
 *  没传 children 时 label 行不再加多余 margin，让"纯标签行"看起来更紧凑。
 */
function NodeSection({
  label,
  hint,
  badge,
  badgeKind,
  headerRight,
  main,
  handle,
  children,
}: {
  label?: string;
  hint?: string;
  badge?: ReactNode;
  /** badge 颜色变体；不传则用默认灰 */
  badgeKind?: "system" | "skills" | "knowledge" | "tools" | "mcp";
  /** 节点 section 标题右侧的自由槽位（按钮 / 状态文字等）。
   *  现在被文件类节点用来挂 "Upload" 按钮——保持"标签 + 操作按钮"在同一行的视觉一致。
   *  注意：跟 `badge` 不该同时使用（两者都会争 ml-auto，会挤）。 */
  headerRight?: ReactNode;
  /** 标记为主分区，外观稍微突出 */
  main?: boolean;
  /** 在分区左侧挂一个 target handle */
  handle?: HandleSpec;
  children?: ReactNode;
}) {
  const labelOnly = children === undefined;
  return (
    <div className={clsx("node-card-section", main ? "main" : "sub")}>
      {handle && (
        <Handle
          type="target"
          position={Position.Left}
          id={handle.id}
          className={handle.className}
        />
      )}
      {label && (
        <div
          className={clsx(
            "node-card-section-label",
            labelOnly && "!mb-0"
          )}
        >
          <span>{label}</span>
          {hint && <NodeInfoTip text={hint} />}
          {badge != null && (
            <span className={clsx("badge", badgeKind)}>{badge}</span>
          )}
          {headerRight !== undefined && (
            <span className="ml-auto flex items-center gap-1">
              {headerRight}
            </span>
          )}
        </div>
      )}
      {children !== undefined && (
        <div className="node-card-section-content">{children}</div>
      )}
    </div>
  );
}

/** 节点卡片内联的 info 图标 —— 跟 PropertyPanel 的 InfoTip 共用同一种交互（native title
 *  悬浮），但视觉上稍微再调一档：节点卡片字号本来就更小 (.node-card-section-label 是 10px)，
 *  所以图标也用 10px、浅灰色、hover 变深。stopPropagation 防止 hover 时把卡片当成被
 *  点击拖动。
 */
function NodeInfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-3 h-3 text-[10px] leading-none text-slate-300 hover:text-slate-600 cursor-help select-none nodrag"
    >
      ⓘ
    </span>
  );
}


/* ====================================================================
 * 各类节点
 * ==================================================================== */

/* React Flow v12 的 NodeProps 泛型是 `<NodeType extends Node>`，传 `{ data: T }` 无法
 * 满足约束（`{ data: T }` 缺少 id/position 等字段）。本文件里我们都用裸 NodeProps，
 * 然后把 `data` 手动 cast 成对应的 *NodeData 类型——和原本就在用的 `as unknown as`
 * 完全兼容，不会改运行时行为。
 */
/** Chat Input 节点
 *
 * 节点本身就是一个可输入的 textarea，承担两件事：
 *  1. **可视化"flow 起点"**：跟 LLM 节点连一根线，让画布表达"消息从这里流出"
 *  2. **inline 测试输入**：用户在这里打字 → 写到 useFlowRuntime.flow.testInput →
 *     画布右上角 Run 按钮（下一步实现）读这个值跑一次 turn → FileOutput 节点
 *     里就能看到产物
 *
 * 跟"在 Chat 页面跑这个 flow"是两条**独立**路径：
 *  - Chat 页面：用户在底部输入框打字，testInput 不动；多轮聊天历史也只在那里
 *  - Inline run：testInput 是单 turn 的素材；不入聊天历史，不持久化
 *
 * 注意 React Flow 集成：
 *  - 给可交互区域加 `nodrag`：textarea 内点击/拖选不应触发节点拖动
 *  - 加 `nopan`：textarea 内滚动 / 选区不被画布吞掉
 *  - 加 `onMouseDown stopPropagation`：再加一道保险，防止跨浏览器差异
 */
export function InputNode({ id, data, selected }: NodeProps) {
  const d = (data as unknown as IONodeData) || {};
  const testInput = useFlowRuntime((s) => s.flow.testInput);
  const setTestInput = useFlowRuntime((s) => s.setTestInput);
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);

  return (
    <NodeCard
      iconKind="input"
      title={d.label || "Chat Input"}
      subtitle="Chat entry · type a test message or leave for the Chat panel"
      selected={selected}
      status={runtime?.status}
      streaming={isStreaming(runtime)}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Test input" main>
        <textarea
          className="nodrag nopan w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none bg-white focus:border-emerald-400 outline-none"
          rows={3}
          placeholder="输入测试消息 · Ctrl/⌘+Enter 触发画布运行..."
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Ctrl/⌘+Enter → 通过 window 自定义事件让 FlowEditor 跑一次。
            // 解耦 InputNode 跟 FlowEditor 的 runInline——节点不应该知道 toolbar 在哪。
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent("flow:run-inline"));
              return;
            }
            // Delete 键在 React Flow 里默认会删节点；textarea 内按 Delete 应该
            // 删字符，挡住事件冒泡到画布
            if (e.key === "Backspace" || e.key === "Delete") {
              e.stopPropagation();
            }
          }}
        />
        {/* runtime 数据（启动时间 / 错误）现在统一在右侧 PropertyPanel 的 Runtime 分区展示，
         * 节点上仅保留头部状态徽章（spinner / 流式动画 / ✓ / ✗）+ 左侧色条。
         */}
      </NodeSection>
    </NodeCard>
  );
}

/** Manual Trigger 节点：用户在运行页点 ▶ 触发，按 paramsSchema 弹表单填字段。
 *
 *  节点上展示已声明的字段数；详细的 schema 编辑放在 PropertyPanel。
 *  运行时阶段一不真触发（chat trigger 才有 inline run）；MVP 范围内只是图结构占位
 *  + 把字段保存到 flow.definition，等 master_data 阶段 3 接 UI Run 按钮。
 */
export function ManualTriggerNode({ data, selected }: NodeProps) {
  const d =
    (data as unknown as ManualTriggerNodeData) ||
    ({ paramsSchema: [] } as ManualTriggerNodeData);
  const count = d.paramsSchema?.length ?? 0;
  return (
    <NodeCard
      iconKind="manualTrigger"
      title={d.label || "Manual Trigger"}
      subtitle="Manual trigger · user fills params when running"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Params Schema" badge={count} main>
        {count === 0 ? (
          <span className="placeholder">
            未声明字段 · 运行时直接以无参数任务启动
          </span>
        ) : (
          <div className="text-[11px] text-slate-700 leading-snug font-mono break-all">
            {(d.paramsSchema || [])
              .slice(0, 4)
              .map((v) => `${v.name}:${v.type}`)
              .join(", ")}
            {count > 4 ? ` · +${count - 4}` : ""}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Schedule Trigger 节点：flow_engine 内置 APScheduler 按 cron 拉起。
 *
 *  节点上展示 cron + timezone。完整编辑放 PropertyPanel。
 *  "任务是否启用"由 Flow 级 `isEnabled` 决定（节点级 enabled badge 已移除——
 *  跟 Flow 级语义重复且容易让人误以为是一次性开关）。
 */
export function ScheduleTriggerNode({ data, selected }: NodeProps) {
  const d =
    (data as unknown as ScheduleTriggerNodeData) ||
    ({ cron: "" } as ScheduleTriggerNodeData);
  return (
    <NodeCard
      iconKind="scheduleTrigger"
      title={d.label || "Schedule Trigger"}
      subtitle="Scheduled trigger · driven by a cron expression"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Cron" main>
        {d.cron ? (
          <span className="font-mono text-xs text-slate-800">{d.cron}</span>
        ) : (
          <span className="placeholder">右侧填写 cron 表达式</span>
        )}
        <div className="text-[11px] text-slate-500 mt-0.5">
          {d.timezone || "Asia/Shanghai"}
        </div>
      </NodeSection>
    </NodeCard>
  );
}

/** Webhook Trigger 节点：外部系统 POST 到自动生成的 path 启动 flow。
 *
 *  节点上展示 path 占位（真实 path 由后端按 flow.id 生成；前端这里展示一个提示）+ auth 模式。
 *  完整配置放 PropertyPanel。
 */
export function WebhookTriggerNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as WebhookTriggerNodeData) || ({} as WebhookTriggerNodeData);
  const auth = d.auth || "none";
  // method 决定测试输入展示哪个：POST → body，GET → query。
  // 切换 method 不清空另一边的存储值（用户切回去想看到原数据）。
  const method = d.method || "POST";
  const isPost = method === "POST";

  // 订阅 runtime 状态——工具栏 Run 按钮会把模拟请求盖到这里（status=ok, text=body）。
  // 卡片上：左色条按状态着色 + Body 编辑器同时是"输入"也是"产物"。
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  // 测试请求：直接订阅本节点这一条，避免别的节点改动触发本节点 re-render
  const body = useFlowRuntime(
    (s) => s.flow.testRequests[id]?.body ?? "",
  );
  const query = useFlowRuntime(
    (s) => s.flow.testRequests[id]?.query ?? "",
  );
  const setTestRequestBody = useFlowRuntime((s) => s.setTestRequestBody);
  const setTestRequestQuery = useFlowRuntime((s) => s.setTestRequestQuery);

  const updateNodeData = useUpdateNodeData();

  // JSON 校验：empty / valid_json / invalid_json 三态徽标（仅 POST 用）
  const validation = useMemo(() => {
    if (!body.trim()) return { kind: "empty" as const };
    try {
      JSON.parse(body);
      return { kind: "valid_json" as const };
    } catch {
      return { kind: "invalid_json" as const };
    }
  }, [body]);

  // Query 解析结果：URLSearchParams 探一遍，给"解出 N 个键"徽标（仅 GET 用）
  const queryParsed = useMemo(() => {
    const qs = query.startsWith("?") ? query.slice(1) : query;
    if (!qs.trim()) return { count: 0 };
    try {
      const p = new URLSearchParams(qs);
      let n = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of p) n++;
      return { count: n };
    } catch {
      return { count: 0 };
    }
  }, [query]);

  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();

  return (
    <NodeCard
      iconKind="webhookTrigger"
      title={d.label || "Webhook Trigger"}
      subtitle={`HTTP trigger · external ${method} starts the flow`}
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Endpoint" main>
        {/* method 选择器内联在路径前——切换会立刻改写下面 "Test request" 区显示的输入框；
            外层 nodrag + stopPropagation 防止下拉框被拖动事件吞掉 */}
        <div
          className="flex items-center gap-1.5 nodrag"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <select
            className="text-[10px] font-mono font-semibold border rounded px-1 py-0.5 bg-white text-slate-700"
            value={method}
            onChange={(e) => updateNodeData(id, { method: e.target.value })}
            title="HTTP 方法 · 决定参数来源（POST=body / GET=query）"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
          <span className="font-mono text-[11px] text-slate-700 break-all">
            /webhooks/{`{flow_id}`}
          </span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span>auth：</span>
          <span className="font-mono">{auth}</span>
        </div>
      </NodeSection>
      <NodeSection label={isPost ? "Test body" : "Test query"}>
        {/* 运行时态的测试请求——保存在 useFlowRuntime.testRequests，不入库。
            method=POST 显示 body textarea；method=GET 显示 query 输入框（单行）。
            另一边的存储值保留但不展示，让用户能在 method 间无损切换。
            外层 nodrag + 阻止 mousedown 冒泡，避免编辑时被识别为拖动。 */}
        <div
          className="nodrag"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {isPost ? (
            <>
              <textarea
                className="w-full text-[10px] font-mono border rounded px-1.5 py-1 leading-snug resize-none bg-white"
                rows={4}
                value={body}
                placeholder={'{"id": "1"}'}
                spellCheck={false}
                onChange={(e) => setTestRequestBody(id, e.target.value)}
              />
              <div className="flex items-center justify-between mt-0.5 text-[10px]">
                <span>
                  {validation.kind === "empty" && (
                    <span className="text-slate-400">body 可选</span>
                  )}
                  {validation.kind === "valid_json" && (
                    <span className="text-emerald-600">✓ JSON</span>
                  )}
                  {validation.kind === "invalid_json" && (
                    <span className="text-amber-600">⚠ 非 JSON</span>
                  )}
                </span>
                {runtime?.finishedAt && (
                  <span
                    className="text-slate-400"
                    title={new Date(runtime.finishedAt).toLocaleString()}
                  >
                    Last run · {formatRelative(runtime.finishedAt)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <span
                  className="text-[10px] font-mono text-slate-400 select-none"
                  title="URL 查询串，如 id=1&foo=bar；下游用 {{trigger.query.id}} 引用"
                >
                  ?
                </span>
                <input
                  type="text"
                  className="flex-1 min-w-0 text-[10px] font-mono border rounded px-1.5 py-0.5 leading-snug bg-white"
                  value={query}
                  placeholder="id=1&foo=bar"
                  spellCheck={false}
                  onChange={(e) => setTestRequestQuery(id, e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between mt-0.5 text-[10px]">
                <span>
                  {queryParsed.count === 0 ? (
                    <span className="text-slate-400">query 可选</span>
                  ) : (
                    <span className="text-emerald-600">
                      ✓ {queryParsed.count} 个键
                    </span>
                  )}
                </span>
                {runtime?.finishedAt && (
                  <span
                    className="text-slate-400"
                    title={new Date(runtime.finishedAt).toLocaleString()}
                  >
                    Last run · {formatRelative(runtime.finishedAt)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </NodeSection>
    </NodeCard>
  );
}

/** 相对时间格式化——"30s ago" / "5m ago" / "2h ago"。
 *  仅给 Webhook 节点的 Last run caption 用，本想抽到 utils 但只有一处复用，先内置。
 */
function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function OutputNode({ id, data, selected }: NodeProps) {
  const d = (data as unknown as IONodeData) || {};
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  return (
    <NodeCard
      iconKind="output"
      title="Output"
      subtitle="Collects downstream output · shown in chat bubble"
      selected={selected}
      status={runtime?.status}
      streaming={isStreaming(runtime)}
    >
      <NodeSection
        label="Sink"
        main
        handle={{ id: "input", className: "handle-output" }}
      >
        <div className="text-xs text-slate-700">{d.label || "Final Output"}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          展示在聊天气泡，不再向下游流出
        </div>
        {/* 流式文本 / 错误明细统一搬到 PropertyPanel 的 Runtime 分区；节点头部已经
         * 通过流式三点动画（streaming）+ 左色条把"是否在动"传达清楚了。
         */}
      </NodeSection>
    </NodeCard>
  );
}

/** Response 节点：DAG 终点之一，渲染 JSON 模板作为本次触发的 HTTP 响应体。
 *
 *  画布上展示：
 *    - 顶部：status code 徽章（按 2xx/4xx/5xx 着色）
 *    - 主体：bodyTemplate 头两三行预览
 *    - 详细模板编辑 / headers 全在 PropertyPanel
 *
 *  没有 output handle —— Response 是叶子节点；只有左侧 input handle。
 */
export function ResponseNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as ResponseNodeData) || ({} as ResponseNodeData);
  const status = d.statusCode ?? 200;
  const preview = (d.bodyTemplate || "")
    .trim()
    .split("\n")
    .slice(0, 3)
    .join("\n");
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();
  return (
    <NodeCard
      iconKind="response"
      title={d.label || "Response"}
      subtitle="DAG sink · renders JSON body as the HTTP response"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
    >
      <NodeSection
        label="Body Template"
        main
        handle={{ id: "input", className: "handle-output" }}
        badge={
          <span
            className={
              "text-[10px] font-mono rounded px-1.5 py-px " +
              statusBadgeCls(status)
            }
          >
            {status}
          </span>
        }
      >
        {preview ? (
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap leading-snug font-mono line-clamp-3">
            {preview}
          </pre>
        ) : (
          <span className="placeholder">右侧编辑 JSON 模板</span>
        )}
        <div className="text-[10px] text-slate-400 mt-1">
          叶子节点 · 渲染结果作为 HTTP body 返回
        </div>
      </NodeSection>
    </NodeCard>
  );
}

/** HTTP 状态码徽章配色——按 2xx/3xx/4xx/5xx 大段着色，跟浏览器 devtools 习惯一致。 */
function statusBadgeCls(code: number): string {
  if (code >= 200 && code < 300) return "bg-emerald-100 text-emerald-700";
  if (code >= 300 && code < 400) return "bg-sky-100 text-sky-700";
  if (code >= 400 && code < 500) return "bg-amber-100 text-amber-700";
  if (code >= 500) return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

/** Prompt 节点：图上的一段 system 提示文字。
 *  右端 source 拉到 LLM 的 system 分区 target；运行时被合并进 system message。
 *  内容编辑放在 PropertyPanel，节点上只显示前两行预览。
 */
export function PromptNode({ data, selected }: NodeProps) {
  const d =
    (data as unknown as PromptNodeData) || ({ content: "" } as PromptNodeData);
  const preview = (d.content || "").trim().split("\n").slice(0, 2).join("\n");
  return (
    <NodeCard
      iconKind="prompt"
      title={d.label || "Prompt"}
      subtitle="System prompt · merged into the LLM system message"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-system" }}
    >
      <NodeSection label="Content" main>
        {preview ? (
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap leading-snug font-sans line-clamp-3">
            {preview}
          </pre>
        ) : (
          <span className="placeholder">右侧面板填写 prompt 内容</span>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Skill / Tool / MCP / Knowledge —— "能力节点"四件套
 *
 * 这四种节点都是"挂到 LLM 上的能力引用"。视觉规范统一为：
 *   - header   : icon + **Label**（用户对此节点的称呼） + kind 静态描述
 *   - body     : 一个 "NAME" 分区，展示选中的底层资源名（skill/tool/server/KBs）
 *   - footer   : output 图标 + handle
 *
 * 设计意图：画布是"网络拓扑视图"，节点上回答两件事——
 *   1. 我是谁？        → header（Label，用户命名）
 *   2. 我引用了什么？   → body（NAME，从 model_server / KB 选中的标识）
 * 详细配置（参数覆盖 / 描述 / tags 等）一律走右侧 PropertyPanel。
 */

/** Skill 节点：引用一个 .md playbook（model_server /v1/library/skills/list 列表中的项）。
 *  右端 source 拉到 LLM 的 skills 分区 target；运行时 flow_engine 拉取 playbook body
 *  注入 system message。Prompt 节点 vs Skill 节点：
 *  - Prompt 是 flow 内的临时文本（写完即丢）
 *  - Skill 是磁盘上跨 flow 复用的标准件（model_server 的 library 资产）
 */
export function SkillNode({ data, selected }: NodeProps) {
  const d = (data as unknown as SkillNodeData) || ({} as SkillNodeData);
  return (
    <NodeCard
      iconKind="skill"
      title={d.label || "Skill"}
      subtitle="Playbook · .md instructions injected into system"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-skills" }}
    >
      <NodeSection label="NAME" main>
        {d.name ? (
          <span className="font-mono text-xs text-slate-800">{d.name}</span>
        ) : (
          <span className="placeholder">右侧选择一个 skill (md)</span>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** LLM 节点：分区式卡片 + 多 handle。
 *
 * 端点布局（自上而下，对应 NodeCard 的多个 section + footer）：
 *   model  section   :   —— 主分区，无 handle
 *   input  section   : input  target (灰)        ← Chat Input 节点接进来
 *   system section   : system target (sky 青)    ← Prompt 节点接进来
 *   skills section   : skills target (lime 黄绿) ← Skill 节点接进来
 *   tools  section   : tools  target (amber 黄)
 *   mcp    section   : mcp    target (violet 紫)
 *   footer.right     : output source (brand 蓝)
 *
 * 连接方向：所有"提供方"节点（Input / Prompt / Skill / Tool / MCP）的右侧 source
 *          把线拉到 LLM 的左侧分区 target；edge.targetHandle 区分接到哪个分区。
 */
export function LLMNode({ id, data, selected }: NodeProps) {
  const d = (data as unknown as LLMNodeData) || {};
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);

  // 通过 useStore 订阅 edges 数组（节点 props 拿不到），useMemo 推导每个分区的连接计数
  const edges = useStore((s) => s.edges);
  const counts = useMemo(() => {
    let input = 0;
    let system = 0;
    let skills = 0;
    let knowledge = 0;
    let tools = 0;
    let mcp = 0;
    let output = 0;
    for (const e of edges) {
      if (e.target === id) {
        // 兼容历史 edge：未显式指定 targetHandle 的边视作接入 input（默认 handle）
        const h = e.targetHandle ?? "input";
        if (h === "input") input++;
        else if (h === "system") system++;
        else if (h === "skills") skills++;
        else if (h === "knowledge") knowledge++;
        else if (h === "tools") tools++;
        else if (h === "mcp") mcp++;
      }
      if (e.source === id && e.sourceHandle === "output") output++;
    }
    return { input, system, skills, knowledge, tools, mcp, output };
  }, [edges, id]);

  // runtime 数据（流式文本 / tool 调用 / 迭代数 / 错误）统一搬到右侧 PropertyPanel
  // 的 Runtime 分区展示。节点上只保留连接计数 + 头部状态徽章（流式时是三点动画）。
  return (
    <NodeCard
      iconKind="llm"
      title={d.label || "LLM"}
      subtitle="ReAct loop · iterates through tools to reach a final answer"
      selected={selected}
      status={runtime?.status}
      streaming={isStreaming(runtime)}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Model" main>
        {d.backend || d.model ? (
          <>
            <div className="font-medium truncate">
              {d.model || <span className="placeholder">未选模型</span>}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {d.backend || "?"} · T={d.temperature ?? "-"} · iter≤
              {d.max_iterations ?? "-"}
            </div>
          </>
        ) : (
          <span className="placeholder">右侧面板选择 backend / model</span>
        )}
      </NodeSection>

      {/* 以下 6 个连接型分区：标签 + ⓘ 悬浮说明 + 数量 + 左侧 handle 一行搞定，
       *  不再渲染 "已接入 N 个 xxx" / "连入 X 节点" 这种跟 badge 数字 / hint 重复的 body 文字。
       *  hint 文案跟 PropertyPanel ConnectedNodes 的 PORTS.hint 保持完全一致——三处统一。 */}
      <NodeSection
        label="Input"
        hint="用户消息 / 上游数据"
        badge={counts.input}
        handle={{ id: "input", className: "handle-input" }}
      />

      <NodeSection
        label="System"
        hint="Prompt 节点（拼进 system message）"
        badge={counts.system}
        badgeKind="system"
        handle={{ id: "system", className: "handle-system" }}
      />

      <NodeSection
        label="Skills"
        hint="Skill 节点（md playbook）"
        badge={counts.skills}
        badgeKind="skills"
        handle={{ id: "skills", className: "handle-skills" }}
      />

      <NodeSection
        label="Knowledge"
        hint="Knowledge 节点（KB / RAG）"
        badge={counts.knowledge}
        badgeKind="knowledge"
        handle={{ id: "knowledge", className: "handle-knowledge" }}
      />

      <NodeSection
        label="Tools"
        hint="Tool 节点（function calling）"
        badge={counts.tools}
        badgeKind="tools"
        handle={{ id: "tools", className: "handle-tools" }}
      />

      <NodeSection
        label="MCP"
        hint="MCP server（按 server 整体接入）"
        badge={counts.mcp}
        badgeKind="mcp"
        handle={{ id: "mcp", className: "handle-mcp" }}
      />
    </NodeCard>
  );
}

export function ToolNode({ id, data, selected }: NodeProps) {
  const d = (data as unknown as ToolNodeData) || ({} as ToolNodeData);
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  // paramOverrides 锁定数量——以 badge 形式挂到 NAME 分区右上，让用户在画布上
  // 一眼看到"这个 tool 被锁了几个参数"，详情看右侧 PropertyPanel。
  const lockedCount = Object.values(d.paramOverrides || {}).filter((v) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  }).length;
  return (
    <NodeCard
      iconKind="tool"
      title={d.label || "Tool"}
      subtitle="Local function · exposed to the LLM via function calling"
      selected={selected}
      status={runtime?.status}
      streaming={isStreaming(runtime)}
      outputHandle={{ id: "output", className: "handle-tools" }}
    >
      <NodeSection
        label="NAME"
        main
        badge={
          lockedCount > 0 ? (
            <span title={`${lockedCount} 个参数已锁`}>🔒 {lockedCount}</span>
          ) : undefined
        }
      >
        {d.name ? (
          <span className="font-mono text-xs text-slate-800">{d.name}</span>
        ) : (
          <span className="placeholder">右侧选择一个本地 tool</span>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Knowledge 节点：聚合若干个 KB 引用，连入 LLM 的 knowledge 分区。
 *
 *  Knowledge 跟 Skill/Tool/MCP 的区别：它是**多选**集合，NAME 分区展示前几个 id +
 *  badge 显示总数。其它视觉规范（Label 作 title / kind hint 作 subtitle）保持一致。
 *
 *  注意 data.kbIds 可能携带"已被用户在 KB 管理页删除"的 id；此处仅展示，
 *  连接到 LLM 的运行时启用集会在 computeEnabledKBsFromGraph 阶段再过滤一次，
 *  保证不会把脏 id 透传给 flow_engine。
 */
export function KnowledgeNode({ data, selected }: NodeProps) {
  const d =
    (data as unknown as KnowledgeNodeData) ||
    ({ kbIds: [] } as KnowledgeNodeData);
  const ids = d.kbIds || [];
  return (
    <NodeCard
      iconKind="knowledge"
      title={d.label || "RAG"}
      subtitle="RAG · provides retrieval or full-doc context to the LLM"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-knowledge" }}
    >
      <NodeSection
        label="NAME"
        main
        badge={ids.length > 0 ? ids.length : undefined}
      >
        {ids.length === 0 ? (
          <span className="placeholder">右侧选择一个或多个 KB</span>
        ) : (
          <div className="text-[11px] text-slate-700 leading-snug font-mono break-all">
            {ids.length <= 3
              ? ids.join(", ")
              : `${ids.slice(0, 3).join(", ")} · +${ids.length - 3}`}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

export function MCPNode({ data, selected }: NodeProps) {
  const d = (data as unknown as MCPNodeData) || ({ serverName: "" } as MCPNodeData);
  return (
    <NodeCard
      iconKind="mcp"
      title={d.label || "MCP Server"}
      subtitle="MCP Server · plugs in every tool the server exposes"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-mcp" }}
    >
      <NodeSection label="NAME" main>
        {d.serverName ? (
          <span className="font-mono text-xs text-slate-800">{d.serverName}</span>
        ) : (
          <span className="placeholder">右侧选择 MCP server</span>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** FileOutput 节点：终点节点，把上游 LLM 这一 turn 的最终文本/媒体变成可下载文件。
 *
 *  产物有三种（buildDownloadInfo 返回联合类型）：
 *    - text   : 直接把 LLM 的回复文本写成 md / txt / json（本地算 Blob，零网络）
 *    - binary : 从 LLM 回复里抽出第一个媒体 URL（音/图/视/PDF），fetch 真二进制写盘
 *    - error  : 用户选了 media 但文本里没媒体 URL；展示错误，不出下载按钮
 *
 *  视觉：节点上仅"预览 / 下载"两个按钮 + 错误态文案；元信息（filename / 大小 /
 *  完成时间）放右侧 PropertyPanel 的 Runtime 分区。完整预览走全屏 modal。
 */
export function FileOutputNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as FileOutputNodeData) ||
    ({} as FileOutputNodeData);
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // 只在 text + finishedAt 都齐时才出产物。turn running 中不会闪空 Blob，
  // 也跟 ChatPanel.send() 推进来的"完成态"语义一致。
  const info = useMemo(() => {
    if (!runtime?.text || !runtime?.finishedAt) return null;
    return buildDownloadInfo(d, {
      text: runtime.text,
      finishedAt: runtime.finishedAt,
    });
  }, [d, runtime]);

  /* 文本模式：直接本地构造 Blob URL，同步完成。
   * 二进制模式：异步 fetch URL → blob 缓存，下面 useEffect 处理。
   * 两条路汇成同一个 downloadUrl + sizeBytes，渲染层统一消费。
   */
  const textBlobUrl = useMemo(() => {
    if (!info || info.kind !== "text") return null;
    const blob = new Blob([info.content], { type: info.mime });
    return URL.createObjectURL(blob);
  }, [info]);

  // 二进制模式异步状态：跟随 info.url 变化做 fetch + revoke 旧 blob URL。
  const [binState, setBinState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok"; blobUrl: string; size: number }
    | { status: "error"; error: string }
  >({ status: "idle" });

  useEffect(() => {
    if (!info || info.kind !== "binary") {
      setBinState({ status: "idle" });
      return;
    }
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setBinState({ status: "loading" });

    fetch(info.url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        const blob = await r.blob();
        // 注意：服务端可能没设 mime（或设错了）。我们用 buildDownloadInfo 推出的
        // mime 重新 wrap，确保后续 <audio>/<img> 拿到正确 type。
        const reBlob = new Blob([blob], { type: info.mime });
        const url = URL.createObjectURL(reBlob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdBlobUrl = url;
        setBinState({ status: "ok", blobUrl: url, size: reBlob.size });
      })
      .catch((e) => {
        if (cancelled) return;
        setBinState({
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      });

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [info]);

  // 卸载时 revoke 文本模式的 blob URL（二进制模式由上面 useEffect 自己管）
  useEffect(() => {
    return () => {
      if (textBlobUrl) URL.revokeObjectURL(textBlobUrl);
    };
  }, [textBlobUrl]);

  // 统一渲染：把三类产物归并到 "需要展示什么按钮 / 文案" 这一层
  const downloadUrl =
    info?.kind === "text"
      ? textBlobUrl
      : info?.kind === "binary" && binState.status === "ok"
        ? binState.blobUrl
        : null;
  const sizeBytes =
    info?.kind === "text"
      ? info.size
      : info?.kind === "binary" && binState.status === "ok"
        ? binState.size
        : undefined;

  return (
    <>
      <NodeCard
        iconKind="fileOutput"
        title={d.label || "File Output"}
        subtitle="Saves this turn's final text or media as a downloadable file"
        selected={selected}
        status={runtime?.status}
        streaming={isStreaming(runtime)}
      >
        <NodeSection
          label="Config"
          main
          handle={{ id: "input", className: "handle-file" }}
        >
          <div className="text-[11px] text-slate-600 leading-snug">
            <div>
              前缀：
              <span className="font-mono text-slate-700">
                {d.filenamePrefix || "output"}
              </span>
            </div>
            <div>
              格式：
              <span className="font-mono text-slate-700">
                {d.format || "auto"}
              </span>
            </div>
          </div>
        </NodeSection>

        <NodeSection label="Artifact">
          {!info ? (
            <span className="placeholder">等待这个 flow 的 LLM 跑完一 turn…</span>
          ) : info.kind === "error" ? (
            <span className="text-[11px] text-rose-700">{info.reason}</span>
          ) : info.kind === "binary" &&
            (binState.status === "loading" || binState.status === "idle") ? (
            // idle 是 useEffect 触发前的一帧；并入 loading 文案，避免按钮先闪一下
            <span className="text-[11px] text-slate-500">
              获取媒体中…（{info.filename}）
            </span>
          ) : info.kind === "binary" && binState.status === "error" ? (
            <span className="text-[11px] text-rose-700">
              下载失败：{binState.error}
            </span>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex-1 text-[11px] rounded border border-slate-200 hover:border-orange-400 hover:bg-orange-50 px-2 py-1 text-slate-700"
                title={info.filename}
              >
                预览
              </button>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={info.filename}
                  className="flex-1 text-center text-[11px] rounded bg-orange-500 hover:bg-orange-600 text-white px-2 py-1"
                  title={
                    sizeBytes !== undefined
                      ? `下载 ${info.filename}（${formatBytes(sizeBytes)}）`
                      : `下载 ${info.filename}`
                  }
                >
                  ↓ 下载
                </a>
              )}
            </div>
          )}
        </NodeSection>
      </NodeCard>

      {previewOpen && info && info.kind !== "error" && (
        <FilePreviewModal
          filename={info.filename}
          // text artifact 用 actualFormat（md/txt/json）；binary artifact 用固定 "media"
          format={info.kind === "text" ? info.actualFormat : "media"}
          content={info.kind === "text" ? info.content : (info.inlineText || "")}
          mediaUrl={info.kind === "binary" ? downloadUrl : null}
          mediaMime={info.kind === "binary" ? info.mime : undefined}
          downloadUrl={downloadUrl}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}

/* ====================================================================
 * DAG 通用节点（5 个 MVP）
 *
 * 设计要点：
 *  - 这些节点的 PropertyPanel 表单做完整；运行时 inline run **不真跑**
 *    （runFlowToStore 只处理 chat trigger + LLM 节点链路）
 *  - handle 模型：
 *      File Input      : 仅 output（数据源，左侧无 input）
 *      HTTPRequest     : 左 input + 右 output
 *      Variable.read   : 仅 output；Variable.write : 仅 input（终点）
 *      Code            : 左 input + 右 output
 *      IfElse          : 左 input + 右两个 source handle (true/false)
 *
 *  - 节点 body 上**不显示运行时状态**——除了未来 DAG 引擎接通后真有 runtime 写入，
 *    现在挂状态条只会一直空白，反而干扰
 * ==================================================================== */

/** File Input：运行时让用户挑文件作为下游素材。
 *
 *  画布上有两个区域：
 *    - Accept   : 节点的约束配置摘要（accept / size / multiple / parseAs）
 *    - Test files : 跟 Chat Input 的 "Test input" 对称——画布内挑测试文件，
 *                  FlowToolbar 的 Run 按钮触发 inline run 时会被读取并附加到 user message
 *
 *  挑选的文件存进 `useFlowRuntime.flow.testFiles[id]` 共享给 inline runner；
 *  Chat 面板那条路径则在 ChatPanel 内部独立维护 pendingFiles，不通过这个 store
 *  （Chat 跟画布是两套独立 UI，但底层 buildUserInputWithAttachments helper 同款）。
 */
export function FileInputNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as FileInputNodeData) || ({} as FileInputNodeData);
  const accept = d.acceptMime || "*/*";
  const parseAs = d.parseAs || "raw";
  const sizeHint = d.maxBytes
    ? `≤ ${formatBytesShort(d.maxBytes)}`
    : "不限大小";

  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const testFiles = useFlowRuntime((s) => s.flow.testFiles[id]) || [];
  const setTestFiles = useFlowRuntime((s) => s.setTestFiles);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { ok, errors } = validateFilesAgainstConstraints(Array.from(files), {
      acceptMime: d.acceptMime || "",
      maxBytes: d.maxBytes || 0,
    });
    // 单文件模式：选了多个 → 仅取第一个；之前的 testFiles 全替换
    // 多文件模式：累积追加
    const merged = d.multiple ? [...testFiles, ...ok] : ok.slice(0, 1);
    setTestFiles(id, merged);
    setAttachError(errors.length ? errors.join("；") : null);
  }

  function removeAt(idx: number) {
    const next = testFiles.filter((_, i) => i !== idx);
    setTestFiles(id, next);
    setAttachError(null);
  }

  return (
    <NodeCard
      iconKind="fileInput"
      title={d.label || "File Input"}
      subtitle="Data source · user picks files at runtime"
      selected={selected}
      status={runtime?.status}
      streaming={isStreaming(runtime)}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection label="Accept" main>
        <span className="font-mono text-[11px] text-slate-700 break-all">
          {accept}
        </span>
        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
          <span>{d.multiple ? "多文件" : "单文件"}</span>
          <span>·</span>
          <span>{sizeHint}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider rounded bg-slate-100 text-slate-600 px-1 leading-tight">
            {parseAs}
          </span>
        </div>
      </NodeSection>

      {/* Test files 区域：画布内挑测试文件，inline run 会读 store 里这批文件
       *  跟主输入一起合成 user message 发给 LLM。
       *  - 单文件模式：picker 选完即替换；chip 上 × 清掉
       *  - 多文件模式：picker 选完累积；chip 上 × 移除单个
       *  统一交互模式（跟 UploadNode 一致）：
       *    [TEST FILES] ────── [Upload 按钮]
       *    [文件名…后缀]  [大小]  [×]
       *    [文件名…后缀]  [大小]  [×]
       */}
      <NodeSection
        label="Test files"
        headerRight={
          <button
            type="button"
            className="nodrag text-[11px] rounded border border-slate-200 hover:border-orange-400 hover:bg-orange-50 px-2 py-0.5 text-slate-700"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => fileInputRef.current?.click()}
            title={
              "上传测试文件 · 用于 Run 按钮 inline run" +
              (d.acceptMime ? ` · accept=${d.acceptMime}` : "") +
              (d.maxBytes ? ` · ≤${formatBytesShort(d.maxBytes)}` : "")
            }
          >
            {testFiles.length > 0
              ? d.multiple
                ? "+ 添加"
                : "替换"
              : "Upload"}
          </button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={d.acceptMime || undefined}
          multiple={!!d.multiple}
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />

        {testFiles.length > 0 ? (
          <div className="flex flex-col gap-1">
            {testFiles.map((f, i) => (
              <FileRow
                key={i}
                name={f.name}
                size={f.size}
                mime={f.type}
                onRemove={() => removeAt(i)}
              />
            ))}
          </div>
        ) : (
          <span className="placeholder text-[11px]">还没有文件</span>
        )}

        {attachError && (
          <div className="mt-1 text-[10px] text-rose-700">{attachError}</div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Upload：纯数据源节点——画布上让用户上传文件作为下游处理素材。
 *
 *  跟 FileInput 的关系：
 *    - FileInput 是 "LLM 输入侧" 的扩展：文件 → 拼进 user message；带完整约束
 *    - Upload    是 "数据源侧" 的入口：文件 → output 端口给下游 DAG 节点；**零约束**
 *
 *  设计：故意不放 accept / size / parseAs 任何配置，节点上也不显示一堆 chips
 *  之外的元信息——保持"丢文件进来"的最简交互。约束 / 解析交给真正消费它的下游节点。
 *
 *  storage 复用 useFlowRuntime.flow.testFiles[id]，跟 FileInput 一张表（只是
 *  不参与 LLM user message 合成）。DAG 引擎接通后从这张表里读文件本体。
 */
export function UploadNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as UploadNodeData) || ({} as UploadNodeData);
  const uploadedFiles = useFlowRuntime((s) => s.flow.testFiles[id]) || [];
  const setTestFiles = useFlowRuntime((s) => s.setTestFiles);
  const updateNodeData = useUpdateNodeData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rejectedHint, setRejectedHint] = useState<string | null>(null);
  // 上传态：idle/uploading/error。落库成功是写到 d.fileUrl，本地态不再单独存。
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(files)) {
      if (isExcelLikeFilename(f.name)) accepted.push(f);
      else rejected.push(f.name);
    }
    if (rejected.length > 0) {
      setRejectedHint(
        `已忽略 ${rejected.length} 个非表格文件：${rejected.slice(0, 2).join("，")}${rejected.length > 2 ? "…" : ""
        }（仅支持 ${EXCEL_ACCEPT_EXTENSIONS.join(" / ")}）`,
      );
    } else {
      setRejectedHint(null);
    }
    if (accepted.length === 0) return;

    const file = accepted[0];
    // 先丢进内存做即时预览；旧的 fileUrl 立刻作废免得后续把旧文件当新文件给到 webhook。
    setTestFiles(id, [file]);
    updateNodeData(id, {
      fileUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      uploadedAt: undefined,
    });
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const info = await uploadFile(file);
      updateNodeData(id, {
        fileUrl: info.url,
        fileName: info.originalName || file.name,
        fileSize: info.size || file.size,
        fileType: info.type || file.type,
        uploadedAt: new Date().toISOString(),
      });
      setUploadStatus("idle");
    } catch (e) {
      setUploadStatus("error");
      setUploadError(e instanceof Error ? e.message : String(e));
    }
  }

  function removeFile() {
    setTestFiles(id, []);
    updateNodeData(id, {
      fileUrl: undefined,
      fileName: undefined,
      fileSize: undefined,
      fileType: undefined,
      uploadedAt: undefined,
    });
    setUploadStatus("idle");
    setUploadError(null);
  }

  // 显示态：优先看 d.fileUrl（持久化的"已落库"），其次看 testFiles（本会话刚选的）。
  const hasUploaded = !!d.fileUrl;
  const hasLocal = uploadedFiles.length > 0;
  const displayName = d.fileName || uploadedFiles[0]?.name || "";
  const displaySize = d.fileSize ?? uploadedFiles[0]?.size ?? 0;

  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();

  return (
    <NodeCard
      iconKind="upload"
      title={d.label || "Upload Excel"}
      subtitle="Data source · xlsx / xls / csv → {sheet: rows[]}"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection
        label="File"
        main
        headerRight={
          <button
            type="button"
            className="nodrag text-[11px] rounded border border-slate-200 hover:border-purple-400 hover:bg-purple-50 px-2 py-0.5 text-slate-700 disabled:opacity-60"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadStatus === "uploading"}
            title={`仅支持 ${EXCEL_ACCEPT_EXTENSIONS.join(" / ")}`}
          >
            {hasUploaded || hasLocal ? "更换" : "Upload"}
          </button>
        }
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

        {hasUploaded || hasLocal ? (
          <div className="flex flex-col gap-1">
            <FileRow
              name={displayName}
              size={displaySize}
              mime={d.fileType}
              onRemove={removeFile}
            />
          </div>
        ) : (
          <span className="placeholder text-[11px]">还没有文件</span>
        )}

        {/* 状态行：上传态 / 落库态 / 默认 sheet 各一句，按需出现 */}
        {(uploadStatus !== "idle" || hasUploaded || (!hasUploaded && hasLocal) || d.activeSheet) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-snug">
            {uploadStatus === "uploading" && (
              <span className="text-amber-600">上传中…</span>
            )}
            {uploadStatus === "idle" && hasUploaded && (
              <span className="text-emerald-600">已落库</span>
            )}
            {uploadStatus === "idle" && !hasUploaded && hasLocal && (
              <span className="text-rose-600">仅本地 · 未落库</span>
            )}
            {uploadStatus === "error" && (
              <span className="text-rose-600">上传失败</span>
            )}
            {d.activeSheet && (hasUploaded || hasLocal) && (
              <span className="text-slate-500">
                默认 sheet：<b className="text-slate-700">{d.activeSheet}</b>
              </span>
            )}
          </div>
        )}

        {rejectedHint && (
          <div className="mt-1 text-[10px] text-rose-600 leading-snug">
            {rejectedHint}
          </div>
        )}

        {uploadError && (
          <div className="mt-1 text-[10px] text-rose-600 leading-snug" title={uploadError}>
            {uploadError.length > 80 ? uploadError.slice(0, 80) + "…" : uploadError}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** HTTPRequest：调用外部 REST API，把响应丢给下游。 */
export function HttpRequestNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as HttpRequestNodeData) ||
    ({ method: "GET", url: "" } as HttpRequestNodeData);
  const method = d.method || "GET";
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();
  return (
    <NodeCard
      iconKind="httpRequest"
      title={d.label || "HTTP Request"}
      subtitle="Data source · calls an external REST API"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection
        label="Endpoint"
        main
        handle={{ id: "input", className: "handle-input" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={
              "text-[10px] font-mono uppercase tracking-wider rounded px-1.5 py-px " +
              methodBadgeCls(method)
            }
          >
            {method}
          </span>
          {d.url ? (
            <span className="font-mono text-[11px] text-slate-700 truncate flex-1">
              {d.url}
            </span>
          ) : (
            <span className="placeholder flex-1">右侧填写 URL</span>
          )}
        </div>
      </NodeSection>
    </NodeCard>
  );
}

/** SQL：执行数据库查询，把 Row[] 给下游消费。
 *
 *  v2 画布卡片：只展示"connection 名称（异步取） · mode · table 或 query 首行"，
 *  详细配置在右侧 PropertyPanel。connectionId 为空时给"未选连接"提示。
 *
 *  Connection 名称的拉取走 useConnectionName（lib/connectionsStore），它会
 *  在组件挂载时按需 fetch 一次，并把结果缓存在 zustand store 里，避免每个 SQL
 *  节点各自一次请求。
 */
export function SqlNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as SqlNodeData) ||
    ({ connectionId: "", mode: "query" } as SqlNodeData);
  const connName = useConnectionName(d.connectionId);
  const mode = d.mode === "table" ? "table" : "query";
  const firstQueryLine = (d.query || "").split(/\r?\n/).find((l) => l.trim()) || "";
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();

  return (
    <NodeCard
      iconKind="sql"
      title={d.label || "SQL"}
      subtitle="Data source · query a relational DB"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection
        label="Connection"
        main
        handle={{ id: "input", className: "handle-input" }}
      >
        {d.connectionId ? (
          <span className="font-mono text-[11px] text-slate-700 truncate block">
            {connName || d.connectionId.slice(0, 8)}
          </span>
        ) : (
          <span className="placeholder">右侧选择 Connection</span>
        )}
      </NodeSection>
      <NodeSection label={mode === "table" ? "Table" : "Query"}>
        {mode === "table" ? (
          (d.table || "").trim() ? (
            <span className="font-mono text-[11px] text-slate-700 truncate block">
              {d.table}
            </span>
          ) : (
            <span className="placeholder">右侧填写 table 名</span>
          )
        ) : firstQueryLine ? (
          <span className="font-mono text-[11px] text-slate-700 truncate block">
            {firstQueryLine}
          </span>
        ) : (
          <span className="placeholder">右侧填写 SQL 语句</span>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Global Variables：flow.variables 的画布配置入口。
 *
 *  设计：
 *  - 不参与 DAG 执行 → 无 input / output handle
 *  - 画布上是只读概览（变量名 · 类型），编辑放在右侧 PropertyPanel
 *  - 读取数据靠 FlowContext.variables（FlowEditor 注入），节点 data 里不再存
 */
export function VariableNode({ data, selected }: NodeProps) {
  const d = (data as unknown as VariableNodeData) || {};
  const { variables } = useFlowContext();
  const visible = variables.slice(0, 4);
  const more = Math.max(0, variables.length - visible.length);
  return (
    <NodeCard
      iconKind="variable"
      title={d.label || "Global Variables"}
      subtitle="Edit flow-level variables · no execution role"
      selected={selected}
    >
      <NodeSection label={`Variables (${variables.length})`} main>
        {variables.length === 0 ? (
          <span className="placeholder">右侧添加变量</span>
        ) : (
          <div className="space-y-0.5">
            {visible.map((v) => (
              <div
                key={v.name}
                className="flex items-center gap-1.5 text-xs"
              >
                <span className="font-mono text-slate-800 truncate">
                  {v.name}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  {v.type}
                </span>
              </div>
            ))}
            {more > 0 && (
              <div className="text-[11px] text-slate-400">+ {more} more</div>
            )}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** Code：执行一段 JS / Python 处理上游 inputs，返回值给下游。 */
export function CodeNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as CodeNodeData) ||
    ({ language: "python", code: "" } as CodeNodeData);
  const lang = d.language || "python";
  const codeLines = (d.code || "").split("\n").length;
  const preview = (d.code || "")
    .trim()
    .split("\n")
    .slice(0, 2)
    .join("\n");
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();
  return (
    <NodeCard
      iconKind="code"
      title={d.label || "Code"}
      subtitle="Process · custom JS / Python script"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection
        label="Script"
        main
        handle={{ id: "input", className: "handle-input" }}
        badge={
          <span className="font-mono text-[10px] text-slate-600">{lang}</span>
        }
      >
        {preview ? (
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap leading-snug font-mono line-clamp-3">
            {preview}
          </pre>
        ) : (
          <span className="placeholder">右侧编辑脚本</span>
        )}
        <div className="text-[10px] text-slate-400 mt-1">
          {codeLines} 行 · 入参 inputs，返回值即 output
        </div>
      </NodeSection>
    </NodeCard>
  );
}

/** Transform：1 维表的数据处理流水线。
 *
 *  画布卡片很小——只展示 ops 数量徽章 + 头两步摘要，详细配置（含实时预览表）
 *  全在右栏 PropertyPanel。
 */
export function TransformNode({ data, selected }: NodeProps) {
  const d =
    (data as unknown as TransformNodeData) ||
    ({ ops: [] } as TransformNodeData);
  const ops = d.ops ?? [];
  const enabledCount = ops.filter((o) => o.enabled !== false).length;
  const preview = ops.slice(0, 2).map((o) => describeOp(o));
  return (
    <NodeCard
      iconKind="transform"
      title={d.label || "Transform"}
      subtitle="Process · 1D table pipeline (rename / type / filter / dedupe ...)"
      selected={selected}
      outputHandle={{ id: "output", className: "handle-output" }}
    >
      <NodeSection
        label="Pipeline"
        main
        handle={{ id: "input", className: "handle-input" }}
        badge={
          <span className="font-mono text-[10px] text-slate-600">
            {enabledCount}/{ops.length} steps
          </span>
        }
      >
        {ops.length === 0 ? (
          <span className="placeholder">右侧选列加操作；空 pipeline = 原样透传</span>
        ) : (
          <div className="text-[11px] text-slate-700 leading-snug space-y-0.5 font-mono line-clamp-3">
            {preview.map((line, i) => (
              <div key={i} className="truncate">
                {ops[i].enabled === false ? (
                  <span className="text-slate-300 line-through">{line}</span>
                ) : (
                  line
                )}
              </div>
            ))}
            {ops.length > 2 && (
              <div className="text-[10px] text-slate-400">
                +{ops.length - 2} more…
              </div>
            )}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** If/Else：二路条件分支。
 *
 *  没法用 NodeCard.outputHandle（它只支持单 source）；body 内手写两个分区，
 *  各自挂一个右侧 source handle。注意：左侧 input handle 仍然走 NodeSection.handle。
 */
export function IfElseNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as IfElseNodeData) ||
    ({ condition: "" } as IfElseNodeData);
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();
  return (
    <NodeCard
      iconKind="ifElse"
      title={d.label || "If / Else"}
      subtitle="Control flow · two-way conditional branch"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
    >
      <NodeSection
        label="Condition"
        main
        handle={{ id: "input", className: "handle-input" }}
      >
        {d.condition ? (
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap leading-snug font-mono line-clamp-3">
            {d.condition}
          </pre>
        ) : (
          <span className="placeholder">右侧填写条件表达式</span>
        )}
      </NodeSection>

      {/* 双 source handle：true / false。直接挂在 section 内，避免 NodeCard.footer 的
          单一 outputHandle 限制。颜色：true=emerald / false=rose，跟"通过 / 拒绝"语义一致。
          runtime.branch 命中时本条 section 加 ring 高亮，未命中那条灰阶减弱——
          一眼能看出"这次跑下来走的是哪条"。 */}
      <div
        className={clsx(
          "relative px-3 py-2 border-t flex items-center text-[11px] transition-all",
          runtime?.branch === "true"
            ? "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-400"
            : runtime?.branch === "false"
              ? "bg-emerald-50/20 text-emerald-700/50"
              : "bg-emerald-50/40 text-emerald-800",
        )}
      >
        <span className="font-mono">true</span>
        <span className="ml-auto text-[10px] text-slate-500">→ 满足条件</span>
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          className="handle-output !bg-emerald-500"
        />
      </div>
      <div
        className={clsx(
          "relative px-3 py-2 border-t flex items-center text-[11px] transition-all",
          runtime?.branch === "false"
            ? "bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-400"
            : runtime?.branch === "true"
              ? "bg-rose-50/20 text-rose-700/50"
              : "bg-rose-50/40 text-rose-800",
        )}
      >
        <span className="font-mono">false</span>
        <span className="ml-auto text-[10px] text-slate-500">→ 不满足</span>
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="handle-output !bg-rose-500"
        />
      </div>
    </NodeCard>
  );
}

/** Switch：多路条件分支（带 default）。
 *
 *  视觉上跟 IfElse 一脉相承：一个 input 进、多个 case 分区 + 一条固定的 default。
 *  每个 case 是独立的 Handle（**v2: id = case.value 字面量**），命中态加 ring 高亮。
 *
 *  注意：case.value 既是匹配值也是 handle id，改 value 等于换分支语义——已挂连线的
 *  sourceHandle 会对不上而断开。PropertyPanel.SwitchEditor 在有连线时会黄字告警。
 */
export function SwitchNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as SwitchNodeData) ||
    ({ expression: "", cases: [] } as SwitchNodeData);
  const cases = Array.isArray(d.cases) ? d.cases : [];
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();
  const matched = runtime?.branch || null;

  return (
    <NodeCard
      iconKind="switch"
      title={d.label || "Switch"}
      subtitle="Control flow · multi-way branch with default"
      selected={selected}
      status={runtime?.status}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
    >
      <NodeSection
        label="Expression"
        main
        handle={{ id: "input", className: "handle-input" }}
      >
        {d.expression ? (
          <pre className="text-[11px] text-slate-700 whitespace-pre-wrap leading-snug font-mono line-clamp-2">
            {d.expression}
          </pre>
        ) : (
          <span className="placeholder">右侧填写表达式</span>
        )}
      </NodeSection>

      {/* case 列表：每行一个独立 source handle。
          - handle id = case.value 字面量（v2 合并字段后没有单独的 id）
          - value 为空 / 跟保留字撞了 → 不渲染 handle（连不出去），文字给 placeholder 提示
          - 命中态：emerald 高亮；其它 case 灰阶减弱，跟 IfElse 体验一致
          - **key 用 idx**（不用 c.value）：value 改字时不会触发 remount → 不会让 React Flow
            连续注销 / 注册 handle，避免拖拽时出现"handle 不响应"的瞬态（这也是历史 bug
            "右端点有的没法连线出来"的根因——值改动期间 handle 重新挂载，hit-test 短暂失效）
       */}
      {cases.length === 0 ? (
        <div className="px-3 py-2 border-t text-[11px] text-slate-400 italic">
          右侧添加 case…
        </div>
      ) : (
        cases.map((c, idx) => {
          const v = (c.value || "").trim();
          const connectable = !!v && v !== "input" && v !== "output" && v !== "default";
          const hit = connectable && matched === v;
          const dimmed = matched && !hit && matched !== "default";
          return (
            <div
              key={idx}
              className={clsx(
                "relative px-3 py-2 border-t flex items-center text-[11px] transition-all",
                hit
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-400"
                  : dimmed
                    ? "bg-emerald-50/20 text-emerald-700/50"
                    : "bg-emerald-50/40 text-emerald-800",
              )}
            >
              {v ? (
                <span className="font-mono truncate flex-1 min-w-0" title={v}>
                  {v}
                </span>
              ) : (
                <span className="italic text-slate-400 flex-1 min-w-0">
                  (未填值)
                </span>
              )}
              <span className="ml-2 text-[10px] text-slate-500 shrink-0">
                {connectable ? "→ 命中分支" : "未启用"}
              </span>
              {connectable && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={v}
                  className="handle-output !bg-emerald-500"
                />
              )}
            </div>
          );
        })
      )}

      {/* default 永远存在；用 amber / rose 区别于具体 case 的 emerald */}
      <div
        className={clsx(
          "relative px-3 py-2 border-t flex items-center text-[11px] transition-all",
          matched === "default"
            ? "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-400"
            : matched
              ? "bg-amber-50/20 text-amber-700/50"
              : "bg-amber-50/40 text-amber-800",
        )}
      >
        <span className="font-mono">default</span>
        <span className="ml-auto text-[10px] text-slate-500">→ 兜底</span>
        <Handle
          type="source"
          position={Position.Right}
          id="default"
          className="handle-output !bg-amber-500"
        />
      </div>
    </NodeCard>
  );
}

/** Merge 节点：多入一出。
 *
 *  - target handle 一个就够——React Flow 的 target 可以接多条入边，不需要"每条入边一个 handle"
 *  - source handle 一个：合流之后继续往下
 *  - 没有配置项，所以画布上只显示一段静态说明
 *  - 命中态：运行成功后徽章显示来源数量（"merged from 1 / 2 / …"），方便定位
 */
export function MergeNode({ id, data, selected }: NodeProps) {
  const d =
    (data as unknown as MergeNodeData) || ({ label: "Merge" } as MergeNodeData);
  const runtime = useFlowRuntime((s) => s.byNodeId[id]);
  const rf = useReactFlow();
  const { flowId, variables } = useFlowContext();

  // 运行后从 result.output 推断"几路汇入"——透传单上游时是裸 output，多上游是 dict
  // 这里做个近似：若 output 是 plain object 且 key 看起来像 nodeId（含 `_` 或匹配前缀），按字典认；
  // 否则按"1 路透传"展示。展示不严谨没关系，准确数据看右侧 runtime 面板。
  const mergedCount = useMemo(() => {
    const out = runtime?.outputData;
    if (out && typeof out === "object" && !Array.isArray(out)) {
      const keys = Object.keys(out as Record<string, unknown>);
      const looksLikeNodeIds =
        keys.length > 0 &&
        keys.every((k) => /^[a-zA-Z][a-zA-Z0-9]*(_[A-Za-z0-9_-]+)?$/.test(k));
      if (looksLikeNodeIds && keys.length > 1) return keys.length;
    }
    return runtime?.status === "ok" ? 1 : 0;
  }, [runtime?.outputData, runtime?.status]);

  return (
    <NodeCard
      iconKind="merge"
      title={d.label || "Merge"}
      subtitle="Control flow · join branches into one stream"
      selected={selected}
      status={runtime?.status}
      outputHandle={{ id: "output", className: "handle-output" }}
      onRun={() => {
        void runSingleNodeFromStore(id, rf.getNodes(), rf.getEdges(), flowId, variables);
      }}
    >
      <NodeSection
        label="Inputs"
        main
        handle={{ id: "input", className: "handle-input" }}
      >
        <div className="text-[11px] text-slate-600 leading-snug">
          接多个分支入边；只要有任一分支跑通就向下继续。
        </div>
        {mergedCount > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-mono">
            merged · {mergedCount}
          </div>
        )}
      </NodeSection>
    </NodeCard>
  );
}

/** HTTP method 徽章配色——按动词语义分（GET 蓝/读、POST 绿/写、DELETE 红/删 …）。 */
function methodBadgeCls(m: string): string {
  switch (m) {
    case "GET":
      return "bg-blue-100 text-blue-700";
    case "POST":
      return "bg-emerald-100 text-emerald-700";
    case "PUT":
      return "bg-amber-100 text-amber-700";
    case "PATCH":
      return "bg-violet-100 text-violet-700";
    case "DELETE":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

/** 文件大小友好显示——节点上空间小，1 KB / 1.5 MB 这种短形式即可。 */
function formatBytesShort(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export const nodeTypes = {
  input: InputNode,
  manualTrigger: ManualTriggerNode,
  scheduleTrigger: ScheduleTriggerNode,
  webhookTrigger: WebhookTriggerNode,
  prompt: PromptNode,
  skill: SkillNode,
  knowledge: KnowledgeNode,
  output: OutputNode,
  response: ResponseNode,
  llm: LLMNode,
  tool: ToolNode,
  mcp: MCPNode,
  fileOutput: FileOutputNode,
  fileInput: FileInputNode,
  upload: UploadNode,
  httpRequest: HttpRequestNode,
  sql: SqlNode,
  variable: VariableNode,
  code: CodeNode,
  ifElse: IfElseNode,
  switch: SwitchNode,
  merge: MergeNode,
  transform: TransformNode,
};
