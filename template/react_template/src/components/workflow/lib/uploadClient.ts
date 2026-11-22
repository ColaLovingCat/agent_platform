/** 客户端文件上传助手 —— 走 BFF /api/upload，最终落到 master_data。
 *
 *  调用者：
 *    - UploadNode（画布卡片）：onPick 时调用
 *    - UploadEditor（属性面板）：onPick / 自动补传 时调用
 *
 *  契约：成功返回 UploadedFileInfo；失败抛 Error（带可读的 message，
 *  上层把它扔进 UI 的红条提示就行）。
 */

export type UploadedFileInfo = {
  url: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
};

export async function uploadFile(file: File): Promise<UploadedFileInfo> {
  const fd = new FormData();
  // master_data FilesController 期望的字段名是 "File"（大写 F）——千万别改。
  fd.append("File", file, file.name);

  let r: Response;
  try {
    r = await fetch("/api/upload", { method: "POST", body: fd });
  } catch (e) {
    throw new Error(
      `上传失败（网络错误）：${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let body: unknown;
  try {
    body = await r.json();
  } catch {
    throw new Error(`上传失败（响应非 JSON，HTTP ${r.status}）`);
  }

  if (!r.ok || (body as { error?: string })?.error) {
    const err = (body as { error?: string })?.error || `HTTP ${r.status}`;
    throw new Error(`上传失败：${err}`);
  }
  const info = body as UploadedFileInfo;
  if (!info?.url) throw new Error("上传成功但响应里没有 url 字段");
  return info;
}

/** 反向：按 master_data 返回的 URL 抓回文件，重建 File 对象（用于打开旧 flow 时的预览）。
 *
 *  ## 为什么走 BFF 代理而不是直接 fetch(url)
 *
 *  master_data 返回的 url 是 `http://localhost:9740/uploads/xxx`，浏览器直接 fetch 会
 *  跨域到另一个端口。master_data 静态文件目录没配 CORS 头，浏览器拒绝读响应 → "Failed
 *  to fetch"。改走 BFF 代理 `/api/upload/fetch?url=...`：同源请求，BFF 服务端去拉文件
 *  流式吐回——没有 CORS 限制，未来要加鉴权 / 审计也容易。
 *
 *  失败抛 Error；fileType 以 server 返回的 Content-Type 为准。
 */
export async function fetchUploadedFile(
  url: string,
  fallbackName: string,
): Promise<File> {
  const proxied = `/api/upload/fetch?url=${encodeURIComponent(url)}`;
  let r: Response;
  try {
    r = await fetch(proxied);
  } catch (e) {
    throw new Error(
      `下载文件失败：${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!r.ok) {
    // BFF 给的错误是 { error: string }，尽量提取出来给用户看
    let detail = `HTTP ${r.status}`;
    try {
      const j = (await r.json()) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      // 非 JSON，保留 HTTP X
    }
    throw new Error(`下载文件失败（${detail}）`);
  }
  const blob = await r.blob();
  const ct = blob.type || "application/octet-stream";
  return new File([blob], fallbackName, { type: ct });
}
