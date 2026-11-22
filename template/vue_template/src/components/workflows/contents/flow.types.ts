export interface StencilInfos {
  type: string
  category: { id: string; name: string }[]
}

export interface FlowInfos {
  type: string
  topic: string
  //
  flowID: string
  name: string
  //
  datas: any
  //
  nodes: any[]
  edges: any[]
}

export interface NodeInfos {
  id: string
  shape: string
  label: string
  //
  width: number
  height: number
  x?: number
  y?: number
  //
  data: NodeData
  ports: PortInfos[]
}

export interface NodeData {
  id: string
  name: string
  flowID: string
  // 用于区分在拖拽区还是画布中
  isStencil: boolean
  // 类别
  type: string
  category: {
    id: string
    name: string
  }
  // 前置信息
  preCheck: string // none |single |double |multi
  preInfos: PreInfos[]
  // 与flow共享数据
  datas: any
  // 自身所需参数
  params: any
  // 运行结果
  model: string // normal |show |read |root |leaf
  status: string // initial |ready |running |success |error
  resultID: string | null
  result: any
}
export interface PreInfos {
  id: string
  resultID: string | null
}
export interface PortInfos {
  id: string
  group: string
}
