/**
 * @summary 浏览器常用方法
 */
export const ExWeb = {
  /**
   * @summary url地址信息
   */
  url: function () {
    const localHost = document.location;
    //
    const reg = new RegExp("^(http|https)://", "i");
    if (reg.test(localHost.href)) {
      return {
        type: "server", // 地址
        url: localHost.href, // 地址
        server: localHost.origin, // 服务器+端口
        protocol: localHost.protocol, // 协议
        host: localHost.hostname, // 服务器
        port: localHost.port, // 端口
        path: localHost.pathname, // 页面路径
        param: localHost.search, // 参数
      };
    } else {
      return {
        type: "file",
        path: localHost.href, // 页面路径
      };
    }
  },
  /**
   * @summary 请求参数集
   */
  params: function () {
    const sHref = window.location.href;
    const args = sHref.split("?");
    if (args[0] === sHref) {
      return "";
    }
    const hrefarr = args[1].split("#")[0].split("&");
    const obj: any = {};
    for (let i = 0; i < hrefarr.length; i++) {
      const temp = hrefarr[i].split("=");
      obj[temp[0]] = temp[1];
    }
    return obj;
  },
  /**
   * @summary 获取单一请求参数
   */
  query: function (prop: string) {
    let result = null;
    const reg = new RegExp("(^|&)" + prop + "=([^&]*)(&|$)", "i"); // 不区分大小写
    const host = window.location.search.substr(1);
    if (reg.test(host)) {
      const r = host.match(reg);
      result = r ? decodeURI(r[2]) : null;
    }
    return result;
  },
  encode: function (query: any) {
    const encoded: Record<string, string> = {};
    Object.keys(query).forEach((k) => {
      if (query[k] != null) {
        encoded[k] = encodeURIComponent(query[k]);
      }
    });
    return encoded;
  },
  decode: function (query: any) {
    const decoded: Record<string, string> = {};
    Object.keys(query).forEach((k) => {
      const v = query[k];
      if (typeof v === "string") {
        decoded[k] = decodeURIComponent(decodeURIComponent(v));
      }
    });
    return decoded;
  },
  /**
   * @summary 浏览器类型
   */
  browser: function () {
    const userAgent = navigator.userAgent;
    try {
      const isFF = userAgent.indexOf("Firefox") > -1; // Firefox
      const isEdge =
        userAgent.indexOf("Edge") > -1 || userAgent.indexOf("Edg") > -1; // IE的Edge
      const isOpera = userAgent.indexOf("Opera") > -1; // Opera
      const isChrome =
        userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Safari") > -1; // Chrome
      const isSafari =
        userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") == -1; // Safari
      let isIE =
        userAgent.indexOf("compatible") > -1 &&
        userAgent.indexOf("MSIE") > -1 &&
        !isOpera;
      if (!isIE) isIE = userAgent.indexOf("Trident") > -1; // IE
      //
      if (isIE) {
        let reIE = new RegExp("MSIE (\\d+\\.\\d+);");
        if (reIE.test(userAgent)) {
          const fIEVersion = parseFloat(RegExp["$1"]);
          if (fIEVersion == 7) {
            return "IE7";
          } else if (fIEVersion == 8) {
            return "IE8";
          } else if (fIEVersion == 9) {
            return "IE9";
          } else if (fIEVersion == 10) {
            return "IE10";
          } else if (fIEVersion == 11) {
            return "IE11";
          } else {
            return "";
          } //IE版本过低
        }
        reIE = new RegExp("Trident/(\\d+\\.\\d+);");
        if (reIE.test(userAgent)) {
          const fIEVersion = parseFloat(RegExp["$1"]);
          if (fIEVersion == 7) {
            return "IE11";
          } else if (fIEVersion == 6) {
            return "IE10";
          } else if (fIEVersion == 5) {
            return "IE9";
          } else if (fIEVersion == 4) {
            return "IE8";
          } //IE版本过低
          return "IE";
        }
      }
      if (isOpera) {
        return "Opera";
      }
      if (isEdge) {
        return "Edge";
      }
      if (isFF) {
        return "Firefox";
      }
      if (isSafari) {
        return "Safari";
      }
      if (isChrome) {
        return "Chrome";
      }
      return "";
    } catch (e) {
      return "Error";
    }
  },
  /**
   * @summary 判断是android还是ios还是web
   */
  device: function () {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf("iphone os") > -1 || ua.indexOf("ipad") > -1) {
      // ios
      return "iOS";
    }
    if (ua.indexOf("android") > -1) {
      return "Android";
    }
    return "Web";
  },
  /**
   * @summary 视口尺寸
   */
  viewSize: function () {
    if (window.innerWidth) {
      return {
        w: window.innerWidth,
        h: window.innerHeight,
      };
    } else {
      // ie8及其以下
      if (document.compatMode === "BackCompat") {
        // 怪异模式
        return {
          w: document.body.clientWidth,
          h: document.body.clientHeight,
        };
      } else {
        // 标准模式
        return {
          w: document.documentElement.clientWidth,
          h: document.documentElement.clientHeight,
        };
      }
    }
  },
  /**
   * @summary 关闭窗口
   */
  close: function () {
    try {
      // 安全处理：断开与父窗口的关系，防止 opener 被滥用
      window.opener = null;
      // 兼容 IE 的写法（赋值为空对象）
      window.open("", "_self");
      // 主流浏览器关闭窗口
      window.close();
      // 如果上面不生效（某些浏览器禁止关闭非脚本打开的窗口）
      // 可以给用户一个“退回首页”的降级方案
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = "/"; // 替换为你系统的首页/登出页
        }
      }, 500);
    } catch (e) {
      console.error("关闭窗口失败：", e);
      // 保底跳转
      window.location.href = "/";
    }
  },
};
