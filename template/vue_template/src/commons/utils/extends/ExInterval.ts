/**
 * @summary 定时器队列类型
 */
export class ExInterval {
  lastID: any = null;
  list: any[] = [];

  /**
   * @summary 创建定时器
   * @param func 触发的方法
   * @param time 频次
   * @param name 名称
   * @param immediate 是否立即执行一次
   */
  create(
    func: Function,
    time: number,
    name: string,
    immediate: boolean = false
  ) {
    if (immediate) {
      try {
        func();
      } catch (err) {
        console.error("[Interval Immediate Error]", err);
      }
    }

    const id = setInterval(function () {
      console.info("[Interal]", { name, time, id });
      func();
    }, time);
    //
    this.lastID = id;
    this.list.push(id);
    //
    return id;
  }

  /**
   * @summary 停止定时器
   * @param id 停止特定的id，如果不传则停止最近的那一个
   */
  stop(id: any = null) {
    if (!id) id = this.lastID;
    clearInterval(id);
    //
    this.list.splice(
      this.list.findIndex((a) => a == id),
      1
    );
    this.lastID = this.list[this.list.length - 1];
  }

  /**
   * @summary 停止list中所有定时器
   */
  clear() {
    if (this.list.length > 0) {
      this.list.map((id) => {
        clearInterval(id);
      });
    }
    this.list = [];
    console.info("[Interval]:", "Clear");
  }

  /**
   * @summary 停止所有定时器
   */
  clearAll() {
    const end = window.setInterval(function () {}, 100 * 1000);
    for (let loop = 0; loop <= end; loop++) {
      clearInterval(loop);
    }
    //
    this.list = [];
    console.info("[Interval]:", "Clear All");
  }

  /**
   * @summary 每天定时 run 任务
   * @description 例如：每天 03:30 自动执行某个回调函数
   * @param callback - 需要定时执行的任务函数
   * @param {{ hour: number, minute: number }} triggerTime - 触发时间（24小时制）
   * @param immediate - 是否立即执行一次
   * @example
   * // 每天凌晨 03:30 执行 myTask
   * scheduleNextUpdate(myTask, { hour: 3, minute: 30 });
   */
  static scheduleTask(
    triggerTime: { hour: number; minute: number },
    callback: (nextTime: Date) => void,
    immediate: boolean = false
  ): void {
    const now = new Date();

    // 计算下一次目标时间
    const getNextTarget = (): Date => {
      const t = new Date();
      t.setHours(triggerTime.hour, triggerTime.minute, 0, 0);
      if (t <= new Date()) {
        t.setDate(t.getDate() + 1); // 已经过了今天 → 明天
      }
      return t;
    };

    if (immediate) {
      try {
        const nextTarget = getNextTarget();
        callback(nextTarget); // 告诉用户：下一次什么时候执行
      } catch (err) {
        console.error("[Schedule Immediate Error]", err);
      }
    }

    const target = getNextTarget();
    const delay = target.getTime() - now.getTime();

    console.log(
      `[Timer] next: ${target.toLocaleString()}, left: ${(
        delay /
        1000 /
        60
      ).toFixed(1)} mins`
    );

    setTimeout(() => {
      // 执行回调时，告诉用户：下一次运行的时间（再+1天）
      const nextTarget = new Date(target);
      nextTarget.setDate(nextTarget.getDate() + 1);

      callback(nextTarget);

      // 继续调度
      ExInterval.scheduleTask(triggerTime, callback);
    }, delay);
  }
}
