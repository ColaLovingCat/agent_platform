// src/assets/locales/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCN from './zh.json';
import enUS from './en.json';

// 可以从 localStorage 获取用户上次选择的语言，默认中文
const savedLanguage = localStorage.getItem('i18nextLng') || 'en';

i18n
  .use(initReactI18next) // 注入 react-i18next
  .init({
    resources: {
      'zh': { translation: zhCN },
      'en': { translation: enUS },
    },
    lng: savedLanguage, // 当前语言
    fallbackLng: 'zh', // 如果当前语言没有对应的翻译，默认使用中文
    interpolation: {
      escapeValue: false, // React 已经自带防 XSS 功能，不需要这个
    },
  });

export default i18n;