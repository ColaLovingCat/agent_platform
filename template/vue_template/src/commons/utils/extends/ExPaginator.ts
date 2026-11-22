/**
 * @summary 分页类型
 * @member {Pagination} pagination
 * @member {T[ ]} rows
 * @member {T[ ]} dataSource
 */
export class ExPaginator<T> {
  constructor(datas: T[], size: number) {
    this.dataSource = datas;
    this.pagination.size = size;
    //
    this.pagination.index = 0;
    this._refreshData();
  }

  // 数据源
  dataSource: T[] = [];
  // 展示数据
  rows: T[] = [];

  // 分页信息
  pagination: Pagination = {
    index: 0,
    total: 0,
    length: 0,
    size: 0,
  };

  /**
   * 刷新数据
   * @private
   */
  _refreshData() {
    if (!this.dataSource) this.dataSource = [];
    // 刷新总条数
    this.pagination.total = this.dataSource.length;
    // 刷新总页数
    this.pagination.length = Math.ceil(
      this.dataSource.length / this.pagination.size
    );
    // 刷新展示数据
    this.rows = getCurrentPageData(
      this.dataSource,
      this.pagination.size,
      this.pagination.index
    );
  }

  /**
   * 翻页及跳转
   * @private
   */
  _step(step: number) {
    const tempIndex = this.pagination.index + step;
    if (tempIndex > -1 && tempIndex < this.pagination.length) {
      this.pagination.index = tempIndex;
    }
    this._refreshData();
  }
  /**
   * @summary 向前翻页
   */
  prev() {
    this._step(-1);
  }
  /**
   * @summary 向后翻页
   */
  next() {
    this._step(1);
  }
  /**
   * @summary 跳转
   * @param index 页面索引
   */
  goTo(index: number) {
    if (index >= 0 && index < this.pagination.total) {
      this.pagination.index = index * 1;
      this._refreshData();
    }
  }

  /**
   * @summary 设置新页面大小
   * @param size 页面大小
   */
  setSize(size: number) {
    this.pagination.size = size;
    this._refreshData();
  }

  /**
   * @summary 设置新数据源
   * @param datas 替换数据
   */
  setDatas(datas: T[]) {
    if (datas) this.dataSource = datas;
    this._refreshData();
  }
}

export interface Pagination {
  index: number; // 页面索引
  total: number; // 总条数
  length: number; // 总页数
  size: number; // 单页数量
  options?: number[]; // 可选的单页数量
}

/**
 * @summary 分页方法
 * @member {Array} arr
 * @member {Number} size 单页数量
 * @member {Number} index 页面索引，从0开始
 */
export const getCurrentPageData = (arr: any[], size: number, index: number) => {
  if (!Array.isArray(arr) || arr.length === 0 || size <= 0 || index < 0)
    return [];

  const start = index * size;
  const end = start + size;

  return arr.slice(start, end).map((item, idx) => ({
    ...item,
    _rowNo: start + idx + 1,
  }));
};
