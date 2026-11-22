import type MarkdownIt from "markdown-it";

interface TextSegment {
  type: "text" | "clickable";
  //
  content?: string; // 显示的文本
  key?: string;
  value?: string;
}

export function parseClickableText(text: string): TextSegment[] {
  if (!text || typeof text !== "string") {
    return [{ type: "text", content: text || "" }];
  }

  const segments: TextSegment[] = [];
  let currentIndex = 0;
  const textLength = text.length;

  while (currentIndex < textLength) {
    const remainingText = text.slice(currentIndex);
    let earliestMatch: RegExpMatchArray | null = null;

    const bracketRegex =
      /\[([^\]]+)\]\{:data-([^=]+)=["'""\u201c\u201d]([^"'""\u201c\u201d]+)["'""\u201c\u201d]\}/;
    const bracketMatch = remainingText.match(bracketRegex);
    if (bracketMatch?.index !== undefined) {
      earliestMatch = bracketMatch;
    }

    if (earliestMatch) {
      const matchIndex = earliestMatch.index!;
      if (matchIndex > 0) {
        segments.push({
          type: "text",
          content: remainingText.slice(0, matchIndex),
        });
      }
      segments.push({
        type: "clickable",
        content: earliestMatch[1],
        key: earliestMatch[2],
        value: earliestMatch[3].trim(),
      });
      currentIndex += matchIndex + earliestMatch[0].length;
    } else {
      segments.push({ type: "text", content: remainingText });
      break;
    }
  }

  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

export function renderClickableText(text: string, md: MarkdownIt) {
  try {
    if (!text || typeof text !== "string") {
      return md.utils.escapeHtml(text || "");
    }

    const segments = parseClickableText(text);
    return segments
      .map((segment) => {
        if (segment.type === "clickable") {
          const escapedContent = md.utils.escapeHtml(String(segment.content));
          const escapedKey = md.utils.escapeHtml(String(segment.key));
          const escapedValue = md.utils.escapeHtml(String(segment.value));
          return `<span class="clickable-text" data-key="${escapedKey}" data-value="${escapedValue}">${escapedContent}</span>`;
        }
        return md.utils.escapeHtml(String(segment.content || ""));
      })
      .join("");
  } catch {
    return md.utils.escapeHtml(text);
  }
}
