import type { DirectiveBinding } from "vue";

function throttle(fn: Function, delay: number): (...args: any[]) => void {
  let lastCall = 0;
  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

function parseDelay(
  modifiers: Record<string, boolean>,
  defaultDelay = 1000
): number {
  const key = Object.keys(modifiers)[0];
  const parsed = parseInt(key);
  return !isNaN(parsed) ? parsed : defaultDelay;
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const event = binding.arg || "click";
    const delay = parseDelay(binding.modifiers);
    const handler = binding.value;

    if (typeof handler !== "function") {
      console.warn("v-throttle value must be a function");
      return;
    }

    const throttled = throttle(handler, delay);
    el.addEventListener(event, throttled);
    (el as any)._throttleData = { event, throttled };
  },
  unmounted(el: HTMLElement) {
    const data = (el as any)._throttleData;
    if (data) {
      el.removeEventListener(data.event, data.throttled);
      delete (el as any)._throttleData;
    }
  },
};
