/** Flow 执行器
 *
 * 把 ChatPanel.send() 里那一坨"找主 LLM → 拼 system → 算启用集 → buildRunBody →
 * 流式遍历 SSE → 分发事件"的逻辑抽成一个独立函数，让 ChatPanel 和（下一步要做的）
 * FlowToolbar.Run 共用同一条执行路径——从此 chat 跟 canvas inline run 行为完全一致，
 * 不会出现"chat 里能跑 canvas 里跑出 bug"这种漂移。
 *
 * ## 两个口径
 *
 * 1. `runFlowOnce(opts, callbacks)` —— **纯函数 + callbacks**
 *    不依赖 zustand store；调用方按需 hook 自己的状态。ChatPanel 直接用，
 *    把事件 callback 转成 `setMessages(...)`。
 *
 * 2. `runFlowToStore(opts)` —— **高级封装**
 *    内部把 callbacks 全部连到 `useFlowRuntime`，让画布上的节点直接显示 runtime。
 *    FlowToolbar 的 inline Run 用这个。
 *
 * ## 设计取舍
 *
 * - **callbacks 而不是 async iterator**：调用方需要在多个事件类型上做不同操作
 *   （deltas vs tool_call vs tool_result …），用 callbacks 把分发逻辑收在 runner 里，
 *   调用方写起来更平。如果以后要更通用（例如同时喂多个 sink），再补一个事件迭代版本。
 *
 * - **runner 维护 fullText 状态**：assistant_delta 事件每次只携带增量；很多调用方需要
 *   "完整文本"（例如把 final content 推进 FileOutput）。所以 runner 内部累积 fullText，
 *   在 onAssistantDelta 里同时把 delta 和 fullText 透传出去，避免每个调用方都重复实现。
 *
 * - **不抛**：执行错误（run_error / llm_error / fetch 失败）走 onError；
 *   AbortError 走 onAborted。最终 result 里有 `error` / `aborted` 字段。
 *   只有"前置校验失败"（找不到主 LLM、缺 backend/model）才同步抛 RunFlowSetupError，
 *   方便调用方在调用前做最简校验。
 */

import type { Flow, FlowNode, ToolNodeData } from "./types";
import {
  buildRunBody,
  buildUserInputWithAttachments,
  computeEnabledKBsFromGraph,
  computeEnabledSkillsFromGraph,
  computeEnabledToolsFromGraph,
  computeSystemPromptFromGraph,
  computeToolOverridesFromGraph,
  findFileInputNodesForLLM,
  findPrimaryLLMNode,
  mergeFileInputConstraints,
  runReactStream,
  type KnowledgeBase,
  type Skill,
  type Tool,
} from "./flowEngine";
import {
  findOutputSinkNodes,
  useFlowRuntime,
  type ToolCallView,
} from "./flowRuntimeStore";

/* ===================================================================
 * 类型
 * =================================================================== */

export type RunFlowOptions = {
  flow: Flow;
  /** 用户当前这一 turn 的输入（ChatPanel = 用户消息；inline run = testInput） */
  userInput: string;
  /** 之前的对话历史（多轮 chat 用；inline run 传 [] 即可） */
  history?: { role: string; content: string }[];
  /** 函数式 tool 元信息（由 ChatPanel/FlowEditor fetch 的全局快照传进来） */
  allTools: Tool[];
  /** Skill (md) 元信息 */
  allSkills: Skill[];
  /** KB 列表；空数组 = 跳过 KB 启用集计算（节省 fetch 开销，调用方按需传） */
  allKnowledgeBases?: KnowledgeBase[];
  /** 团队 id（可选）—— 仅当跑的是 team chat 时传：flow_engine 收到后会构造
   *  sub-agent overlay 把团队其他成员注入成 LLM 工具。
   *  单 flow chat 不传。 */
  teamId?: string;
  /** 用户中断 */
  signal?: AbortSignal;
};

export type RunFlowCallbacks = {
  /** 流式 assistant 内容增量。delta = 本次新增；fullText = 累积到现在的全文 */
  onAssistantDelta?: (delta: string, fullText: string) => void;
  /** llm_message 事件：可能携带 tool_calls 元信息（id + name），先于 tool_call 到达 */
  onLLMMessage?: (toolCalls: ToolCallView[]) => void;
  /** tool_call 事件：LLM 决定调用某 tool */
  onToolCall?: (tc: ToolCallView) => void;
  /** tool_result 事件：tool 执行成功 */
  onToolResult?: (id: string, result: string) => void;
  /** tool_error 事件：tool 执行失败 */
  onToolError?: (id: string, error: string) => void;
  /** run_completed：成功收尾，带 iter 数 */
  onRunCompleted?: (iterations: number) => void;
  /** run_error / llm_error / fetch 失败 */
  onError?: (error: string) => void;
  /** AbortError 单独走这里，方便调用方区分"用户主动停"和"出错" */
  onAborted?: () => void;
};

export type RunFlowResult = {
  /** 主 LLM 节点 id（如果前置校验都过了的话一定有） */
  primaryLLMId: string;
  /** 最终的 assistant 文本（流式累积的最终值） */
  finalText: string;
  /** 总迭代次数（来自 run_completed 事件；未到达就是 undefined） */
  iterations?: number;
  /** 用户中断 */
  aborted?: boolean;
  /** 出错 */
  error?: string;
};

/** 前置校验失败抛这个——调用方一般在 try/catch 里把它转成 UI 提示 */
export class RunFlowSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunFlowSetupError";
  }
}

/* ===================================================================
 * runFlowOnce
 * =================================================================== */

/**
 * 跑一次 flow（chat 单 turn / inline 单次试跑）。
 *
 * 同步抛：
 *   - `RunFlowSetupError`：找不到主 LLM / 缺 backend|model / userInput 为空
 *
 * 异步通过 callbacks 流出：
 *   - 流式 delta、tool 事件、错误、完成、中断
 *
 * 返回：
 *   - 最终结果对象（含 finalText / iterations / aborted / error）
 */
export async function runFlowOnce(
  opts: RunFlowOptions,
  callbacks: RunFlowCallbacks = {}
): Promise<RunFlowResult> {
  const {
    flow,
    userInput,
    history = [],
    allTools,
    allSkills,
    allKnowledgeBases = [],
    teamId,
    signal,
  } = opts;

  // ---- 1. 前置校验 ----
  if (!userInput.trim()) {
    throw new RunFlowSetupError("输入为空");
  }
  const primary = findPrimaryLLMNode(flow);
  if (!primary) {
    throw new RunFlowSetupError("此 flow 没有 LLM 节点");
  }
  if (!primary.data.backend || !primary.data.model) {
    throw new RunFlowSetupError("LLM 节点未选择 backend / model");
  }

  // ---- 2. 拼 system & 算启用集 ----
  // System：图里 Prompt 节点 → 否则 LLM.data.system → 否则不发 system
  const graphSystem = computeSystemPromptFromGraph(flow);
  const finalSystem = graphSystem ?? primary.data.system ?? "";
  const sysPrefix = finalSystem
    ? [{ role: "system", content: finalSystem }]
    : [];

  const enabledTools = computeEnabledToolsFromGraph(flow, allTools);
  const enabledSkills = computeEnabledSkillsFromGraph(flow, allSkills);
  const enabledKBs = computeEnabledKBsFromGraph(flow, allKnowledgeBases);
  // Tool 节点上设置的 paramOverrides 聚合：runtime LLM 选了再被 flow_engine 强制覆盖。
  // 跟 enabledTools 分开计算：tool 可以"启用但不锁参数"，也可以"锁参数但仍属启用集"。
  const toolOverrides = computeToolOverridesFromGraph(flow);

  // ---- 3. 拼 messages（系统 + 历史 + 当前用户消息）----
  const userMsg = { role: "user", content: userInput };
  const messages = [...sysPrefix, ...history, userMsg];

  const body = buildRunBody(primary.data, messages, {
    stream: true,
    tools: enabledTools,
    skills: enabledSkills,
    knowledgeIds: enabledKBs,
    toolOverrides,
    // flowId：让 flow_engine 把本次会话挂在持久化的 flow 上（FlowRun 追溯用）。
    flowId: flow.id || undefined,
    // teamId：team chat 时传，触发 flow_engine 端构造 sub-agent overlay；
    // 单 flow chat 不传，行为跟以前一致。
    teamId: teamId || undefined,
  });

  // ---- 4. 跑 SSE，分发事件 ----
  const result: RunFlowResult = {
    primaryLLMId: primary.id,
    finalText: "",
  };

  try {
    for await (const ev of runReactStream(body, { signal })) {
      const cat = ev.category as string | undefined;
      switch (cat) {
        case "assistant_delta": {
          const delta = (ev.content as string) || "";
          result.finalText += delta;
          callbacks.onAssistantDelta?.(delta, result.finalText);
          break;
        }
        case "llm_message": {
          const tcs = (ev.tool_calls as Array<{
            id: string;
            function?: { name?: string };
          }>) || [];
          if (tcs.length) {
            const views: ToolCallView[] = tcs.map((tc) => ({
              id: tc.id,
              name: tc.function?.name || "",
            }));
            callbacks.onLLMMessage?.(views);
          }
          break;
        }
        case "tool_call": {
          callbacks.onToolCall?.({
            id: ev.id as string,
            name: ev.name as string,
            args: ev.args,
          });
          break;
        }
        case "tool_result": {
          callbacks.onToolResult?.(
            ev.id as string,
            ev.result as string
          );
          break;
        }
        case "tool_error": {
          callbacks.onToolError?.(
            ev.id as string,
            ev.error as string
          );
          break;
        }
        case "run_completed": {
          const iter = (ev.iterations as number) ?? 0;
          result.iterations = iter;
          callbacks.onRunCompleted?.(iter);
          break;
        }
        case "run_error":
        case "llm_error": {
          const err = (ev.error as string) || `unknown ${cat}`;
          result.error = err;
          callbacks.onError?.(err);
          break;
        }
        // 其它事件类型先忽略——把 UI 该处理的全部归在上面这几类里
      }
    }
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    if (isAbort) {
      result.aborted = true;
      callbacks.onAborted?.();
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      result.error = msg;
      callbacks.onError?.(msg);
    }
  }

  return result;
}

/* ===================================================================
 * runFlowToStore · inline run 用的高级封装
 *
 * 把 callbacks 全部连到 useFlowRuntime store，让画布上的节点直接显示运行时：
 *
 *   开始：
 *     - 找 Chat Input 节点 → setNodeStatus(input, "running")
 *     - primaryLLM       → setNodeStatus(llm, "running")
 *     - 候选的 sink 节点（FileOutput / Output）→ setNodeStatus(sink, "running")
 *
 *   流式过程：
 *     - assistant_delta → mergeNode(llm, { text: fullText })
 *     - tool_call       → appendNodeToolCall(llm, tc)
 *                          + 若图里有名字匹配的 Tool 节点 → setNodeStatus(toolN, "running", { args })
 *     - tool_result     → patchNodeToolCall(llm, id, { result })
 *                          + 对应 Tool 节点 → setNodeStatus(toolN, "ok", { result, text: result })
 *     - tool_error      → patchNodeToolCall(llm, id, { error })
 *                          + 对应 Tool 节点 → setNodeStatus(toolN, "error", { error })
 *
 *   结束：
 *     - run_completed → llm setNodeStatus("ok", { iterations, text })
 *     - error / abort → llm setNodeStatus("error", { error })
 *     - 成功才推 sinks（用 setNodeOutput）
 *     - input 节点状态切回 idle / 保留 ok 标记（标识"上次输入是几点跑的"）
 *
 * 调用方一般是 FlowToolbar 的 inline Run；ChatPanel 那条路不用——它有自己的
 * messages 状态机，跟 store 是两套独立的视图。
 * =================================================================== */

export type RunFlowToStoreOptions = Omit<
  RunFlowOptions,
  "userInput" | "history"
> & {
  /** 来自 Chat Input 节点的画布内输入；为空则前置校验失败 */
  testInput: string;
};

export async function runFlowToStore(
  opts: RunFlowToStoreOptions
): Promise<RunFlowResult> {
  const {
    flow,
    testInput,
    allTools,
    allSkills,
    allKnowledgeBases,
    signal,
  } = opts;

  // 同步前置校验——拿不到 primaryLLMId 就不能展示运行时，让上层 catch 处理
  const primary = findPrimaryLLMNode(flow);
  if (!primary) throw new RunFlowSetupError("此 flow 没有 LLM 节点");
  if (!primary.data.backend || !primary.data.model) {
    throw new RunFlowSetupError("LLM 节点未选择 backend / model");
  }

  // 收集所有 FileInput 节点上画布内挑的测试文件——跟 ChatPanel 的 pendingFiles 等价物。
  // 多个 FileInput 节点接到同一个 LLM 时按"出现顺序"扁平化；它们的约束已合并出
  // 一个统一的 parseAs，所有文件按这一种解析方式拼。
  const fileInputs = findFileInputNodesForLLM(flow, primary.id);
  const store = useFlowRuntime.getState();
  const allTestFiles: File[] = [];
  for (const fi of fileInputs) {
    const files = store.flow.testFiles[fi.id];
    if (files && files.length) allTestFiles.push(...files);
  }
  const parseAs =
    fileInputs.length > 0
      ? mergeFileInputConstraints(fileInputs).parseAs
      : "text";

  // 校验：text 与 testFiles 至少有一个非空才算"有得跑"
  if (!testInput.trim() && allTestFiles.length === 0) {
    throw new RunFlowSetupError(
      fileInputs.length > 0
        ? "Chat Input 文本与 File Input 文件均为空"
        : "Chat Input 节点的输入为空"
    );
  }

  // 准备：找 input / sink 节点 id；建 toolName → toolNodeId 索引
  const inputNode = flow.nodes.find((n) => n.type === "input");
  const sinks = findOutputSinkNodes(
    primary.id,
    flow.edges,
    flow.nodes
  );
  const toolByName = buildToolNameIndex(flow.nodes);

  // 把 text + 附件按 parseAs 合成最终 user message；同 chat 路径
  const { userInputForLLM } = await buildUserInputWithAttachments(
    testInput,
    allTestFiles,
    parseAs
  );

  // 起跑：标 running 并清除上一轮残留产物（toolCalls / error / iterations）
  if (inputNode) store.setNodeStatus(inputNode.id, "running");
  // FileInput 节点也参与运行可视化：本 turn 用了哪些文件，进入 running → 成功 ok
  for (const fi of fileInputs) {
    if (store.flow.testFiles[fi.id]?.length) {
      store.setNodeStatus(fi.id, "running");
    }
  }
  store.setNodeStatus(primary.id, "running", {
    text: "",
    toolCalls: [],
    error: undefined,
    iterations: undefined,
  });
  for (const sid of sinks) {
    // 不清空 sink 上的 text—— 让用户能在 spinner 时仍看到上一次 ok 的产物，
    // 直到本次成功才覆盖
    store.setNodeStatus(sid, "running");
  }

  return runFlowOnce(
    {
      flow,
      userInput: userInputForLLM,
      history: [],
      allTools,
      allSkills,
      allKnowledgeBases,
      signal,
    },
    {
      onAssistantDelta: (_delta, fullText) =>
        store.mergeNode(primary.id, { text: fullText }),

      onLLMMessage: (tcs) => {
        for (const tc of tcs) store.appendNodeToolCall(primary.id, tc);
      },

      onToolCall: (tc) => {
        store.appendNodeToolCall(primary.id, tc);
        const tnId = toolByName.get(tc.name);
        if (tnId) {
          store.setNodeStatus(tnId, "running", {
            args: tc.args,
            error: undefined,
            result: undefined,
            text: undefined,
          });
        }
      },

      onToolResult: (id, result) => {
        store.patchNodeToolCall(primary.id, id, { result });
        // 通过 toolCalls 反查这条调用对应的 tool name → 节点
        const tcs = store.byNodeId[primary.id]?.toolCalls;
        const tc = tcs?.find((x) => x.id === id);
        const tnId = tc ? toolByName.get(tc.name) : undefined;
        if (tnId) {
          store.setNodeStatus(tnId, "ok", { result, text: result });
        }
      },

      onToolError: (id, error) => {
        store.patchNodeToolCall(primary.id, id, { error });
        const tcs = store.byNodeId[primary.id]?.toolCalls;
        const tc = tcs?.find((x) => x.id === id);
        const tnId = tc ? toolByName.get(tc.name) : undefined;
        if (tnId) store.setNodeStatus(tnId, "error", { error });
      },

      onRunCompleted: (iterations) => {
        // 等下面统一在 finally 里处理；这里只记录 iter 进 store，让用户在 LLM
        // 节点上看到迭代次数（即使后续断流也保留）
        store.mergeNode(primary.id, { iterations });
      },

      onError: (err) => {
        store.setNodeStatus(primary.id, "error", { error: err });
        for (const sid of sinks) {
          store.setNodeStatus(sid, "error", { error: err });
        }
      },

      onAborted: () => {
        // aborted 标成 idle 避免 LLM 节点上残留红色错误提示——把 finishedAt 抹掉，
        // 让 UI 上看起来"什么都没发生过"
        store.mergeNode(primary.id, {
          status: "idle",
          finishedAt: undefined,
        });
        for (const sid of sinks) {
          // 同理：sink 回退到 idle，但保留上次 ok 的 text/finishedAt（如果有）
          const prev = store.byNodeId[sid];
          if (prev?.status === "running") {
            store.mergeNode(sid, { status: prev.text ? "ok" : "idle" });
          }
        }
      },
    }
  ).then((result) => {
    // 收尾：把 input / fileInput / llm / sink 落到终态
    if (inputNode) {
      store.setNodeStatus(
        inputNode.id,
        result.aborted ? "idle" : result.error ? "error" : "ok",
        result.error ? { error: result.error } : {}
      );
    }
    // FileInput 节点跟 chat input 同语义：成功 = ok / 出错 = error / 中断 = idle
    for (const fi of fileInputs) {
      // 只更新本 turn 里真正用过的那几个（之前置过 running）；没用到的保持 idle
      const prev = store.byNodeId[fi.id];
      if (prev?.status !== "running") continue;
      store.setNodeStatus(
        fi.id,
        result.aborted ? "idle" : result.error ? "error" : "ok",
        result.error ? { error: result.error } : {}
      );
    }
    if (!result.aborted && !result.error) {
      store.setNodeStatus(primary.id, "ok", { text: result.finalText });
      // 推 sink：FileOutput / Output 拿到最终文本——跟 ChatPanel 行为一致
      const finishedAt = Date.now();
      for (const sid of sinks) {
        store.mergeNode(sid, {
          status: "ok",
          text: result.finalText,
          finishedAt,
        });
      }
    }
    return result;
  });
}

/** 建 toolName → flow 里 type=tool 节点 id 的索引。
 *  注意：MCP server 暴露的 tool 不在 flow 里有独立节点（用户拖的是 MCP 节点而不是 Tool 节点），
 *  所以这种 tool 调用时只更新 LLM 的 toolCalls 列表，**没有**单独节点级状态可点亮——
 *  这是有意为之，避免画布上瞎闪。
 */
function buildToolNameIndex(nodes: FlowNode[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nodes) {
    if (n.type !== "tool") continue;
    const name = (n.data as ToolNodeData).name;
    if (name) m.set(name, n.id);
  }
  return m;
}
