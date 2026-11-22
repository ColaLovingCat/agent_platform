import { useState, useRef, useCallback } from "react";

export function useStateRef<T>(initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const ref = useRef<T>(initialValue);

  const setValue = useCallback((value: T | ((prevState: T) => T)) => {
    // 兼容 setState(prev => prev + 1) 的函数式写法
    const newValue = value instanceof Function ? value(ref.current) : value;

    ref.current = newValue; // 1. 同步更新 ref，逻辑层立刻就能读到最新值
    setState(newValue); // 2. 触发 React 重新渲染更新 UI
  }, []);

  return [state, setValue, ref] as const; // 返回元组
}
