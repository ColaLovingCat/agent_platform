/** 统一的"已选/已上传文件行"组件——跨 flow 节点 + chat 附件区共用。
 *
 *  布局：100% 宽 block 行
 *    [icon] [文件名（base truncate + ext shrink-0）] [大小] [×]
 *
 *  设计要点：
 *    - **后缀永远可见**：拆 base+ext 两段，base 走 truncate，ext 走 shrink-0；
 *      这是用户的核心需求——后缀对识别文件类型最关键。
 *    - **icon 按扩展名映射**：spreadsheet/pdf/image/video/audio/text/code/archive，
 *      其它兜底通用 file 图标。映射放在本文件内（fileIconFor）保持局部内聚。
 *    - **大小 + × 永不收缩**：shrink-0 保证"必须能看到"的信息坚守阵地。
 *    - **`min-w-0`** 是 truncate 在 flex 子项里能"先收缩再省略"的前提，少一个就撑爆容器。
 *
 *  调用方：components/flow/nodes/index.tsx (UploadNode / FileInputNode)
 *          components/chat/ChatPanel.tsx (pending attachments)
 */
"use client";

import type { ReactNode } from "react";
import { formatBytes } from "./nodes/fileOutputUtils";

export function FileRow({
  name,
  size,
  mime,
  onRemove,
}: {
  name: string;
  size: number;
  /** 可选 MIME；只用于 tooltip 显示，不影响图标选择（图标按扩展名走更稳） */
  mime?: string;
  onRemove?: () => void;
}) {
  const { base, ext } = splitFilename(name);
  const titleSuffix = mime ? ` · ${mime}` : "";
  return (
    <div className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-700">
      <span className="shrink-0 text-slate-500">{fileIconFor(ext)}</span>
      <div
        className="min-w-0 flex-1 flex items-center"
        title={`${name} · ${formatBytes(size)}${titleSuffix}`}
      >
        <span className="truncate min-w-0">{base}</span>
        <span className="shrink-0">{ext}</span>
      </div>
      <span className="text-slate-400 shrink-0">{formatBytes(size)}</span>
      {onRemove && (
        <button
          type="button"
          className="nodrag text-slate-400 hover:text-rose-600 leading-none shrink-0 text-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label={`移除 ${name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** 拆文件名为 base + ext，保留点。
 *  无点 / 点在开头（隐藏文件如 .gitignore）/ 点在末尾 → 视作"无后缀"全部归入 base，
 *  避免 truncate 把"."当成后缀展示出空 ext 占位。 */
export function splitFilename(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/* ====================================================================
 * fileIconFor · 按扩展名挑图标
 *
 * 故意按"扩展名"而不是 MIME：MIME 在不同浏览器 / OS 上不稳定（拖入的 .csv 经常
 * 报 application/vnd.ms-excel 或 application/octet-stream），扩展名才是稳定信号。
 * ==================================================================== */

const EXT_GROUPS = {
  spreadsheet: new Set([".xlsx", ".xls", ".csv", ".tsv", ".ods"]),
  pdf: new Set([".pdf"]),
  image: new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif", ".heic",
  ]),
  video: new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"]),
  audio: new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]),
  code: new Set([".json", ".xml", ".yaml", ".yml", ".html", ".js", ".ts", ".py"]),
  archive: new Set([".zip", ".tar", ".gz", ".rar", ".7z"]),
  text: new Set([".txt", ".md", ".log"]),
} as const;

export type FileKind =
  | "spreadsheet"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "archive"
  | "text"
  | "generic";

export function fileKindFor(ext: string): FileKind {
  const lower = ext.toLowerCase();
  for (const k of Object.keys(EXT_GROUPS) as Array<keyof typeof EXT_GROUPS>) {
    if (EXT_GROUPS[k].has(lower)) return k as FileKind;
  }
  return "generic";
}

export function fileIconFor(ext: string): ReactNode {
  const kind = fileKindFor(ext);
  return <FileTypeIcon kind={kind} />;
}

/** SVG 风格跟 nodes/index.tsx 的 NodeIcon 一致（lucide-style 1.75 stroke），
 *  尺寸 14×14 — 跟 NodeFileRow 的 10px 文本对齐舒服。 */
function FileTypeIcon({ kind }: { kind: FileKind }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  // 基础"文件框"形状所有 kind 复用，里面再画 kind 特征——保持一组图标视觉同源
  const fileFrame = (
    <>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
    </>
  );
  switch (kind) {
    case "spreadsheet":
      // 文件框 + 内部表格网格
      return (
        <svg {...props}>
          {fileFrame}
          <path d="M8 13h8" />
          <path d="M8 17h8" />
          <path d="M12 13v4" />
        </svg>
      );
    case "pdf":
      // 文件框 + "PDF"小标签
      return (
        <svg {...props}>
          {fileFrame}
          <text x="7.5" y="18" fontSize="6" fontFamily="ui-sans-serif" fontWeight="700" fill="currentColor" stroke="none">PDF</text>
        </svg>
      );
    case "image":
      // 文件框 + 山 + 太阳
      return (
        <svg {...props}>
          {fileFrame}
          <circle cx="10" cy="13" r="1" />
          <path d="m8 18 3-3 3 3" />
        </svg>
      );
    case "video":
      // 文件框 + 三角播放
      return (
        <svg {...props}>
          {fileFrame}
          <polygon points="10 13 15 16 10 19 10 13" fill="currentColor" stroke="none" />
        </svg>
      );
    case "audio":
      // 文件框 + 波形线
      return (
        <svg {...props}>
          {fileFrame}
          <path d="M8 16v-3" />
          <path d="M11 18v-7" />
          <path d="M14 17v-5" />
          <path d="M17 16v-3" />
        </svg>
      );
    case "code":
      // 文件框 + < >
      return (
        <svg {...props}>
          {fileFrame}
          <path d="m10 13-2 2 2 2" />
          <path d="m14 13 2 2-2 2" />
        </svg>
      );
    case "archive":
      // 文件框 + 拉链虚线
      return (
        <svg {...props}>
          {fileFrame}
          <path d="M12 11v2" />
          <path d="M12 15v2" />
          <path d="M12 19v1" />
        </svg>
      );
    case "text":
      // 文件框 + 三行文字
      return (
        <svg {...props}>
          {fileFrame}
          <path d="M8 13h8" />
          <path d="M8 16h8" />
          <path d="M8 19h5" />
        </svg>
      );
    case "generic":
    default:
      return (
        <svg {...props}>
          {fileFrame}
        </svg>
      );
  }
}
