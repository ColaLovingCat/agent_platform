"use client";

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type Node,
  type Connection,
  type NodeChange,
  type EdgeChange,
  MarkerType,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { nodeTypes } from "./nodes";
import { FlowContext, NodeDataContext } from "./nodeContext";
import { NodePalette } from "./NodePalette";
import { PropertyPanel } from "./PropertyPanel";
import { FlowToolbar } from "./FlowToolbar";
import type {
  Flow,
  FlowNodeKind,
  FlowVariable,
  LLMNodeData,
} from "./lib/types";
import {
  DEFAULT_LLM_DATA,
  DEFAULT_USER_MESSAGE_TEMPLATES,
  TRIGGER_KIND_TO_TYPE,
  findTriggerNode,
  isTriggerKind,
} from "./lib/types";
import {
  fetchKnowledge,
  fetchMcpServers,
  fetchModels,
  fetchSkills,
  fetchTools,
  type KnowledgeBase,
  type MCPServer,
  type ModelOption,
  type Skill,
  type Tool,
} from "./lib/flowEngine";
import { runFlowToStore, RunFlowSetupError } from "./lib/flowRunner";
import { useFlowRuntime } from "./lib/flowRuntimeStore";
import { buildFlowSnapshot, projectEdges } from "./lib/flowSnapshot";

type Props = {
  initialFlow: Flow;
  /** 本地或其它持久化；未提供时走 /api/flows BFF */
  onPersist?: (body: Partial<Flow>) => Promise<Flow>;
};

/* ===================================================================
 * 右侧 PropertyPanel drawer 的尺寸常量
 *
 * MIN：太窄会让节点编辑器里的 grid 2 列表单挤死（实测 280 是临界点）
 * MAX：太宽抢画布空间，800 大约是 1440p 屏一半，再宽就影响编辑体验
 * DEFAULT：跟旧的 w-80 (320) 保持一致，老用户无感切换；新用户进来宽度更舒服需要自己拉
 * =================================================================== */
const DRAWER_MIN_W = 280;
const DRAWER_MAX_W = 800;
const DRAWER_DEFAULT_W = 360;

function clampDrawerWidth(w: number): number {
  return Math.max(DRAWER_MIN_W, Math.min(DRAWER_MAX_W, w));
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowEditorInner({ initialFlow, onPersist }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [nodes, setNodes] = useState<Node[]>(initialFlow.nodes as unknown as Node[]);
  const [edges, setEdges] = useState<Edge[]>(
    (initialFlow.edges || []).map((e) => ({
      ...e,
      markerEnd: { type: MarkerType.ArrowClosed },
    })) as unknown as Edge[]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [models, setModels] = useState<ModelOption[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [engineErr, setEngineErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);

  // ---- inline run 状态 ----
  // running    : 触发 toolbar 上 ▶/■ 切换 + 阻止重入
  // statusText : 底部状态条；运行时显示"运行中…"，结束后显示"完成 · N 次迭代" 等
  // abortRef   : Stop 按钮 abort 当前 SSE
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // ---- PropertyPanel drawer 宽度 ----
  // 抽屉浮在画布右侧，宽度从 localStorage 还原，拖左把手实时改宽并持久化。
  // 上下限：见 DRAWER_MIN_W / DRAWER_MAX_W；SSR 时 localStorage 不可用，给个默认。
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DRAWER_DEFAULT_W;
    const raw = window.localStorage.getItem("flow.drawer.width");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? clampDrawerWidth(n) : DRAWER_DEFAULT_W;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("flow.drawer.width", String(drawerWidth));
  }, [drawerWidth]);

  /** 把手 mousedown → 接管全局 mousemove/mouseup 直到松手。
   *  start 时锁定 body 的 cursor / userSelect 以避免拖动期间出现"飞文本"或鼠标变成 ↕↔ 来回闪。 */
  const onDrawerResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = drawerWidth;
      const prevCursor = document.body.style.cursor;
      const prevSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      function onMove(ev: MouseEvent) {
        // 把手在抽屉左边 → 鼠标向左移 = 抽屉变宽
        const next = clampDrawerWidth(startW - (ev.clientX - startX));
        setDrawerWidth(next);
      }
      function onUp() {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevSelect;
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [drawerWidth],
  );

  const rf = useReactFlow();

  // 切换 flow 时清空运行时（避免上一个 flow 的 testInput / 节点状态残留）。
  // ChatPanel 也会在它的 activeId 变化时调一次——两边各自负责自己的入口。
  useEffect(() => {
    useFlowRuntime.getState().reset();
    setStatusText("");
  }, [initialFlow.id]);

  // 拉 model / tool / skill / kb / mcp server 列表
  // tools = 函数式工具（model_server /v1/library/tools/list），
  // skills = playbook md（model_server /v1/library/skills/list），
  // kb = 知识库（rag_engine /v1/knowledge/list），分别从各自端点并发拉
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [mr, tr, sr, kb, mcp] = await Promise.all([
          fetchModels(),
          fetchTools(),
          fetchSkills(),
          // KB 列表是可选的：上游不可达 / 没建过任何 KB → 走空列表，编辑器照常工作
          fetchKnowledge().catch(() => ({ data: [] })),
          // MCP 列表是可选的：上游不可达不应阻塞其它列表的展示
          fetchMcpServers().catch(() => ({ available: false, data: [] })),
        ]);
        if (!mounted) return;
        setModels(mr.data || []);
        setTools(tr.data || []);
        setSkills(sr.data || []);
        setKnowledgeBases(kb.data || []);
        setMcpServers(mcp.data || []);
      } catch (e) {
        if (!mounted) return;
        setEngineErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setDirty(true);
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...conn,
          id: `e_${nanoid(6)}`,
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        eds
      )
    );
    setDirty(true);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(
        "application/flow-node-type"
      ) as FlowNodeKind | "";
      if (!kind) return;

      // Trigger 类节点（input / manualTrigger / scheduleTrigger / webhookTrigger）唯一性约束：
      // 一个 flow 只能有一个 trigger，它的 kind 决定 flow.triggerType。
      // 已存在则拒绝创建并提示——避免出现两种触发方式同时挂在一张图上。
      if (isTriggerKind(kind)) {
        const existing = findTriggerNode(nodes as { type?: string }[]);
        if (existing) {
          alert(
            `这个 flow 已经有一个 trigger 节点（${existing.type ?? "?"}）。\n` +
              `每个 flow 只能有一个 trigger，先删掉旧的再拖新的。`
          );
          return;
        }
      }

      const bounds = wrapperRef.current?.getBoundingClientRect();
      const pos = rf.screenToFlowPosition({
        x: e.clientX - (bounds?.left ?? 0),
        y: e.clientY - (bounds?.top ?? 0),
      });
      const id = `${kind}_${nanoid(6)}`;
      const node: Node = {
        id,
        type: kind,
        position: pos,
        data: defaultDataFor(kind),
      } as Node;
      setNodes((nds) => nds.concat(node));
      setSelectedId(id);

      // 拖入的是 trigger → 同步 flow.triggerType；保证图与元数据一致
      const tt = TRIGGER_KIND_TO_TYPE[kind];
      if (tt) {
        setFlow((f) => (f.triggerType === tt ? f : { ...f, triggerType: tt }));
      }

      setDirty(true);
    },
    [rf, nodes]
  );

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  const selected = useMemo(
    () => (selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null),
    [selectedId, nodes]
  );

  // 当前画布上的 trigger 节点 kind（如果有），用于把 NodePalette 同 kind 的项标灰。
  // 只看 type 字段；isTriggerKind 同时给做白名单，避免拿到非 trigger 类型混进来。
  const triggerInUse = useMemo<FlowNodeKind | null>(() => {
    const t = findTriggerNode(nodes as { type?: string }[]);
    return t && t.type && isTriggerKind(t.type as FlowNodeKind)
      ? (t.type as FlowNodeKind)
      : null;
  }, [nodes]);

  function updateNodeData(id: string, patch: Record<string, unknown>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...(n.data as object), ...patch } } : n
      )
    );
    setDirty(true);
  }

  function updateFlowMeta(
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
  ) {
    setFlow((f) => ({ ...f, ...patch }));
    setDirty(true);
  }

  function updateVariables(next: FlowVariable[]) {
    setFlow((f) => ({ ...f, variables: next }));
    setDirty(true);
  }

  // Ctrl/⌘+S 快捷保存。捕获在 window 上，不让浏览器自带"另存为"页面拦截。
  // saveRef 用闭包持有最新 save 函数，避免每次 render 重绑监听器。
  const saveRef = useRef<() => void>(() => {});
  // 同一模式：runInlineRef 让 Chat Input 节点的 Ctrl/⌘+Enter 能触发跑画布
  // （InputNode 跟 FlowEditor 解耦，不能直接 prop 传——走 window 自定义事件）
  const runInlineRef = useRef<() => void>(() => {});
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isSave =
        (e.key === "s" || e.key === "S") &&
        (e.ctrlKey || e.metaKey) &&
        !e.altKey;
      if (!isSave) return;
      e.preventDefault();
      saveRef.current?.();
    }
    function onRun() {
      runInlineRef.current?.();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("flow:run-inline", onRun);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("flow:run-inline", onRun);
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      const body: Partial<Flow> = {
        name: flow.name,
        description: flow.description,
        flowType: flow.flowType,
        triggerType: flow.triggerType,
        visibility: flow.visibility,
        isEnabled: flow.isEnabled,
        variables: flow.variables,
        nodes: nodes as unknown as Flow["nodes"],
        // projectEdges：清理 React Flow 自加的运行时字段、把 null handle 归一为
        // undefined，保证持久化 JSON 干净；多 handle 节点的 sourceHandle / targetHandle
        // 必须随边一起存，否则下次加载连接关系丢失
        edges: projectEdges(edges),
      };
      const updated = onPersist
        ? await onPersist(body)
        : await (async () => {
            const r = await fetch(`/api/flows/${flow.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return (await r.json()) as Flow;
          })();
      setFlow(updated);
      setSavedAt(new Date());
      setDirty(false);
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  // 把最新 save / runInline 暴露给 keydown 监听器（每次 render 后更新引用）
  saveRef.current = save;

  /* -----------------------------------------------------------------
   * inline run
   *
   * 跑画布上"当前未保存的 nodes/edges"，输入取自 useFlowRuntime.flow.testInput
   * （Chat Input 节点画布内的输入框）。
   *
   *   - 重入保护：running=true 时主按钮已经是 Stop，但保险起见再判一次
   *   - 校验失败（无 LLM / 无 model / 输入为空）走 RunFlowSetupError，
   *     用 alert 提示并不更新 statusText（避免覆盖上一次有用的"完成"信息）
   *   - 网络/解析等运行时错误：进入 statusText 红字，store 里也会被
   *     runFlowToStore 标到对应节点上（带红边）
   * ----------------------------------------------------------------- */
  async function runInline() {
    if (running) return;
    const testInput = useFlowRuntime.getState().flow.testInput;
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setStatusText("运行中…");
    try {
      const result = await runFlowToStore({
        flow: buildFlowSnapshot(flow, nodes, edges),
        testInput,
        allTools: tools,
        allSkills: skills,
        allKnowledgeBases: knowledgeBases,
        signal: ac.signal,
      });
      if (result.aborted) setStatusText("已中断");
      else if (result.error) setStatusText(`错误: ${result.error}`);
      else setStatusText(`完成 · ${result.iterations ?? 0} 次迭代`);
    } catch (e) {
      if (e instanceof RunFlowSetupError) {
        // 前置校验失败——用户很可能没填 testInput / 没拖 LLM；用 alert 显式提示，
        // 状态条保持空，不要覆盖上次跑出来的"完成"信息
        alert(e.message);
        setStatusText("");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusText(`错误: ${msg}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stopInline() {
    abortRef.current?.abort();
  }

  runInlineRef.current = runInline;

  // 抽屉宽 + 12px 间距 → header bar 的 right offset / MiniMap 的 right offset 都按这个错开
  const overlayRightOffset = drawerWidth + 12;

  return (
    <FlowContext.Provider value={{ flowId: flow.id, variables: flow.variables || [] }}>
    <NodeDataContext.Provider value={updateNodeData}>
    <div className="flex-1 flex min-h-0 h-full">
      <NodePalette triggerInUse={triggerInUse} />

      <div
        className="flex-1 relative min-w-0 h-full"
        ref={wrapperRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          className="h-full w-full"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes as never}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          /* === Figma 风格画布交互 ===
           * 默认（不按键）：
           *   - 左键拖空白 → 拉框选（selectionOnDrag）
           *   - 左键点节点 → 选节点；左键拖节点 → 移动节点
           *   - 中键 / 右键拖动空白 → 平移画布（panOnDrag=[1,2]，给老手保留快捷方式）
           *   - 滚轮 → 缩放（React Flow 默认 zoomOnScroll）
           * 按住空格：
           *   - 整个画布切到 pan 模式，左键拖动 = 平移（panActivationKeyCode="Space"）
           *   - 松开空格立刻恢复"左键 = 框选"
           * 多选规则：
           *   - selectionMode=Partial → 节点与框相交即选中（不要求被完全框住），更贴合直觉
           *   - 默认 Shift 加选 / 取消选保留（multiSelectionKeyCode 默认就是 Shift）
           *
           * 注意：Space 在 PropertyPanel input/textarea 里输入时不会触发 pan，因为
           * React Flow 的 key 监听只在画布 focus 时生效，输入框 focus 时 Space 是空格字符。
           */
          panOnDrag={[1, 2]}
          selectionOnDrag
          panActivationKeyCode="Space"
          selectionMode={SelectionMode.Partial}
        >
          <Background />
          {/* MiniMap 默认 bottom-right，会被抽屉盖住；用 inline style 把它顶到抽屉左边 */}
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            nodeColor={() => "#94a3b8"}
            nodeBorderRadius={4}
            maskColor="rgb(241 245 249 / 0.85)"
            style={{ right: overlayRightOffset, bottom: 12 }}
          />
          <Controls />
        </ReactFlow>

        {/* 画布交互提示条：贴左下角，紧挨 Controls，告知 Figma 风格的快捷键。
         * pointer-events-none 让它不抢任何鼠标事件；半透明 + 小字号尽量不打扰。
         */}
        <div
          className="absolute bottom-3 left-16 flex items-center gap-1.5 pointer-events-none select-none"
          aria-hidden
        >
          <span className="bg-white/85 backdrop-blur border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500 leading-none">
            拖动 = 框选
          </span>
          <span className="text-slate-300 text-[10px]">·</span>
          <span className="bg-white/85 backdrop-blur border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500 leading-none">
            <kbd className="font-mono text-slate-700">Space</kbd> + 拖动 = 平移
          </span>
          <span className="text-slate-300 text-[10px]">·</span>
          <span className="bg-white/85 backdrop-blur border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-500 leading-none">
            中键 / 右键 = 平移
          </span>
        </div>

        {/* 顶部 header bar：左对齐 flow 名 + 状态胶囊；右边留出抽屉宽度防遮挡 */}
        <div
          className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none"
          style={{ right: overlayRightOffset }}
        >
          <div className="bg-white/90 backdrop-blur rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold pointer-events-auto">
            {flow.name}
            <span className="ml-2 text-xs text-slate-400">{flow.id}</span>
          </div>
          <div className="flex-1" />
          {engineErr && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs px-2 py-1 rounded pointer-events-auto">
              flow_engine 不可达：{engineErr}
            </div>
          )}
          {/* 运行反馈胶囊：跑中 / 完成 / 错误 / 已中断；没有反馈时不渲染。
           * 紧贴 FlowToolbar 左侧，跟工具栏在同一行，避免遮挡左下角的 React Flow Controls。
           * 保存态（dirty / savedAt）由 Save 按钮的小红点 + tooltip 单点表达，这里不重复。
           */}
          {(running || statusText) && (
            <div
              className={
                "pointer-events-auto bg-white/95 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5 text-xs font-medium " +
                (running
                  ? "text-sky-700 border-sky-200"
                  : statusText.startsWith("错误")
                  ? "text-rose-700 border-rose-200"
                  : statusText.startsWith("完成")
                  ? "text-emerald-700 border-emerald-200"
                  : "text-slate-600 border-slate-200")
              }
            >
              {running ? statusText || "运行中…" : statusText}
            </div>
          )}
          <FlowToolbar
            flow={flow}
            nodes={nodes}
            edges={edges}
            saving={saving}
            dirty={dirty}
            savedAt={savedAt}
            onSave={save}
            running={running}
            onRun={runInline}
            onStop={stopInline}
          />
        </div>

        {/* 右侧悬浮抽屉：absolute / 浮在 ReactFlow 之上 / 宽度可拖 */}
        <PropertyPanel
          flow={flow}
          selected={selected}
          models={models}
          tools={tools}
          skills={skills}
          knowledgeBases={knowledgeBases}
          mcpServers={mcpServers}
          onUpdateNodeData={updateNodeData}
          onUpdateFlowMeta={updateFlowMeta}
          onUpdateVariables={updateVariables}
          onSelectNode={setSelectedId}
          width={drawerWidth}
          onResizeStart={onDrawerResizeStart}
        />
      </div>
    </div>
    </NodeDataContext.Provider>
    </FlowContext.Provider>
  );
}

function defaultDataFor(kind: FlowNodeKind): object {
  switch (kind) {
    case "input":
      return { label: "User Input" };
    case "manualTrigger":
      return {
        label: "Manual Trigger",
        paramsSchema: [],
        userMessageTemplate: DEFAULT_USER_MESSAGE_TEMPLATES.manual,
      };
    case "scheduleTrigger":
      return {
        label: "Schedule Trigger",
        cron: "0 9 * * 1-5",
        timezone: "Asia/Shanghai",
        paramsJson: "{}",
      };
    case "webhookTrigger":
      return {
        label: "Webhook Trigger",
        auth: "none",
        userMessageTemplate: DEFAULT_USER_MESSAGE_TEMPLATES.webhook,
      };
    case "output":
      return { label: "Output" };
    case "llm":
      // 新建 LLM 节点：直接用 DEFAULT_LLM_DATA 的副本。backend / model 维持
      // undefined，让用户必须在 PropertyPanel 显式选过模型才能跑。
      return { ...DEFAULT_LLM_DATA } satisfies LLMNodeData;
    case "tool":
      return { name: "", label: "" };
    case "mcp":
      return { serverName: "", label: "" };
    case "prompt":
      return { label: "Prompt", content: "" };
    case "skill":
      return { name: "", label: "" };
    case "knowledge":
      // 默认空列表；用户在 PropertyPanel 加 KB
      return { label: "RAG", kbIds: [] };
    case "fileOutput":
      // 默认 prefix=output / format=auto；用户在 PropertyPanel 改
      return { label: "File Output", filenamePrefix: "output", format: "auto" };
    case "response":
      // 给一个常见的"成功响应"模板当起手；status=200，headers 空
      return {
        label: "Response",
        statusCode: 200,
        bodyTemplate:
          '{\n  "status": true,\n  "message": "",\n  "data": {}\n}',
        headers: {},
      };
    case "fileInput":
      return {
        label: "File Input",
        acceptMime: "",
        maxBytes: 0,
        multiple: false,
        parseAs: "raw",
      };
    case "upload":
      // Upload Excel：只留 label + activeSheet（默认 sheet 由用户在配置里选）。
      // 文件本体不存 node.data，而是 useFlowRuntime.flow.testFiles[id]。
      return { label: "Upload Excel" };
    case "sql":
      // SQL (v2)：节点本身不再带任何连接信息；用户在 PropertyPanel 选已建好的 Connection。
      // connectionId="" → 节点会显示"未选连接"提示，执行时会报清晰错误。
      return {
        label: "SQL",
        connectionId: "",
        mode: "query",
      };
    case "httpRequest":
      return {
        label: "HTTP Request",
        method: "GET",
        url: "",
        headers: {},
        queryParams: {},
        bodyType: "none",
        body: "",
        timeoutMs: 0,
      };
    case "variable":
      return {
        label: "Global Variables",
      };
    case "code":
      return {
        label: "Code",
        language: "python",
        code: "",
        timeoutMs: 0,
      };
    case "switch":
      return {
        label: "Switch",
        expression: "",
        cases: [],
      };
    case "merge":
      return {
        label: "Merge",
      };
    case "ifElse":
      return {
        label: "If / Else",
        condition: "",
      };
    case "transform":
      // 起手空操作链——预览区会指引用户从列头 ▾ 菜单加 op
      return {
        label: "Transform",
        ops: [],
      };
  }
}
