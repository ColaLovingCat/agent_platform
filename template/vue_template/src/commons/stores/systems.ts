import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type { SystemInfos } from "@/commons/types/datas.types";

import { Modal } from "ant-design-vue";

export const useSystemInfosStore = defineStore("systemInfos", () => {
  const infos: Ref<SystemInfos> = ref({
    name: "Demo System",
    loginMode: "sso-local",
    //
    azure: "configs",
    azureAuto: false,
    azureConfigs: {
      host: "https://login.microsoftonline.com/0ae51e19-07c8-4e4b-bb6d-648ee58410f4/oauth2/v2.0/authorize",
      client_id: "30a3180e-ef46-4d44-98c3-b8a0bc8e7a13",
      scope: "api://30a3180e-ef46-4d44-98c3-b8a0bc8e7a13/sso",
      response_type: "code",
    },
    adminKey: "SystemAdmin",
  });
  function setAzure(values: any) {
    Object.assign(infos.value.azureConfigs, values);
  }

  const state = ref({
    theme: "default",
    headerShow: true, // 隐藏头部，全屏
    siderShow: true, // 隐藏侧边，全屏
  });
  function setHeader(status: boolean) {
    state.value.headerShow = status;
  }
  function setSider(status: boolean) {
    state.value.siderShow = status;
  }
  function setTheme(theme: string) {
    state.value.theme = theme;
  }

  const _logoutShow = ref(false); // 避免多个注销弹窗
  function showLogout(callback: Function) {
    if (!_logoutShow.value) {
      _logoutShow.value = true;
      //
      Modal.warning({
        title: "Authentication Required",
        content: "You will be redirected to the Login page.",
        onOk: () => {
          _logoutShow.value = false;
          //
          callback();
        },
      });
    }
  }

  return { infos, setAzure, state, setHeader, setSider, setTheme, showLogout };
});
