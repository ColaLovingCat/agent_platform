"use client";

import { useEffect } from "react";
import type { FileOutputFormat } from "./lib/types";
import { md } from "@/components/chats/markdown/markdown";
import { getMediaPreviewKind } from "./nodes/fileOutputUtils";

/** FilePreviewModal · 全屏预览 FileOutput 节点产物的内容
 *
 *  渲染策略：
 *  - md    : 复用聊天面板的 <Markdown>（react-markdown + remark-gfm + rehype-highlight）
 *  - json  : pretty print 后用 <pre> + 等宽字体
 *  - txt   : 原样显示在 <pre> 里
 *  - media : 按 mime 大类渲染 <img>/<audio>/<video>/<iframe pdf>；
 *            若仍传了 content（伴随 LLM 回复原文），下方折叠显示
 *
 *  交互：
 *  - 顶部：filename + 关闭按钮
 *  - 底部：复制 / 下载 两个按钮
 *  - Esc 键关闭
 *  - 点击遮罩关闭（防误关：必须正好点遮罩本身，点内容区域不行）
 */

type Props = {
  filename: string;
  /** 包含 "media" —— 与 buildDownloadInfo 的产物 union 对齐 */
  format: Exclude<FileOutputFormat, "auto">;
  /** 文本产物的真实内容；media 产物时是"伴随的 LLM 回复原文"（可空） */
  content: string;
  /** 仅 media 时有意义：fetch 后的 blob URL（同 downloadUrl，但语义上专门给预览 widget） */
  mediaUrl?: string | null;
  /** 仅 media 时有意义：媒体真实 mime（决定 img/audio/video/iframe） */
  mediaMime?: string;
  /** 下载用的 blob URL；text 模式来自本地 Blob，media 模式来自 fetch 缓存 */
  downloadUrl: string | null;
  onClose: () => void;
};

export function FilePreviewModal({
  filename,
  format,
  content,
  mediaUrl,
  mediaMime,
  downloadUrl,
  onClose,
}: Props) {
  // ESC 关闭
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 锁滚动；卸载时恢复
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // 安静失败；浏览器禁权限时会抛
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`预览 ${filename}`}
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6"
      onMouseDown={(e) => {
        // 仅当点击事件起源于遮罩本身时关闭——防止 modal 内拖选文本时误触
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">
              {filename}
            </div>
            <div className="text-[11px] text-slate-500">
              format: <span className="font-mono">{format}</span>
              {format === "media" && mediaMime ? (
                <>
                  {" · "}mime:{" "}
                  <span className="font-mono">{mediaMime}</span>
                </>
              ) : (
                <>
                  {" · "}size:{" "}
                  <span className="font-mono">{content.length}</span> chars
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2"
            aria-label="关闭"
            title="关闭 (Esc)"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          <PreviewBody
            format={format}
            content={content}
            mediaUrl={mediaUrl}
            mediaMime={mediaMime}
          />
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5 flex items-center gap-2 bg-white">
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-xs px-3 py-1.5 rounded border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700"
            title="复制完整内容到剪贴板"
          >
            复制
          </button>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={filename}
              className="ml-auto text-xs px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-600 text-white"
              title="下载到本地"
            >
              ↓ 下载
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBody({
  format,
  content,
  mediaUrl,
  mediaMime,
}: {
  format: Exclude<FileOutputFormat, "auto">;
  content: string;
  mediaUrl?: string | null;
  mediaMime?: string;
}) {
  if (format === "media") {
    return (
      <MediaPreview
        mediaUrl={mediaUrl ?? null}
        mediaMime={mediaMime ?? "application/octet-stream"}
        inlineText={content}
      />
    );
  }

  if (format === "md") {
    return (
      <div className="bg-white rounded border p-4">
        <>{md.render(content)}</>
      </div>
    );
  }

  if (format === "json") {
    let pretty = content;
    try {
      pretty = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // 解析失败就原样展示
    }
    return (
      <pre className="bg-white rounded border p-4 text-xs font-mono whitespace-pre-wrap break-words text-slate-800">
        {pretty}
      </pre>
    );
  }

  // txt
  return (
    <pre className="bg-white rounded border p-4 text-xs font-mono whitespace-pre-wrap break-words text-slate-800">
      {content}
    </pre>
  );
}

/** 媒体预览：按 mime 大类分流 img / audio / video / iframe(pdf) / fallback。
 *  mediaUrl 是 fetch 缓存后的 blob: URL（本域），所以视频/PDF 也能直接 src 不踩 CORS。
 *  inlineText 是 LLM 那段伴随回复——放在媒体下方折叠，方便对照（"模型说了什么"）。
 */
function MediaPreview({
  mediaUrl,
  mediaMime,
  inlineText,
}: {
  mediaUrl: string | null;
  mediaMime: string;
  inlineText: string;
}) {
  const kind = getMediaPreviewKind(mediaMime);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded border p-4 flex items-center justify-center">
        {!mediaUrl ? (
          <span className="text-xs text-slate-500 italic">媒体还未就绪…</span>
        ) : kind === "image" ? (
          <img
            src={mediaUrl}
            alt="preview"
            className="max-w-full max-h-[60vh] object-contain"
          />
        ) : kind === "audio" ? (
          <audio src={mediaUrl} controls className="w-full" />
        ) : kind === "video" ? (
          <video
            src={mediaUrl}
            controls
            className="max-w-full max-h-[60vh]"
          />
        ) : kind === "pdf" ? (
          <iframe
            src={mediaUrl}
            title="pdf-preview"
            className="w-full h-[60vh] border-0"
          />
        ) : (
          <div className="text-xs text-slate-500">
            该 mime 暂不支持内嵌预览（{mediaMime}）—— 用底部下载按钮取本地查看。
          </div>
        )}
      </div>

      {inlineText.trim() && (
        <details className="bg-white rounded border p-3 text-xs">
          <summary className="cursor-pointer text-slate-600 font-medium select-none">
            LLM 回复原文（含媒体链接的 markdown）
          </summary>
          <div className="mt-2 border-t pt-2">
            <>{md.render(inlineText)}</>
          </div>
        </details>
      )}
    </div>
  );
}
