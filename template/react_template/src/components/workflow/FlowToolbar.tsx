"use client";

import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useReactFlow, type Edge, type Node } from "@xyflow/react";
import type { Flow } from "./lib/types";
import { buildFlowSnapshot } from "./lib/flowSnapshot";
import { buildFlowDefinition } from "./lib/flowDefinition";
import { runWholeDagFromStore } from "./lib/dagSimulators";

/* ====================================================================
 * FlowToolbar · 画布右上角的图标操作组
 *
 * 按钮顺序（自左向右）：
 *   1. Run         : 根据 flow.triggerType 选择行为
 *                    - chat              : 在画布内 inline 跑（runFlowToStore），运行
 *                                          产物直接显示在节点上；跑中变红色 Stop
 *                    - webhook / schedule: 跑整张 DAG（runWholeDagFromStore → SSE）
 *                                          走同一个组件 DagRunButton，区别仅在找哪个
 *                                          入口节点 + tooltip 文案
 *                    - manual            : 由 master_data 调度器接入；前端 disabled
 *   2. OpenInChat  : 仅 chat 触发时显示——直达 /chat?flowId=... 的图标快捷入口
 *   3. Save        : 持久化当前画布；dirty 高亮，saving 转 spinner，已保存禁用
 *   4. Test ▾      : 折叠菜单（获取数据 …）
 *
 * 全部用 inline SVG（lucide 风格），跟 nodes/index.tsx 的 NodeIcon 一致。
 * ==================================================================== */

type Props = {
  flow: Flow;
  /** 画布上实时的 nodes（FlowEditor 单独维护，不同步到 flow.state） */
  nodes: Node[];
  /** 画布上实时的 edges */
  edges: Edge[];
  saving: boolean;
  dirty: boolean;
  savedAt: Date | null;
  onSave: () => void;
  /** 当前是否正在 inline run（FlowEditor 维护） */
  running: boolean;
  /** 触发 inline run；只在 flow.triggerType === "chat" 时有意义 */
  onRun: () => void;
  /** 用户点 Stop 时调用——FlowEditor 内 abortController.abort() */
  onStop: () => void;
};

export function FlowToolbar({
  flow,
  nodes,
  edges,
  saving,
  dirty,
  savedAt,
  onSave,
  running,
  onRun,
  onStop,
}: Props) {
  return (
    <div className="pointer-events-auto bg-white/95 backdrop-blur rounded-lg border border-slate-200 shadow-sm flex items-stretch divide-x divide-slate-200">
      <RunButton flow={flow} running={running} onRun={onRun} onStop={onStop} />
      {/* chat 触发时：把"在 Chat 页面打开"作为一个独立图标紧挨 Run 放出来——
       *  比埋在 Test ▾ 菜单里少一次点击；triggerType 不是 chat 时整个按钮不渲染。 */}
      {flow.triggerType === "chat" && <OpenInChatButton flowId={flow.id} />}
      <SaveButton onSave={onSave} saving={saving} dirty={dirty} savedAt={savedAt} />
      <TestMenu flow={flow} nodes={nodes} edges={edges} />
    </div>
  );
}

/* ===================================================================
 * OpenInChatButton · 仅 chat 触发时显示的"去聊天页"快捷入口
 *
 * 设计：纯图标 Link（react-router 客户端导航），样式跟其它 toolbar 按钮一致——
 * 沿用 btnCls 让"点击区高度 / 圆角 / hover 反馈"统一。
 *
 * 放外面而不是埋进 Test ▾，是因为 chat flow 的典型使用动线就是"编辑 → 跳去聊"，
 * 多藏一层菜单浪费一次点击。
 * =================================================================== */
function OpenInChatButton({ flowId }: { flowId: string }) {
  return (
    <Link
      to={`/llm?flowId=${encodeURIComponent(flowId)}`}
      className={btnCls("text-sky-600 hover:bg-sky-50")}
      title="在 Chat 页面打开（多轮聊天 · 完整记录历史）"
      aria-label="在 Chat 页面打开"
    >
      <ChatIcon />
    </Link>
  );
}

/* ===================================================================
 * Run · 按 triggerType 分发
 *
 * chat 类 flow 的 Run 行为：
 *   - 默认：▶ play，brand 绿，点击触发 onRun（inline 跑画布）
 *   - 跑中：■ stop，rose 红，点击触发 onStop（abort）
 *
 * webhook / schedule：走 DagRunButton，差别仅是找哪个入口节点。
 * manual：master_data 暂未接入，前端 disabled。
 * =================================================================== */

function RunButton({
  flow,
  running,
  onRun,
  onStop,
}: {
  flow: Flow;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
}) {
  if (flow.triggerType === "chat") {
    if (running) {
      return (
        <button
          type="button"
          onClick={onStop}
          className={btnCls("text-rose-600 hover:bg-rose-50")}
          title="停止运行"
          aria-label="停止"
        >
          <StopIcon />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onRun}
        className={btnCls("text-emerald-600 hover:bg-emerald-50")}
        title="在画布内运行（使用 Chat Input 节点的输入）"
        aria-label="运行"
      >
        <PlayIcon />
      </button>
    );
  }
  if (flow.triggerType === "webhook") {
    return (
      <DagRunButton
        flow={flow}
        entryType="webhookTrigger"
        entryLabel="Webhook Trigger"
        runningTitle="正在按拓扑顺序跑 DAG…"
        idleTitle="从 Webhook Trigger 开始跑整张 DAG（使用画布上各节点的测试输入）"
      />
    );
  }
  if (flow.triggerType === "schedule") {
    return (
      <DagRunButton
        flow={flow}
        entryType="scheduleTrigger"
        entryLabel="Schedule Trigger"
        runningTitle="正在模拟一次 cron 触发…"
        idleTitle="模拟一次 cron 触发，跑整张 DAG（生产由 flow_engine APScheduler 按 cron 自动拉起）"
      />
    );
  }
  // manual：触发由 master_data 调度器接入；前端先 disabled
  return (
    <button
      type="button"
      disabled
      className={btnCls("text-slate-400 cursor-not-allowed")}
      title={`triggerType=${flow.triggerType} 的运行由 master_data 调度器接入；前端尚不能 inline 跑`}
      aria-label="运行（尚未实现）"
    >
      <PlayIcon />
    </button>
  );
}

/* ===================================================================
 * DagRunButton · webhook / schedule 类 flow 的"全图跑"按钮
 *
 * 设计：
 *   - 在画布找到首个 entryType 节点作为起点；找不到 → disabled + tooltip 提示
 *   - 调用 runWholeDagFromStore：浏览器 POST 9750/api/flows/<id>/dag/test-flow，
 *     BFF 透传到 9730（flow_engine），SSE 流回 DagEvent → applyEvent 写 store。
 *   - 跟随聚焦：每收到 node_started 事件把视角居中到那个节点。
 *   - 与节点上的 ▶ 互补：节点 ▶ = "只跑这一个"（前置上游必须 ok）；本按钮 = "整张 DAG"。
 *
 * webhook / schedule 复用同一个组件是因为前端这一侧两者执行链路完全相同——
 * trigger payload 的差异在服务端 executor 内部处理（webhookTrigger 读 body/query，
 * scheduleTrigger 读 paramsJson + 节点 cron/tz），前端只负责"起跑 + drain SSE"。
 * =================================================================== */

function DagRunButton({
  flow,
  entryType,
  entryLabel,
  runningTitle,
  idleTitle,
}: {
  flow: Flow;
  /** 入口节点类型，比如 "webhookTrigger" / "scheduleTrigger" */
  entryType: string;
  /** 用户能看懂的中文/英文名称，用在错误 tooltip 里 */
  entryLabel: string;
  runningTitle: string;
  idleTitle: string;
}) {
  const rf = useReactFlow();
  const [running, setRunning] = useState(false);

  // 找首个入口节点；列表稳定时 useMemo 让 deps 干净
  const entryNodeId = useMemo(
    () => flow.nodes.find((n) => n.type === entryType)?.id,
    [flow.nodes, entryType],
  );

  if (!entryNodeId) {
    return (
      <button
        type="button"
        disabled
        className={btnCls("text-slate-400 cursor-not-allowed")}
        title={`当前 flow 还没有 ${entryLabel} 节点；先从左侧拖一个到画布。`}
        aria-label={`运行（缺 ${entryLabel} 节点）`}
      >
        <PlayIcon />
      </button>
    );
  }

  async function run() {
    if (running) return;
    setRunning(true);
    // 起跑前先把视野拉到入口节点附近——用户至少看到第一步在哪
    rf.fitView({
      nodes: [{ id: entryNodeId! }],
      duration: 300,
      padding: 0.6,
      maxZoom: 1.2,
    });
    try {
      await runWholeDagFromStore(
        entryNodeId!,
        rf.getNodes(),
        rf.getEdges(),
        flow.id,
        flow.variables,
        (ev) => {
          // 跟随聚焦：每收到 node_started 事件把视角居中到那个节点。
          // 故意只听 node_started 不听 node_completed——避免每个节点上"开始→完成"两次
          // 抖动；用户看到的是"光标移到节点 → 节点跑完 → 光标移到下一个"的清晰节奏。
          if (ev.type === "node_started") {
            rf.fitView({
              nodes: [{ id: ev.nodeId }],
              duration: 250,
              padding: 0.6,
              maxZoom: 1.2,
            });
          }
        },
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={running}
      className={btnCls(
        running
          ? "text-emerald-500/60 cursor-wait"
          : "text-emerald-600 hover:bg-emerald-50",
      )}
      title={running ? runningTitle : idleTitle}
      aria-label="运行整张 DAG"
    >
      <PlayIcon />
    </button>
  );
}

/* ===================================================================
 * Save · 三态（dirty / saving / saved）
 * =================================================================== */

function SaveButton({
  onSave,
  saving,
  dirty,
  savedAt,
}: {
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  savedAt: Date | null;
}) {
  const disabled = saving || !dirty;

  // tooltip 始终展示「上次保存时间」作为主信息；dirty / saving 在前面加状态前缀。
  // 这样用户 hover 时能一眼看到两件事：现在状态 + 最近一次成功保存的时间点。
  const lastSavedLine = savedAt
    ? `上次保存于 ${formatTime(savedAt)}`
    : "尚未保存过";
  const title = saving
    ? `正在保存…\n${lastSavedLine}`
    : dirty
    ? `有未保存的更改 (Ctrl/⌘+S)\n${lastSavedLine}`
    : lastSavedLine;

  const cls = saving
    ? "text-slate-400"
    : dirty
    ? "text-brand-600 hover:bg-brand-50"
    : "text-emerald-600";

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={disabled}
      className={btnCls("relative", cls, disabled && "cursor-default")}
      title={title}
      aria-label={title}
    >
      {saving ? <SpinnerIcon /> : dirty ? <SaveIcon /> : <CheckIcon />}
      {/* 角标：dirty 时右上角一颗小红点，提醒"还没保存"。
       *  saving / saved 时不显示，避免视觉噪音。
       *  ring-white 让红点在任何 hover 背景下都能保持轮廓。
       */}
      {dirty && !saving && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"
        />
      )}
    </button>
  );
}

/** HH:MM:SS 本地时间——toLocaleTimeString() 默认就是这个格式，
 *  抽出来是为了未来可能要加日期 / 多语言时改一处即可。
 */
function formatTime(d: Date): string {
  return d.toLocaleTimeString();
}

/* ===================================================================
 * Test ▾ · 折叠菜单
 *
 * 这是个"开发者抽屉"——目前只放一项「获取数据」。后面预留位置：
 *   - 复制 flow JSON 到剪贴板
 *   - 校验 flow（无孤立节点 / 至少一个 LLM …）
 *   - dry-run（不真发请求，模拟一遍图遍历）
 * =================================================================== */

function TestMenu({
  flow,
  nodes,
  edges,
}: {
  flow: Flow;
  nodes: Node[];
  edges: Edge[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dumpFlow() {
    // 真实快照：flow 元信息 + 画布最新 nodes/edges。复用 lib/flowSnapshot 的 helper，
    // 保证跟 runInline / save 三个调用点的口径完全一致（避免某处遗漏 sourceHandle 这种
    // 隐蔽 bug）。
    const snapshot = buildFlowSnapshot(flow, nodes, edges);

    // 派生 master_data Definition——跟 flowToSaveDto 走的是同一个 builder，
    // 所以这里 console.log 出来的就是真正会被 PUT 到 master_data 的 JSON 内容。
    // 对调试两类问题特别有用：
    //   - "保存成功但取出来字段丢了" → 看 def 对象哪个 key 没出现
    //   - "字段太大触发存储限制"     → 看 defString.length
    const def = buildFlowDefinition(snapshot);

    /* eslint-disable no-console */
    console.group(`%c[Flow] ${flow.name} · ${flow.id}`, "color:#2563eb;font-weight:600");
    console.log("snapshot   :", snapshot);
    console.log("definition :", def);
    console.groupEnd();
    /* eslint-enable no-console */
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={btnCls(
          "text-slate-600 hover:bg-slate-50",
          open && "bg-slate-100"
        )}
        title="测试 / 调试工具"
        aria-label="测试"
        aria-expanded={open}
      >
        <FlaskIcon />
        <span className="ml-0.5 -mr-0.5">
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 min-w-[220px] bg-white border rounded-lg shadow-lg py-1 z-30"
        >
          <MenuItem
            icon={<DataIcon />}
            label="获取数据"
            hint="console.log 当前 flow 快照"
            onClick={dumpFlow}
          />
          {/* "在 Chat 页面打开"已挪到外层工具栏（OpenInChatButton）；这里留菜单位置预备
              后续测试 / 调试动作，例如：复制 flow JSON 到剪贴板、dry-run 等。 */}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-start gap-2"
    >
      <span className="text-slate-500 mt-0.5">{icon}</span>
      <span className="flex-1">
        <div className="text-sm text-slate-800">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </span>
    </button>
  );
}

/* ===================================================================
 * 通用样式 + 图标
 * =================================================================== */

function btnCls(...mods: (string | false | undefined)[]) {
  return clsx(
    "h-9 px-2.5 inline-flex items-center justify-center transition-colors",
    "first:rounded-l-lg last:rounded-r-lg",
    ...mods
  );
}

const svgCommon = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlayIcon() {
  return (
    <svg {...svgCommon}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function StopIcon() {
  // 实心方块——比"播放/暂停"双图标对照下更直观；fill currentColor 而非 stroke
  return (
    <svg {...svgCommon} fill="currentColor" stroke="none">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ChatIcon() {
  // message-square：跟 input 节点同源，但是右上角语义是"前往 chat"，颜色另定
  return (
    <svg {...svgCommon}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg {...svgCommon}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...svgCommon}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SpinnerIcon() {
  // 旋转动画：tailwind animate-spin 给外层 svg；只画一段弧
  return (
    <svg
      {...svgCommon}
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg {...svgCommon}>
      <path d="M10 2v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2" />
      <path d="M8 2h8" />
      <path d="M6.5 14h11" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      {...svgCommon}
      width={12}
      height={12}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function DataIcon() {
  // file-json：文件 + 中间一个数据括号
  return (
    <svg {...svgCommon}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M10 13a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
      <path d="M14 13a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1 1 1 0 0 0-1 1v1a1 1 0 0 1-1 1" />
    </svg>
  );
}
