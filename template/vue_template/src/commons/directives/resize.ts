import type { DirectiveBinding } from "vue";

function debounce(fn: Function, delay = 300) {
  let timer: number | null = null;
  return function (this: any, ...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

interface ElWithObserver extends HTMLElement {
  _resizeObserver?: ResizeObserver;
}

export default {
  mounted(el: ElWithObserver, binding: DirectiveBinding) {
    const callback = binding.value;
    const delay = binding.arg ? parseInt(binding.arg) : 300;

    if (typeof callback !== "function") {
      console.warn("v-resize binding value must be a function");
      return;
    }

    const observer = new ResizeObserver(
      debounce(() => callback(el), delay)
    );

    observer.observe(el);
    el._resizeObserver = observer;
  },

  unmounted(el: ElWithObserver) {
    el._resizeObserver?.disconnect();
    delete el._resizeObserver;
  }
};
