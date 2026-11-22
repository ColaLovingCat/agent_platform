import { deepCopyArr } from "./pub";

/**
 * @summary Array 拓展
 * @param initial         初始化简单数组
 * @param new             初始化简单数组
 * @param insert          指定位置添加元素
 * @param delete          删除指定位置元素
 * @param checkIndex      检查索引是否可用
 * @param checkExist      检查简易元素是否存在
 * @param checkExistbyEle 检查简易元素是否存在
 * @param copy            深拷贝
 * @param exchange        交换元素位置
 * @param switch          切换元素存在与否的状态
 * @param switchbyEle     切换元素存在与否的状态
 * @param sort            排序
 * @param sortbyEle       排序
 * @param sortbyEles      排序
 * @param unique          去重
 * @param uniqueSingle    去重
 * @param group           分组
 * @param filter          模糊搜索
 * @param shuffle         打乱顺序
 * @param forEach         forEach
 * @param intersect       数组联查
 */
export interface ExArray {
  /**
   * @summary 初始化简单数组
   * @param length 数组长度
   * @returns [0,1,2,3,4,5...]
   */
  initial(length: number, startIndex?: number): number[];
  /**
   * @summary 在指定位置 index 添加元素obj
   * @param index 指定位置
   * @param obj 指定元素
   */
  insert(arr: any[], index: number, obj: any): any[];
  /**
   * @summary 删除指定位置 index 的元素
   * @param index 指定位置
   */
  delete(arr: any[], index: number): any[];
  /**
   * @summary 检查索引是否可用
   * @param index 指定位置
   */
  checkIndex(arr: any[], index: number): boolean;
  /**
   * @summary 检查元素是否在数组中，注意区分数据类型
   */
  checkExist(arr: any[], obj: string | number | boolean): number;
  /**
   * @summary 检查元素是否在数组中，需要指定元素的某一特定属性
   */
  checkExistbyEle(arr: any[], obj: any, prop: string): boolean;
  /**
   * @summary 深拷贝
   */
  copy<T = any>(arr: T[]): T[];
  /**
   * @summary 交换两个索引位置的元素在数组中的位置
   */
  exchange(arr: any[], index1: number, index2: number): any[];
  /**
   * @summary 切换数组中该元素的状态，没有则添加，有则删除
   */
  switch(arr: any[], value: any): void;
  /**
   * @summary 切换数组中该元素单一属性的状态，没有则添加，有则删除
   */
  switchbyEle(arr: any[], obj: any, prop: string): void;
  /**
   * @summary 排序
   */
  sort(arr: any[], sortBy?: "asc" | "desc"): any[];
  /**
   * @summary 按元素单一属性排序
   */
  sortbyEle(arr: any[], func: Function, sortBy?: "asc" | "desc"): any[];
  /**
   * @summary 支持多字段比对
   * @param arr 原数组
   * @param keys 多个字段名，或提取函数数组
   * @param orders 每个字段对应的顺序 asc/desc
   */
  sortbyEles(
    arr: any[],
    keys: (string | ((item: any) => any))[],
    orders?: ("asc" | "desc")[],
  ): any[];
  _sortCompare(a: any, b: any): number;
  /**
   * @summary 去重后获取单一元素的数组
   */
  uniqueSingle(arr: any[], prop: string): any[];
  /**
   * @summary 去重
   */
  unique(arr: any[]): any[];
  /**
   * @summary 基于单一属性值将数组分组
   * @param { Function } fun - item => item.id
   */
  group(arr: any[], fun: Function): { name: string; datas: any[] }[];
  /**
   * @summary 基于单一属性值模糊搜索包含文本信息的项
   * @param { Function } fun - item => item.value
   */
  filter(arr: any[], filterTxt: string, fun: Function): any[];
  /**
   * @summary 随机打乱
   */
  shuffle(arr: any[]): any[];
  /**
   * @summary forEach
   * @param func 示例：(item, index) => {}
   */
  forEach(arr: any[], fun: Function): any[];
  /**
   * @summary 两数组联查
   * @param type 0-简单合并(默认)| 1-交集| 2-并集 |3-差集
   */
  intersect(arr1: any[], arr2: any[], type?: 0 | 1 | 2 | 3): any[];
}
export const ExArray: ExArray = {
  initial: function (length: number, startIndex?: number): number[] {
    if (!startIndex) return new Array(length).fill(0);

    const result: number[] = [];
    for (let loop = 0; loop < length; loop++) {
      result.push(startIndex + loop);
    }
    return result;
  },
  insert: function (arr: any[], index: number, obj: any) {
    arr.splice(index, 0, obj);
    return arr;
  },
  delete: function (arr: any[], index: number) {
    arr.splice(index, 1);
    return arr;
  },
  checkIndex: function (arr: any[], index: number) {
    return index > -1 && index < arr.length;
  },
  checkExist: function (arr: any[], obj: string | number | boolean) {
    return arr.indexOf(obj);
  },
  checkExistbyEle: function (arr: any[], obj: any, prop: string) {
    return arr.findIndex((item) => item[prop] == obj[prop]) != -1;
  },
  copy: function (arr: any[]) {
    return deepCopyArr(arr);
    // return JSON.parse(JSON.stringify(arr));
  },
  exchange: function (arr: any[], index1: number, index2: number) {
    if (this.checkIndex(arr, index1) && this.checkIndex(arr, index2)) {
      [arr[index1], arr[index2]] = [arr[index2], arr[index1]];
    }
    return arr;
  },
  switch: function (arr: any[], value: any) {
    const index = this.checkExist(arr, value);
    if (index == -1) {
      // 未找到
      arr.push(value);
    } else {
      // 删除元素
      arr.splice(index, 1);
    }
  },
  switchbyEle: function (arr: any[], obj: any, prop: string) {
    const index = arr.findIndex((item) => item[prop] == obj[prop]);
    if (index == -1) {
      // 未找到
      arr.push(obj);
    } else {
      // 删除元素
      arr.splice(index, 1);
    }
  },
  sort: function (arr: any[], sortBy = "asc") {
    return arr.sort((a, b) =>
      sortBy === "asc" ? this._sortCompare(a, b) : this._sortCompare(b, a),
    );
  },
  sortbyEle: function (arr: any[], func: Function, sortBy = "asc") {
    return arr.sort((a, b) =>
      sortBy === "asc"
        ? this._sortCompare(func(a), func(b))
        : this._sortCompare(func(b), func(a)),
    );
  },
  sortbyEles: function (
    arr: any[],
    keys: (string | ((item: any) => any))[],
    orders: ("asc" | "desc")[] = [],
  ) {
    return arr.sort((a, b) => {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const order = orders[i] || "asc";
        const va = typeof key === "function" ? key(a) : a[key];
        const vb = typeof key === "function" ? key(b) : b[key];
        const cmp = this._sortCompare(va, vb);
        if (cmp !== 0) return order === "asc" ? cmp : -cmp;
      }
      return 0; // 所有字段相等
    });
  },
  _sortCompare: function (a: any, b: any) {
    if (typeof a === "string" && typeof b === "string") {
      return a.localeCompare(b);
    }
    return Number(a) - Number(b);
  },
  uniqueSingle: function (arr: any[], prop: string) {
    return [...new Set(arr.map((item: any) => item[prop]))];
  },
  unique: function (arr: any[]) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      if (result.indexOf(arr[i]) === -1) {
        result.push(arr[i]);
      }
    }
    return result;
  },
  group: function (arr: any[], fun: Function) {
    const groups: any = {};
    arr.forEach(function (o) {
      const group = fun(o);
      groups[group] = groups[group] || [];
      groups[group].push(o);
    });
    return Object.keys(groups).map(function (group) {
      return { name: group, datas: groups[group] };
    });
  },
  filter: function (arr: any[], filterTxt: string, fun: Function) {
    return filterTxt !== ""
      ? arr.filter((item) => {
          return (
            fun(item)
              .toLocaleLowerCase()
              .indexOf(filterTxt.toLocaleLowerCase()) != -1
          );
        })
      : arr;
  },
  shuffle: function (arr: any[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      arr = this.exchange(arr, i, j);
    }
    return arr;
  },
  forEach: function (arr: any[], fun: Function) {
    for (let loop = 0; loop < arr.length; loop++) {
      fun.call(arr, arr[loop], loop);
    }
    return arr;
  },
  intersect: function (arr1: any[], arr2: any[], type = 0) {
    switch (type) {
      case 1:
        return arr1.filter((item) => arr2.includes(item));
      case 2:
        return arr1.concat(arr2.filter((item) => !arr1.includes(item))); // [...new Set([...arr1, ...arr2])]
      case 3:
        return arr1.filter((item) => !arr2.includes(item));
      default:
        return arr1.concat(arr2);
    }
  },
};
