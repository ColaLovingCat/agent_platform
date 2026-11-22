// src/commons/stores/users.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { UserInfos } from '../types/datas.types';

// 2. 定义整个 Store 的类型（包含状态和操作方法）
interface UserStore {
  userInfo: UserInfos | null;
  token: string | null;
  
  // 操作方法 (Actions)
  setUserInfo: (info: UserInfos) => void;
  setToken: (token: string) => void;
  updateUserInfo: (info: Partial<UserInfos>) => void; // 用于更新部分信息，比如修改头像
  clearUser: () => void; // 退出登录时调用
}

// 3. 创建并导出 Store
export const useUserStore = create<UserStore>()(
  // 使用 persist 中间件，实现数据持久化（刷新页面不丢失）
  persist(
    (set) => ({
      // 初始状态
      userInfo: null,
      token: null,

      // 修改整个用户信息
      setUserInfo: (info) => set({ userInfo: info }),
      
      // 保存 Token
      setToken: (token) => set({ token }),
      
      // 更新部分用户信息 (合并现有信息)
      updateUserInfo: (info) => 
        set((state) => ({
          userInfo: state.userInfo ? { ...state.userInfo, ...info } : null
        })),

      // 清除用户状态 (登出)
      clearUser: () => set({ userInfo: null, token: null }),
    }),
    {
      name: 'user-storage', // 保存在 localStorage 中的 key 名称
      storage: createJSONStorage(() => localStorage), // 默认就是 localStorage，如果是 sessionStorage 可以改
    }
  )
);