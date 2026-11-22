/** NodeDataContext / FlowContext —— 把 FlowEditor 顶层信息透给画布节点本体。
 *
 *  动机：节点组件由 React Flow 的 nodeTypes 注册表渲染，props 只有 NodeProps
 *  （id / data / selected 等），父组件无法 prop-drill 额外数据。轻量 Context 是
 *  最直接的解法。
 *
 *  当前两块上下文：
 *  - NodeDataContext : updateNodeData(nodeId, patch) —— 画布上某节点改 data 用
 *    （例：UploadNode 上传后写回 fileUrl）。
 *  - FlowContext     : { flowId } —— 节点 ▶ 按钮在 remote 模式下需要这个去拼
 *    `/api/flows/<id>/dag/test-node` URL。
 *
 *  默认值：no-op / 空字符串 + 控制台 warning。如果某个节点在 Provider 外用了
 *  这些 hook，开发期能立刻看到红字。
 */
"use client";

import { createContext, useContext } from "react";
import type { FlowVariable } from "./lib/types";

export type UpdateNodeData = (
  nodeId: string,
  patch: Record<string, unknown>,
) => void;

const noop: UpdateNodeData = (id) => {
  if (typeof console !== "undefined") {
    console.warn(
      `[NodeDataContext] updateNodeData called outside a Provider (nodeId=${id}). Patch ignored.`,
    );
  }
};

export const NodeDataContext = createContext<UpdateNodeData>(noop);

/** Hook 形态——节点组件 `const updateMyData = useUpdateNodeData();` 即可。 */
export function useUpdateNodeData(): UpdateNodeData {
  return useContext(NodeDataContext);
}

/* ===================================================================
 * FlowContext —— flow 级信息（当前只有 flowId）
 *
 * 用法：FlowEditor 在最顶层 <FlowContext.Provider value={{ flowId: flow.id }}>
 * 包住整个画布；任何子组件可 `const { flowId } = useFlowContext()` 拿到。
 *
 * 为什么不用 useParams：
 * - 节点组件**理论上**可以被未来的"模板预览"等场景渲染，那时 URL 没有 [id]
 * - 显式 Provider 让依赖关系清晰，也便于测试时 mock 一个 flowId
 * =================================================================== */
type FlowContextValue = {
  /** 当前 flow id。Provider 外读到的是 ""（带控制台警告）。 */
  flowId: string;
  /** 当前 flow 的全局变量列表（Global Variables 节点画布预览要用）。 */
  variables: FlowVariable[];
};

const defaultFlowContext: FlowContextValue = { flowId: "", variables: [] };

export const FlowContext = createContext<FlowContextValue>(defaultFlowContext);

/** Hook 形态——节点组件 `const { flowId } = useFlowContext();` 即可。 */
export function useFlowContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx.flowId && typeof console !== "undefined") {
    // 调用栈非常浅时打一次警告即可——不阻塞渲染
    console.warn(
      "[FlowContext] flowId is empty. 节点 ▶ remote 模式将无法拼出端点 URL。",
    );
  }
  return ctx;
}
