/** Excel / CSV 客户端解析助手 —— Upload Excel 节点 + Transform 探针共用。
 *
 *  把"扔进来一个 File 拿到所有 sheet 的 rows"这件事抽成一个纯函数。
 *
 *  支持的扩展名：
 *    .xlsx / .xls / .xlsm  → SheetJS（动态 import，不进首屏 bundle）
 *    .csv / .tsv           → 本地朴素分隔符解析
 *
 *  返回形态固定：
 *    {
 *      sheetNames: ["Sheet1", "Sheet2", ...],   // 保持文件里的原顺序
 *      sheets:     { "Sheet1": [{...}, ...], "Sheet2": [...], ... },
 *      meta:       { filename, kind: "xlsx" | "xls" | "xlsm" | "csv" | "tsv" }
 *    }
 *
 *  非法扩展名 / 解析失败统一抛 Error，让上层决定怎么提示。
 */
export type Row = Record<string, unknown>;

export type ExcelParseResult = {
  sheetNames: string[];
  sheets: Record<string, Row[]>;
  meta: {
    filename: string;
    kind: "xlsx" | "xls" | "xlsm" | "csv" | "tsv";
  };
};

/** 支持的扩展名（小写、含 `.`），UI 端 `<input accept="...">` 也用这个值。 */
export const EXCEL_ACCEPT_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".xlsm",
  ".csv",
  ".tsv",
] as const;

/** input `accept` 属性的字符串形态，逗号分隔。 */
export const EXCEL_ACCEPT_ATTR = EXCEL_ACCEPT_EXTENSIONS.join(",");

/** input `accept` 也支持给 MIME 模式；附带这些可以提高某些浏览器的命中率。
 *  注意 Excel 在 Win/macOS 上的 mime 各不相同，这里只列常见的；扩展名才是兜底。
 */
export const EXCEL_ACCEPT_FULL =
  [
    ...EXCEL_ACCEPT_EXTENSIONS,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "text/csv",
    "text/tab-separated-values",
  ].join(",");

/** 判断文件名扩展是否在支持列表里——比 mime 判断稳。 */
export function isExcelLikeFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCEL_ACCEPT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 解析入口：吃 File → 出全 sheet 数据。失败抛 Error。 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
    const text = await file.text();
    const rows = parseDelimited(text, lower.endsWith(".tsv") ? "\t" : ",");
    return {
      sheetNames: ["Sheet1"],
      sheets: { Sheet1: rows },
      meta: { filename: file.name, kind: lower.endsWith(".tsv") ? "tsv" : "csv" },
    };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    // 动态 import：xlsx ~600KB，不进首屏 bundle
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    if (wb.SheetNames.length === 0) {
      throw new Error(`${file.name} 里没有任何 sheet`);
    }
    const sheets: Record<string, Row[]> = {};
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      sheets[name] = XLSX.utils.sheet_to_json<Row>(sheet, {
        defval: null,
        raw: true,
      });
    }
    const kind: "xlsx" | "xls" | "xlsm" = lower.endsWith(".xlsx")
      ? "xlsx"
      : lower.endsWith(".xlsm")
        ? "xlsm"
        : "xls";
    return {
      sheetNames: [...wb.SheetNames],
      sheets,
      meta: { filename: file.name, kind },
    };
  }
  throw new Error(
    `不支持的扩展名：${file.name}（仅支持 ${EXCEL_ACCEPT_EXTENSIONS.join(" / ")}）`,
  );
}

/* ===================================================================
 * 朴素 CSV / TSV 解析
 *
 * 不依赖外部库；处理 BOM、引号字段（内可含分隔符 / 换行）、"" 转义、\r\n / \n。
 * 失败时尽量给残缺数据不抛错（预览容错就好）。
 * =================================================================== */

function parseDelimited(text: string, delim: string): Row[] {
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM

  const records: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQ = false;

  while (i < s.length) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      i += 1;
      continue;
    }
    if (ch === delim) {
      cur.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      if (s[i] === "\n") i += 1;
      cur.push(field);
      records.push(cur);
      cur = [];
      field = "";
      continue;
    }
    if (ch === "\n") {
      i += 1;
      cur.push(field);
      records.push(cur);
      cur = [];
      field = "";
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    records.push(cur);
  }
  while (records.length > 0 && records[records.length - 1].every((x) => x === "")) {
    records.pop();
  }
  if (records.length === 0) return [];

  const headers = uniquifyHeaders(records[0]);
  const out: Row[] = [];
  for (let r = 1; r < records.length; r++) {
    const row: Row = {};
    const cells = records[r];
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = c < cells.length ? cells[c] : "";
    }
    out.push(row);
  }
  return out;
}

function uniquifyHeaders(hs: string[]): string[] {
  const seen = new Map<string, number>();
  return hs.map((h) => {
    const base = h && h.length > 0 ? h : "column";
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}
