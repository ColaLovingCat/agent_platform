/** Transform 节点的上游样本探针。
 *
 *  TransformEditor 在 PropertyPanel 打开时需要"现做现拿"上游数据来跑 applyOps 预览。
 *  不同 kind 的上游取数姿势不同——本文件把这些差异藏在一个 probe 注册表后面，对
 *  UI 层暴露统一接口：
 *
 *    sampleUpstream(node, flow) → Promise<SampleResult>
 *
 *  当前实装：
 *    - upload      : 从 useFlowRuntime.flow.testFiles[id] 取浏览器里那份 File，
 *                    按扩展名走 csv / json / xlsx 三种 parser
 *    - httpRequest : 走 BFF 路由 /api/preview/http 把 HttpRequestNodeData 的配置
 *                    交给服务端执行（避 CORS / 鉴权），把响应解析成 rows
 *    - 其它 kind   : 返回 unsupported；UI 显示"该数据源暂不支持预览"
 *
 *  新增上游数据源时只需要：
 *    1. 在 PROBES 注册一个 entry
 *    2. 实现 probe 函数（拿 node + flow，返回 SampleResult）
 *  完全无需碰 TransformEditor。
 */
import type { Flow, FlowNode, HttpRequestNodeData, UploadNodeData } from "./types";
import { useFlowRuntime } from "./flowRuntimeStore";
import type { Row } from "./transform";
import { isExcelLikeFilename, parseExcelFile } from "./excelParse";

export type SampleResult =
  | { status: "ok"; rows: Row[]; sourceLabel: string }
  | { status: "empty"; sourceLabel: string; reason: string }
  | { status: "unsupported"; sourceLabel: string; reason: string }
  | { status: "error"; sourceLabel: string; error: string };

/** 注册表：kind → probe 函数。把"该 kind 怎么取样本"集中在这里。 */
type ProbeFn = (node: FlowNode, flow: Flow) => Promise<SampleResult>;

const PROBES: Partial<Record<string, ProbeFn>> = {
  upload: probeUpload,
  httpRequest: probeHttpRequest,
  // 后续：sql / variable / code / ... 任意上游
};

/** 入口：找 node 对应的 probe 跑一遍。没注册 → unsupported。 */
export async function sampleUpstream(
  node: FlowNode,
  flow: Flow,
): Promise<SampleResult> {
  const probe = PROBES[node.type];
  const label = friendlyLabel(node);
  if (!probe) {
    return {
      status: "unsupported",
      sourceLabel: label,
      reason: `节点类型 "${node.type}" 暂未实现预览探针`,
    };
  }
  try {
    return await probe(node, flow);
  } catch (e) {
    return {
      status: "error",
      sourceLabel: label,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function friendlyLabel(node: FlowNode): string {
  const d = (node.data ?? {}) as { label?: string };
  return `${d.label || node.type} (${node.id.slice(0, 6)})`;
}

/* ===================================================================
 * Upload Excel 探针
 *
 * Upload Excel 节点的样本就是浏览器里那份 File（存在 useFlowRuntime.flow.testFiles[id]）。
 * 解析全部托管给 lib/excelParse.ts，把多 sheet 结构拍平到"单表 rows"：
 *   - node.data.activeSheet 命中 → 用该 sheet
 *   - 没设 / 找不到 → 用首个 sheet
 * =================================================================== */

async function probeUpload(node: FlowNode): Promise<SampleResult> {
  const label = friendlyLabel(node);
  const files = useFlowRuntime.getState().flow.testFiles[node.id] || [];
  if (files.length === 0) {
    return {
      status: "empty",
      sourceLabel: label,
      reason: "Upload Excel 节点上还没有文件——在节点上或配置面板里选一个 xlsx / xls / csv",
    };
  }
  const file = files[0];
  if (!isExcelLikeFilename(file.name)) {
    return {
      status: "unsupported",
      sourceLabel: label,
      reason: `不支持的扩展名：${file.name}（仅支持 xlsx / xls / xlsm / csv / tsv）`,
    };
  }
  const parsed = await parseExcelFile(file);
  if (parsed.sheetNames.length === 0) {
    return {
      status: "empty",
      sourceLabel: label,
      reason: `${file.name} 里没有任何 sheet`,
    };
  }
  const wanted = (node.data as UploadNodeData | undefined)?.activeSheet;
  const sheetName =
    wanted && parsed.sheets[wanted] ? wanted : parsed.sheetNames[0];
  const rows = parsed.sheets[sheetName] || [];
  return {
    status: "ok",
    rows: rows as Row[],
    sourceLabel: `${label} · ${file.name}[${sheetName}]`,
  };
}

/* ===================================================================
 * HttpRequest 探针
 *
 * 走 BFF (`/api/preview/http`) 把 HttpRequestNodeData 直接交给 server-side 执行——
 *   - 避 CORS / mixed-content
 *   - 把 master_data token 等敏感头藏在服务端
 *
 * 一些 URL 字段会带 `{{trigger.xxx}}` 占位（DAG 引擎才会渲染），probe 时没有 trigger
 * 上下文。直接把含占位的 URL 发出去服务端会失败——前端先做一遍轻校验，命中占位
 * 立刻返回 unsupported 提示，避免无意义网络调用。
 * =================================================================== */

async function probeHttpRequest(node: FlowNode): Promise<SampleResult> {
  const label = friendlyLabel(node);
  const d = (node.data ?? {}) as HttpRequestNodeData;
  const url = (d.url || "").trim();
  if (!url) {
    return {
      status: "empty",
      sourceLabel: label,
      reason: "HttpRequest 还没填 URL",
    };
  }
  if (/\{\{[^}]+\}\}/.test(url) ||
      /\{\{[^}]+\}\}/.test(JSON.stringify(d.headers ?? {})) ||
      /\{\{[^}]+\}\}/.test(JSON.stringify(d.queryParams ?? {})) ||
      /\{\{[^}]+\}\}/.test(d.body ?? "")) {
    return {
      status: "unsupported",
      sourceLabel: label,
      reason:
        "URL / headers / params / body 含 {{xxx}} 模板占位——预览阶段没有 trigger 上下文，无法替换。把占位临时换成具体值就能预览。",
    };
  }

  const r = await fetch("/api/preview/http", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: d.method || "GET",
      url,
      headers: d.headers || {},
      queryParams: d.queryParams || {},
      bodyType: d.bodyType || "none",
      body: d.body || "",
      timeoutMs: d.timeoutMs || 0,
    }),
  });
  const text = await r.text();
  if (!r.ok) {
    return {
      status: "error",
      sourceLabel: label,
      error: `HTTP ${r.status}: ${text.slice(0, 300)}`,
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      status: "unsupported",
      sourceLabel: label,
      reason: "上游响应不是 JSON——Transform 节点只处理 JSON 数组形式的数据",
    };
  }

  // BFF 返回的形态：{ ok, status, headers, body, rows? } —— body 是已 JSON.parse 过的
  const body = (json as { body?: unknown }).body;
  const rows = tryExtractRows(body);
  if (rows === null) {
    return {
      status: "unsupported",
      sourceLabel: label,
      reason:
        "HTTP 响应不是 1 维表形态——期望顶层是数组对象，或者有 data / items / rows 字段是数组对象",
    };
  }
  return {
    status: "ok",
    rows,
    sourceLabel: `${label} · ${d.method || "GET"} ${url}`,
  };
}

/** 把任意 JSON 试着抽成 1 维表。
 *  规则（按命中顺序）：
 *    1. 整体是数组对象 → 直接用
 *    2. .data / .items / .rows / .results 是数组对象 → 用它
 *    3. 否则失败返回 null
 */
function tryExtractRows(v: unknown): Row[] | null {
  if (Array.isArray(v) && v.every((x) => x && typeof x === "object")) {
    return v as Row[];
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["data", "items", "rows", "results"]) {
      const sub = o[k];
      if (Array.isArray(sub) && sub.every((x) => x && typeof x === "object")) {
        return sub as Row[];
      }
    }
  }
  return null;
}
