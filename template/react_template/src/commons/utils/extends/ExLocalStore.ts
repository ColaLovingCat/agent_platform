import { logger } from "@/commons/utils/logger";
const log = logger.create("ExLocalStore");

/**
 * @summary 本地存储
 */
export const ExLocalStore = {
  /**
   * @summary 存储
   * @param day 过期时间，单位：天，默认30
   */
  set: function (prop: string, value: any, day = 30) {
    const time = new Date().getTime() + day * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      prop,
      JSON.stringify({
        data: value,
        time: time,
      })
    );
    //
    log.log(
      "",
      `set ${prop}, expires at ${new Date(time).toLocaleString()}`
    );
  },
  /**
   * @summary 获取
   * @return 过期为null
   */
  get: function (prop: string) {
    const data = localStorage.getItem(prop);
    if (!data) {
      return null;
    }

    const obj = JSON.parse(data);
    if (new Date().getTime() > obj.time) {
      // 过期
      log.log(
        "",
        `get ${prop}, expired at ${new Date(obj.time).toLocaleString()}`
      );
      localStorage.removeItem(prop);
      return null;
    } else {
      log.log(
        "",
        `get ${prop}, expires at ${new Date(obj.time).toLocaleString()}`
      );
      return obj.data;
    }
  },
  /**
   * @summary 删除
   */
  delete: function (prop: string) {
    localStorage.removeItem(prop);
  },
  /**
   * @summary 清空
   */
  clear: function () {
    localStorage.clear();
  },
};
