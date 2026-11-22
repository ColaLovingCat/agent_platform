import { deepCopyObj } from "./pub";

/**
 * @summary Object拓展方法
 * @param stringifyParams  将对象序列化字符串
 * @param typeOf           获取数据类型
 * @param copy             深拷贝对象
 * @param getValuebyPath   按路径安全获取对象值
 * @param buildODataFilter 生成支持嵌套分组的 `$filter`
 */
export interface ExObject {
  /**
   * @summary 将对象序列化为 URL 查询参数
   */
  stringifyParams(obj: Record<string, any>): string;
  /**
   * @summary 获取数据类型
   * @returns {string} Number | String | Boolean | Null | Undefined | Object | Array | Date | Function | RegExp | BigInt | Symbol
   */
  typeOf(obj: any): string;
  /**
   * @summary 深拷贝对象
   */
  copy<T>(obj: T): T;
  /**
   * @summary 按路径安全获取对象值，不存在则返回默认值
   * @param object 目标对象
   * @param path 属性路径，数组或以点分隔的字符串
   */
  getValuebyPath(
    object: Record<string, any>,
    path: string | (string | number)[]
  ): any;
  /**
   * @summary 生成支持嵌套分组的 OData `$filter`
   * @param filters 过滤条件对象：
   *   - 字段条件： { age: { op: "gt", value: 18 } }
   *   - 分组： { and: [ {...}, {...} ] } 或 { or: [ {...}, {...} ] }
   * @param defaultOp 字段操作符 (默认 eq)
   */
  buildODataFilter(
    filters: Record<string, any> | any[],
    defaultOp?: opType
  ): string;
}
type opType =
  | "eq"
  | "gt"
  | "lt"
  | "ge"
  | "le"
  | "ne"
  | "contains"
  | "startswith"
  | "endswith"
  | "length"
  | "tolower"
  | "toupper"
  | "trim"
  | "round"
  | "floor"
  | "ceiling"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "fractionalseconds"
  | "now";
export const ExObject: ExObject = {
  stringifyParams: function (obj: any) {
    if (!obj || typeof obj !== "object") return "";

    const pairs = [];
    for (const key in obj) {
      const value = obj[key];
      if (value instanceof Array) {
        for (let i = 0; i < value.length; ++i) {
          pairs.push(
            encodeURIComponent(key + "[" + i + "]") +
              "=" +
              encodeURIComponent(value[i])
          );
        }
        continue;
      }
      pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]));
    }
    return pairs.join("&");
  },
  typeOf: function (obj: any) {
    return Object.prototype.toString.call(obj).slice(8, -1);
  },
  copy: function (obj: any) {
    return deepCopyObj(obj);
  },
  getValuebyPath: function (object: any, path: any) {
    if (!object) return null;

    // 如果是数组，直接用；否则转成数组路径
    const pathArr = Array.isArray(path)
      ? path
      : path
          // 先把 [0] 这样的数组下标转成 .0 的形式
          .replace(/\[(\d+)\]/g, ".$1")
          // 按 "." 分割
          .split(".")
          // 过滤掉空值（避免出现连续的点号）
          .filter(Boolean);

    // 逐层取值
    return pathArr.reduce((o: any, prop: string) => {
      return o != null && prop in o ? o[prop] : null;
    }, object);
  },
  buildODataFilter(filters: any, defaultOp: opType = "eq") {
    if (!filters) return "";

    // 文本函数式（必须写成函数调用）
    const FUNC_OPS = ["contains", "startswith", "endswith"];
    // 数值/日期提取函数
    const FUNC_MATH = [
      "length",
      "round",
      "floor",
      "ceiling",
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fractionalseconds",
    ];
    // 文本转换函数
    const FUNC_STR = ["tolower", "toupper", "trim"];

    // 格式化字符串
    const formatValue = (val: any): string | number | boolean => {
      if (typeof val === "string") {
        return `'${val.replace(/'/g, "''")}'`;
      } else if (val instanceof Date) {
        return `'${val.toISOString()}'`;
      } else {
        return val;
      }
    };

    // 递归解析节点
    const process = (node: any): string => {
      // 分组数组 => 当作 and 分组
      if (Array.isArray(node)) {
        return `(${node.map(process).join(" and ")})`;
      }

      // 如果是分组对象 => { and: [], or: [], not: true }
      if (typeof node === "object" && (node.and || node.or)) {
        const logic = node.and ? "and" : "or";
        const children = (node.and || node.or).map(process).filter(Boolean);
        let group = children.length ? `(${children.join(` ${logic} `)})` : "";

        if (node.not) {
          group = `not ${group}`;
        }
        return group;
      }

      // 字段条件
      const parts: string[] = [];
      for (const key in node) {
        const raw = node[key];

        // 字段条件支持对象格式 { op, link, value }
        let op = defaultOp;
        let link = "";
        let value: any;
        let not = false;

        if (raw && typeof raw === "object") {
          op = raw.op ?? defaultOp;
          link = raw.link ?? "";
          value = raw.value ?? null;
          not = raw.not === true;
        } else {
          // 如果不是对象，直接用默认操作符和原值
          value = raw;
        }

        const formatted = formatValue(value);

        let expr = "";
        if (FUNC_OPS.includes(op)) {
          expr = `${op}(${key}, ${formatted})`;
        } else if (FUNC_STR.includes(op)) {
          expr = `${op}(${key}) eq ${formatted}`;
        } else if (FUNC_MATH.includes(op)) {
          expr = `${op}(${key}) ${link || "eq"} ${formatted}`;
        } else if (op === "now") {
          expr = `${key} ${link || "eq"} now()`;
        } else {
          expr = `${key} ${op} ${formatted}`;
        }

        // 加上 not
        if (not) {
          expr = `not ${expr}`;
        }

        parts.push(expr);
      }

      // 如果一个字段有多个条件，则用 and 拼接起来并加括号
      return parts.length > 1 ? `(${parts.join(" and ")})` : parts[0];
    };

    // 从根节点开始解析
    return process(filters);
  },
};
