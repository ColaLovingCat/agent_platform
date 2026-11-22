export default {
    mounted(el: HTMLElement, binding: any) {
      const loadImage = () => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          const img = el as HTMLImageElement;
          const lazySrc = binding.value;
          if (lazySrc && img.src !== lazySrc) {
            const placeholder = binding.arg || 'data:image/svg+xml;base64,...'; // 默认占位符
            img.src = placeholder;
            img.onload = () => {
              img.src = lazySrc; // 当图片加载完成后才设置真实图片
            };
          }
          window.removeEventListener('scroll', lazyLoadHandler);
        }
      };
  
      const lazyLoadHandler = () => {
        loadImage();
      };
  
      el._lazyLoadHandler = lazyLoadHandler;
  
      loadImage();
      window.addEventListener('scroll', lazyLoadHandler);
    },
    unmounted(el: HTMLElement) {
      if (el._lazyLoadHandler) {
        window.removeEventListener('scroll', el._lazyLoadHandler);
        delete el._lazyLoadHandler;
      }
    },
  };
  