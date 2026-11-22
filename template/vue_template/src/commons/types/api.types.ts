export interface RequestOptions {
  // 默认
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; // 获取 |新建 |整体更新 |删除 |部分更新
  data?: any; // 请求体数据（POST/PUT等）或查询参数（GET）
  // 头部
  type?: string; // Content-Type，例：'application/json'，设为 'none' 则不设置
  headers?: Record<string, string>;
  // 返回
  dataType?: "json" | "text" | "blob"; // 期望的响应数据类型，默认是 json
  activeBody?: boolean; // 是否需要返回响应头信息 {headers,body}
  // credentials?: RequestCredentials  // 可选：是否发送 cookie
  // mode?: RequestMode                // 可选：请求的模式，通常用于跨域设置
}

export const checkAPI = (url: string) => {
  // 接口以http或https开头
  const check =
    new RegExp("^http.*$").test(url) || new RegExp("^https.*$").test(url);
  if (check) return url;

  // 前端部署在wwwroot中
  //@ts-ignore
  if (import.meta.env.VITE_APP_ROOT == "true") return url;

  // 默认地址
  //@ts-ignore
  return import.meta.env.VITE_APP_API_URL + url;
};
