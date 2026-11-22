/** 解析 OpenAI 兼容的 chat/completions SSE 流（与 flow_server pages/models.html 一致）。 */

export type SseError = { status?: number; detail?: unknown };

export async function readLlmSse(
  resp: Response,
  onDelta: (text: string) => void,
  onError?: (err: SseError) => void,
): Promise<void> {
  if (!resp.body) {
    onError?.({ detail: "响应体为空" });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of block.split("\n")) {
        const trimmed = line.replace(/^data:\s?/, "");
        if (line === trimmed) continue;
        if (trimmed === "[DONE]") return;
        try {
          const obj = JSON.parse(trimmed) as {
            error?: SseError;
            choices?: { delta?: { content?: string } }[];
          };
          if (obj.error) {
            onError?.(obj.error);
            return;
          }
          const delta = obj.choices?.[0]?.delta;
          if (delta && typeof delta.content === "string" && delta.content) {
            onDelta(delta.content);
          }
        } catch {
          /* ignore partial JSON */
        }
      }
    }
  }
}

/** 从流式文本中拆分 <think>…</think> 与普通正文。 */

const THINKING_OPEN = "<think>";
const THINKING_CLOSE = "</think>";

export type ThinkingStreamHandlers = {
  onText?: (text: string) => void;
  onThinkingStart?: () => void;
  onThinking?: (text: string) => void;
  onThinkingEnd?: () => void;
};

function tailPrefixLen(s: string, marker: string): number {
  const max = Math.min(s.length, marker.length - 1);
  for (let k = max; k > 0; k--) {
    if (marker.startsWith(s.slice(-k))) return k;
  }
  return 0;
}

export class ThinkingStreamParser {
  private buf = "";
  private inThinking = false;

  reset() {
    this.buf = "";
    this.inThinking = false;
  }

  feed(text: string, handlers: ThinkingStreamHandlers) {
    if (!text) return;
    this.buf += text;

    while (this.buf) {
      if (!this.inThinking) {
        const idx = this.buf.indexOf(THINKING_OPEN);
        if (idx >= 0) {
          if (idx > 0) handlers.onText?.(this.buf.slice(0, idx));
          this.buf = this.buf.slice(idx + THINKING_OPEN.length);
          this.inThinking = true;
          handlers.onThinkingStart?.();
          continue;
        }
        const hold = tailPrefixLen(this.buf, THINKING_OPEN);
        if (hold > 0) {
          const plain = this.buf.slice(0, -hold);
          if (plain) handlers.onText?.(plain);
          this.buf = this.buf.slice(-hold);
        } else {
          handlers.onText?.(this.buf);
          this.buf = "";
        }
        break;
      }

      const idx = this.buf.indexOf(THINKING_CLOSE);
      if (idx >= 0) {
        const thinking = this.buf.slice(0, idx);
        if (thinking) handlers.onThinking?.(thinking);
        this.buf = this.buf.slice(idx + THINKING_CLOSE.length);
        this.inThinking = false;
        handlers.onThinkingEnd?.();
        continue;
      }
      const hold = tailPrefixLen(this.buf, THINKING_CLOSE);
      if (hold > 0) {
        const part = this.buf.slice(0, -hold);
        if (part) handlers.onThinking?.(part);
        this.buf = this.buf.slice(-hold);
      } else {
        handlers.onThinking?.(this.buf);
        this.buf = "";
      }
      break;
    }
  }

  flush(handlers: ThinkingStreamHandlers) {
    if (!this.buf) return;
    if (this.inThinking) {
      handlers.onThinking?.(this.buf);
    } else {
      handlers.onText?.(this.buf);
    }
    this.buf = "";
    if (this.inThinking) {
      this.inThinking = false;
      handlers.onThinkingEnd?.();
    }
  }
}
