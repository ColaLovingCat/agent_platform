export interface TableInfos {
  pagination: Pagination
  columns: ColumInfos[]
  rows: any[]
}

export interface Pagination {
  pageIndex: number // 当前页数
  totalCount: number // 总行数
  pageSize: number // 每页行数
  sizeOptions?: number[] // 可选择的行数
}
export interface ColumInfos {
  key: string | number
  dataIndex?: string | number
  title: string
  isVisible?: boolean
  isFilter?: boolean
  sort?: string
}
