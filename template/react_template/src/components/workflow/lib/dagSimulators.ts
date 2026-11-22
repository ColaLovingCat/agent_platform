/** DAG 执行驱动 —— 浏览器 → flow_engine 的"事件桥"。
 *
 *  ## 历史包袱 / 改名说明
 *
 *  文件名仍叫 `dagSimulators`，但**本地模拟器已经全部移除**。原本前端有一整套
 *  `simWebhookTrigger / simIfElse / simUpload / simCode(JS) / simResponse` 用来在浏览器里
 *  模拟 DAG 执行（"L 模式"），跟服务端"R 模式"通过 toggle 二选一。这套设计在 Code 节点
 *  上暴露出致命矛盾：本地只支持 JS、服务端只支持 Python——同一个 flow 编辑能跑 / 保存
 *  后真触发又跑不动，**"画布上跑通"不等于"生产跑通"**。
 *
 *  v2 直接简化：所有 DAG 执行统一走 flow_engine（SSE）。
 *  - 删 L/R toggle
 *  - 删本地 simulators
 *  - 保留事件协议 `DagEvent`（远端 SSE 帧的反序列化形态）
 *  - 保留 `applyEvent` 把事件翻译成 store 写操作
 *  - 保留 `buildTriggerFromTestRequest` 把画布上的 test 输入打包成 trigger payload
 *
 *  文件名留着不改，避免一次性动太多 import；后续重命名为 `dagRunner.ts` 也无伤大雅。
 *
 *  ## 调用链
 *
 *  ```
 *  画布 Run 按钮 / 节点 ▶ ─┐
 *                          ▼
 *      runWholeDagFromStore() / runSingleNodeFromStore()
 *                          ▼
 *      executeWholeDagRemote() / executeSingleNodeRemote()   ← dagRemote.ts
 *      (fetch SSE + parse → AsyncGenerator<DagEvent>)
 *                          ▼
 *                  applyEvent(ev) ──► useFlowRuntime.setNodeStatus(...)
 *                                       ↓
 *                                   RuntimePanel / 节点头状态
 *  ```
 *
 *  ## 事件协议 (DagEvent)
 *
 *  跟 flow_engine `core/dag_event.py` 一一对应（SSE event 名 + JSON data 字段）。
 *
 *    flow_started      ─ 一次 Run 开始
 *    node_started      ─ 某节点开始执行
 *    node_completed    ─ 某节点完成；带 text / outputData / branch（ifElse）
 *    node_failed       ─ 某节点抛错；带 error message
 *    node_skipped      ─ 某节点本轮不会执行（不支持的类型 / 分支被裁）
 *    flow_completed    ─ 一次 Run 全部走完
 *    flow_failed       ─ 一次 Run 中途遇到 fatal（executor 本身 throw）
 */

import type { Edge, Node } from "@xyflow/react";
import { useFlowRuntime } from "./flowRuntimeStore";
import { executeSingleNodeRemote, executeWholeDagRemote } from "./dagRemote";
import type { FlowVariable } from "./types";

/* ====================================================================
 * 全局变量 → 引擎期望的 dict 形态
 *
 *   FlowVariable[] (UI 形态：name / type / defaultValue / description)
 *     → Record<string, unknown> (引擎形态：{<name>: <defaultValue>})
 *
 * 仅取 `defaultValue` —— 运行期没有"写变量"的概念了；变量值就是 flow.variables
 * 里声明的 defaultValue（Code 节点收到的是只读 dict 副本，改了不会回写）。
 *
 * 缺省 defaultValue 的变量（用户加了 name + type 但没设值）以 null 进字典，
 * 保持跟模板 `{{var.x}}` 缺失值的"空"语义一致。
 * ==================================================================== */
function variablesToRecord(
  vs: FlowVariable[] | undefined,
): Record<string, unknown> {
  if (!vs || vs.length === 0) return {};
  const out: Record<string, unknown> = {};
  for (const v of vs) {
    if (!v?.name) continue;
    out[v.name] = v.defaultValue ?? null;
  }
  return out;
}

/* ====================================================================
 * 事件协议 (DagEvent) —— 与 flow_engine `core/dag_event.py` 保持完全一致
 * ==================================================================== */

export type DagEvent =
  | { type: "flow_started"; at: number }
  | { type: "node_started"; nodeId: string; at: number }
  | {
      type: "node_completed";
      nodeId: string;
      at: number;
      /** 节点产物（结构化）；下游节点通过 inputs[nodeId] 读到它。 */
      outputData: unknown;
      /** 给 RuntimePanel 展示的人类可读预览；不传则 UI 端按 JSON 兜底 */
      text?: string;
      /** 仅 ifElse 节点会带：选中的分支名（"true" / "false"）；UI 用来高亮对应分支 */
      branch?: string;
    }
  | { type: "node_failed"; nodeId: string; at: number; error: string }
  | {
      type: "node_skipped";
      nodeId: string;
      at: number;
      /** 给用户看的原因（节点类型服务端尚未实现 executor / 分支被裁等） */
      reason: string;
    }
  | { type: "flow_completed"; at: number }
  | { type: "flow_failed"; at: number; error: string };

/* ====================================================================
 * Trigger 打包 —— 给 webhook 类入口节点用
 *
 * 服务端拿不到浏览器 store；前端在 POST /dag/test-flow 前先把画布上的
 * testRequests[id] 解析成结构化 trigger 传过去。
 * ==================================================================== */

/** 读节点 data 上的 method，缺省 POST。data 可能是 undefined / 任意形状，宽松取。 */
function readMethod(data: unknown): "GET" | "POST" {
  if (data && typeof data === "object") {
    const m = (data as { method?: unknown }).method;
    if (m === "GET" || m === "POST") return m;
  }
  return "POST";
}

/** 把画布 testRequests 构造成跟 flow_engine executor 对齐的 trigger payload。
 *
 *  形态严格匹配 `flow_engine/core/nodes/{webhook,schedule,manual}_trigger.py` 的输出
 *  （v2 统一格式，用 `action` 字段做 discriminator）：
 *
 *    webhook POST  → { action:"webhook", method:"POST", headers:{}, body }
 *    webhook GET   → { action:"webhook", method:"GET",  headers:{}, query }
 *    schedule      → undefined（让 backend executor 从节点 paramsJson 兜底；
 *                              scheduler.py 注入的 schedule meta 编辑器测试时无意义）
 *    manual        → { action:"manual", params:{} }
 *                    （v1 没有 Run modal；params 始终空。modal 接入后这里再填）
 *
 *  返回 undefined 表示"不构造，让 backend 自决"——backend executor 自己有兜底逻辑
 *  （schedule 会读 paramsJson，manual 给空 params）。这比"前端构造个空壳塞过去"更
 *  接近"生产路径在做什么"的语义。
 */
export function buildTriggerFromTestRequest(node: Node | undefined): unknown {
  if (!node) return undefined;
  const req = useFlowRuntime.getState().flow.testRequests[node.id];

  if (node.type === "webhookTrigger") {
    const method = readMethod(node.data);
    if (method === "GET") {
      return {
        action: "webhook",
        method: "GET",
        headers: {},
        query: parseQueryString(req?.query ?? ""),
      };
    }
    return {
      action: "webhook",
      method: "POST",
      headers: {},
      body: parseBodyString(req?.body ?? ""),
    };
  }

  if (node.type === "scheduleTrigger") {
    // 不构造——backend schedule_trigger executor 会从节点 paramsJson 解析 params，
    // 并用"now"补齐 schedule.scheduledAt/firedAt。前端这里不重复劳动。
    return undefined;
  }

  if (node.type === "manualTrigger") {
    // v1: 没有"运行时 modal 让用户填 params"的 UI；params 始终空。
    // TODO: modal 接入后从 store 里取用户填的 paramsValues。
    return { action: "manual", params: {} };
  }

  // 非 trigger 节点不应该走到这里；保底返 undefined
  return undefined;
}

/** body 字符串 → JSON 对象（失败保留字符串原文，让用户在 RuntimePanel 看到问题）。 */
function parseBodyString(raw: string): unknown {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** query string → Record<str, str>。URLSearchParams 直接传 `?id=1` 会把 "?id" 当 key——
 *  手动剥前导 `?`。 */
function parseQueryString(raw: string): Record<string, string> {
  const qs = raw.startsWith("?") ? raw.slice(1) : raw;
  const out: Record<string, string> = {};
  if (!qs.trim()) return out;
  for (const [k, v] of new URLSearchParams(qs)) {
    out[k] = v;
  }
  return out;
}

/* ====================================================================
 * UI 入口 —— 浏览器侧"点 Run / 点节点 ▶"调这里
 *
 * 所有路径统一走 flow_engine：BFF 9750 透传到 9730 的 /api/flows/<id>/dag/test-*
 * 拿 SSE → 解析成 DagEvent → applyEvent 写 store。
 * ==================================================================== */

/** 跑整张 DAG。reset store 后从 startId（webhookTrigger / scheduleTrigger / manualTrigger）开始。
 *
 *  - 跑前清掉 byNodeId 里所有节点状态（保留 testInput / testFiles / testRequests）
 *  - 按 startNode.type 构造 trigger payload（buildTriggerFromTestRequest 内部分流）
 *  - drain SSE 事件 → applyEvent 逐步更新 UI
 *  - 可选 onEvent 钩子：每条 DagEvent 触发一次，调用方可以做"画布跟随聚焦"等 UI 副作用
 *
 *  onEvent 调用顺序：**先写 store，再调钩子**——确保钩子看到的 store 已是最新态。
 */
export async function runWholeDagFromStore(
  startId: string,
  nodes: Node[],
  edges: Edge[],
  flowId: string,
  variables: FlowVariable[] | undefined,
  onEvent?: (ev: DagEvent) => void,
): Promise<void> {
  const store = useFlowRuntime.getState();
  for (const id of Object.keys(store.byNodeId)) {
    store.clearNode(id);
  }

  const startNode = nodes.find((n) => n.id === startId);
  const trigger = buildTriggerFromTestRequest(startNode);

  for await (const ev of executeWholeDagRemote(
    flowId,
    { nodes, edges },
    trigger,
    variablesToRecord(variables),
  )) {
    applyEvent(ev);
    onEvent?.(ev);
  }
}

/** 跑单个节点。上游产物从 store 里拼出来传给服务端——服务端不查 store / DB。
 *
 *  - 任一上游 status != "ok" → 不走网络，直接发 node_failed 让用户去先跑上游
 *  - 目标节点是 trigger 类 → trigger 从 testRequests 构造；否则从图里首个 trigger 节点
 *    的 store 产物里取（"我已经跑过整张图了，单独重跑某个下游节点"的场景）
 *  - 可选 onEvent 钩子：跟 runWholeDagFromStore 同款语义
 */
export async function runSingleNodeFromStore(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  flowId: string,
  variables: FlowVariable[] | undefined,
  onEvent?: (ev: DagEvent) => void,
): Promise<void> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    applyEvent({
      type: "node_failed",
      nodeId,
      at: Date.now(),
      error: `节点 ${nodeId} 不存在于当前 flow`,
    });
    return;
  }

  // 先清自身（避免上次 error / branch 残留）
  useFlowRuntime.getState().clearNode(nodeId);

  // 收集上游 outputData：任一**直接父节点**不就绪 → 直接发 node_failed
  const store = useFlowRuntime.getState();
  const upstreamEdges = edges.filter((e) => e.target === nodeId);
  const inputs: Record<string, unknown> = {};
  for (const e of upstreamEdges) {
    const up = store.byNodeId[e.source];
    if (!up || up.status !== "ok") {
      applyEvent({
        type: "node_failed",
        nodeId,
        at: Date.now(),
        error: `上游节点 ${e.source} 还没跑过 / 未就绪；先 Run 整张图或 Run 上游`,
      });
      return;
    }
    inputs[e.source] = up.outputData;
  }

  // 收集**祖先节点**的 outputData（沿 edges 反向 BFS）—— 给 Code 节点的 flow.find(id) 用。
  // 跟 inputs 的区别：inputs 仅含直接父节点；flowOutputs 含所有祖先（已成功跑过的）。
  // 没跑过的祖先不阻断本次执行（用户可能只重跑某条分支）；flow.find 取不到就返回 None。
  const flowOutputs: Record<string, unknown> = {};
  const ancestorIds = collectAncestorIds(nodeId, edges);
  for (const ancId of ancestorIds) {
    const anc = store.byNodeId[ancId];
    if (anc && anc.status === "ok" && anc.outputData !== undefined) {
      flowOutputs[ancId] = anc.outputData;
    }
  }

  // trigger：目标节点是 trigger 时直接构造；否则从图里找首个 trigger 节点的 store 产物
  let trigger: unknown;
  if (
    node.type === "webhookTrigger" ||
    node.type === "manualTrigger" ||
    node.type === "scheduleTrigger"
  ) {
    trigger = buildTriggerFromTestRequest(node);
  } else {
    const triggerNode = nodes.find(
      (n) =>
        n.type === "webhookTrigger" ||
        n.type === "manualTrigger" ||
        n.type === "scheduleTrigger",
    );
    trigger = triggerNode ? store.byNodeId[triggerNode.id]?.outputData : undefined;
  }

  for await (const ev of executeSingleNodeRemote(
    flowId,
    node,
    inputs,
    trigger,
    variablesToRecord(variables),
    flowOutputs,
  )) {
    applyEvent(ev);
    onEvent?.(ev);
  }
}

/** 沿 edges 反向 BFS 收集所有祖先节点 id。
 *
 *  设计选择：纯拓扑反向遍历，不考虑分支裁剪——前端 store 里"跑没跑过"的状态自身就够过滤了。
 *  调用方按 store.byNodeId[id].status 再筛 "ok" 的塞进 flowOutputs；其它的不带。
 */
function collectAncestorIds(targetId: string, edges: Edge[]): Set<string> {
  const revAdj = new Map<string, string[]>();
  for (const e of edges) {
    if (!e.source || !e.target) continue;
    const arr = revAdj.get(e.target) ?? [];
    arr.push(e.source);
    revAdj.set(e.target, arr);
  }
  const out = new Set<string>();
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const src of revAdj.get(cur) ?? []) {
      if (!out.has(src)) {
        out.add(src);
        queue.push(src);
      }
    }
  }
  return out;
}

/* ====================================================================
 * Event → Store 翻译层
 *
 * DagEvent 是 flow_engine 端的统一发布协议；本函数是它在浏览器侧的唯一消费者。
 * 任何路径（runWhole / runSingle / 未来的 streaming）拿到 DagEvent 都过这里写 store，
 * 保证翻译规则唯一。
 * ==================================================================== */

export function applyEvent(ev: DagEvent): void {
  const store = useFlowRuntime.getState();
  switch (ev.type) {
    case "flow_started":
    case "flow_completed":
    case "flow_failed":
      // 当前没有 flow 级 UI 反馈（工具栏按钮自己管 running 态）；保留事件位以备将来
      // 加入"整体进度条"等控件时直接用上。
      return;

    case "node_started":
      store.setNodeStatus(ev.nodeId, "running", {
        startedAt: ev.at,
        finishedAt: undefined,
        error: undefined,
        text: undefined,
        outputData: undefined,
        branch: undefined,
      });
      return;

    case "node_completed":
      store.setNodeStatus(ev.nodeId, "ok", {
        finishedAt: ev.at,
        text: ev.text,
        outputData: ev.outputData,
        branch: ev.branch,
        error: undefined,
      });
      return;

    case "node_failed":
      store.setNodeStatus(ev.nodeId, "error", {
        finishedAt: ev.at,
        error: ev.error,
      });
      return;

    case "node_skipped":
      // 用 idle 表达"本轮不会跑"——跟 error 区分开，让用户知道"这不是出错，是被绕过"。
      // text 里写明原因，方便点开 RuntimePanel 看；status 留 idle 不点亮节点头部。
      store.mergeNode(ev.nodeId, {
        status: "idle",
        startedAt: undefined,
        finishedAt: ev.at,
        text: `(skipped) ${ev.reason}`,
        error: undefined,
        outputData: undefined,
        branch: undefined,
      });
      return;
  }
}
