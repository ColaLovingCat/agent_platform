import { fetchRequest } from "@/commons/utils/fetch";

export const upload = (data?: any) => {
  return fetchRequest("/api/upload", {
    method: "POST",
    data,
    type: "none",
  });
};
