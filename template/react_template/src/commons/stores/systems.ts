import { Modal } from "antd";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { SystemInfos } from "../types/datas.types";

interface SystemState {
  theme: string;
  headerShow: boolean;
  siderShow: boolean;
  debug: boolean;
}

interface SystemStore {
  systemInfo: SystemInfos | null;
  setSystemInfo: (info: SystemInfos) => void;
  setAzure: (info: any) => void;

  systemState: SystemState;
  setHeaderShow: (show: boolean) => void;
  setSiderShow: (show: boolean) => void;
  setDebug: (debug: boolean) => void;

  showLogout: (callback: () => void) => void;
}

let _logoutShow = false;

export const useSystemStore = create<SystemStore>()(
  persist(
    (set) => ({
      systemInfo: null,
      setSystemInfo: (info) => set({ systemInfo: info }),
      setAzure: (info) =>
        set((s: any) => ({
          systemInfo: { ...s.systemInfo, azureConfigs: info },
        })),

      systemState: {
        theme: "light",
        headerShow: false,
        siderShow: false,
        debug: false,
      },
      setHeaderShow: (show) =>
        set((s) => ({
          systemState: { ...s.systemState, headerShow: show },
        })),
      setSiderShow: (show) =>
        set((s) => ({
          systemState: { ...s.systemState, siderShow: show },
        })),
      setDebug: (debug) =>
        set((s) => ({
          systemState: { ...s.systemState, debug },
        })),

      showLogout(callback) {
        if (!_logoutShow) {
          _logoutShow = true;

          Modal.warning({
            title: "Authentication Required",
            content: "You will be redirected to the Login page.",
            onOk: () => {
              _logoutShow = false;
              if (typeof callback === "function") {
                callback();
              }
            },
          });
        }
      },
    }),
    {
      name: "system-storage", // 保存在 localStorage 中的 key 名称
      storage: createJSONStorage(() => localStorage), // 默认就是 localStorage，如果是 sessionStorage 可以改
    },
  ),
);
