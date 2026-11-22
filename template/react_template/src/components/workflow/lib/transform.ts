/** Transform 节点的纯函数核心。
 *
 *  本文件只暴露**确定性**的函数，不碰 DOM / fetch / 任何 IO：
 *    - applyOps        : 给一份 rows + 一串 ops，按顺序 reduce 出最终 rows + 每行的失败标记
 *    - opsForType      : 给一个列类型，回该类型可用的 filter op 集合
 *    - inferColumnType : 看一列采样值，推断它是 string / number / datetime / boolean
 *
 *  设计原则：**不抛错**。任何脏数据都被吞掉并在 cellWarnings 里记一条，
 *  让 UI 用淡红角标 + 悬浮提示告诉用户哪格转失败、为什么；上游引擎不打断。
 */
import type { TransformOp } from "./types";

export type Row = Record<string, unknown>;

/** 应用结果。
 *  - rows         : 跑完所有 enabled ops 后的最终数据
 *  - cellWarnings : 失败信息，key 为 `${rowIdx}::${column}`，value 为 reason
 *    （rowIdx 跟最终 rows 的下标对齐；中间被 filter / dedupe 删掉的行不会出现）
 *  - columns      : 最终列名顺序（rename 改名、duplicate 追加、delete 删除后的结果）
 */
export type ApplyResult = {
  rows: Row[];
  cellWarnings: Record<string, string>;
  columns: string[];
};

export type ColumnType = "string" | "number" | "datetime" | "boolean" | "mixed";

/* ===================================================================
 * applyOps —— 主入口
 * =================================================================== */

export function applyOps(
  rows: Row[],
  ops: Array<TransformOp & { enabled?: boolean }>,
): ApplyResult {
  // deep-copy 一份，避免污染调用方
  let current: Row[] = rows.map((r) => ({ ...r }));
  let columns = collectColumns(current);
  const cellWarnings: Record<string, string> = {};

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.enabled === false) continue;
    try {
      const r = applyOne(current, columns, op, cellWarnings);
      current = r.rows;
      columns = r.columns;
    } catch (e) {
      // 极端情况（如 rename to "" 等参数级硬错）：整步跳过，记一条 warning 到 0::__op
      cellWarnings[`-1::__op${i}`] =
        `op #${i + 1} ${op.kind} 失败：${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return { rows: current, cellWarnings, columns };
}

function applyOne(
  rows: Row[],
  columns: string[],
  op: TransformOp & { enabled?: boolean },
  warnings: Record<string, string>,
): { rows: Row[]; columns: string[] } {
  switch (op.kind) {
    case "rename":
      return opRename(rows, columns, op.column, op.to);
    case "duplicate":
      return opDuplicate(rows, columns, op.column, op.as);
    case "delete":
      return opDelete(rows, columns, op.column);
    case "changeType":
      return opChangeType(rows, columns, op.column, op.type, op.format, warnings);
    case "replace":
      return opReplace(rows, columns, op.column, op.from, op.to, op.useRegex);
    case "removeDuplicates":
      return opRemoveDuplicates(rows, columns, op.columns);
    case "filter":
      return opFilter(rows, columns, op.column, op.op, op.value);
  }
}

/* ===================================================================
 * Column ops
 * =================================================================== */

function opRename(
  rows: Row[],
  columns: string[],
  from: string,
  to: string,
): { rows: Row[]; columns: string[] } {
  if (!from || !to || from === to) return { rows, columns };
  if (!columns.includes(from)) return { rows, columns };
  if (columns.includes(to)) {
    // 重名静默忽略——UI 那边会在 op 编辑表单里给红字校验，这里不抛
    return { rows, columns };
  }
  const nextCols = columns.map((c) => (c === from ? to : c));
  const nextRows = rows.map((r) => {
    const o: Row = {};
    for (const c of columns) {
      o[c === from ? to : c] = r[c];
    }
    return o;
  });
  return { rows: nextRows, columns: nextCols };
}

function opDuplicate(
  rows: Row[],
  columns: string[],
  src: string,
  as: string,
): { rows: Row[]; columns: string[] } {
  if (!src || !as) return { rows, columns };
  if (!columns.includes(src)) return { rows, columns };
  if (columns.includes(as)) return { rows, columns }; // 静默拒绝重名
  return {
    rows: rows.map((r) => ({ ...r, [as]: r[src] })),
    columns: [...columns, as],
  };
}

function opDelete(
  rows: Row[],
  columns: string[],
  col: string,
): { rows: Row[]; columns: string[] } {
  if (!col || !columns.includes(col)) return { rows, columns };
  return {
    rows: rows.map((r) => {
      const { [col]: _ignore, ...rest } = r;
      return rest;
    }),
    columns: columns.filter((c) => c !== col),
  };
}

/* ===================================================================
 * Type cast
 * =================================================================== */

function opChangeType(
  rows: Row[],
  columns: string[],
  col: string,
  type: "string" | "float" | "int" | "datetime" | "boolean",
  format: string | undefined,
  warnings: Record<string, string>,
): { rows: Row[]; columns: string[] } {
  if (!col || !columns.includes(col)) return { rows, columns };
  const nextRows = rows.map((r, idx) => {
    const v = r[col];
    if (v === null || v === undefined || v === "") {
      // 空值不报错，原样保留（保持"缺失"语义）
      return r;
    }
    const cast = tryCast(v, type, format);
    if (cast.ok) {
      return { ...r, [col]: cast.value };
    }
    warnings[`${idx}::${col}`] = cast.reason;
    return r; // keepOriginal
  });
  return { rows: nextRows, columns };
}

function tryCast(
  v: unknown,
  type: "string" | "float" | "int" | "datetime" | "boolean",
  format: string | undefined,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  switch (type) {
    case "string":
      return { ok: true, value: String(v) };
    case "float": {
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (Number.isFinite(n)) return { ok: true, value: n };
      return { ok: false, reason: `"${String(v)}" 不是合法 float` };
    }
    case "int": {
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      if (Number.isFinite(n)) return { ok: true, value: Math.trunc(n) };
      return { ok: false, reason: `"${String(v)}" 不是合法 int` };
    }
    case "boolean": {
      if (typeof v === "boolean") return { ok: true, value: v };
      const s = String(v).trim().toLowerCase();
      if (["true", "1", "yes", "y", "t"].includes(s)) return { ok: true, value: true };
      if (["false", "0", "no", "n", "f"].includes(s)) return { ok: true, value: false };
      return { ok: false, reason: `"${String(v)}" 不是合法 boolean` };
    }
    case "datetime": {
      // format 暂未做严格 strptime 解析；当前 MVP：用 Date 构造直接解析
      // （ISO-8601 / RFC2822 都支持）；format 字段先留着，等接 dayjs/luxon 再用
      void format;
      const d = v instanceof Date ? v : new Date(String(v));
      if (!Number.isNaN(d.getTime())) return { ok: true, value: d.toISOString() };
      return { ok: false, reason: `"${String(v)}" 不是合法 datetime` };
    }
  }
}

/* ===================================================================
 * Replace
 * =================================================================== */

function opReplace(
  rows: Row[],
  columns: string[],
  col: string,
  from: string,
  to: string,
  useRegex: boolean | undefined,
): { rows: Row[]; columns: string[] } {
  if (!col || !columns.includes(col)) return { rows, columns };
  if (from === undefined || from === null) return { rows, columns };

  // 正则模式：用户给的是 /pattern/flags 或裸 pattern；裸 pattern 默认 global
  let pattern: RegExp | null = null;
  if (useRegex) {
    try {
      const m = from.match(/^\/(.+)\/([a-z]*)$/i);
      if (m) {
        pattern = new RegExp(m[1], m[2].includes("g") ? m[2] : m[2] + "g");
      } else {
        pattern = new RegExp(from, "g");
      }
    } catch {
      // 正则写歪了：整步跳过；UI 那边会做编辑期校验
      return { rows, columns };
    }
  }

  const nextRows = rows.map((r) => {
    const v = r[col];
    if (v === null || v === undefined) return r;
    const s = String(v);
    const next = pattern
      ? s.replace(pattern, to)
      : s.split(from).join(to);
    return { ...r, [col]: next };
  });
  return { rows: nextRows, columns };
}

/* ===================================================================
 * Remove Duplicates
 * =================================================================== */

function opRemoveDuplicates(
  rows: Row[],
  columns: string[],
  keyCols: string[] | undefined,
): { rows: Row[]; columns: string[] } {
  const keys = keyCols && keyCols.length > 0 ? keyCols : columns;
  const seen = new Set<string>();
  const nextRows: Row[] = [];
  for (const r of rows) {
    // JSON.stringify 对 key 的顺序敏感；先把 key 按字典序排好再序列化，避免
    // {a:1,b:2} vs {b:2,a:1} 被当成不同
    const k = JSON.stringify(
      Object.fromEntries(keys.sort().map((c) => [c, r[c] ?? null])),
    );
    if (seen.has(k)) continue;
    seen.add(k);
    nextRows.push(r);
  }
  return { rows: nextRows, columns };
}

/* ===================================================================
 * Filter
 * =================================================================== */

function opFilter(
  rows: Row[],
  columns: string[],
  col: string,
  op:
    | "eq" | "neq"
    | "gt" | "gte" | "lt" | "lte"
    | "contains" | "startsWith" | "endsWith"
    | "before" | "after"
    | "isEmpty" | "isNotEmpty",
  value: string | undefined,
): { rows: Row[]; columns: string[] } {
  if (!col || !columns.includes(col)) return { rows, columns };
  const nextRows = rows.filter((r) => evalFilter(r[col], op, value));
  return { rows: nextRows, columns };
}

function evalFilter(
  v: unknown,
  op:
    | "eq" | "neq"
    | "gt" | "gte" | "lt" | "lte"
    | "contains" | "startsWith" | "endsWith"
    | "before" | "after"
    | "isEmpty" | "isNotEmpty",
  value: string | undefined,
): boolean {
  const empty = v === null || v === undefined || v === "";
  if (op === "isEmpty") return empty;
  if (op === "isNotEmpty") return !empty;
  if (empty) return false; // 其它 op 在空值上恒为 false

  const sValue = value ?? "";

  switch (op) {
    case "eq":
      return String(v) === sValue;
    case "neq":
      return String(v) !== sValue;
    case "contains":
      return String(v).includes(sValue);
    case "startsWith":
      return String(v).startsWith(sValue);
    case "endsWith":
      return String(v).endsWith(sValue);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const n = typeof v === "number" ? v : Number(v);
      const m = Number(sValue);
      if (!Number.isFinite(n) || !Number.isFinite(m)) return false;
      if (op === "gt") return n > m;
      if (op === "gte") return n >= m;
      if (op === "lt") return n < m;
      return n <= m;
    }
    case "before":
    case "after": {
      const da = v instanceof Date ? v : new Date(String(v));
      const db = new Date(sValue);
      if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
      return op === "before" ? da.getTime() < db.getTime() : da.getTime() > db.getTime();
    }
  }
}

/* ===================================================================
 * Helpers · Column type inference + filter-ops-per-type
 * =================================================================== */

/** 列出某列在采样 rows 里出现过的所有非空值类型。
 *  规则：
 *    - 全部 boolean / 全部 number / 全部能解析成 Date 的 → 对应单一类型
 *    - 否则 → "string"（兜底）
 *    - 全空 → "string"
 */
export function inferColumnType(rows: Row[], col: string): ColumnType {
  let seenNum = 0;
  let seenBool = 0;
  let seenDate = 0;
  let seenStr = 0;
  let nonEmpty = 0;

  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined || v === "") continue;
    nonEmpty += 1;
    if (typeof v === "boolean") {
      seenBool += 1;
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) {
      seenNum += 1;
      continue;
    }
    const s = String(v).trim();
    // 数字字符串
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      seenNum += 1;
      continue;
    }
    // bool 字符串
    if (/^(true|false|yes|no|y|n)$/i.test(s)) {
      seenBool += 1;
      continue;
    }
    // 日期：尝试 ISO / 常见格式
    if (
      /^\d{4}-\d{2}-\d{2}/.test(s) ||
      /^\d{4}\/\d{1,2}\/\d{1,2}/.test(s) ||
      v instanceof Date
    ) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        seenDate += 1;
        continue;
      }
    }
    seenStr += 1;
  }

  if (nonEmpty === 0) return "string";
  // 全部命中同一类 → 该类；否则 mixed（=> 退化到 string 处理）
  if (seenStr === 0 && seenBool === nonEmpty) return "boolean";
  if (seenStr === 0 && seenNum === nonEmpty) return "number";
  if (seenStr === 0 && seenDate === nonEmpty) return "datetime";
  return "string";
}

/** 给一种列类型，返回 filter 节点该提供的 op 选项。
 *  UI 会按这个清单渲染下拉，避免给 number 列出现 "startsWith"。
 */
export function opsForType(t: ColumnType): Array<{
  value: TransformOp & { kind: "filter" } extends { op: infer O } ? O : never;
  label: string;
  needsValue: boolean;
}> {
  const common: Array<{ value: any; label: string; needsValue: boolean }> = [
    { value: "isEmpty", label: "is empty", needsValue: false },
    { value: "isNotEmpty", label: "is not empty", needsValue: false },
  ];
  if (t === "number") {
    return [
      { value: "eq", label: "= equals", needsValue: true },
      { value: "neq", label: "≠ not equals", needsValue: true },
      { value: "gt", label: "> greater than", needsValue: true },
      { value: "gte", label: "≥ greater or equal", needsValue: true },
      { value: "lt", label: "< less than", needsValue: true },
      { value: "lte", label: "≤ less or equal", needsValue: true },
      ...common,
    ];
  }
  if (t === "datetime") {
    return [
      { value: "before", label: "before", needsValue: true },
      { value: "after", label: "after", needsValue: true },
      { value: "eq", label: "= equals", needsValue: true },
      { value: "neq", label: "≠ not equals", needsValue: true },
      ...common,
    ];
  }
  if (t === "boolean") {
    return [
      { value: "eq", label: "= equals", needsValue: true },
      { value: "neq", label: "≠ not equals", needsValue: true },
      ...common,
    ];
  }
  // string + mixed 兜底
  return [
    { value: "eq", label: "= equals", needsValue: true },
    { value: "neq", label: "≠ not equals", needsValue: true },
    { value: "contains", label: "contains", needsValue: true },
    { value: "startsWith", label: "starts with", needsValue: true },
    { value: "endsWith", label: "ends with", needsValue: true },
    ...common,
  ];
}

/** 把任意 rows 里出现过的所有列名按"首次出现顺序"收集成数组。
 *  rows[0] 可能没有某些后面的稀疏列，所以不能直接 Object.keys(rows[0]) 完事。
 */
export function collectColumns(rows: Row[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  }
  return out;
}

/** 把一个 op 渲染成"画布卡片上要展示的一句话摘要"。
 *  用在 TransformNode 节点上和 PropertyPanel 的 op 行 header。
 */
export function describeOp(op: TransformOp): string {
  switch (op.kind) {
    case "rename":
      return `rename ${op.column} → ${op.to}`;
    case "duplicate":
      return `duplicate ${op.column} → ${op.as}`;
    case "delete":
      return `delete ${op.column}`;
    case "changeType":
      return `${op.column} as ${op.type}`;
    case "replace":
      return `${op.column}: replace "${op.from}" → "${op.to}"${op.useRegex ? " (regex)" : ""}`;
    case "removeDuplicates":
      return op.columns && op.columns.length > 0
        ? `dedupe by [${op.columns.join(", ")}]`
        : `dedupe (all columns)`;
    case "filter":
      if (op.op === "isEmpty" || op.op === "isNotEmpty") {
        return `filter ${op.column} ${op.op === "isEmpty" ? "is empty" : "is not empty"}`;
      }
      return `filter ${op.column} ${op.op} ${JSON.stringify(op.value ?? "")}`;
  }
}
