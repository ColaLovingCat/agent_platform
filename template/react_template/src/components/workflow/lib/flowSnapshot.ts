/** Flow snapshot 工具
 *
 * 画布上的 nodes / edges 是 React Flow 维护的、跟我们的 Flow 持久化 schema 不完全
 * 同构（比如 edges 上有 markerEnd / animated / data 等运行时字段，handle 字段是
 * `string | null | undefined`）。多个调用点都需要"把当前画布状态打包成 Flow"：
 *
 *   - FlowEditor.runInline()  → 喂给 runFlowToStore()
 *   - FlowEditor.save()        → PUT 后端持久化（其实是它的子集 + 元字段）
 *   - FlowToolbar.dumpFlow()   → console.log 一份完整快照
 *
 * 这个文件提供两个层级的辅助：
 *   - {@link projectEdges}：把 React Flow 的 edges 数组投影成 FlowEdge[]
 *     （只保留持久化字段；`null` handle 转 `undefined`，避免存盘后 JSON 里出现
 *     `"sourceHandle": null` 这种语义不明的值）
 *   - {@link buildFlowSnapshot}：基于一个已有的 Flow 元信息 + 画布 nodes/edges
 *     生成完整的 Flow 对象（用于运行 / 调试）
 */

import type { Edge, Node } from "@xyflow/react";
import type { Flow, FlowEdge } from "./types";

export function projectEdges(edges: Edge[]): FlowEdge[] {
  return edges.map(({ id, source, target, sourceHandle, targetHandle, label }) => ({
    id,
    source,
    target,
    sourceHandle: sourceHandle ?? undefined,
    targetHandle: targetHandle ?? undefined,
    label: typeof label === "string" ? label : undefined,
  }));
}

/** 把 base flow 的元信息 + 当前画布 nodes/edges 组装成一个完整 Flow。
 *  这是 runFlowToStore / dumpFlow 等"非持久化但需要完整 Flow 形状"调用方的统一入口。
 */
export function buildFlowSnapshot(
  base: Flow,
  nodes: Node[],
  edges: Edge[]
): Flow {
  return {
    ...base,
    nodes: nodes as unknown as Flow["nodes"],
    edges: projectEdges(edges),
  };
}
