import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { 
  Search, 
  Plus, 
  RotateCcw, 
  FilterX, 
  FolderOpen, 
  SearchX, 
  Loader2, 
  Waypoints 
} from 'lucide-react';

import {
  FLOW_TYPES,
  TRIGGER_TYPES,
  type Flow,
  type FlowType,
  type FlowVisibility,
  type TriggerType,
} from "@/components/workflow/lib/types";
import { WEBHOOK_PUBLIC_URL } from "@/components/workflow/lib/publicConfig";

import {
  createFlow,
  deleteFlow,
  listFlows,
  resetFlowsFromSeed,
} from "./flowStore";

export default function FlowsListPage() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [flowTypeFilter, setFlowTypeFilter] = useState<FlowType | "all">("all");
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<TriggerType | "all">(
    "all",
  );

  function load() {
    setLoading(true);
    setFlows(listFlows());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredFlows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flows.filter((f) => {
      if (flowTypeFilter !== "all" && f.flowType !== flowTypeFilter) return false;
      if (triggerTypeFilter !== "all" && f.triggerType !== triggerTypeFilter) {
        return false;
      }
      if (q) {
        const hay = `${f.name} ${f.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [flows, search, flowTypeFilter, triggerTypeFilter]);

  const filtersActive =
    !!search.trim() ||
    flowTypeFilter !== "all" ||
    triggerTypeFilter !== "all";

  async function handleCreate(input: {
    name: string;
    description?: string;
    flowType: FlowType;
    triggerType: TriggerType;
  }) {
    setCreating(true);
    try {
      const flow = createFlow(input);
      setCreateOpen(false);
      navigate(`/flows/${flow.id}`);
    } catch (e) {
      alert(`创建失败: ${e instanceof Error ? e.message : e}`);
    } finally {
      setCreating(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm(`确认删除 flow ${id}?`)) return;
    deleteFlow(id);
    load();
  }

  return (
  <div className="sections sections-flow-list bg-[#F8FAFC] flex-1 overflow-y-auto custom-scrollbar">
  <div className="mx-auto px-8 py-10 w-full">
    
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex gap-5 items-end">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Workflows</h1>
        <p className="text-sm text-slate-500 mt-1">Manage automated processes, triggers, and execution graphs.</p>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (confirm("从 datas.json 重置本地列表？未保存的修改会丢失。")) {
              resetFlowsFromSeed();
              load();
            }
          }}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm"
          title="用 datas.json 覆盖 localStorage"
        >
          <RotateCcw size={16} />
          <span>重置数据</span>
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          disabled={creating}
          className="h-10 px-5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md shadow-indigo-200"
        >
          <Plus size={18} />
          <span>新建 Flow</span>
        </button>
      </div>
    </div>

    {/* ================= 2. 筛选与搜索工具栏 ================= */}
    {!loading && flows.length > 0 && (
      <div className="mb-8 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索名称或描述…"
            className="w-full text-sm border-none rounded-xl pl-9 pr-4 py-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
          />
        </div>

        {/* 筛选条件组合 */}
        <div className="flex items-center gap-4 flex-wrap">
          <FilterPills
            label="Type"
            current={flowTypeFilter}
            options={[
              { value: "all", label: "全部" },
              ...FLOW_TYPES.map((t) => ({ value: t.value, label: t.value })),
            ]}
            onChange={(v) => setFlowTypeFilter(v as FlowType | "all")}
          />
          
          {/* 这里你可以加一个垂直分割线，如果 FilterPills 没有自带的话 */}
          <div className="hidden sm:block w-px h-6 bg-slate-200"></div>

          <FilterPills
            label="Trigger"
            current={triggerTypeFilter}
            options={[
              { value: "all", label: "全部" },
              ...TRIGGER_TYPES.map((t) => ({ value: t.value, label: t.value })),
            ]}
            onChange={(v) => setTriggerTypeFilter(v as TriggerType | "all")}
          />
        </div>

        {/* 结果统计与清除动作 */}
        <div className="flex items-center gap-4 ml-auto pl-2 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0">
          <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full whitespace-nowrap">
            {filtersActive ? (
              <span className="text-indigo-600 font-bold">{filteredFlows.length} <span className="text-slate-500 font-normal">/ {flows.length} 结果</span></span>
            ) : (
              <span>共 {flows.length} 个项目</span>
            )}
          </div>
          
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFlowTypeFilter("all");
                setTriggerTypeFilter("all");
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors whitespace-nowrap"
            >
              <FilterX size={14} />
              清除筛选
            </button>
          )}
        </div>
      </div>
    )}

    {/* ================= 3. 内容展示区 (含各种空状态) ================= */}
    <div className="min-h-[400px]">
      {loading ? (
        /* --- 加载中状态 --- */
        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
          <span className="text-sm font-medium">加载中...</span>
        </div>
      ) : flows.length === 0 ? (
        /* --- 完全没有数据的空状态 --- */
        <div className="h-[400px] flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white/50 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen size={32} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No flows created yet</h3>
          <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
            Get started by creating your first workflow automation. Define triggers, connect agents, and watch the magic happen.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-10 px-6 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} />
            新建 Flow
          </button>
        </div>
      ) : filteredFlows.length === 0 ? (
        /* --- 筛选无结果的空状态 --- */
        <div className="h-[300px] flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white/50 animate-in fade-in">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <SearchX size={32} className="text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">No matching flows</h3>
          <p className="text-sm text-slate-500 mb-4">We couldn't find any flows that match your current filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFlowTypeFilter("all");
              setTriggerTypeFilter("all");
            }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg"
          >
            清除所有筛选条件
          </button>
        </div>
      ) : (
        /* --- 列表展示网格 --- */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {filteredFlows.map((f) => (
            <FlowCard
              key={f.id}
              flow={f}
              onDelete={() => handleDelete(f.id)}
            />
          ))}
        </div>
      )}
    </div>

    {/* ================= 4. 弹窗 ================= */}
    {createOpen && (
      <NewFlowModal
        creating={creating}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    )}
  </div>
</div>
  );
}

function FilterPills({
  label,
  current,
  options,
  onChange,
}: {
  label: string;
  current: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {label}
      </span>
      <div className="flex items-center rounded border border-slate-200 bg-white overflow-hidden">
        {options.map((opt, i) => {
          const active = opt.value === current;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                "px-2 py-1 text-[11px] font-mono transition " +
                (active
                  ? "bg-brand-100 text-brand-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50") +
                (i > 0 ? " border-l border-slate-200" : "")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlowCard({ flow, onDelete }: { flow: Flow; onDelete: () => void }) {
  return (
    <div
      className={
        "rounded-xl border bg-white p-4 border-slate-200 hover:border-brand-500 hover:shadow flex flex-col transition " +
        (flow.isEnabled ? "" : "opacity-60")
      }
    >
      <Link to={`/flows/${flow.id}`} className="block flex-1">
        <div className="flex items-start gap-3">
          <div
            className={
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 " +
              flowTypeIconBgCls(flow.flowType)
            }
          >
            <FlowTypeIcon type={flow.flowType} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-slate-800 truncate">
              {flow.name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              id: {flow.id}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <EnabledBadge enabled={flow.isEnabled} />
            <VisibilityBadge v={flow.visibility} />
          </div>
        </div>
        {flow.description && (
          <div className="text-sm text-slate-600 mt-2 line-clamp-2">
            {flow.description}
          </div>
        )}
        <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5 flex-wrap">
          <span
            className={
              "text-[10px] uppercase tracking-wider rounded px-1.5 py-px font-mono " +
              flowTypeBadgeCls(flow.flowType)
            }
          >
            {flow.flowType}
          </span>
          <span
            className={
              "text-[10px] uppercase tracking-wider rounded px-1.5 py-px font-mono " +
              triggerBadgeCls(flow.triggerType)
            }
          >
            {flow.triggerType}
          </span>
          <span>
            nodes={flow.nodes?.length ?? 0} · edges={flow.edges?.length ?? 0}
          </span>
        </div>
      </Link>
      <div className="mt-3 pt-3 border-t flex items-center gap-2">
        <TriggerAction flow={flow} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-slate-500 hover:text-red-600"
        >
          删除
        </button>
      </div>
    </div>
  );
}

function TriggerAction({ flow }: { flow: Flow }) {
  const [copied, setCopied] = useState(false);

  switch (flow.triggerType) {
    case "chat":
      return (
        <Link
          to={`/llm?flowId=${encodeURIComponent(flow.id)}`}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        >
          在 Chat 中打开
        </Link>
      );
    case "webhook": {
      const url = `${WEBHOOK_PUBLIC_URL}/webhooks/${flow.id}`;
      return (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              alert(url);
            }
          }}
          className="text-xs px-2 py-1 rounded bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
        >
          {copied ? "已复制" : "复制 Webhook URL"}
        </button>
      );
    }
    default:
      return (
        <Link
          to={`/flows/${flow.id}`}
          className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          打开编辑器
        </Link>
      );
  }
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      title={enabled ? "已启用" : "已停用"}
      className={
        "inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded-full font-medium border " +
        (enabled
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-500 border-slate-200")
      }
    >
      <span
        className={
          "inline-block w-1.5 h-1.5 rounded-full " +
          (enabled ? "bg-emerald-500" : "bg-slate-400")
        }
      />
      {enabled ? "on" : "off"}
    </span>
  );
}

function VisibilityBadge({ v }: { v: FlowVisibility }) {
  const cfg =
    v === "private"
      ? { label: "private", icon: "🔒", cls: "bg-slate-50 text-slate-600 border-slate-200" }
      : v === "shared"
        ? { label: "shared", icon: "👥", cls: "bg-sky-50 text-sky-700 border-sky-200" }
        : { label: "public", icon: "🌐", cls: "bg-amber-50 text-amber-700 border-amber-200" };

  return (
    <span
      title={cfg.label}
      className={
        "inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded-full font-mono border " +
        cfg.cls
      }
    >
      <span aria-hidden>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function NewFlowModal({
  creating,
  onClose,
  onCreate,
}: {
  creating: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description?: string;
    flowType: FlowType;
    triggerType: TriggerType;
  }) => void;
}) {
  const [name, setName] = useState("New Flow");
  const [description, setDescription] = useState("");
  const [flowType, setFlowType] = useState<FlowType>("react");
  const [triggerType, setTriggerType] = useState<TriggerType | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert("名称不能为空");
      return;
    }
    const finalTrigger: TriggerType =
      triggerType ?? (flowType === "react" ? "chat" : "manual");
    onCreate({
      name: trimmed,
      description: description.trim() || undefined,
      flowType,
      triggerType: finalTrigger,
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b flex items-center">
          <div className="font-semibold text-slate-800 flex-1">新建 Flow</div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-sm"
          >
            关闭
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Flow Type
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FLOW_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setFlowType(ft.value)}
                  className={
                    "text-left rounded-lg border-2 p-3 text-sm transition " +
                    (flowType === ft.value
                      ? flowTypeActiveCls(ft.value)
                      : "border-slate-200 hover:border-slate-300")
                  }
                >
                  <div className="font-semibold">{ft.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{ft.tagline}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              名称
            </label>
            <input
              autoFocus
              className="mt-1.5 w-full text-sm border rounded px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              描述（可选）
            </label>
            <textarea
              rows={2}
              className="mt-1.5 w-full text-sm border rounded px-2 py-1.5 resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Trigger（可选）
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRIGGER_TYPES.map((t) => {
                const active = triggerType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTriggerType(active ? null : t.value)}
                    className={
                      "rounded-lg border-2 px-2.5 py-1 text-xs font-mono " +
                      (active
                        ? triggerActiveCls(t.value)
                        : "border-slate-200 text-slate-600")
                    }
                  >
                    {t.value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={creating || !name.trim()}
            className="px-3 py-1.5 rounded bg-brand-500 text-white text-sm hover:bg-brand-600 disabled:bg-slate-300"
          >
            {creating ? "创建中…" : "创建 Flow"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowTypeIcon({
  type,
  className,
}: {
  type: FlowType;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className || "w-5 h-5",
  };
  if (type === "react") {
    return (
      <svg {...common}>
        <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
        <circle cx="8" cy="11.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="11.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 6h10" />
      <path d="M6 8l5 8" />
      <path d="M18 8l-5 8" />
    </svg>
  );
}

function triggerBadgeCls(t: TriggerType | string): string {
  switch (t) {
    case "chat":
      return "bg-emerald-100 text-emerald-700";
    case "manual":
      return "bg-fuchsia-100 text-fuchsia-700";
    case "schedule":
      return "bg-indigo-100 text-indigo-700";
    case "webhook":
      return "bg-cyan-100 text-cyan-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function triggerActiveCls(t: TriggerType): string {
  switch (t) {
    case "chat":
      return "bg-emerald-50 border-emerald-400";
    case "manual":
      return "bg-fuchsia-50 border-fuchsia-400";
    case "schedule":
      return "bg-indigo-50 border-indigo-400";
    case "webhook":
      return "bg-cyan-50 border-cyan-400";
  }
}

function flowTypeBadgeCls(t: FlowType | string): string {
  return t === "react"
    ? "bg-blue-100 text-blue-700"
    : "bg-stone-200 text-stone-700";
}

function flowTypeActiveCls(t: FlowType): string {
  return t === "react"
    ? "bg-blue-50 border-blue-400"
    : "bg-stone-50 border-stone-400";
}

function flowTypeIconBgCls(t: FlowType): string {
  return t === "react"
    ? "bg-blue-100 text-blue-700"
    : "bg-stone-200 text-stone-700";
}
