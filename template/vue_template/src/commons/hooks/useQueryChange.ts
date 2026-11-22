// useQueryChange.ts
import { useRoute } from "vue-router";
import { watch } from "vue";

export function useQueryChange(
  callback: (
    newQuery: Record<string, any>,
    oldQuery: Record<string, any>
  ) => void,
  // 如果传了，就只监听这些 query key，否则监听所有
  keys?: string[]
) {
  const route = useRoute();

  // 初始触发一次（可选）
  callback(route.query, {});

  // 响应式 watch
  watch(
    () => route.query,
    (newQ, oldQ) => {
      if (keys && keys.length > 0) {
        // 只比对指定的 key
        const changed = keys.some((k) => newQ[k] !== oldQ[k]);
        if (changed) callback(newQ, oldQ);
      } else {
        // 监听全部
        callback(newQ, oldQ);
      }
    }
  );
}
