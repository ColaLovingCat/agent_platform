// directives/dataFixed.ts
import type { DirectiveBinding } from "vue";

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    updateContent(el, binding);
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    updateContent(el, binding);
  },
};

function updateContent(el: HTMLElement, binding: DirectiveBinding) {
  const value = binding.value;
  const precision = binding.arg ? parseInt(binding.arg) : 2;

  if (typeof value === "number") {
    el.innerText = value.toFixed(precision);
  } else {
    console.warn("v-datafixed expects a number as value");
    el.innerText = "";
  }
}
