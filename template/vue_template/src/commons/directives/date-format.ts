import type { DirectiveBinding } from "vue";
import dayjs from "dayjs";

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    applyFormat(el, binding);
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    applyFormat(el, binding);
  },
};

function applyFormat(el: HTMLElement, binding: DirectiveBinding) {
  const rawValue = binding.value;
  const format = el.dataset.format || "YYYY-MM-DD HH:mm:ss";

  if (!rawValue) {
    el.innerText = "";
    return;
  }

  const date = dayjs(rawValue);
  if (!date.isValid()) {
    console.error("[v-dateformat] Invalid date:", rawValue);
    el.innerText = String(rawValue);
    return;
  }

  el.innerText = date.format(format);
}
