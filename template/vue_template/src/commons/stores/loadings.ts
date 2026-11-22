import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useLoadingStore = defineStore("loading", () => {
  const _count = ref(0);

  const status = computed(() => _count.value > 0);

  function set(status: boolean) {
    _count.value = status ? 1 : 0;
  }

  function loading() {
    _count.value++;
  }

  function end() {
    if (_count.value > 0) _count.value--;
  }

  function clear() {
    set(false);
  }

  return { status, set, loading, end, clear };
});
