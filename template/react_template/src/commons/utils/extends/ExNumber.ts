/**
 * @summary 数字拓展
 * @param createRand            创建随机数
 * @param toFixed               保持小数位
 * @param formatMoney           金额分隔符
 * @param transRadix            进制转换
 * @param split                 获取整数和小数部分
 * @param limit                 限制数值在范围内
 * @param gap                   数值间差值
 * @param fixFloatingPointError 修正浮点数运算小数溢出
 */
export interface ExNumber {
  /**
   * @summary 创建随机数，包含左右值
   * @param point 返回值保留几位小数，默认返回整数
   */
  createRand(min: number, max: number, point?: number): number;
  /**
   * @summary 转字符并保持小数位数， 52.10
   * @param point 返回值保留几位小数
   */
  toFixed(num: number, point?: number | null): string;
  /**
   * @summary 金额分隔符 2,100.34
   * @param thousandsSep 千分位分隔符
   * @param decPoint 小数点符号
   * @param decCount 保留小数点位数
   */
  formatMoney(
    num: number,
    thousandsSep?: string,
    decPoint?: string,
    decCount?: number
  ): string;
  /**
   * @summary 进制转换
   * @param m 从
   * @param n 转至
   */
  transRadix(num: any, m?: number, n?: number): string;
  /**
   * @summary 获取整数和小数部分
   * @returns [] [整数部分,小数部分]
   */
  split(num: number): [number, number];
  /**
   * @summary 限制数值在范围内
   */
  limit(num: number, min: number, max: number): number;
  /**
   * @summary 数值间差值，包含符号 +/-
   * @returns string dataA - dataB
   */
  gap(dataA: number, dataB: number): string;
  /**
   * @summary 修正浮点数运算小数溢出的问题， 0.1+0.2 0.3-0.2 0.1*0.2 0.3/0.1
   * @param operator (a,b) => a + b
   */
  fixFloatingPointError(
    num1: number,
    num2: number,
    operator: (a: number, b: number) => number
  ): number;
  _getDecimalPlaces(num: number): number;
}
export const ExNumber: ExNumber = {
  createRand: function (
    min: number,
    max: number,
    point: number | undefined = undefined
  ): number {
    // point = point || 0;
    // if (point === 0) {
    //   return Math.round(min + Math.random() * (max - min));
    // } else {
    //   const up = Math.pow(10, point);
    //   return min + Math.round(Math.random() * (max - min) * up) / up;
    // }
    point = point || 0;
    if (point === 0) {
      // 整数情况直接四舍五入
      return Math.round(min + Math.random() * (max - min));
    } else {
      const up = Math.pow(10, point);

      // 用 fixFloatingPointError 来避免精度丢失
      const rand = Math.random();

      // (max - min) * up
      const range = this.fixFloatingPointError(max - min, up, (a, b) => a * b);
      // rand * range
      const scaled = this.fixFloatingPointError(rand, range, (a, b) => a * b);
      // min + scaled / up
      const div = this.fixFloatingPointError(scaled, up, (a, b) => a / b);
      const res = this.fixFloatingPointError(min, div, (a, b) => a + b);

      // 保证小数点位数
      return Number(res.toFixed(point));
    }
  },
  toFixed: function (num: number, point: number | null | undefined) {
    const isNegative = num < 0;
    num = Math.abs(num);

    const temp: any[] = this.split(num);
    let result = temp[0].toString();
    if (point && point > 0) {
      let dec = temp[1].toString().replace("0.", "");
      if (dec.length < point) {
        dec += new Array(point - dec.length).fill(0).join("");
      } else {
        dec = dec.substring(0, point);
      }
      result = result + "." + dec;
    }

    if (isNegative) {
      result = "-" + result;
    }
    return result;
  },
  formatMoney: function (
    num: number,
    thousandsSep = ",",
    decPoint = ".",
    decCount = 2
  ) {
    const sign = num < 0 ? "-" : "";

    const temp = Math.abs(num);
    let absNumber: string = String(temp);
    if (decCount > -1) {
      absNumber = temp.toFixed(decCount);
    }

    const parts = absNumber.split(".");
    let integerPart = parts[0];
    const decimalPart = parts[1] ? decPoint + parts[1] : "";

    while (/(\d+)(\d{3})/.test(integerPart)) {
      integerPart = integerPart.replace(
        /(\d+)(\d{3})/,
        "$1" + thousandsSep + "$2"
      );
    }

    return sign + integerPart + decimalPart;
  },

  transRadix: function (num: any, m = 10, n = 16) {
    return parseInt(num + "", m).toString(n);
  },
  split: function (num: number) {
    return [
      Math.floor(num),
      this.fixFloatingPointError(num, 1, (a: any, b: any) => a % b),
    ];
  },
  limit: function (num: number, min: number, max: number) {
    return Math.max(min, Math.min(num, max));
  },
  gap(dataA: number, dataB: number): string {
    let result: number = this.fixFloatingPointError(
      dataA,
      dataB,
      (a, b) => a - b
    );

    // 保留合适的小数位
    const decimalPlaces = Math.max(
      this._getDecimalPlaces(dataA),
      this._getDecimalPlaces(dataB)
    );

    return result > 0
      ? "+" + result.toFixed(decimalPlaces)
      : result.toFixed(decimalPlaces);
  },
  fixFloatingPointError: function (
    num1: any,
    num2: any,
    operator: (a: number, b: number) => number
  ) {
    const opStr = operator.toString();

    const getPrecision = this._getDecimalPlaces;
    const precision1 = getPrecision(num1);
    const precision2 = getPrecision(num2);

    const factor1 = 10 ** precision1;
    const factor2 = 10 ** precision2;

    const int1 = Math.round(num1 * factor1);
    const int2 = Math.round(num2 * factor2);

    if (opStr.includes("*")) {
      const result = (int1 * int2) / (factor1 * factor2);
      return result;
    }

    if (opStr.includes("/")) {
      const result = (int1 / int2) * (factor2 / factor1);
      return result;
    }

    const factor = 10 ** Math.max(precision1, precision2);
    const res = operator(num1 * factor, num2 * factor) / factor;
    return res;
  },
  _getDecimalPlaces: function (num: number) {
    const match = String(num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match) {
      return 0;
    }
    // 小数点后的位数
    const fraction = match[1] ? match[1].length : 0;
    // 科学计数法的指数
    const exponent = match[2] ? Number(match[2]) : 0;
    return Math.max(0, fraction - exponent);
  },
};
