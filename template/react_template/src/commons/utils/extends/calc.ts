import * as extend from "@/commons/utils/extends";

export class Funcs {
  // 截取字符串
  static async LEFT(str: string, len: number) {
    str = str != null ? String(str) : "";
    return str.slice(0, len);
  }
  static async RIGHT(str: string, len: number) {
    str = str != null ? String(str) : "";
    return str.slice(-len);
  }
  static async SUBSTR(str: string, start: number, len: number) {
    str = str != null ? String(str) : "";
    return str.substr(start - 1, len);
  }

  // 获取当前时间
  static async DATENOW(format: string) {
    return extend.ExDate.format(new Date(), format);
  }

  /** 动态注册静态方法 */
  static register(name: string, fn: (...args: any[]) => any) {
    (this as any)[name.toUpperCase()] = fn;
  }
}

/** 主计算函数 */
export const calcStr = async (
  template: string,
  values: any
): Promise<string> => {
  let result = template;

  // 从 template 中提取所有 ${...}，支持嵌套
  const matches = extractExpressions(template);

  for (const m of matches) {
    const key = m.inner.trim();

    // 判断是否函数调用
    const funcRegex = /^\w+\(.*\)$/;
    if (funcRegex.test(key)) {
      // 处理函数
      const replaced = await parseFunction(key, values);
      result = result.replace(m.raw, replaced);
    } else {
      // 普通变量
      const obj = values?.value ?? values;
      const val = obj[key];
      result = result.replace(m.raw, val != null ? String(val) : "");
    }
  }

  return result;
};
// 处理表达式
function extractExpressions(
  template: string
): { raw: string; inner: string }[] {
  // 存放解析结果的数组
  const results: { raw: string; inner: string }[] = [];
  // 当前扫描的位置
  let i = 0;
  while (i < template.length) {
    // 如果当前位置是 "${"
    if (template[i] === "$" && template[i + 1] === "{") {
      // depth 表示花括号嵌套层数
      // 初始值 1，因为我们已经遇到了一个 "{"
      let depth = 1;

      // j 从 i+2 开始（跳过 "${"）
      let j = i + 2;

      // 向后扫描，直到括号完全闭合 (depth 回到 0)
      while (j < template.length && depth > 0) {
        if (template[j] === "{") depth++; // 遇到左括号，嵌套层数 +1
        else if (template[j] === "}") depth--; // 遇到右括号，嵌套层数 -1
        j++;
      }

      // raw = 整个匹配片段（例如 "${a+b}"）
      const raw = template.slice(i, j);
      // inner = 去掉外层 ${ } 的内容（例如 "a+b"）
      const inner = raw.slice(2, -1);
      results.push({ raw, inner });

      // 移动 i 到 j 继续往后扫描
      i = j;
    } else {
      // 当前字符不是 "${"，继续往后
      i++;
    }
  }
  return results;
}
// 处理函数
const parseFunction = async (expr: string, values: any): Promise<string> => {
  // 用正则匹配 "函数名(参数...)" 结构
  const funcMatch = expr.match(/^(\w+)\((.*)\)$/);
  if (!funcMatch) return expr;

  // 提取函数名和参数字符串
  const funcName = funcMatch[1].toUpperCase();
  const inner = funcMatch[2];

  // 解析参数
  const rawArgs = splitArgs(inner);
  const parsedArgs = await Promise.all(
    rawArgs.map((arg) => parseArg(arg, values))
  );

  // 尝试数字转换
  const isNumeric = (val: any) =>
    typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val);
  const finalArgs = parsedArgs.map((v) => (isNumeric(v) ? Number(v) : v));

  // 执行函数
  const fn = (Funcs as any)[funcName];
  return fn ? await fn(...finalArgs) : expr;
};
// 拆分函数参数，支持括号嵌套
const splitArgs = (inner: string): string[] => {
  const args: string[] = [];

  // 缓冲区，收集当前参数的字符
  let buf = "";
  // 括号嵌套层数
  let depth = 0;

  for (let char of inner) {
    // 如果遇到逗号，并且不在括号内，则认为当前参数结束
    if (char === "," && depth === 0) {
      args.push(buf.trim()); // 去掉参数两端空格后加入结果数组
      buf = ""; // 清空缓冲区，开始收集下一个参数
    } else {
      if (char === "(") depth++; // 左括号增加层数
      if (char === ")") depth--; // 右括号减少层数
      // 把当前字符加入缓冲区
      buf += char;
    }
  }
  // 循环结束后，缓冲区可能还有最后一个参数，加入结果数组
  if (buf) args.push(buf.trim());

  return args;
};
// 递归解析单个参数
async function parseArg(arg: string, values: any): Promise<string> {
  arg = arg.trim();

  // 如果参数本身是 ${xxx}
  const keyMatch = arg.match(/^\$\{(\w+)\}$/);
  if (keyMatch) {
    const obj = values?.value ?? values;
    const val = obj[keyMatch[1]];
    return val != null ? String(await val) : "";
  }

  // 如果参数是 ${FUNC(...)}
  const funcMatch = arg.match(/^\$\{(\w+\(.*\))\}$/);
  if (funcMatch) {
    return await parseFunction(funcMatch[1], values);
  }

  return arg;
}

/** 正则截取函数 */
export const captureStr = (str: string, start: string, end: string) => {
  if (!str) return "";

  // 转义特殊字符
  const escapeRegex = (s: any) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reg = new RegExp(`${escapeRegex(start)}(.*?)${escapeRegex(end)}`, "s"); // s支持跨行匹配
  const match = str.match(reg);
  return match ? match[1] : "";
};
