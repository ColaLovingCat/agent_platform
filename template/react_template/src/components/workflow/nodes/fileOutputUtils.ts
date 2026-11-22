/** FileOutput 节点的纯工具函数集
 *
 * 抽出来的目的是 nodes/index.tsx 已经够大了，且 FilePreviewModal 也要用到
 * 里面的 detectFormat —— 共享一个文件比 export 来 export 去清爽。
 *
 * 本文件还承担"二进制媒体产物"的识别契约：当 LLM 的回复文本里出现
 * `![alt](url.wav)` / `[alt](url.png)` 等媒体引用时，FileOutput 节点应当真正去
 * 下载那份二进制（而不是把含 URL 的 markdown 文本当 .md 保存）。
 * 这套规则集中在 BINARY_EXTENSIONS / MIME_BY_EXT / extractMediaRef 三个常量函数里，
 * 之后加新媒体类型（webm / svg / pdf 等）就在这三处补即可，全链路自动适配。
 */

import type {
  FileOutputFormat,
  FileOutputNodeData,
} from "../lib/types";

/** runtime 在 store 里现在是 partial（status 等），这里只关心两件事——
 *  text 和 finishedAt——所以函数签名收敛到一个 Pick 就够，不强依赖 store 的完整类型。
 *  调用方负责在 text && finishedAt 都 truthy 时才调本函数。
 */
type DownloadSourceRuntime = {
  text: string;
  finishedAt: number;
};

/* ====================================================================
 * 媒体二进制白名单
 *
 * 设计：扩展名 → mime 一对一映射。识别 / 下载 / 预览三处都看这张表，
 *  - identify : extractMediaRef 用 ext 是否在白名单里判定"这是不是个媒体 URL"
 *  - download : FileOutputNode 用 mime 设 fetch 后 Blob 的 type
 *  - preview  : FilePreviewModal 用 mime 决定渲染 <img>/<audio>/<video>/<iframe>
 *
 * 加新类型时只动这一张表（再加测试若有），三处自动同步。
 * ==================================================================== */
const MIME_BY_EXT: Record<string, string> = {
  // audio
  wav:  "audio/wav",
  mp3:  "audio/mpeg",
  ogg:  "audio/ogg",
  flac: "audio/flac",
  m4a:  "audio/mp4",
  // image
  png:  "image/png",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  gif:  "image/gif",
  webp: "image/webp",
  svg:  "image/svg+xml",
  // video
  mp4:  "video/mp4",
  webm: "video/webm",
  mov:  "video/quicktime",
  // doc
  pdf:  "application/pdf",
};

export function isBinaryExtension(ext: string): boolean {
  return ext.toLowerCase() in MIME_BY_EXT;
}

/** Markdown 媒体引用提取：
 *  匹配 `![alt](url)` 或 `[alt](url)` 形式，取第一个其 URL 末段扩展名在白名单里的。
 *
 *  规则细节：
 *   - ! 前缀（embed 语法）优先于普通链接——embed 通常意味着"作者真希望它内联展示"
 *   - URL 取 ` ` 之前的部分（兼容 `(url "title")` 这种 markdown 标准写法）
 *   - URL 末段从最后一个 `.` 取扩展；带 query 时去掉 `?xxx`
 *   - 返回原 URL（不归一化），保持跟外部服务的字节级一致（鉴权 query 之类）
 */
export function extractMediaRef(text: string):
  | { url: string; ext: string; mime: string; matchKind: "embed" | "link" }
  | null {
  if (!text) return null;

  // 先扫 ![]() 嵌入式，再扫 []()，逐个看扩展是否在白名单
  // re 内部用非贪婪以及 \s| 区分 URL 与可选 title。
  const re = /(!?)\[[^\]]*\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const isEmbed = m[1] === "!";
    const url = m[2];
    const ext = extractExtension(url);
    if (!ext) continue;
    if (!isBinaryExtension(ext)) continue;
    return {
      url,
      ext,
      mime: MIME_BY_EXT[ext.toLowerCase()],
      matchKind: isEmbed ? "embed" : "link",
    };
  }
  return null;
}

/** 从 URL 末段提取扩展名（不含 . / query / fragment）；提不出就返回 ""。
 *  例 "http://x/y/a.b.wav?token=1" → "wav"
 */
function extractExtension(url: string): string {
  // 砍 fragment / query
  const noQuery = url.split(/[?#]/, 1)[0];
  const lastSlash = noQuery.lastIndexOf("/");
  const tail = lastSlash >= 0 ? noQuery.slice(lastSlash + 1) : noQuery;
  const dot = tail.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = tail.slice(dot + 1);
  if (!ext || ext.length > 10) return "";
  return ext;
}

/* ====================================================================
 * 产物联合类型
 *
 * FileOutput 节点的产物现在分三种：
 *   - text   : LLM 的回复直接写盘（md / txt / json）
 *   - binary : LLM 的回复里含媒体 URL，要 fetch 真二进制写盘
 *   - error  : format=media 但文本里没找到媒体 URL（用户期望明确，却无产物）
 *
 * 三种共享的字段（filename / finishedAt）放外面；各自专有字段在 union 里。
 * 调用方（FileOutputNode / FilePreviewModal）按 kind 字段 narrow。
 * ==================================================================== */
export type TextArtifact = {
  kind: "text";
  filename: string;
  /** mime（带 charset）；写 Blob 时用 */
  mime: string;
  content: string;
  size: number;
  finishedAt: number;
  /** 经过 detect 后的实际格式（不含 "auto" / "media"） */
  actualFormat: "md" | "txt" | "json";
};

export type BinaryArtifact = {
  kind: "binary";
  filename: string;
  mime: string;
  /** 媒体源 URL；FileOutputNode fetch 它拿真字节 */
  url: string;
  /** 文件扩展（无点），跟 filename 末段一致；预览用 */
  ext: string;
  finishedAt: number;
  /** 伴随的 LLM 回复原文——可选展示在预览 modal 里 */
  inlineText?: string;
};

export type ErrorArtifact = {
  kind: "error";
  reason: string;
  finishedAt: number;
};

export type Artifact = TextArtifact | BinaryArtifact | ErrorArtifact;

/** 根据节点配置 + runtime 文本计算出"要下载的产物"。
 *
 *  分流逻辑：
 *   format=md/txt/json → 强制文本模式，按选定格式
 *   format=media       → 强制二进制模式；找不到媒体 URL → 返回 error
 *   format=auto        → 优先探测媒体；探到 → binary；探不到 → 走文本启发 detectFormat
 */
export function buildDownloadInfo(
  cfg: FileOutputNodeData,
  runtime: DownloadSourceRuntime
): Artifact {
  const text = runtime.text || "";
  const ts = formatTimestamp(runtime.finishedAt);
  const prefix = sanitizePrefix(cfg.filenamePrefix || "output");
  const fmt = cfg.format || "auto";

  // 1) 显式选了文本格式 → 文本模式
  if (fmt === "md" || fmt === "txt" || fmt === "json") {
    return makeText(text, prefix, ts, runtime.finishedAt, fmt);
  }

  // 2) 显式选了 media → 必须二进制；找不到就报错
  if (fmt === "media") {
    const ref = extractMediaRef(text);
    if (!ref) {
      return {
        kind: "error",
        reason: "未在 LLM 回复中检测到媒体 URL（支持 wav/mp3/png/jpg/mp4/pdf 等）",
        finishedAt: runtime.finishedAt,
      };
    }
    return {
      kind: "binary",
      filename: `${prefix}-${ts}.${ref.ext}`,
      mime: ref.mime,
      url: ref.url,
      ext: ref.ext,
      finishedAt: runtime.finishedAt,
      inlineText: text,
    };
  }

  // 3) auto：先看有没有媒体；否则走文本启发
  const ref = extractMediaRef(text);
  if (ref) {
    return {
      kind: "binary",
      filename: `${prefix}-${ts}.${ref.ext}`,
      mime: ref.mime,
      url: ref.url,
      ext: ref.ext,
      finishedAt: runtime.finishedAt,
      inlineText: text,
    };
  }
  return makeText(text, prefix, ts, runtime.finishedAt, detectFormat(text));
}

function makeText(
  text: string,
  prefix: string,
  ts: string,
  finishedAt: number,
  fmt: "md" | "txt" | "json"
): TextArtifact {
  return {
    kind: "text",
    filename: `${prefix}-${ts}.${fmt}`,
    mime: MIME_BY_TEXT_FORMAT[fmt],
    content: text,
    size: new Blob([text]).size,
    finishedAt,
    actualFormat: fmt,
  };
}

const MIME_BY_TEXT_FORMAT: Record<"md" | "txt" | "json", string> = {
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  json: "application/json;charset=utf-8",
};

/** 启发式判断（文本模式专用）：看上去更像 md / json / txt 中的哪个。
 *
 *  规则（按优先级）：
 *   1. 以 `---\n...\n---` 开头（YAML frontmatter） → md
 *   2. 含有 markdown 标志：`#` 标题、列表行、围栏代码块、链接... → md
 *   3. 首字符是 `{` 或 `[` 且 JSON.parse 成功 → json
 *   4. 否则 → txt
 *
 *  注意：媒体探测优先级在 buildDownloadInfo 里**先**于本函数；本函数只在
 *  确认是文本产物时被调用。
 */
export function detectFormat(text: string): Exclude<FileOutputFormat, "auto" | "media"> {
  const t = text.trimStart();
  if (!t) return "txt";

  if (t.startsWith("---\n") || t.startsWith("---\r\n")) {
    // 简单确认有第二个 --- 闭合
    const rest = t.slice(4);
    if (/\n---\s*(\n|$)/.test(rest)) return "md";
  }

  // markdown 启发式：标题 / 列表 / 围栏代码块 / 链接
  if (
    /^#{1,6}\s/m.test(t) ||
    /^[-*+]\s/m.test(t) ||
    /^```/m.test(t) ||
    /\[[^\]]+\]\([^)]+\)/.test(t)
  ) {
    return "md";
  }

  if (t[0] === "{" || t[0] === "[") {
    try {
      JSON.parse(t);
      return "json";
    } catch {
      // 落到 txt
    }
  }

  return "txt";
}

/** YYYYMMDD-HHmmss（本地时区） */
export function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** 把用户自定义前缀里的非法字符清理掉，避免下载时浏览器拒收 */
export function sanitizePrefix(s: string): string {
  // 允许：字母 / 数字 / 下划线 / 连字符 / 点；其它字符替换成 _
  // 同时去掉前后空格 + 折叠多重 _
  return s
    .trim()
    .replace(/[^A-Za-z0-9_.\-\u4e00-\u9fa5]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    || "output";
}

/** "12.4 KB" / "893 B" / "1.2 MB"——节点上展示文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 节点 / modal 上显示"几秒前 / HH:mm:ss" */
export function formatTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))} 秒前`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return new Date(epochMs).toLocaleTimeString();
}

/** 根据 mime 大类决定预览组件类型——给 FilePreviewModal 用。 */
export function getMediaPreviewKind(mime: string): "image" | "audio" | "video" | "pdf" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "other";
}
