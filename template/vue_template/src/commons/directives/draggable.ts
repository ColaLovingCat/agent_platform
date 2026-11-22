import type { Directive } from "vue";

export const draggable: Directive = {
  mounted(el) {
    const header = el.querySelector(".cursor-move") as HTMLElement;
    let offsetX = 0,
      offsetY = 0,
      dragging = false;

    header.onmousedown = (e) => {
      dragging = true;
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      document.onmousemove = (e) => {
        if (dragging) {
          el.style.left = e.clientX - offsetX + "px";
          el.style.top = e.clientY - offsetY + "px";
        }
      };
      document.onmouseup = () => (dragging = false);
    };
  },
};
