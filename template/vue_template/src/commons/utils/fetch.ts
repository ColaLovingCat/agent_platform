import { checkAPI, type RequestOptions } from "../types/api.types";
import * as extend from "./extends";

import { logger } from "@/commons/utils/logger";
const log = logger.create("Fetch");

const authKey = "Authorization";

export const fetchRequest = (
  url: string,
  options: RequestOptions = {},
  remarks = ""
) => {
  const opts: any = {};
  // 请求方式
  opts.method = (options.method || "GET").toUpperCase();
  // 头部信息
  opts.headers =
    options.type != "none"
      ? {
          "Content-Type": options.type || "application/json; charset=utf-8",
          Accept: "application/json,text/plain,*/*",
        }
      : {};
  Object.assign(opts.headers, options.headers);
  // 获取token信息
  const token = extend.ExLocalStore.get("token");
  if (token) {
    Object.assign(opts.headers, {
      [authKey]: token,
    });
  }
  // opts.credentials = options.credentials || 'include'; // 设置cookie是否一起发送 omit | same-origin | include
  // opts.mode= options.mode || 'no-cors', // 跨域设置 cors | no-cors | same-origin
  // 格式化参数
  switch (opts.method) {
    // 拼接GET参数
    case "GET":
    case "DELETE": {
      if (options.data) {
        url += "?" + extend.ExObject.stringifyParams(options.data);
      }
      break;
    }
    // body存入POST参数
    case "POST":
    case "PUT":
    case "PATCH":
    default: {
      opts.body = !options.type ? JSON.stringify(options.data) : options.data;
      break;
    }
  }
  remarks != "" ? console.log(remarks + " Request: ", url, opts) : void 0;
  // 返回数据的解析方式
  const dataType = options.dataType || "json";
  //
  return new Promise((resolve, reject) => {
    fetch(checkAPI(url), opts)
      .then(async (res) => {
        remarks != "" ? console.log(remarks + " Status: ", res.status) : void 0;

        // 刷新token
        const token = res.headers.get(authKey);
        if (token) {
          log.log("token", token);
          extend.ExLocalStore.set("token", token);
        }

        // 处理返回的数据
        let data: any = null;
        try {
          switch (dataType) {
            case "text": {
              data = await res.text();
              break;
            }
            case "blob": {
              data = await res.blob();
              break;
            }
            default: {
              data = await res.json();
              break;
            }
          }
        } catch (e) {
          data = null;
        }
        remarks != "" ? console.log(remarks + ": ", data) : void 0;

        // 需要获取头部信息
        const headers: { [key: string]: any } = {};
        res.headers.forEach((value, name) => {
          headers[name] = value;
        });
        const result = {
          code: {
            status: res.status,
            ok: res.ok,
            text: res.statusText,
          },
          headers,
          body: data,
        };

        // 错误处理
        if (!res.ok) {
          if (res.status == 401) {
            extend.ExLocalStore.delete("token");
          }
          return reject(result);
        }

        //
        if (options.activeBody) {
          resolve(result);
        }
        resolve(data);
      })
      .catch(function (err) {
        remarks != "" ? console.error(remarks + ": ", err) : void 0;
        reject(err);
      });
  });
};

