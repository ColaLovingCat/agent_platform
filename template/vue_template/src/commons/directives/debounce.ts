import type { DirectiveBinding } from "vue";

function debounce(fn: Function, delay: number): (...args: any[]) => void {
  let timer: number | null = null;
  return function (this: any, ...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function parseDelay(
  modifiers: Record<string, boolean>,
  defaultDelay = 500
): number {
  const modifierKey = Object.keys(modifiers)[0];
  const parsed = parseInt(modifierKey);
  return !isNaN(parsed) ? parsed : defaultDelay;
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const event = binding.arg || "click";
    const delay = parseDelay(binding.modifiers);
    const handler = binding.value;

    if (typeof handler !== "function") {
      console.warn("v-debounce value must be a function");
      return;
    }

    const debounced = debounce(handler, delay);
    el.addEventListener(event, debounced);
    (el as any)._debounceData = { event, debounced };
  },
  unmounted(el: HTMLElement) {
    const data = (el as any)._debounceData;
    if (data) {
      el.removeEventListener(data.event, data.debounced);
      delete (el as any)._debounceData;
    }
  },
};
