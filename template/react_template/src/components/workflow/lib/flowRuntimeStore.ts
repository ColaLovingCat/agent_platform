/** Flow 运行时数据 store
 *
 * React Flow 的 edges 只是**声明式连接**——它告诉系统"A 的输出送到 B 的输入"，
 * 但运行时数据并不真的沿 edges 流动。我们的后端是 LangGraph ReAct，前端只看
 * SSE 流；所以"图上的节点"拿不到 React Flow 的 props 里的运行时数据。
 *
 * 这个 store 就是把"运行时状态"和"声明式节点 id"绑定的桥，覆盖两类用途：
 *
 *   1. **节点级状态** byNodeId[id]：每个节点的执行状态（idle/running/ok/error）+
 *      产物（最终文本 / tool calls / iterations / error 等）。这样：
 *        - FileOutputNode 拿 text 生成 Blob URL
 *        - LLMNode 显示最终回复 + 迭代次数 + tool 调用列表
 *        - ToolNode 显示最近一次 args / result
 *        - 任何节点都能根据 status 渲染 spinner / 高亮
 *
 *   2. **Flow 级状态** flow：跨节点共享的"运行控制信息"。当前只放
 *      `testInput`（Chat Input 节点上画布内的测试输入框文本，用于 inline run）。
 *
 * 关键决策：
 *   - **不持久化**：刷新页面就没；这是"运行时视图"，不是核心数据。
 *   - **每 turn 全量覆盖**：再跑一次替换上一次（不做历史栈）。
 *   - **跨 flow 共用一个 store**：切换 flow 时 ChatPanel/FlowEditor 调 reset()。
 *
 * 设计上有意把 mergeNode / setNodeStatus / appendNodeToolCall / patchNodeToolCall
 * 全做成正交动作，让 flowRunner.ts（下一步）能自然地把 SSE 事件流映射成 store 更新，
 * 不需要再加 reducer。
 */

import { create } from "zustand";

/* ===================================================================
 * 类型
 * =================================================================== */

export type NodeRunStatus = "idle" | "running" | "ok" | "error";

/** Tool 调用视图——所有节点共用一个 shape，跟 ChatPanel 里的同名类型保持兼容 */
export type ToolCallView = {
  id: string;
  name: string;
  args?: unknown;
  result?: string;
  error?: string;
};

export type RuntimeNodeState = {
  status: NodeRunStatus;
  /** 进入 running 时设；不设 / 重置时为 undefined */
  startedAt?: number;
  /** 进入 ok / error 时设 */
  finishedAt?: number;
  /** 节点的"主要文本产物"
   *   - LLM     : assistant 最终内容（流式累积）
   *   - Output  : 同上
   *   - FileOutput: 同上（消费者会把 text 转成 Blob 下载）
   *   - Tool    : result（也存在 .result 上，二选一读）
   */
  text?: string;
  /** LLM 节点：本 turn 的所有 tool 调用 */
  toolCalls?: ToolCallView[];
  /** Tool 节点：最近一次调用的 args / result，方便单点读取 */
  args?: unknown;
  result?: string;
  /** status === "error" 时填 */
  error?: string;
  /** LLM 节点：本 turn 的 ReAct 迭代次数（run_completed 事件） */
  iterations?: number;
  /** DAG simulator 给下游消费的"结构化产物"。
   *  与 `text`（人类可读预览）分开：text 给 UI 看，outputData 给下个节点的 simulator 读。
   *  形态完全跟节点类型走（Upload=`{sheet: rows[]}`、Response=`{statusCode,headers,body}`…）。 */
  outputData?: unknown;
  /** IfElse 节点跑完后选中的 sourceHandle ("true" / "false")；
   *  walker 用来裁剪分支；UI 也可以拿它高亮选中的那条边（未实装）。 */
  branch?: string;
};

/** 跨节点的 flow 级运行时状态 */
export type RuntimeFlowState = {
  /** Chat Input 节点画布内输入框的文本（inline run 的输入） */
  testInput: string;
  /** File Input 节点画布内挑选的测试文件（inline run 的附件输入）。
   *  Key = FileInput 节点 id；Value = 该节点上挑选的 File[]
   *
   *  这里直接把 File 对象塞进 store —— zustand 不要求 state immutable，且 File 是
   *  浏览器原生对象，refresh 即丢，跟 store 整体不持久化的语义一致。
   *  跨 Chat / Canvas 两套 UI 共享同一张表，避免重复管理 picker 状态。
   */
  testFiles: Record<string, File[]>;
  /** Webhook Trigger 节点的"模拟请求"载荷（inline run 的输入端）。
   *  Key = WebhookTrigger 节点 id；Value = 该节点上预设的测试请求。
   *
   *  跟 testFiles 同源思路：保持在浏览器本地、不持久化到 master_data——
   *  这只是"调试用的输入"，跟 flow 配置无关。后端 DAG executor 接入后，
   *  inline Run 会把这份 payload 作为 `POST /webhooks/{id}` 的请求体发出去。
   */
  testRequests: Record<string, TestRequestPayload>;
};

/** Webhook 节点的测试请求载荷。
 *
 *  MVP：body + query；future: method / headers / pathParams 等按需扩——
 *  schema 用 optional 字段，后端 executor 接入时按存在与否兜底默认值（POST + 空 query 等）。
 */
export type TestRequestPayload = {
  /** 请求体原始字符串（用户在 textarea 里打的什么都行）。校验/解析交给消费方。 */
  body?: string;
  /** 查询串原始字符串，URL-encoded 形式，如 `id=1&foo=bar`；前导 `?` 可选。
   *  消费方（simWebhookTrigger）用 URLSearchParams 解析成 Record<string,string>，
   *  喂给 `{{trigger.query.xxx}}` 模板。 */
  query?: string;
};

type State = {
  byNodeId: Record<string, RuntimeNodeState>;
  flow: RuntimeFlowState;

  /* === 节点级动作 === */
  /** 浅合并 patch 到指定节点；节点不存在时按 idle 起步 */
  mergeNode: (nodeId: string, patch: Partial<RuntimeNodeState>) => void;
  /** 切状态：自动 startedAt / finishedAt；extra 里可附带文本 / 错误等 */
  setNodeStatus: (
    nodeId: string,
    status: NodeRunStatus,
    extra?: Partial<RuntimeNodeState>
  ) => void;
  /** 往节点的 toolCalls 数组追加一项（不存在则新建） */
  appendNodeToolCall: (nodeId: string, tc: ToolCallView) => void;
  /** 给已有 toolCall 打补丁（按 id 匹配）—— tool_result / tool_error 走这里 */
  patchNodeToolCall: (
    nodeId: string,
    toolCallId: string,
    patch: Partial<ToolCallView>
  ) => void;

  /* === 旧 API（兼容已有 FileOutputNode / PropertyPanel.FileOutputEditor / ChatPanel）=== */
  setNodeOutput: (
    nodeId: string,
    output: { text: string; finishedAt: number }
  ) => void;

  /* === Flow 级动作 === */
  setTestInput: (text: string) => void;
  /** 整体覆盖某 FileInput 节点的测试附件（File[] 已校验过的）；空数组 = 清空 */
  setTestFiles: (nodeId: string, files: File[]) => void;
  /** 设置 Webhook 节点的测试请求 body（原始字符串）；空串 = 清掉 body 字段 */
  setTestRequestBody: (nodeId: string, body: string) => void;
  /** 设置 Webhook 节点的测试请求 query string（如 `id=1&foo=bar`）；空串 = 清掉 query 字段 */
  setTestRequestQuery: (nodeId: string, query: string) => void;

  /* === 清理 === */
  /** 清空所有节点产物 + flow 级状态（切 flow / 清空对话用） */
  reset: () => void;
  /** 仅清掉某一节点的状态 */
  clearNode: (nodeId: string) => void;
};

/* ===================================================================
 * Store
 * =================================================================== */

const EMPTY_FLOW_STATE: RuntimeFlowState = {
  testInput: "",
  testFiles: {},
  testRequests: {},
};

export const useFlowRuntime = create<State>((set) => ({
  byNodeId: {},
  flow: { ...EMPTY_FLOW_STATE },

  mergeNode: (nodeId, patch) =>
    set((s) => {
      const prev: RuntimeNodeState = s.byNodeId[nodeId] ?? { status: "idle" };
      return {
        byNodeId: { ...s.byNodeId, [nodeId]: { ...prev, ...patch } },
      };
    }),

  setNodeStatus: (nodeId, status, extra) =>
    set((s) => {
      const prev: RuntimeNodeState = s.byNodeId[nodeId] ?? { status: "idle" };
      const now = Date.now();
      const next: RuntimeNodeState = { ...prev, ...extra, status };
      // 自动管理时间戳：进入 running 设 startedAt（且清掉旧的 finishedAt）；
      // 完成 / 失败时设 finishedAt（保留 startedAt 以便 UI 算耗时）。
      if (status === "running") {
        next.startedAt = now;
        next.finishedAt = undefined;
      } else if (status === "ok" || status === "error") {
        next.finishedAt = now;
      }
      return { byNodeId: { ...s.byNodeId, [nodeId]: next } };
    }),

  appendNodeToolCall: (nodeId, tc) =>
    set((s) => {
      const prev: RuntimeNodeState = s.byNodeId[nodeId] ?? { status: "idle" };
      const list = prev.toolCalls ? prev.toolCalls.slice() : [];
      // 同 id 已存在就不重复 append（llm_message 事件可能在 tool_call 之前到达，
      // 携带同一 id；以后到的覆盖式 patch 由 patchNodeToolCall 负责）
      if (!list.some((x) => x.id === tc.id)) list.push(tc);
      return {
        byNodeId: {
          ...s.byNodeId,
          [nodeId]: { ...prev, toolCalls: list },
        },
      };
    }),

  patchNodeToolCall: (nodeId, toolCallId, patch) =>
    set((s) => {
      const prev = s.byNodeId[nodeId];
      if (!prev || !prev.toolCalls) return s;
      const list = prev.toolCalls.map((tc) =>
        tc.id === toolCallId ? { ...tc, ...patch } : tc
      );
      return {
        byNodeId: { ...s.byNodeId, [nodeId]: { ...prev, toolCalls: list } },
      };
    }),

  setNodeOutput: (nodeId, output) =>
    set((s) => {
      // 老接口：被 ChatPanel.send() 在 turn 完成后调来推 sink 节点（FileOutput）。
      // 在新模型里这等价于 status=ok + text + finishedAt 一次性写齐。
      const prev: RuntimeNodeState = s.byNodeId[nodeId] ?? { status: "idle" };
      return {
        byNodeId: {
          ...s.byNodeId,
          [nodeId]: {
            ...prev,
            status: "ok",
            text: output.text,
            finishedAt: output.finishedAt,
          },
        },
      };
    }),

  setTestInput: (text) =>
    set((s) => ({ flow: { ...s.flow, testInput: text } })),

  setTestFiles: (nodeId, files) =>
    set((s) => {
      const next = { ...s.flow.testFiles };
      if (files.length === 0) delete next[nodeId];
      else next[nodeId] = files;
      return { flow: { ...s.flow, testFiles: next } };
    }),

  setTestRequestBody: (nodeId, body) =>
    set((s) => {
      const next = { ...s.flow.testRequests };
      const merged = { ...(next[nodeId] || {}), body: body || undefined };
      // 两个字段都空时 = 清掉这一条；避免 reset / 调试时多噪音
      if (!merged.body && !merged.query) {
        delete next[nodeId];
      } else {
        next[nodeId] = merged;
      }
      return { flow: { ...s.flow, testRequests: next } };
    }),

  setTestRequestQuery: (nodeId, query) =>
    set((s) => {
      const next = { ...s.flow.testRequests };
      const merged = { ...(next[nodeId] || {}), query: query || undefined };
      if (!merged.body && !merged.query) {
        delete next[nodeId];
      } else {
        next[nodeId] = merged;
      }
      return { flow: { ...s.flow, testRequests: next } };
    }),

  reset: () =>
    set({
      byNodeId: {},
      flow: { testInput: "", testFiles: {}, testRequests: {} },
    }),

  clearNode: (nodeId) =>
    set((s) => {
      if (!(nodeId in s.byNodeId)) return s;
      const next = { ...s.byNodeId };
      delete next[nodeId];
      return { byNodeId: next };
    }),
}));

/* ===================================================================
 * 工具函数：从图里找出"应该接收 LLM 输出"的终点节点
 *
 * "终点节点" = 类型在 SINK_KINDS 中且通过 edges 直接/间接连到给定 LLM 节点的下游。
 * 当前只支持直连一跳（LLM → 终点），未来如果加了 Process / Filter 这类
 * 中间节点，把递归遍历加在这里就行。
 * =================================================================== */

export const SINK_KINDS = ["fileOutput", "output"] as const;
export type SinkKind = (typeof SINK_KINDS)[number];

/** 给定 LLM 节点 id，返回所有"接受其输出"的终点节点 id（按 SINK_KINDS 过滤） */
export function findOutputSinkNodes(
  llmNodeId: string,
  edges: { source: string; target: string; sourceHandle?: string }[],
  nodes: { id: string; type?: string }[]
): string[] {
  const sinks: string[] = [];
  for (const e of edges) {
    if (e.source !== llmNodeId) continue;
    // LLM 的右侧 source handle 唯一是 "output"；其它（不会出现）忽略
    if (e.sourceHandle && e.sourceHandle !== "output") continue;
    const target = nodes.find((n) => n.id === e.target);
    if (!target?.type) continue;
    if ((SINK_KINDS as readonly string[]).includes(target.type)) {
      sinks.push(target.id);
    }
  }
  return sinks;
}
