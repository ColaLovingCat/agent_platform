import type { App } from "vue";

import debounce from "./debounce";
import throttle from "./throttle";
import dateFormat from "./date-format";
import dataFixed from "./data-fixed";
import scrollLoad from "./scroll-load";
import lazy from "./lazy";
import resize from "./resize";
import { draggable } from "./draggable";

// 后续可以继续扩展其他指令
const directives: Record<string, any> = {
  debounce,
  throttle,
  "date-format": dateFormat,
  "data-fixed": dataFixed,
  "scroll-load": scrollLoad,
  lazy,
  resize,
  draggable,
};

export default {
  install(app: App) {
    for (const key in directives) {
      app.directive(key, directives[key]);
    }
  },
};
