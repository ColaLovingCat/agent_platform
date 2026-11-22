/** connection 客户端 —— 同时跟 master_data（CRUD + where-used）和 flow_engine（test / tables / columns / query）对话。
 *
 * 设计要点：
 * - master_data 端 ApiResponse<T> 跟 flows 同款；这里复用 unwrap 模式
 * - flow_engine 端是裸 JSON（FastAPI），直接返
 * - 密码字段在所有"读"路径上**永远不暴露**——master_data DTO 已经过滤；
 *   仅 flow_engine 的 internal endpoint 才解密，且要 X-Internal-Secret header
 *   （那一路 flow_engine 内部使用，BFF 不直调）
 */

import { MASTER_DATA_URL, FLOW_ENGINE_URL } from "./serverConfig";
import { getServerAuthToken } from "./authToken";

/* ===================================================================
 * 类型契约（跟 master_data ConnectionDto.cs 严格对齐）
 * =================================================================== */

export type ConnectionKind = "mssql" | "mysql" | "oracle";

/** master_data ConnectionResponseDto —— 不含密码 */
export type Connection = {
  id: string;
  name: string;
  description?: string;
  kind: ConnectionKind;
  host: string;
  port: number;
  database?: string;
  serviceName?: string;
  username: string;
  optionsJson?: string;
  hasPassword: boolean;
  isEnabled: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
  deletedBy?: string | null;
  deletedAt?: string | null;
  lastTestedAt?: string | null;
  /** "ok" / 错误 message；UI 用来给"上次测试"打绿/红 */
  lastTestedResult?: string | null;
};

/** 新建 / 更新 表单（密码可选；空 = 不改）。跟 master_data ConnectionSaveDto.cs 对齐。 */
export type ConnectionSaveInput = {
  id?: string; // 空 / 缺 = 新增
  name: string;
  description?: string;
  kind: ConnectionKind; // 创建后不可改；更新时会被后端忽略
  host: string;
  port: number;
  database?: string;
  serviceName?: string;
  username: string;
  password?: string; // 空 / null = 不改密码
  optionsJson?: string;
  isEnabled?: boolean;
};

export type WhereUsedItem = {
  flowId: string;
  flowName: string;
  nodeId: string;
  nodeType: string;
};
export type WhereUsedResult = {
  connectionId: string;
  count: number;
  items: WhereUsedItem[];
};

export type TestResult = { success: boolean; message: string; kind?: string };
export type TableInfo = { schema: string; name: string; type: "table" | "view" };
export type ColumnInfo = { name: string; type: string; nullable: boolean };
export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  elapsedMs: number;
  truncated: boolean;
  limit: number;
};

/* ===================================================================
 * 底层 fetch（参考 masterDataClient.ts 同款）
 * =================================================================== */

class UpstreamError extends Error {
  status: number;
  constructor(msg: string, status: number) {
    super(msg);
    this.status = status;
    this.name = "UpstreamError";
  }
}

function unwrap<T>(body: unknown): { ok: boolean; message: string; data: T | null } {
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if ("Status" in o || "status" in o || "success" in o) {
      const status = (o.Status ?? o.status ?? o.success) as unknown;
      const message = (o.Message ?? o.message ?? "") as string;
      const data = (o.Data ?? o.data ?? null) as T | null;
      return { ok: Boolean(status), message: String(message ?? ""), data };
    }
  }
  return { ok: true, message: "", data: body as T };
}

async function md<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  // 取数优先级：当前请求用户 Cookie → MASTER_DATA_TOKEN 服务号 → 空串。
  // 见 lib/authToken.ts 注释。
  const token = getServerAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const url = `${MASTER_DATA_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    throw new UpstreamError(
      `master_data ${path}: 网络不可达 (${e instanceof Error ? e.message : String(e)})`,
      502
    );
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const { message } = unwrap<unknown>(parsed);
    throw new UpstreamError(
      `master_data ${path}: ${message || `${res.status} ${res.statusText}`}`,
      res.status
    );
  }
  const { ok, message, data } = unwrap<T>(parsed);
  if (!ok) throw new UpstreamError(`master_data ${path}: ${message || "unknown"}`, 400);
  return data as T;
}

async function fe<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const url = `${FLOW_ENGINE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (e) {
    throw new UpstreamError(
      `flow_engine ${path}: 网络不可达 (${e instanceof Error ? e.message : String(e)})`,
      502
    );
  }
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    // FastAPI 错误 body: { detail: "..." }
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as Record<string, unknown>).detail)
        : `${res.status} ${res.statusText}`;
    throw new UpstreamError(`flow_engine ${path}: ${detail}`, res.status);
  }
  return (parsed as T) ?? (null as unknown as T);
}

/* ===================================================================
 * master_data 端 helpers
 * =================================================================== */

/** master_data row → 前端 Connection（兼容大驼峰 / 小驼峰） */
function dtoToConnection(d: unknown): Connection {
  const o = (d as Record<string, unknown>) || {};
  function p<T = unknown>(...keys: string[]): T | undefined {
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null) return v as T;
    }
    return undefined;
  }
  return {
    id: String(p("ID", "Id", "id") ?? ""),
    name: String(p("Name", "name") ?? ""),
    description: p<string>("Description", "description") ?? undefined,
    kind: (String(p("Kind", "kind") ?? "mssql").toLowerCase() as ConnectionKind),
    host: String(p("Host", "host") ?? ""),
    port: Number(p<number>("Port", "port") ?? 0),
    database: p<string>("Database", "database") ?? undefined,
    serviceName: p<string>("ServiceName", "serviceName") ?? undefined,
    username: String(p("Username", "username") ?? ""),
    optionsJson: p<string>("OptionsJson", "optionsJson") ?? undefined,
    hasPassword: Boolean(p<boolean>("HasPassword", "hasPassword") ?? false),
    isEnabled: Boolean(p<boolean>("IsEnabled", "isEnabled") ?? true),
    createdBy: p<string | null>("CreatedBy", "createdBy") ?? null,
    createdAt: p<string>("CreatedAt", "createdAt"),
    updatedBy: p<string | null>("UpdatedBy", "updatedBy") ?? null,
    updatedAt: p<string | null>("UpdatedAt", "updatedAt") ?? null,
    deletedBy: p<string | null>("DeletedBy", "deletedBy") ?? null,
    deletedAt: p<string | null>("DeletedAt", "deletedAt") ?? null,
    lastTestedAt: p<string | null>("LastTestedAt", "lastTestedAt") ?? null,
    lastTestedResult: p<string | null>("LastTestedResult", "lastTestedResult") ?? null,
  };
}

/** 转 PascalCase 让 master_data 这种 .NET 风格 .ParseAsTitleCase 不出岔 */
function saveInputToDto(input: ConnectionSaveInput): Record<string, unknown> {
  return {
    ID: input.id ?? "",
    Name: input.name,
    Description: input.description,
    Kind: input.kind,
    Host: input.host,
    Port: input.port,
    Database: input.database,
    ServiceName: input.serviceName,
    Username: input.username,
    Password: input.password,
    OptionsJson: input.optionsJson,
    IsEnabled: input.isEnabled ?? true,
  };
}

/* ===================================================================
 * 公开 API
 * =================================================================== */

export async function listConnections(): Promise<Connection[]> {
  const arr = await md<unknown[]>("/api/connections/getlist");
  return (arr ?? []).map(dtoToConnection);
}

export async function getConnection(id: string): Promise<Connection | null> {
  try {
    const dto = await md<unknown>(`/api/connections/getinfos?id=${encodeURIComponent(id)}`);
    return dto ? dtoToConnection(dto) : null;
  } catch (e) {
    if (e instanceof UpstreamError && (e.status === 404 || /不存在/.test(e.message))) return null;
    throw e;
  }
}

export async function createConnection(input: ConnectionSaveInput): Promise<Connection> {
  const dto = saveInputToDto({ ...input, id: "" });
  const saved = await md<unknown>("/api/connections/save", { method: "POST", body: dto });
  // 取新 ID（跟 flows 同款约定：成功返回 GUID 字符串）
  let newId = "";
  if (typeof saved === "string") {
    newId = saved.trim().replace(/^[{"]+|[}"]+$/g, "");
  } else if (saved && typeof saved === "object") {
    const o = saved as Record<string, unknown>;
    newId = String((o.ID ?? o.Id ?? o.id ?? "")).trim();
  }
  if (!newId || !/^[0-9a-fA-F-]{32,36}$/.test(newId)) {
    throw new Error(`/api/connections/save 返回非法 ID: ${JSON.stringify(saved)}`);
  }
  const created = await getConnection(newId);
  if (!created) throw new Error(`create 成功 (id=${newId}) 但 getinfos 失败`);
  return created;
}

export async function updateConnection(
  id: string,
  patch: Partial<ConnectionSaveInput>
): Promise<Connection | null> {
  const cur = await getConnection(id);
  if (!cur) return null;
  const merged: ConnectionSaveInput = {
    id,
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    kind: cur.kind, // 不可改
    host: patch.host ?? cur.host,
    port: patch.port ?? cur.port,
    database: patch.database ?? cur.database,
    serviceName: patch.serviceName ?? cur.serviceName,
    username: patch.username ?? cur.username,
    // password：留空 = 不改；上面 patch 把 "" 当成"不改" → 直接传 undefined
    password: patch.password ? patch.password : undefined,
    optionsJson: patch.optionsJson ?? cur.optionsJson,
    isEnabled: patch.isEnabled ?? cur.isEnabled,
  };
  const dto = saveInputToDto(merged);
  await md<string>("/api/connections/save", { method: "POST", body: dto });
  return await getConnection(id);
}

export async function deleteConnection(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    await md<string>("/api/connections/delete", { method: "POST", body: { ID: id } });
    return { ok: true, message: "OK" };
  } catch (e) {
    if (e instanceof UpstreamError) return { ok: false, message: e.message };
    throw e;
  }
}

export async function whereUsedConnection(id: string): Promise<WhereUsedResult> {
  const data = await md<{
    connectionId?: string;
    ConnectionId?: string;
    items?: WhereUsedItem[];
    Items?: WhereUsedItem[];
    count?: number;
    Count?: number;
  }>(`/api/connections/where-used?id=${encodeURIComponent(id)}`);
  const items = (data?.items ?? data?.Items ?? []) as WhereUsedItem[];
  const normalized: WhereUsedItem[] = items.map((it) => {
    const o = it as unknown as Record<string, unknown>;
    return {
      flowId: String(o.flowId ?? o.FlowId ?? ""),
      flowName: String(o.flowName ?? o.FlowName ?? ""),
      nodeId: String(o.nodeId ?? o.NodeId ?? ""),
      nodeType: String(o.nodeType ?? o.NodeType ?? "sql"),
    };
  });
  return { connectionId: id, count: normalized.length, items: normalized };
}

/* ===================================================================
 * flow_engine 端 helpers
 * =================================================================== */

export async function testConnection(id: string): Promise<TestResult> {
  return await fe<TestResult>(`/api/connections/${encodeURIComponent(id)}/test`, {
    method: "POST",
    body: {},
  });
}

export async function listConnectionTables(id: string): Promise<TableInfo[]> {
  const body = await fe<{ data?: TableInfo[]; count?: number }>(
    `/api/connections/${encodeURIComponent(id)}/tables`
  );
  return (body?.data ?? []) as TableInfo[];
}

export async function listConnectionColumns(id: string, table: string): Promise<ColumnInfo[]> {
  const body = await fe<{ data?: ColumnInfo[]; count?: number }>(
    `/api/connections/${encodeURIComponent(id)}/columns?table=${encodeURIComponent(table)}`
  );
  return (body?.data ?? []) as ColumnInfo[];
}

export async function runConnectionQuery(
  id: string,
  payload: { sql: string; params?: Record<string, unknown>; limit?: number }
): Promise<QueryResult> {
  return await fe<QueryResult>(`/api/connections/${encodeURIComponent(id)}/query`, {
    method: "POST",
    body: payload,
  });
}
