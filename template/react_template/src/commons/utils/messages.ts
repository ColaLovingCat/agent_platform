import { notification } from "antd";
const placement = "topRight";
const duration = 3;

export const showSuccess = (content: string) => {
  notification.success({
    title: "Success",
    description: content,
    placement,
    duration,
  });
};
export const showInfo = (content: string) => {
  notification.info({
    title: "Info",
    description: content,
    placement,
    duration,
  });
};
export const showWarning = (content: string) => {
  notification.warning({
    title: "Warning",
    description: content,
    placement,
    duration,
  });
};
export const showError = (content: string) => {
  notification.error({
    title: "Error",
    description: content,
    placement,
    duration,
  });
};
