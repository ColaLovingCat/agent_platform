/**
 * @summary Date 拓展方法
 * @param format     时间格式化
 * @param formatUTC  UTC时间
 * @param formatShow 时间展示
 * @param getCW      获取周数
 * @param add        增加相应时间
 * @param gap        时间差值
 * @param period     周期时间段
 */
export interface ExDate {
  /**
   * @summary 时间格式化
   * @param date 时间
   * @param format "yyyy-MM-dd HH:mm:ss"
   */
  format(date: any, format?: string): string;
  /**
   * @summary 获取UTC时间
   */
  formatUTC(date: any): string;
  /**
   * @summary 获取周数
   * @param type A 周一开始 |B 周日开始
   * @returns 3
   */
  getCW(d: Date | String, type: string): number;
  /**
   * @summary 格式化显示日期的不同阶段
   * @returns 3 days ago
   */
  formatShow(date: any, format?: string): string;
  /**
   * @summary 时间增减
   * @param strInterval y|M|q|w|d|h|m|s
   */
  add(date: Date | string, interval: IntervalType, num: number): Date;
  /**
   * @summary 时间差值 A-B，默认返回天数
   */
  gap(
    dateA: Date | string,
    dateB: Date | string,
    interval?: IntervalType
  ): number | null;
  /**
   * @summary 获取周期的时间段
   */
  period(
    type:
      | "current_shift"
      | "24h"
      | "3d"
      | "7d"
      | "current_week"
      | "last_week"
      | "current_month"
      | "last_month"
      | "last_year"
  ): string[];
}

export const months_short = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const months_long = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const weeks_short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weeks_long = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const dates = [
  "Year",
  "Month",
  "Quarter",
  "Week",
  "Day",
  "Hour",
  "Minute",
  "Second",
];

type IntervalType = "y" | "M" | "q" | "w" | "d" | "h" | "m" | "s";
export const ExDate: ExDate = {
  format(date: any, format: string | undefined = undefined) {
    if (date === "" || date === null) {
      return "";
    }
    //无参数
    if ((date == undefined && format === undefined) || date === "now") {
      date = new Date();
    } else {
      if (typeof date === "string") {
        date = date.replace("T", " ");
      }
      date = new Date(date);
    }

    if (format === undefined) {
      format = "yyyy-MM-dd HH:mm:ss";
    }

    // 匹配规则
    const map: Record<string, string> = {
      // 年份
      YYYY: date.getFullYear().toString(),
      YY: date.getFullYear().toString().slice(-2),
      yyyy: date.getFullYear().toString(),
      yy: date.getFullYear().toString().slice(-2),

      // 季度
      QQ: String(Math.floor((date.getMonth() + 3) / 3)).padStart(2, "0"),
      Q: String(Math.floor((date.getMonth() + 3) / 3)),
      qq: String(Math.floor((date.getMonth() + 3) / 3)).padStart(2, "0"),
      q: String(Math.floor((date.getMonth() + 3) / 3)),

      // 月份
      MMMM: months_long[date.getMonth()],
      MMM: months_short[date.getMonth()],
      MM: String(date.getMonth() + 1).padStart(2, "0"),
      M: String(date.getMonth() + 1),

      // 星期 & 周数
      WWWW: weeks_long[date.getDay()],
      WWW: weeks_short[date.getDay()],
      WBB: this.getCW(date, "B").toString().padStart(2, "0"),
      WW: this.getCW(date, "A").toString().padStart(2, "0"),
      WB: this.getCW(date, "B").toString(),
      W: this.getCW(date, "A").toString(),
      ww: this.getCW(date, "A").toString().padStart(2, "0"),
      w: this.getCW(date, "A").toString(),

      // 日期
      DD: String(date.getDate()).padStart(2, "0"),
      D: String(date.getDate()),
      dd: String(date.getDate()).padStart(2, "0"),
      d: String(date.getDate()),

      // 小时
      HH: String(date.getHours()).padStart(2, "0"),
      H: String(date.getHours()),
      hh: String(date.getHours() % 12 || 12).padStart(2, "0"),
      h: String(date.getHours() % 12 || 12),

      // 分钟
      mm: String(date.getMinutes()).padStart(2, "0"),
      m: String(date.getMinutes()),

      // 秒
      SS: String(date.getSeconds()).padStart(2, "0"),
      S: String(date.getSeconds()),
      ss: String(date.getSeconds()).padStart(2, "0"),
      s: String(date.getSeconds()),

      // 毫秒
      f: String(date.getMilliseconds()),
    };

    const tokens = Object.keys(map)
      .sort((a, b) => b.length - a.length)
      .join("|");
    const regex = new RegExp(tokens, "g");
    return format.replace(regex, (match) => map[match] ?? match);
  },
  formatUTC(date: any): string {
    const dt = new Date(date);
    const YYYY = dt.getUTCFullYear();
    const MM = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const DD = String(dt.getUTCDate()).padStart(2, "0");
    const HH = String(dt.getUTCHours()).padStart(2, "0");
    const mm = String(dt.getUTCMinutes()).padStart(2, "0");
    const ss = String(dt.getUTCSeconds()).padStart(2, "0");

    return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
  },
  getCW(date: Date | string, type: string): number {
    const d: Date = typeof date === "string" ? new Date(date) : date;

    if (type == "A") {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7; // 周一 = 0
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    } else {
      const start = new Date(d.getFullYear(), 0, 1); // 当年第一天
      const diff = (d.getTime() - start.getTime()) / 86400000; // 距离年初的天数

      // 计算周数（以周日为第一天）
      return Math.ceil((diff + start.getDay() + 1) / 7);
    }
  },
  formatShow: function (date: any, format = "yyyy/MM/dd") {
    const now = new Date().getTime();
    const dt = new Date(date).getTime();
    const diffSec = Math.floor((now - dt) / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    if (diffSec < 15 * 86400) return `${Math.floor(diffSec / 86400)} days ago`;

    return this.format(date, format);
  },
  add: function (date: any, strInterval: IntervalType, num: number): Date {
    const dt = new Date(date);
    switch (strInterval) {
      case "s":
        dt.setSeconds(dt.getSeconds() + num);
        break;
      case "m":
        dt.setMinutes(dt.getMinutes() + num);
        break;
      case "h":
        dt.setHours(dt.getHours() + num);
        break;
      case "d":
        dt.setDate(dt.getDate() + num);
        break;
      case "w":
        dt.setDate(dt.getDate() + 7 * num);
        break;
      case "q":
        dt.setMonth(dt.getMonth() + num * 3);
        break;
      case "M":
        dt.setMonth(dt.getMonth() + num);
        break;
      case "y":
        dt.setFullYear(dt.getFullYear() + num);
        break;
    }
    return dt;
  },
  gap: function (dateA: any, dateB: any, strInterval: IntervalType = "d") {
    try {
      const a = new Date(dateA).getTime();
      const b = new Date(dateB).getTime();
      const diffMs = a - b;

      switch (strInterval) {
        case "s":
          return Math.floor(diffMs / 1000);
        case "m":
          return Math.floor(diffMs / (60 * 1000));
        case "h":
          return Math.floor(diffMs / (60 * 60 * 1000));
        case "d":
        default:
          return Math.floor(diffMs / (24 * 60 * 60 * 1000));
      }
    } catch (e) {
      return null;
    }
  },
  period: function (type: string) {
    const result: any = [null, null];
    //
    const dateNow = new Date();
    let year = dateNow.getFullYear();
    let month = dateNow.getMonth() + 1;
    const dayNum = dateNow.getDay() || 7;

    switch (type) {
      case "current_shift": {
        result[1] = this.format(dateNow, "yyyy/MM/dd HH:mm:ss");
        //
        const hour = dateNow.getHours();
        if (hour < 7) {
          result[0] =
            this.format(this.add(dateNow, "d", -1), "yyyy/MM/dd") + " 19:00:00";
        } else if (hour < 19) {
          result[0] = this.format(dateNow, "yyyy/MM/dd") + " 07:00:00";
        } else {
          result[0] = this.format(dateNow, "yyyy/MM/dd") + " 19:00:00";
        }
        break;
      }
      case "24h": {
        result[0] = this.format(
          this.add(dateNow, "h", -24),
          "yyyy-MM-dd HH:mm:ss"
        );
        result[1] = this.format(dateNow, "yyyy-MM-dd HH:mm:ss");
        break;
      }
      case "3d": {
        result[0] = this.format(
          this.add(dateNow, "d", -2),
          "yyyy-MM-dd HH:mm:ss"
        );
        result[1] = this.format(dateNow, "yyyy-MM-dd HH:mm:ss");
        break;
      }
      case "7d": {
        result[0] = this.format(
          this.add(dateNow, "d", -6),
          "yyyy-MM-dd HH:mm:ss"
        );
        result[1] = this.format(dateNow, "yyyy-MM-dd HH:mm:ss");
        break;
      }
      case "current_week": {
        // 周一
        const start = this.add(dateNow, "d", -(dayNum - 1));
        // 周日
        const end = this.add(dateNow, "d", 7 - dayNum);
        result[0] = this.format(start, "yyyy-MM-dd 00:00:00");
        result[1] = this.format(end, "yyyy-MM-dd 23:59:59");
        break;
      }
      case "last_week": {
        const dayNum = dateNow.getDay();
        result[0] = this.format(this.add(dateNow, "d", -(dayNum + 6)));
        result[1] = this.format(this.add(dateNow, "d", -dayNum));
        break;
      }
      case "current_month": {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); // 当前月的最后一天
        result[0] = this.format(start, "yyyy-MM-dd 00:00:00");
        result[1] = this.format(end, "yyyy-MM-dd 23:59:59");
        break;
      }
      case "last_month": {
        if (month == 1) {
          year = year - 1;
          month = 12;
        } else {
          month = month - 1;
        }
        result[0] = this.format(year + "-" + month + "-1");
        result[1] = this.format(
          year + "-" + month + "-" + new Date(year, month, 0).getDate()
        );
        break;
      }
      case "last_year": {
        result[0] = this.format(year - 1 + "-1-1");
        result[1] = this.format(year - 1 + "-12-31");
        break;
      }
    }
    return result;
  },
};
