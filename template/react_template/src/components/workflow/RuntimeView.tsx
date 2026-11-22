"use client";

/** 节点运行时视图（统一组件）
 *
 * 设计动机：
 *  - 历史上每个节点（LLMNode / ToolNode / OutputNode / FileOutputNode）都自己嵌一段
 *    runtime UI（流式文本 / tool 调用列表 / 状态文字）。
 *  - 画布上的"信息密度太高"——节点变成一个迷你日志面板，跑完后还占着屏幕。
 *
 * 现在统一收口到这里：
 *  - 节点本身只保留头部状态徽章（spinner / 流式动画 / ✓ / ✗）+ 左色条；
 *  - 详细 runtime 数据（文本、tool calls、迭代数、错误）在右侧 PropertyPanel 中
 *    展示——只在选中节点时显示，不打扰画布主视图。
 *
 * 这个文件导出三个东西：
 *   - StreamingTextBox：流式文本框（自动滚到底；run 完后允许用户回看）
 *   - ToolCallRow：单条 tool 调用行（小色点 + name + 状态文字）
 *   - RuntimePanel：根据节点类型自适应展示 runtime 字段的"右侧面板片段"
 *
 * RuntimePanel 是泛型的——它根据 useFlowRuntime 中**实际有的字段**渲染，节点
 * 类型只决定语言（"输入" vs "调用结果" vs "最终回复"），不决定结构。
 */

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import {
  useFlowRuntime,
  type NodeRunStatus,
  type RuntimeNodeState,
  type ToolCallView,
} from "./lib/flowRuntimeStore";

/* ====================================================================
 * StreamingTextBox · 流式文本展示
 *
 * 跑中：每次 text 变化把 scrollTop 顶到底；
 * 跑完 / 出错：不动，让用户回看历史不被强行拉回底部。
 * ==================================================================== */
export function StreamingTextBox({
  text,
  status,
  className,
}: {
  text: string;
  status?: NodeRunStatus;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status !== "running") return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text, status]);
  return (
    <div
      ref={ref}
      className={clsx(
        "text-[12px] text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap leading-snug",
        "bg-slate-50 rounded px-2 py-1.5 border border-slate-200",
        className
      )}
    >
      {text}
    </div>
  );
}

/* ====================================================================
 * ToolCallRow · 单条 tool 调用展示
 *
 * 状态颜色：error(红) > done(emerald) > running(sky 闪烁)
 * ==================================================================== */
export function ToolCallRow({ tc }: { tc: ToolCallView }) {
  const dotCls = tc.error
    ? "bg-rose-500"
    : tc.result != null
    ? "bg-emerald-500"
    : "bg-sky-400 animate-pulse";
  const trail = tc.error
    ? `· error: ${tc.error}`
    : tc.result != null
    ? `· ok`
    : `· running…`;
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      title={tc.error || tc.result || ""}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", dotCls)} />
      <span className="font-mono text-slate-700">{tc.name || "?"}</span>
      <span className="text-slate-400 truncate">{trail}</span>
    </div>
  );
}

/* ====================================================================
 * 工具：JSON.stringify 容错（循环引用 / BigInt 等异常退回 String）
 * ==================================================================== */
function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/* ====================================================================
 * RuntimePanel · 根据节点类型展示运行时数据
 *
 * 调用约定：传 nodeId + nodeType；内部订阅 useFlowRuntime。
 * 渲染策略：
 *   - 没有 runtime entry  → "尚未运行" 占位（统一信息密度）
 *   - 有 entry 但 status==idle → 仍展示，按字段是否存在渲染
 *   - 字段存在则渲染对应小节；不存在跳过（不强制每节点都铺满）
 *
 * 节点类型对字段的含义：
 *   llm        : text=最终回复 / toolCalls=本 turn 调用 / iterations=ReAct 步数
 *   tool       : args=入参 / result=出参 / error=异常
 *   input      : 仅 status + 时间（没有产物）
 *   output     : text=收到的最终回复
 *   fileOutput : text=可下载文本 / finishedAt=完成时间
 *   其它       : 通用渲染（status / error）
 * ==================================================================== */
export function RuntimePanel({
  nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const runtime = useFlowRuntime((s) => s.byNodeId[nodeId]);
  const clearNode = useFlowRuntime((s) => s.clearNode);

  return (
    <div className="rounded border bg-slate-50/60">
      <div className="px-2 py-1.5 border-b border-slate-200/70 flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Runtime
        </span>
        {runtime?.status && runtime.status !== "idle" && (
          <RuntimeStatusBadge status={runtime.status} />
        )}
        {runtime?.iterations != null && (
          <span className="text-[10px] font-mono text-slate-500">
            iter {runtime.iterations}
          </span>
        )}
        <div className="flex-1" />
        {runtime ? (
          <button
            type="button"
            onClick={() => clearNode(nodeId)}
            className="text-[11px] text-slate-500 hover:text-rose-600"
            title="清除此节点的运行时数据"
          >
            清除
          </button>
        ) : (
          <span className="text-[10px] text-slate-400">empty</span>
        )}
      </div>

      <div className="p-2 space-y-2">
        {!runtime ? (
          <div className="italic text-[11px] text-slate-400">
            尚未运行。点击画布右上角运行按钮，或在 Chat 面板用此 flow 跑一 turn。
          </div>
        ) : (
          <RuntimeBody runtime={runtime} nodeType={nodeType} />
        )}
      </div>
    </div>
  );
}

/** 按 nodeType 给 runtime.text 起一个"贴切的中文标签"。
 *  缺失则用默认 "文本"。集中放一张表，加新节点类型时只改这里。 */
const TEXT_LABEL_BY_TYPE: Record<string, string> = {
  // chat / ReAct
  llm: "最终回复",
  tool: "调用结果",
  fileOutput: "文件内容",
  output: "输出文本",
  // DAG
  webhookTrigger: "请求体",
  ifElse: "分支决策",
  switch: "分支决策",
  merge: "合流结果",
  upload: "解析摘要",
  code: "返回值",
  response: "渲染响应",
  sql: "查询结果",
  httpRequest: "HTTP 响应",
};

/** 头部小状态徽章 */
function RuntimeStatusBadge({ status }: { status: NodeRunStatus }) {
  const cls =
    status === "running"
      ? "bg-sky-100 text-sky-700"
      : status === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : status === "error"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-700";
  return (
    <span
      className={clsx(
        "text-[10px] font-mono rounded-full px-1.5 py-px",
        cls
      )}
    >
      {status}
    </span>
  );
}

/** 主体——按字段是否存在分别渲染。 */
function RuntimeBody({
  runtime,
  nodeType,
}: {
  runtime: RuntimeNodeState;
  nodeType: string;
}) {
  // 时间线：startedAt / finishedAt / 当前耗时
  const timing = formatTiming(runtime);

  // 主文本：tool 节点优先用 result（语义更精确；result 在 store 里跟 text 同步写入，
  // 但展示上 "result" 比 "text" 更贴 tool 节点的语义）
  const mainText =
    nodeType === "tool" ? runtime.result || runtime.text : runtime.text;
  const textLabel = TEXT_LABEL_BY_TYPE[nodeType] ?? "文本";

  return (
    <>
      {timing && (
        <div className="text-[11px] text-slate-500">{timing}</div>
      )}

      {nodeType === "tool" && runtime.args !== undefined && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            入参
          </div>
          <pre className="text-[11px] font-mono text-slate-700 bg-slate-50 rounded px-2 py-1.5 border border-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
            {safeStringify(runtime.args)}
          </pre>
        </div>
      )}

      {mainText && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            {textLabel}
          </div>
          <StreamingTextBox text={mainText} status={runtime.status} />
        </div>
      )}

      {runtime.toolCalls && runtime.toolCalls.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Tool 调用 ({runtime.toolCalls.length})
          </div>
          <div className="space-y-1">
            {runtime.toolCalls.map((tc) => (
              <ToolCallRow key={tc.id} tc={tc} />
            ))}
          </div>
        </div>
      )}

      {runtime.error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1.5 leading-snug break-words">
          ✗ {runtime.error}
        </div>
      )}

      {/* 没有任何字段（极少见——通常 status 至少存在）时给个最小提示 */}
      {!runtime.error &&
        !mainText &&
        !(runtime.toolCalls && runtime.toolCalls.length) &&
        runtime.args === undefined &&
        !timing && (
          <div className="text-[11px] text-slate-400 italic">
            状态为 {runtime.status}，但还没有产物。
          </div>
        )}
    </>
  );
}

/** 把 startedAt / finishedAt 转一行人话；running 时显示已耗时（基于 startedAt）。
 *
 * 故意只在 startedAt 存在时计算。比如刚 setNodeStatus("running") 但 store 里
 * 时间戳还没刷新的极短窗口里，宁可不渲染也不展示 NaN。
 */
function formatTiming(rt: RuntimeNodeState): string | null {
  if (!rt.startedAt) return null;
  const start = new Date(rt.startedAt).toLocaleTimeString();
  if (rt.finishedAt) {
    const cost = ((rt.finishedAt - rt.startedAt) / 1000).toFixed(2);
    return `开始于 ${start} · 耗时 ${cost}s`;
  }
  // running：用 startedAt 估个"已经跑了多久"，但避免使用 Date.now() 触发实时更新
  // —— 那需要计时器订阅 React state，性价比低。直接展示开始时间足以。
  return `开始于 ${start} · 仍在运行…`;
}
