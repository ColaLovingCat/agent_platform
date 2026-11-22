import { fetchRequest } from "@/commons/utils/fetch";

export const getlistUsers = (data?: any) => {
  return fetchRequest("/api/users/search", {
    method: "GET",
    data,
  });
};
export const getinfosUsers = (data?: any) => {
  return fetchRequest("/api/users/getinfos", {
    method: "GET",
    data,
  });
};
export const saveUser = (data?: any) => {
  return fetchRequest("/api/users/save", {
    method: "POST",
    data,
  });
};
export const resetPassword = (data?: any) => {
  return fetchRequest("/api/users/reset_password", {
    method: "POST",
    data,
  });
};
export const updatePassword = (data?: any) => {
  return fetchRequest("/api/users/update_password", {
    method: "POST",
    data,
  });
};
export const deleteUser = (data?: any) => {
  return fetchRequest("/api/users/delete", {
    method: "POST",
    data,
  });
};

export const getlistRoles = (data?: any) => {
  return fetchRequest("/api/roles/getlist", {
    method: "GET",
    data,
  });
};
export const saveRole = (data?: any) => {
  return fetchRequest("/api/roles/save", {
    method: "POST",
    data,
  });
};
export const deleteRole = (data?: any) => {
  return fetchRequest("/api/roles/delete", {
    method: "POST",
    data,
  });
};