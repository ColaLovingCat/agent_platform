import { reactive } from "vue";

export interface DrpConfig {
  key: string;
  title: string;
}

export function useDrpFilter(configs: DrpConfig[]) {
  const searchInfos = reactive<Record<string, string[]>>({});
  const tempSelections = reactive<Record<string, string[]>>({});
  const options = reactive<Record<string, { value: string; title: string }[]>>(
    {}
  );

  let raw: Record<string, any>[] = [];

  // 初始化结构
  configs.forEach((c) => {
    searchInfos[c.key] = [];
    tempSelections[c.key] = [];
    options[c.key] = [];
  });

  // 设置原始数据
  const setRaw = (rows: Record<string, any>[]) => {
    raw = rows;
    refreshOptions(""); // 初始化 options
  };

  // 根据已选条件过滤数据（跳过 skipKey）
  const getFilteredRaw = (skipKey: string) => {
    return raw.filter((item) => {
      return configs.every((c) => {
        return (
          skipKey === c.key ||
          searchInfos[c.key].length === 0 ||
          searchInfos[c.key].includes(item[c.key])
        );
      });
    });
  };

  // 更新 options，并同步清理 tempSelections 和 searchInfos
  const refreshOptions = (skipKey: string) => {
    configs.forEach((c) => {
      if (c.key !== skipKey) {
        const data = getFilteredRaw(c.key);
        const uniqueValues = [...new Set(data.map((item) => item[c.key]))];
        options[c.key] = uniqueValues.map((v) => ({ value: v, title: v }));

        tempSelections[c.key] = tempSelections[c.key].filter((v) =>
          uniqueValues.includes(v)
        );
        searchInfos[c.key] = [...tempSelections[c.key]];
      }
    });
  };

  // 点击 Apply，将 tempSelections 生效到 searchInfos
  const applySelection = (key: string) => {
    searchInfos[key] = [...tempSelections[key]];
    refreshOptions(key);
  };

  // 全部选中
  const selectAll = (key: string) => {
    tempSelections[key] = options[key].map((o) => o.value);
    applySelection(key);
  };
  const clearAll = (key: string) => {
    tempSelections[key] = [];
    applySelection(key);
  };

  // 清空
  const clear = () => {
    configs.forEach((c) => {
      tempSelections[c.key] = [];
      searchInfos[c.key] = [];
    });
    refreshOptions("");
  };

  return {
    searchInfos,
    tempSelections,
    options,
    setRaw,
    refreshOptions,
    applySelection,
    selectAll,
    clearAll,
    clear,
  };
}
