import MarkdownIt from 'markdown-it';
// @ts-expect-error no types
import markdownItKatex from 'markdown-it-katex';
import 'katex/dist/katex.min.css';

import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

import { parseClickableText, renderClickableText } from './clickableText';

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        return md.utils.escapeHtml(str);
      }
    }
    return md.utils.escapeHtml(str);
  },
});

md.use(markdownItKatex);

const defaultTextRule = md.renderer.rules.text!;
md.renderer.rules.text = (tokens, idx, options, env, self) => {
  try {
    const content = tokens[idx]?.content;
    if (content && typeof content === 'string') {
      return renderClickableText(content, md);
    }
    return defaultTextRule(tokens, idx, options, env, self);
  } catch {
    return defaultTextRule(tokens, idx, options, env, self);
  }
};

md.renderer.rules.heading_open = (tokens, idx) => {
  const tag = tokens[idx].tag;
  return `<${tag} class="chat-txt">`;
};

md.renderer.rules.table_open = () => '<table>\n';

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const language = token.info ? token.info : '';
  const highlightedCode = md.options.highlight
    ? md.options.highlight(token.content, language, '')
    : md.utils.escapeHtml(token.content);

  return `
    <div class="code-block">
      <span class="code-type">#${language}</span>
      <button class="code-copy">Copy</button>
      <pre class="hljs language-${language}"><code>${highlightedCode}</code></pre>
    </div>
  `;
};

export { md, parseClickableText };
