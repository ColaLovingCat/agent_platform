import { createApp } from "vue";
import App from "./App.vue";

import "./style.scss";
import "./tailwind.css";

const app = createApp(App);

// pinia
import { createPinia } from "pinia";
const pinia = createPinia();
// 持久化存储
import { createPersistedState } from "pinia-plugin-persistedstate";
pinia.use(
  createPersistedState({
    auto: true,
  }),
);
// 重写 $reset 方法 => 解决组合式api中无法使用问题
pinia.use(({ store }) => {
  const initialState = JSON.parse(JSON.stringify(store.$state));
  store.$reset = () => {
    store.$patch(initialState);
  };
});
app.use(pinia);

// router
import router from "./router/index";
app.use(router);

// 注册所有自定义指令
import directives from "@/commons/directives";
app.use(directives);

// 导入语言文件
import { createI18n } from "vue-i18n";
import en from "@/assets/locales/en.json";
import zh from "@/assets/locales/zh.json";
import { readExcel } from "@/commons/utils/xlsx";
const useJson = false;
async function initI18n() {
  let zhLan: any = {},
    enLan: any = {};

  if (useJson) {
    zhLan = zh;
    enLan = en;
  } else {
    const excelData = await readExcel("/systems/lan/lang.xlsx");
    const messagesSheet = excelData["list"] || [];
    messagesSheet.forEach((row: any) => {
      const key = row.type + "." + row.code;
      zhLan[key] = row.zh || "";
      enLan[key] = row.en || "";
    });
  }

  const i18n = createI18n({
    locale: "zh", // 默认语言
    legacy: false, // 支持 Composition API
    globalInjection: true, // 全局注册$t方法
    messages: {
      en: enLan,
      zh: zhLan,
    },
  });
  app.use(i18n);
}
await initI18n();

app.mount("#app");
