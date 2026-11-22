"use client";

import { useMemo, useState } from "react";

import type { FlowNodeKind } from "./lib/types";

type Props = {
  /** 当前画布上正在使用的 trigger 节点 kind；让我们把同 kind 的可拖项标灰、阻止再拖。
   *  没有 trigger 时为 undefined / null，所有 trigger 项都可拖。
   */
  triggerInUse?: FlowNodeKind | null;
};

/* ===================================================================
 * Components 面板（节点拖拽 + 搜索 + 分组折叠）
 *
 * 6 个分组（按"信息流向"自顶向下组织）：
 *   1. Trigger      触发条件：chat / webhook / schedule / manual ——每个 flow 唯一
 *   2. LLM          大模型：llm + 喂给它的素材（file input / prompt / skill /
 *                    rag / tool / mcp / agent）
 *   3. Output       输出：output / file output / response
 *   4. Data Source  数据源：upload excel / sql / http request / global variables
 *   5. Process      数据处理：code / transform / pivot
 *   6. Logic        逻辑：if-else / switch / loop / merge
 *
 * available=true 的项目可拖拽并通过 dataTransfer 传 FlowNodeKind 到画布；
 * available=false 的项目展示为 dashed/灰底/"soon" 徽标，鼠标悬停显示 hint。
 *
 * 搜索：跨组按 label / hint 匹配（不区分大小写）；命中时该组自动展开，
 *      没有命中的组直接折叠隐藏，列表底部显示总命中数。
 *
 * 命名规则：组标题 "<English> <中文>"，例如 "Trigger 触发条件"；item label 用
 *          通用业内称谓而非内部代号（kind="knowledge" 但 label="RAG"，kind="llm"
 *          但 label="LLM"），让画布外的用户也能识别。
 * =================================================================== */

type AvailableItem = {
  available: true;
  kind: FlowNodeKind;
  label: string;
  /** 配色 className（与 nodes/index.tsx 里 .node-card-icon.<iconKind> 同色系） */
  cls: string;
  hint?: string;
};

type ComingItem = {
  available: false;
  label: string;
  hint?: string;
};

type Item = AvailableItem | ComingItem;

type Group = {
  id: string;
  title: string;
  items: Item[];
};

const groups: Group[] = [
  {
    id: "trigger",
    title: "Trigger 触发条件",
    items: [
      {
        available: true,
        kind: "input",
        label: "Chat Input",
        cls: "bg-emerald-50 border-emerald-300 text-emerald-800",
        hint: "对话起点：把用户消息喂进下游 LLM → flow.triggerType=chat",
      },
      {
        available: true,
        kind: "webhookTrigger",
        label: "Webhook Trigger",
        cls: "bg-cyan-50 border-cyan-300 text-cyan-800",
        hint: "HTTP webhook 触发：外部 POST / GET → flow.triggerType=webhook",
      },
      {
        available: true,
        kind: "scheduleTrigger",
        label: "Schedule Trigger",
        cls: "bg-indigo-50 border-indigo-300 text-indigo-800",
        hint: "按 cron 定时触发：flow_engine 调度器拉起 → flow.triggerType=schedule",
      },
      {
        available: true,
        kind: "manualTrigger",
        label: "Manual Trigger",
        cls: "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800",
        hint: "手动按钮触发：运行时按 paramsSchema 弹表单 → flow.triggerType=manual",
      },
    ],
  },
  {
    id: "llm",
    title: "LLM 大模型",
    items: [
      {
        available: true,
        kind: "llm",
        label: "LLM",
        cls: "bg-brand-50 border-brand-500 text-brand-700",
        hint: "ReAct loop：通过工具迭代直到产出最终答案",
      },
      {
        available: true,
        kind: "fileInput",
        label: "File Input",
        cls: "bg-rose-50 border-rose-300 text-rose-800",
        hint: "用户附件作为 LLM 输入：连到 LLM input → chat 面板出现 📎，文件与文本一起送给 LLM。",
      },
      {
        available: true,
        kind: "prompt",
        label: "Prompt",
        cls: "bg-sky-50 border-sky-300 text-sky-800",
        hint: "手写的 system prompt，连到 LLM 的 system 端点",
      },
      {
        available: true,
        kind: "skill",
        label: "Skill",
        cls: "bg-lime-50 border-lime-300 text-lime-800",
        hint: "引用磁盘上的 .md playbook，连到 LLM 的 skills 端点",
      },
      {
        available: true,
        kind: "knowledge",
        label: "RAG",
        cls: "bg-teal-50 border-teal-300 text-teal-800",
        hint: "知识库检索：把若干 KB 接入 LLM；按文档大小自动 inline / 向量检索",
      },
      {
        available: true,
        kind: "tool",
        label: "Tool",
        cls: "bg-amber-50 border-amber-300 text-amber-800",
        hint: "本地函数式工具（function calling）",
      },
      {
        available: true,
        kind: "mcp",
        label: "MCP Server",
        cls: "bg-violet-50 border-violet-300 text-violet-800",
        hint: "整体接入一个 MCP server 暴露的所有工具",
      },
      { available: false, label: "Agent?", hint: "子 Agent 嵌套调用（设计中）" },
    ],
  },
  {
    id: "output",
    title: "Output 输出",
    items: [
      {
        available: true,
        kind: "output",
        label: "Output",
        cls: "bg-slate-100 border-slate-300 text-slate-700",
        hint: "终点：收集下游产出，展示在聊天气泡",
      },
      {
        available: true,
        kind: "fileOutput",
        label: "File Output",
        cls: "bg-orange-50 border-orange-300 text-orange-800",
        hint: "把 LLM 产出生成可下载文件（md / txt / json），适合 Skill Creator 这类\"产出文件\"场景",
      },
      {
        available: true,
        kind: "response",
        label: "Response",
        cls: "bg-green-50 border-green-300 text-green-800",
        hint: "DAG 终点：把上游数据按 JSON 模板渲染成 HTTP 响应体（webhook / manual / schedule 触发的 flow 的返回值）",
      },
    ],
  },
  {
    id: "data",
    title: "Data Source 数据源",
    items: [
      {
        available: true,
        kind: "upload",
        label: "Upload Excel",
        cls: "bg-purple-50 border-purple-300 text-purple-800",
        hint: "表格数据源：上传 xlsx / xls / csv 文件，配置区可预览各 sheet。output 输出 {sheet_name: rows[]} 供下游 DAG 节点消费。不进 LLM 上下文。",
      },
      {
        available: true,
        kind: "sql",
        label: "SQL",
        cls: "bg-neutral-100 border-neutral-300 text-neutral-800",
        hint: "数据库查询：MSSQL / MySQL / Oracle / PostgreSQL。output 输出 Row[]，供下游 Transform / Code / Response 消费。v1 纯前端，密码暂存 flow definition（明文），后续接 master_data 连接表后改 connectionId 引用。",
      },
      {
        available: true,
        kind: "httpRequest",
        label: "HTTP Request",
        cls: "bg-blue-50 border-blue-300 text-blue-800",
        hint: "调用外部 REST API（method / url / headers / body）",
      },
      {
        available: true,
        kind: "variable",
        label: "Global Variables",
        cls: "bg-yellow-50 border-yellow-300 text-yellow-800",
        hint: "flow.variables 全局变量编辑入口：拖一个到画布里，在右侧面板增删改",
      },
    ],
  },
  {
    id: "process",
    title: "Process 数据处理",
    items: [
      {
        available: true,
        kind: "code",
        label: "Code",
        cls: "bg-stone-100 border-stone-300 text-stone-800",
        hint: "运行一段 Python 片段（子进程沙箱 by flow_engine）",
      },
      {
        available: true,
        kind: "transform",
        label: "Transform",
        cls: "bg-stone-50 border-stone-300 text-stone-800",
        hint: "1 维表数据处理流水线：rename / dedupe / changeType / filter / replace 等可叠加操作，右栏实时预览",
      },
      { available: false, label: "Pivot", hint: "数据透视表：行 / 列 / 度量聚合（设计中）" },
    ],
  },
  {
    id: "logic",
    title: "Logic 逻辑",
    items: [
      {
        available: true,
        kind: "ifElse",
        label: "If / Else",
        cls: "bg-pink-50 border-pink-300 text-pink-800",
        hint: "二路条件分支（双 source handle: true / false）",
      },
      {
        available: true,
        kind: "switch",
        label: "Switch",
        cls: "bg-pink-50 border-pink-300 text-pink-800",
        hint: "多路条件分支：N 个 case + 固定 default 兜底",
      },
      {
        available: true,
        kind: "merge",
        label: "Merge",
        cls: "bg-pink-50 border-pink-300 text-pink-800",
        hint: "多路合流：等所有入边解决，单上游产出时透传 / 多上游产出时合成字典",
      },
      { available: false, label: "Loop", hint: "循环（设计中）" },
    ],
  },
];

export function NodePalette({ triggerInUse }: Props = {}) {
  // 折叠状态：默认折叠"全是 soon 占位"的组（Data / Process / Flow），
  // 让 Trigger / Output / LLM 这些有可用节点的组开盒即见。search 模式下强制全展开。
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(
      groups
        .filter((g) => g.items.every((it) => !it.available))
        .map((g) => g.id)
    )
  );
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  // 过滤 + 是否显示空组
  const filtered = useMemo(() => {
    if (!q) return groups.map((g) => ({ ...g, hidden: false, hits: g.items }));
    return groups.map((g) => {
      const hits = g.items.filter((it) => {
        const hay = `${it.label} ${it.hint || ""}`.toLowerCase();
        return hay.includes(q);
      });
      return { ...g, hidden: hits.length === 0, hits };
    });
  }, [q]);

  const totalHits = useMemo(
    () => filtered.reduce((acc, g) => acc + g.hits.length, 0),
    [filtered]
  );

  function toggle(gid: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  }

  function onDragStart(e: React.DragEvent, kind: FlowNodeKind) {
    e.dataTransfer.setData("application/flow-node-type", kind);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-800 mb-2">Components</div>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索节点 (label / 描述)"
            className="w-full text-xs border border-slate-200 rounded pl-7 pr-2 py-1.5 bg-slate-50 focus:bg-white focus:border-brand-400 outline-none"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
            🔍
          </span>
        </div>
        {q && (
          <div className="mt-1 text-[10px] text-slate-500">
            匹配 {totalHits} 项
          </div>
        )}
      </div>

      {/* Body (scroll) */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.map((g) => {
          if (g.hidden) return null;
          const isCollapsed = !q && collapsed.has(g.id); // 搜索时强制展开
          const total = g.items.length;
          const ready = g.items.filter((i) => i.available).length;
          const itemsToShow = q ? g.hits : g.items;

          return (
            <div key={g.id} className="mb-3">
              <button
                type="button"
                onClick={() => toggle(g.id)}
                disabled={!!q}
                className="w-full text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5 flex items-center gap-1 hover:text-slate-700 disabled:opacity-100"
              >
                <span className={`inline-block w-2 transition-transform ${
                  isCollapsed ? "" : "rotate-90"
                }`}>›</span>
                <span className="truncate">{g.title}</span>
                <span className="ml-auto font-normal text-slate-400 normal-case tracking-normal">
                  {ready}/{total}
                </span>
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-1">
                  {itemsToShow.map((item, idx) => {
                    if (!item.available) {
                      return (
                        <div
                          key={`${g.id}-coming-${idx}`}
                          title={item.hint || "尚未实现"}
                          className="select-none cursor-not-allowed rounded border border-dashed border-slate-200 bg-slate-50 text-slate-400 px-2 py-1.5 text-xs italic flex items-center gap-1"
                        >
                          <span className="truncate flex-1">{item.label}</span>
                          <span className="text-[9px] not-italic uppercase tracking-wider rounded bg-slate-200 text-slate-500 px-1 leading-tight">
                            soon
                          </span>
                        </div>
                      );
                    }
                    // available 项：再判断 trigger 是否已经被占用
                    const occupied = triggerInUse === item.kind;
                    if (occupied) {
                      // 已经在画布上 → 灰底 + "in use" 标记，阻止再拖（避免触发
                      // FlowEditor.onDrop 里的 alert，体验更平滑）
                      return (
                        <div
                          key={`${g.id}-${item.kind}-inuse`}
                          title="此 trigger 已经在画布上 · 一个 flow 只能有一个 trigger"
                          className="select-none cursor-not-allowed rounded border border-dashed border-slate-300 bg-slate-100 text-slate-400 px-2 py-1.5 text-xs flex items-center gap-1"
                        >
                          <span className="truncate flex-1">{item.label}</span>
                          <span className="text-[9px] uppercase tracking-wider rounded bg-slate-200 text-slate-500 px-1 leading-tight">
                            in use
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`${g.id}-${item.kind}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.kind)}
                        title={item.hint}
                        className={
                          "select-none cursor-grab rounded border px-2 py-1.5 text-xs " +
                          item.cls
                        }
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {q && totalHits === 0 && (
          <div className="text-xs text-slate-400 italic mt-4 text-center">
            没有匹配的节点
          </div>
        )}
      </div>

      {/* Footer · 操作贴士 + 端点配色 */}
      <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 leading-relaxed">
        <details>
          <summary className="cursor-pointer font-semibold text-slate-600 select-none">
            操作贴士
          </summary>
          <div className="mt-1 space-y-0.5">
            <div>· 单击节点在右侧编辑参数</div>
            <div>· 拖小圆点连线</div>
            <div>· 选中节点按 Delete 删除</div>
          </div>
        </details>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-slate-600 select-none">
            端点配色
          </summary>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              input · 上游消息
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
              system · Prompt 节点
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-lime-500" />
              skills · Skill 节点 (md)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
              knowledge · RAG
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              tools · Tool 节点
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
              mcp · MCP Server
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-brand-500" />
              output · 节点产出
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              file · File Output 节点
            </div>
            <div className="text-slate-400 mt-1">
              连线方向：上游右端 → LLM 左端
            </div>
          </div>
        </details>
      </div>
    </aside>
  );
}
