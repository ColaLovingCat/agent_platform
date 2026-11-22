// hooks/useRouteChange.ts
import { onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";

export function useRouteChange(
  callback: (route: ReturnType<typeof useRoute>) => void,
  options?: {
    immediate?: boolean;
    deep?: boolean;
  }
) {
  const route = useRoute();

  const stop = watch(
    () => route.fullPath, // 监听完整路径（包含 query + params）
    () => callback(route),
    { immediate: options?.immediate ?? true, deep: options?.deep ?? false }
  );

  onBeforeUnmount(() => stop());
}
