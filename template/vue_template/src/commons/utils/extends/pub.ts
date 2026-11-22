/**
 * @summary 深拷贝数组
 */
export const deepCopyArr = function (arr: any[]): any[] {
  const clonedArr = [];
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      // 递归拷贝子数组
      clonedArr[i] = deepCopyArr(arr[i]);
    } else if (typeof arr[i] === "object" && arr[i] !== null) {
      // 拷贝子对象
      clonedArr[i] = Object.assign({}, arr[i]);
    } else {
      // 拷贝基本类型值
      clonedArr[i] = arr[i];
    }
  }
  return clonedArr;
};
/**
 * @summary 深拷贝对象
 */
export const deepCopyObj = function (obj: any): any {
  const objCopy: any = {};
  for (const item in obj) {
    switch (typeof obj[item]) {
      case "object": {
        if (obj[item] instanceof Array) {
          objCopy[item] = deepCopyArr(obj[item]);
        } else {
          objCopy[item] = deepCopyObj(obj[item]);
        }
        break;
      }
      default: {
        objCopy[item] = obj[item];
        break;
      }
    }
  }
  return objCopy;
};
/**
 * @summary 对比值
 */
export const compareObj = function (
  obj1: any,
  obj2: any,
  props: any = null
): boolean {
  // 判断类型是否相等
  if (typeof obj1 !== typeof obj2) {
    return false;
  }

  // 如果是基本类型，直接比较值是否相等
  if (typeof obj1 !== "object" || obj1 === null || obj2 === null) {
    return obj1 === obj2;
  }

  // 如果是数组，比较每个元素是否相等
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) {
      return false;
    }
    for (let i = 0; i < obj1.length; i++) {
      if (!compareObj(obj1[i], obj2[i])) {
        return false;
      }
    }
    return true;
  }

  // 比较对象的每个属性是否相等
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (const key of keys1) {
    if (!obj2.hasOwnProperty(key)) {
      return false;
    }
    if (!compareObj(obj1[key], obj2[key])) {
      return false;
    }
  }
  return true;
};
