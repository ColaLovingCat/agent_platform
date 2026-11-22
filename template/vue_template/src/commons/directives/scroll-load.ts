// src/directives/scrollLoad.ts

import type { DirectiveBinding } from "vue";

interface HTMLElementWithScrollLoad extends HTMLElement {
  _scrollLoadHandler?: EventListenerOrEventListenerObject;
}

function handleScroll(el: HTMLElement, callback: Function) {
  const element = el as HTMLElementWithScrollLoad;
  const scrollHandler = () => {
    const scrollBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (scrollBottom) {
      callback();
    }
  };

  element._scrollLoadHandler = scrollHandler; // 保存引用用于解绑
  el.addEventListener("scroll", scrollHandler);
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    const callback = binding.value;
    if (typeof callback !== "function") {
      console.warn("v-scroll-load 需要一个函数作为绑定值");
      return;
    }

    handleScroll(el, callback);
  },
  unmounted(el: HTMLElement) {
    const element = el as HTMLElementWithScrollLoad;
    if (element._scrollLoadHandler) {
      el.removeEventListener("scroll", element._scrollLoadHandler);
      delete element._scrollLoadHandler;
    }
  },
};
