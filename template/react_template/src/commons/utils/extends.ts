export * from "./extends/ExString";
export * from "./extends/ExNumber";
export * from "./extends/ExArray";
export * from "./extends/ExDate";
export * from "./extends/ExObject";
export * from "./extends/ExWeb";

export * from "./extends/ExInterval";
export * from "./extends/ExLocalStore";
export * from "./extends/ExPaginator";

export * from "./extends/Optimize";

/**
 * @summary 定义loading的加载状态
 */
export class ExLoading {
  _value: number;

  constructor() {
    this._value = 0;
  }

  get status() {
    return this._value > 0;
  }

  loading = () => {
    this._value++;
  };
  end = () => {
    this._value > 0 ? this._value-- : void 0;
  };
  clear = () => {
    this._value = 0;
  };
}
