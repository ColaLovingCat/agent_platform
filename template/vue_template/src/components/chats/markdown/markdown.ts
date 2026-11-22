import MarkdownIt from "markdown-it";
//@ts-ignore
import markdownItKatex from "markdown-it-katex";
import "katex/dist/katex.min.css";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

const md: any = new MarkdownIt({
  html: true,
  linkify: true, // 自动识别链接
  typographer: true,
  highlight: function (str: string, lang: any) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {
        /** empty **/
      }
    }
    return md.utils.escapeHtml(str);
  },
});
md.use(markdownItKatex);
// 标题文本
md.renderer.rules.heading_open = (tokens: any, idx: any) => {
  const tag = tokens[idx].tag;
  return `<${tag} class="chat-txt">`;
};
// 表格
md.renderer.rules.table_open = () => "<table>\n";
// 代码片段
md.renderer.rules.fence = (tokens: any, idx: any) => {
  const token = tokens[idx];
  const language = token.info ? token.info : "";
  const highlightedCode = md.options.highlight
    ? md.options.highlight(token.content, token.info)
    : md.utils.escapeHtml(token.content);

  return `
    <div class="code-block">
      <span class="code-type">#${language}</span>
      <button class="code-copy">Copy</button>
      <pre class="hljs language-${language}"><code>${highlightedCode}</code></pre>
    </div>
  `;
};

export default md;
