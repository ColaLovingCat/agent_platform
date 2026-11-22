import { create } from 'zustand';

interface LoadingStore {
  _count: number; // 规范命名：代替 _value
  startLoading: () => void;
  endLoading: () => void;
  clearLoading: () => void;
}

export const useLoadingStore = create<LoadingStore>((set) => ({
  _count: 0,

  startLoading: () => set((state) => ({ _count: state._count + 1 })),
  endLoading: () => set((state) => ({ _count: Math.max(0, state._count - 1) })),
  clearLoading: () => set({ _count: 0 }),
}));

export const useIsLoading = () => useLoadingStore((state) => state._count > 0);