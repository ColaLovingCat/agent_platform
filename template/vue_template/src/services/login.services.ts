import { fetchRequest } from "@/commons/utils/fetch";

export const health = (data?: any) => {
  return fetchRequest("/api/health", {
    method: "GET",
    data,
  });
};

export const getinfosUser = (data?: any) => {
  return fetchRequest("/api/auth/getinfos", {
    method: "GET",
    data,
  });
};

export const getinfosAzure = (data?: any) => {
  return fetchRequest("/api/azure/configs", {
    method: "GET",
    data,
  });
};
export const loginAzure = (data?: any) => {
  return fetchRequest("/api/azure/login", {
    method: "POST",
    data,
  });
};

export const login = (data?: any) => {
  return fetchRequest("/api/auth/login", {
    method: "POST",
    data,
  });
};

export const loginiUser = (data?: any) => {
  return fetchRequest("/api/iusers/login", {
    method: "POST",
    data,
  });
};
export const searchiUser = (data?: any) => {
  return fetchRequest("/api/iusers/search", {
    method: "GET",
    data,
  });
};

export const checkPassword = (password: string, confirm: string) => {
  // 校验确认密码是否匹配
  if (password !== confirm) return -1;

  // 校验复杂度：长度>=12，包含大小字母+数字
  const complexityRegex = /^(?=.*[A-Za-z])(?=.*\d).{12,}$/;
  if (!complexityRegex.test(password)) return -2;

  return 1;
};
