/**
 * @summary 优化
 * @param debounceFn  防抖
 * @param throttleFn  节流
 * @param curryFn     柯里化函数
 * @param composeFns  组合函数
 * @param singletonFn 单例模式
 */
export const Optimize = {
  /**
   * @summary 执行Promise队列，若其中一个出错则报错
   */
  promiseFlow: function (arr: Promise<any>[], callback: Function) {
    Promise.all(arr)
      .then((res) => {
        callback({
          status: 1,
          message: "",
        });
      })
      .catch((err) => {
        callback({
          status: -1,
          message: err,
        });
      });
  },

  /**
   * @summary 执行队列，按顺序依次执行（上一个完成后才执行下一个）
   * @param arr 返回 Promise 的函数数组
   */
  async promiseQueue(arr: (() => Promise<any>)[], callback: Function) {
    try {
      for (const fn of arr) {
        await fn();
      }
      callback({ status: 1, message: "all finished" });
    } catch (err) {
      callback({ status: -1, message: err });
    }
  },

  /**
   * @summary 等待
   */
  sleep: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),

  /**
   * @summary 防抖，减少频繁触发的事件的执行次数
   * @param func 被防抖的原函数
   * @param wait 在等待时间结束后，才可以重新触发一次函数，若重复触发则重置wait时间
   * @param immediate 是否立即触发
   * @returns 防抖后的新函数
   *
   * @example
   * const debounced = Optimize.debounceFn(() => console.log('fire'), 300);
   * window.addEventListener('resize', debounced);
   */
  debounceFn: function (func: Function, wait: number, immediate = false) {
    let timer: any = null;
    // 缓存函数的执行上下文和参数
    const _self = this,
      _args = arguments;
    return function () {
      // 清除之前的计时器
      if (timer) {
        clearTimeout(timer);
      }
      //
      if (!immediate) {
        timer = setTimeout(function () {
          func.apply(_self, _args);
        }, wait);
      } else {
        const callNow = !timer;
        timer = setTimeout(function () {
          timer = null;
        }, wait);
        if (callNow) {
          func.apply(_self, _args);
        }
      }
    };
  },

  /**
   * @summary 节流，确保函数在指定时间间隔内只被调用一次
   * @param func 被节流的原函数
   * @param delay 时间间隔（毫秒）
   * @returns 节流后的新函数
   *
   * @example
   * const throttled = Optimize.throttleFn(() => console.log('fire'), 300);
   * window.addEventListener('scroll', throttled);
   */
  throttleFn: function (func: Function, delay: number) {
    let lastTime = 0;
    // 缓存函数的执行上下文和参数
    const _self = this,
      _args = arguments;
    return function (e: any) {
      const nowTime = new Date().getTime(); // 记录本次执行时间
      if (nowTime - lastTime > delay) {
        // 在延时范围外则触发方法
        func.apply(_self, _args);
        lastTime = nowTime;
      }
    };
  },

  /**
   * @summary 柯里化函数，把接受多个参数的函数，变换成 接受单一参数的，并返回接受余下的参数且返回结果的 新函数
   * @param func 需要柯里化的函数
   * @returns 柯里化后的新函数
   *
   * @example
   * const add = (a: number, b: number) => a + b;
   * const curried = Optimize.curryFn(add);
   * console.log(curried(1)(2)); // 3
   */
  curryFn: function (func: Function) {
    return function curried(this: any, ...args: any[]) {
      // 如果传入参数个数不少于原函数参数个数，直接调用原函数并返回结果
      if (args.length >= func.length) {
        return func.apply(this, args);
      }
      // 否则返回一个新函数，等待更多的参数传入
      else {
        return (...newArgs: any[]) => {
          return curried.apply(this, args.concat(newArgs));
        };
      }
    };
  },

  /**
   * @summary 组合函数，两个函数自动依次执行
   * @param fns 要组合的函数列表
   * @returns 组合后的新函数
   *
   * @example
   * const double = (x: number) => x * 2;
   * const square = (x: number) => x * x;
   * const composed = Optimize.composeFns(double, square);
   * console.log(composed(2)); // square(double(2)) = square(4) = 16
   */
  composeFns: function (...fns: any[]) {
    const fnsLen = fns.length;
    // 判断参数是否都为函数
    for (let i = 0; i < fnsLen; i++) {
      if (typeof fns[i] !== "function") {
        throw TypeError("The argument passed must be a function.");
      }
    }
    const _self = this;
    function composeFn(...args: any[]) {
      // 第一个函数的执行结果，并用该结果作为下一个函数的输入
      let result = fns[0].apply(_self, args);
      // 从第二个函数开始遍历，依次将函数取出进行调用
      for (let i = 1; i < fnsLen; i++) {
        // 将上一个函数的返回值作为参数传给下一个函数，并更新结果
        result = fns[i].call(_self, result);
      }
      // 将结果返回
      return result;
    }
    return composeFn;
  },
  
  /**
   * @summary 单例模式
   * @param func 构造函数
   * @returns 单例调用方法
   *
   * @example
   * const create = () => ({ id: Math.random() });
   * const singleton = Optimize.singletonFn(create);
   * const a = singleton();
   * const b = singleton();
   * console.log(a === b); // true
   */
  singletonFn: function (func: Function) {
    // 排除非函数与箭头函数
    if (!(func instanceof Function) || !func.prototype) {
      throw new Error("不是合法的构造函数");
    }
    // 用于保存单例实例的变量
    let instance: any;

    return function () {
      // 公共方法，用于获取单例实例
      if (!instance) {
        instance = func();
      }
      return instance;
    };
  },
};
