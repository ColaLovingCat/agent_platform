/** 简单 cron 表达式解析 + 下次触发时间计算。
 *
 *  ## 支持的语法（标准 5 字段 unix cron）
 *
 *    分 时 日 月 周
 *
 *  每个字段支持：
 *    `*`         — 任意值
 *    `5`         — 单值
 *    `1-5`       — 区间
 *    `1,3,5`     — 列表
 *    `* / 15`    — 步长（实际写法不含空格 → `*\/15`，下方注释只是为了 docblock 不被关掉）
 *    `1-10/2`    — 区间 + 步长
 *
 *  不支持：`L` / `W` / `#` / 月名 (JAN/FEB) / 周名 (MON/TUE) / 多余字段。
 *  ——给"管理页快速预览下次触发"用就够；复杂场景靠 flow editor 内置的 cron 编辑器
 *  + APScheduler 服务端兜底。
 *
 *  ## DOM × DOW 语义
 *
 *  按 POSIX 约定：当 day-of-month 和 day-of-week 都不是 `*` 时，二者取 **OR**；
 *  只要其一是 `*` 则按 **AND** 处理。日常 cron 大多是单维度，对得上直觉。
 *
 *  ## 时区
 *
 *  用 `Intl.DateTimeFormat` 在目标 TZ 下提取 wall-clock 字段做匹配，所以 cron
 *  "0 9 * * 1-5"（Asia/Shanghai 周一至五早 9 点）对查看者所在的任何时区都返回
 *  相同的"下次触发绝对时刻"。
 *
 *  ## 性能与上限
 *
 *  扫描以 1 分钟为步长向前推进，**上限 60 天**——这覆盖日 / 周 / 月级常见 cron；
 *  超过 60 天找不到的（如年度任务）返回 null，调用方降级显示 "无法预估"。
 *  典型查询命中在毫秒级，最坏情况 ~60×24×60 = 86400 次迭代 + 同等次 Intl 调用，
 *  浏览器主线程上约 400ms 内可完成；不会触发明显卡顿。
 */
export function nextCronFire(
  cron: string,
  from: Date = new Date(),
  tz: string = "Asia/Shanghai",
): Date | null {
  const parts = (cron || "").trim().split(/\s+/);
  if (parts.length !== 5) return null;

  let minutes: Set<number>;
  let hours: Set<number>;
  let doms: Set<number>;
  let months: Set<number>;
  let dows: Set<number>;
  try {
    minutes = parseField(parts[0], 0, 59);
    hours = parseField(parts[1], 0, 23);
    doms = parseField(parts[2], 1, 31);
    months = parseField(parts[3], 1, 12);
    dows = parseField(parts[4], 0, 6);
  } catch {
    return null;
  }

  const domAny = parts[2].trim() === "*";
  const dowAny = parts[4].trim() === "*";

  // 对齐到下一分钟开始扫——避免 "now == 触发时刻" 时把当前这分钟当成下次触发
  const start = new Date(Math.ceil(from.getTime() / 60000) * 60000);
  const MAX_MIN = 60 * 24 * 60;
  for (let i = 0; i < MAX_MIN; i++) {
    const t = new Date(start.getTime() + i * 60000);
    const wc = wallClockInTZ(t, tz);
    if (!wc) continue;
    const domHit = doms.has(wc.day);
    const dowHit = dows.has(wc.dow);
    const dayMatch =
      domAny && dowAny
        ? true
        : domAny
        ? dowHit
        : dowAny
        ? domHit
        : domHit || dowHit;
    if (
      minutes.has(wc.minute) &&
      hours.has(wc.hour) &&
      dayMatch &&
      months.has(wc.month)
    ) {
      return t;
    }
  }
  return null;
}

/** 单字段解析——按逗号拆 list；每段允许 `*`/`数字`/`a-b` 形式 + 可选 `/step`。 */
function parseField(spec: string, lo: number, hi: number): Set<number> {
  const result = new Set<number>();
  const parts = spec.split(",");
  for (const part of parts) {
    const m = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/);
    if (!m) throw new Error(`bad cron field: ${spec}`);
    const range = m[1];
    const step = m[2] ? Number(m[2]) : 1;
    if (step <= 0) throw new Error(`bad step in: ${spec}`);
    let start: number;
    let end: number;
    if (range === "*") {
      start = lo;
      end = hi;
    } else if (range.includes("-")) {
      const [a, b] = range.split("-").map(Number);
      start = a;
      end = b;
    } else {
      // 注意：`5/15` 这种"单值 + 步长"按 cron 惯例展开为 `5,20,35,...,hi`
      start = Number(range);
      end = step === 1 ? start : hi;
    }
    for (let v = start; v <= end; v += step) {
      if (v >= lo && v <= hi) result.add(v);
    }
  }
  return result;
}

/** 给定 UTC 时刻 + TZ，返回该时刻在 TZ 下的 wall-clock 各字段。
 *
 *  返回的 `dow` 取 cron 惯例：0=Sun .. 6=Sat。 */
function wallClockInTZ(
  date: Date,
  tz: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dow: number;
} | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    const map: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
      map[part.type] = part.value;
    }
    const dowMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      dow: dowMap[map.weekday] ?? 0,
    };
  } catch {
    return null;
  }
}

/** 把一个绝对时刻在指定 TZ 下渲染成 `MM-DD HH:mm` —— UI 展示给用户看。 */
export function formatShortInTZ(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: tz,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/** 完整一点的版本——给 title (tooltip) 用，包含年份和时区名。 */
export function formatFullInTZ(date: Date, tz: string): string {
  try {
    const s = new Intl.DateTimeFormat("zh-CN", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `${s} (${tz})`;
  } catch {
    return date.toISOString();
  }
}

/** "在 N 分/小时/天 后" 的相对描述——给 UI 的次要副文。
 *
 *  设计选择：始终向上取整 (Math.ceil)——避免 "59 秒后" 这种界面闪烁；并且
 *  比 "12 分钟后" 误导性小（实际只剩 11:30 而显示"12 分钟"会让用户错过）。 */
export function describeRelative(date: Date, from: Date = new Date()): string {
  const diffMs = date.getTime() - from.getTime();
  if (diffMs < 0) return "已过";
  const m = Math.ceil(diffMs / 60000);
  if (m < 1) return "马上";
  if (m < 60) return `${m} 分钟后`;
  const h = Math.ceil(m / 60);
  if (h < 24) return `${h} 小时后`;
  const d = Math.ceil(h / 24);
  return `${d} 天后`;
}
