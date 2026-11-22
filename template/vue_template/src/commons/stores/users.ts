import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type { UserInfos } from "@/commons/types/datas.types";

export const useUserInfosStore = defineStore("userInfos", () => {
  const userInfos: Ref<UserInfos> = ref({
    userno: "",
    username: "",
    ntAccount: "",
    email: "",
    roles: null,
  });

  function refresh(values: UserInfos) {
    Object.assign(userInfos.value, values);
  }

  function clear() {
    userInfos.value = {
      userno: "",
      username: "",
      ntAccount: "",
      email: "",
      roles: null,
    };
  }

  return { userInfos, refresh, clear };
});
