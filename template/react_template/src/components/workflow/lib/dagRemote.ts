/** DAG 远端 executor —— 跟 flow_engine SSE 端点对接。
 *
 *  跟 `dagSimulators.ts` 的本地 executor 同形态（都是 `AsyncGenerator<DagEvent>`），
 *  调用方完全不用关心是本地模拟还是远端服务跑——上层 `applyEvent` 一律照单全收。
 *
 *  ## 协议契约
 *
 *  请求：POST /api/flows/<flowId>/dag/{test-flow | test-node}
 *      Content-Type: application/json
 *      body:
 *          test-flow → { definition, trigger?, variables? }
 *          test-node → { node, inputs?, trigger?, variables? }
 *
 *  响应：text/event-stream
 *      帧格式：`event: <type>\ndata: <json>\n\n`
 *      最后一帧：`data: [DONE]\n\n`
 *
 *  ## 事件 shape 与本地等价
 *
 *  data JSON 就是 DagEvent，跟 dagSimulators.ts 的定义一字不差：
 *      flow_started / node_started / node_completed / node_failed / node_skipped /
 *      flow_completed / flow_failed
 *
 *  ## 错误处理
 *
 *  - fetch 失败（网络不可达 / BFF 502）→ yield 一条 `flow_failed`，方便 UI 显示
 *  - 上游非 2xx → 读 body 拼成 `flow_failed` 的 error 字符串
 *  - 解析 SSE 帧异常 → 跳过该帧，继续解析下一帧（防一帧坏的把整个流毁掉）
 */

import type { Edge, Node } from "@xyflow/react";
import type { DagEvent } from "./dagSimulators";

/** 跑整张 DAG（远端实现）。
 *  跟本地 executeWholeDag 的差异：
 *    - 不读 store（trigger / variables 必须由调用方预先组装）
 *    - 不裁剪可达集（服务端 executor 自行处理）
 */
export async function* executeWholeDagRemote(
  flowId: string,
  definition: { nodes: Node[]; edges: Edge[] },
  trigger?: unknown,
  variables?: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<DagEvent> {
  yield* fetchAndParseSse(
    `/api/flows/${encodeURIComponent(flowId)}/dag/test-flow`,
    {
      definition,
      trigger: trigger ?? null,
      variables: variables ?? {},
    },
    signal,
  );
}

/** 跑单个节点（远端实现）。
 *
 *  flowOutputs 是"祖先节点产物"——给 Code 节点的 `flow.find(id)` 用。
 *  跟 inputs 的区别：inputs 仅含直接父节点，flowOutputs 含所有祖先（已成功完成的）。
 *  不传 → 服务端退化为只用 inputs，flow.find 仅能查到直接父节点。
 */
export async function* executeSingleNodeRemote(
  flowId: string,
  node: Node,
  inputs: Record<string, unknown>,
  trigger?: unknown,
  variables?: Record<string, unknown>,
  flowOutputs?: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<DagEvent> {
  yield* fetchAndParseSse(
    `/api/flows/${encodeURIComponent(flowId)}/dag/test-node`,
    {
      node,
      inputs,
      trigger: trigger ?? null,
      variables: variables ?? {},
      flow_outputs: flowOutputs ?? {},
    },
    signal,
  );
}

/* ====================================================================
 * 内部：fetch + SSE 解析
 * ==================================================================== */

async function* fetchAndParseSse(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<DagEvent> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (e) {
    yield {
      type: "flow_failed",
      at: Date.now(),
      error: `请求失败：${e instanceof Error ? e.message : String(e)}`,
    };
    return;
  }

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    yield {
      type: "flow_failed",
      at: Date.now(),
      error: `flow_engine 返回 HTTP ${resp.status}：${text.slice(0, 500) || resp.statusText}`,
    };
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 帧分隔：连续两个换行
      let sepIndex = buffer.indexOf("\n\n");
      while (sepIndex !== -1) {
        const rawFrame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const ev = parseSseFrame(rawFrame);
        if (ev) yield ev;
        sepIndex = buffer.indexOf("\n\n");
      }
    }

    // flush 剩余 buffer 里的最后一帧（部分服务端不发结尾的 \n\n）
    if (buffer.trim()) {
      const ev = parseSseFrame(buffer);
      if (ev) yield ev;
    }
  } catch (e) {
    // 网络流中断 / abort：吐一条 flow_failed 让 UI 收尾，不静默
    if ((e as Error).name !== "AbortError") {
      yield {
        type: "flow_failed",
        at: Date.now(),
        error: `SSE 读取异常：${e instanceof Error ? e.message : String(e)}`,
      };
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 读流被 abort 时 releaseLock 也可能抛——忽略
    }
  }
}

/** 解析一帧 SSE 文本：
 *      event: <type>     ← 可选；data 自带 type 字段，仅作 hint
 *      data: <payload>
 *
 *  payload 是 "[DONE]" 时返回 null（表示流正常结束，无对应 DagEvent）
 *  payload JSON.parse 失败 → 返回 null（防一帧坏的把流毁掉；调用方继续读下一帧）
 */
function parseSseFrame(rawFrame: string): DagEvent | null {
  let dataLine = "";
  for (const line of rawFrame.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(":")) continue; // SSE 注释
    if (trimmed.startsWith("data:")) {
      // data: 可能跨多行；本协议只发一行 JSON，简单拼接即可
      dataLine += trimmed.slice(5).trimStart();
    }
    // event: 行忽略——服务端发的 type 跟 JSON.type 一致，没必要重复读
  }
  if (!dataLine || dataLine === "[DONE]") return null;
  try {
    const parsed = JSON.parse(dataLine) as DagEvent;
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
