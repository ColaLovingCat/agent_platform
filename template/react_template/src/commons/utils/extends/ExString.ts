import { calcStr, captureStr } from "./calc";

/**
 * @summary String 拓展
 * @param isNotEmpty 判断值是否为非空字符串
 * @param isNumber   判断是否符合数字格式
 * @param isEmail    判断邮件格式
 * @param isFilePath 判断是否符合文件路径格式
 * @param fileType   获取文件名后缀
 * @param fileIcon   获取文件图标
 * @param trim       去除空格
 * @param toCase     大小写转换
 * @param replaceAll 替换全部
 * @param uuid       生成uuid
 * @param calcStr    计算模板内的字符拼接和处理函数
 * @param captureStr 截取指定字符间的字符串
 */
export interface ExString {
  /**
   * @summary 判断值是否为非空字符串
   * @param str 待检查的值
   * @param force 是否强制将非字符串类型转为字符串后再判断（如数字、布尔等）
   */
  isNotEmpty(str: unknown, force?: boolean): boolean;
  /**
   * @summary 判断是否符合数字格式
   */
  isNumber(str: string): boolean;
  /**
   * @summary 判断邮件格式
   */
  isEmail(str: string): boolean;
  /**
   * @summary 判断是否符合文件路径格式
   */
  isFilePath(str: string): boolean;
  /**
   * @summary 获取文件名后缀
   */
  fileType(fileName: string): string | null;
  /**
   * @summary 获取文件图标
   */
  fileIcon(fileType: string): string;
  /**
   * @summary 去除空格
   * @param type 1-前后空格| 2-前空格| 3-后空格| 4-所有空格
   */
  trim(str: string, type?: 1 | 2 | 3 | 4): string;
  /**
   * @summary 大小写转换
   * @param type first-首字母大写| unfirst-首字母小写| reverse-大小写转换| upper-全部大写| lower-全部小写
   */
  toCase(str: string, type: CaseType): string;
  /**
   * @summary 替换全部
   * @param ignoreCase 是否忽略大小写，默认不忽略
   */
  replaceAll(
    str: string,
    findText: string | RegExp,
    replaceWith: string,
    ignoreCase?: boolean
  ): string;
  /**
   * @summary 生成uuid，默认可生成 RFC4122标准 UUID v4
   * @param len 字符长度
   * @param radix 字符覆盖范围，10>数字 16>十六进制 36>小写字母 62>大写字母
   */
  uuid(len?: number | null, radix?: number): string;
  /**
   * @summary 生成标准uuid
   */
  _uuid_36(): string;
  /**
   * @summary 计算模板内的字符拼接和处理函数
   * @param template 计算公式，默认可使用 LEFT |RIGHT |SUBSTR |DATENOW |DATEFORMAT
   * @param values 处理值
   */
  calcStr(template: string, values: any): Promise<string>;
  /**
   * @summary 截取指定字符间的字符串
   */
  captureStr(str: string, from: string, to: string): string;
}

type CaseType = "upper" | "lower" | "first" | "unfirst" | "reverse";

export const ExString: ExString = {
  isNotEmpty: function (str: any, force: boolean = false): boolean {
    if (typeof str === "string") {
      return str.trim() !== "";
    }
    if (force && (typeof str === "number" || typeof str === "boolean")) {
      return String(str).trim() !== "";
    }
    return false;
  },
  isNumber: function (str: string) {
    const numberRegex = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
    return numberRegex.test(str);
  },
  isEmail: function (str: string) {
    const multiEmailRegex = /^([\w.-]+@[\w.-]+\.\w+)(;[\w.-]+@[\w.-]+\.\w+)*$/;
    return multiEmailRegex.test(str);
  },
  isFilePath: function (str: any) {
    const fileRegex =
      /^(?:[a-zA-Z]:)?[\\/](?:(?:(?:\.\.?(?:[\\/]))|(?:[\w-_.]+(?:[\\/])))*(?:[\w-_.]+[^\.])?)?$/;
    return fileRegex.test(str);
  },
  fileType: function (fileName: any) {
    if (typeof fileName !== "string") return null;
    const idx = fileName.lastIndexOf(".");
    return idx > 0 ? fileName.slice(idx + 1).toLowerCase() : null;
  },
  fileIcon: function (fileType: string) {
    let result = "fa-file";
    switch (fileType) {
      case "jpg":
      case "png": {
        result = "fa-file-image";
        break;
      }
      case "pdf": {
        result = "fa-file-pdf";
        break;
      }
      case "txt": {
        result = "fa-file-lines";
        break;
      }
      case "csv":
      case "xlsx": {
        result = "fa-file-excel";
        break;
      }
      case "docx": {
        result = "fa-file-word";
        break;
      }
      case "pptx": {
        result = "fa-file-powerpoint";
        break;
      }
      case "mp3": {
        result = "fa-file-audio";
        break;
      }
      case "mp4": {
        result = "fa-file-video";
        break;
      }
      default: {
        break;
      }
    }
    return result;
  },
  trim: function (str: string, type: number = 1): string {
    type = type || 1;
    switch (type) {
      case 1:
        return str.replace(/(^\s*)|(\s*$)/g, "");
      case 2:
        return str.replace(/(^\s*)/g, "");
      case 3:
        return str.replace(/(\s*$)/g, "");
      case 4:
        return str.replace(/\s+/g, "");
      default:
        return str;
    }
  },
  toCase: function (str: string, type: CaseType): string {
    switch (type) {
      case "first":
        return str.replace(/\b\w+\b/g, function (word) {
          return (
            word.substring(0, 1).toUpperCase() + word.substring(1).toLowerCase()
          );
        });
      case "unfirst":
        return str.replace(/\b\w+\b/g, function (word) {
          return (
            word.substring(0, 1).toLowerCase() + word.substring(1).toUpperCase()
          );
        });
      case "reverse":
        return str
          .split("")
          .map(function (word) {
            if (/[a-z]/.test(word)) {
              return word.toUpperCase();
            } else {
              return word.toLowerCase();
            }
          })
          .join("");
      case "upper":
        return str.toUpperCase();
      case "lower":
        return str.toLowerCase();
      default:
        return str;
    }
  },
  replaceAll: function (
    str: string,
    findText: string,
    replaceWith: string,
    ignoreCase = false
  ) {
    if (!RegExp.prototype.isPrototypeOf(findText)) {
      return str.replace(
        new RegExp(findText, ignoreCase ? "gi" : "g"),
        replaceWith
      );
    } else {
      return str.replace(findText, replaceWith);
    }
  },
  uuid: function (len = null, radix: any = null) {
    const chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(
        ""
      );
    let s = [],
      i;
    radix = radix || chars.length;
    if (len) {
      // Compact form
      for (i = 0; i < len; i++) s[i] = chars[0 | (Math.random() * radix)];
      return s.join("");
    } else {
      return this._uuid_36();
    }
  },
  _uuid_36: function () {
    let d = new Date().getTime();
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      d += performance.now(); // use high-precision timer if available
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
  },
  calcStr: async function (template: string, values: any): Promise<string> {
    return calcStr(template, values);
  },
  captureStr: function (str: string, start: string, end: string): string {
    return captureStr(str, start, end);
  },
};
