<script lang="ts" setup>
import { ref, reactive, onMounted, watch } from 'vue'

import type { StencilInfos, FlowInfos, NodeData } from './contents/flow.types'
import { useGraph, useStencil } from './contents/useGraph'
import { getEdge, getNode, runNodeMap } from '@/views/func/flows/modules'
//@ts-ignore
import dagre from 'dagre'

import flowConfigs from './flows-configs.vue'

import * as messages from '@/commons/utils/messages'

// name
defineOptions({
  name: 'app-flows'
})

// props
const props = defineProps({
  stencils: {
    type: Array as () => StencilInfos[],
    default: () => []
  },
  datas: {
    type: Object,
    default: () => ({})
  },
  changeMark: {
    type: Boolean,
    require: false
  }
})

// emits
const emits = defineEmits<{
  (event: 'update:datas', values: any): void
  (event: 'save'): void
  (event: 'customEvent', values: { action: string; datas: any }): void
  (event: 'copy', id: string): void
}>()

let graph: any
let stencil: any = null
const graphRef: any = ref(null)
const stencilRef: any = ref(null)

const pageInfos = reactive({
  debug: true,
  anyChange: false,
  loading: 0
})
const flowInfos: FlowInfos = reactive({
  type: '',
  topic: '',
  flowID: '',
  name: '',
  datas: null as any,
  nodes: [] as any[],
  edges: [] as any[]
})

onMounted(() => {
  // 初始化
  graph = useGraph(graphRef.value)
  bindGrapgEvents()
  stencil = useStencil(graph, stencilRef.value)
})
watch(
  () => props.changeMark,
  (newValue, oldValue) => {
    clearStencil()
    refreshFuncs()
    //
    clearFlow()
    refreshData(props.datas)
  }
)

//#region Initial
// 绑定事件
const bindGrapgEvents = () => {
  // 监听 edge
  graph.on('edge:added', ({ edge }: any) => {
    console.log('[Flow] edge add:', edge.id)
  })
  // 验证连接是否有效
  graph.on('edge:connected', ({ isNew, edge }: any) => {
    console.log('[Flow] edge connect:', edge.id)
    if (isNew) {
      // 检测端口输出
      if (edge.source.port != 'right' || edge.target.port != 'left') {
        graph.removeEdge(edge)
        messages.showError('只能连接节点的 右端口 → 左端口')
        return
      }
      if (edge.source.cell == edge.target.cell) {
        graph.removeEdge(edge)
        messages.showError('只能连接不同节点的端口')
        return
      }

      // 获取信息
      const sourceCell = graph.getCellById(edge.source.cell)
      const sourceData = sourceCell.getData() as NodeData
      const targetCell = graph.getCellById(edge.target.cell)
      if (!targetCell) return
      const targetData = targetCell.getData() as NodeData

      // 检查是否已超出限制
      const limit = targetData.preCheck == 'single' ? 1 : targetData.preCheck == 'double' ? 2 : 999
      if (targetData.preInfos.length >= limit) {
        graph.removeEdge(edge)
        messages.showError('已超过最大连接限制')
        return
      }

      // 更新
      targetData.preInfos = [
        {
          id: sourceData.id,
          resultID: sourceData.resultID
        },
        ...targetData.preInfos
      ]
      targetCell.setData({ ...targetData }, { overwrite: true })
      console.log('[Flow] update preinfo:', targetData)
    }
  })
  // 监听连接断开
  graph.on('edge:removed', ({ edge }: any) => {
    console.log('[Flow] edge remove:', edge.id)

    // 获取连接的节点
    const targetCell = graph.getCellById(edge.target.cell)
    if (!targetCell) return
    const targetData = { ...(targetCell.getData() as NodeData) }

    // 更新
    targetData.preInfos = targetData.preInfos.filter((a: any) => a.id !== edge.source.cell).slice()
    targetCell.setData(
      {
        ...targetData
      },
      { overwrite: true }
    )
    console.log('[Flow] update preinfo:', targetData)
  })

  // 监听 node
  graph.on('node:added', ({ node }: any) => {
    console.log('[Flow] node add:', node.id)
    // 设置新状态
    node.setData({
      id: node.id,
      flowID: flowInfos.flowID,
      isStencil: false,
      status: 'initial'
    })
    // 设置新的宽高
    node.resize(250, 100)
  })
  graph.on('node:removed', ({ node }: any) => {
    console.log('[Flow] node remove:', node.id)
    if (Object.prototype.hasOwnProperty.call(flowInfos.datas, node.id)) {
      delete flowInfos.datas[node.id]
      console.log(`[Flow] removed flow data ${node.id}`)
      //
      pageInfos.anyChange = true
    }
  })

  // 监听 data
  graph.on('node:change:data', ({ node }: any) => {})

  // 监听 点击事件
  graph.on('node:click', ({ node, e }: any) => {
    console.log('[Flow] click node:', node.id)
    const nodeDatas: NodeData = node.getData() // 获取节点的 data 数据
    const target = e.target

    // 配置
    if (target.classList.contains('btn-configs')) {
      console.log('[Flow] config node:', node.id)
      // 展示配置窗口
      showModal('configs', {
        ...nodeDatas
      })
      return
    }

    // 开始任务
    if (target.classList.contains('btn-run')) {
      console.log('[Flow] run node:', node.id)
      start(nodeDatas.id)
      return
    }

    // 重命名
    if (target.classList.contains('btn-rename')) {
      console.log('[Flow] run rename:', node.id)
      showModal('rename', { id: nodeDatas.id })
      return
    }
  })
}
// 自动布局
const autoLayout = () => {
  // 创建一个新的 Dagre 图
  const g: any = new dagre.graphlib.Graph()

  // 设置图的全局布局属性
  // rankdir: 布局方向（例如：'TB' 表示从上到下）
  // nodesep: 节点之间的水平间距
  // ranksep: 节点之间的垂直间距
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 150 })

  // 设置边的默认标签（此处为空对象）
  g.setDefaultEdgeLabel(() => ({}))

  // 获取图中的所有节点和边
  const nodes = graph.getNodes()
  const edges = graph.getEdges()

  // 定义节点的宽度和高度
  const width = 260
  const height = 90

  // 为每个节点在 Dagre 图中设置节点信息（包括宽度和高度）
  nodes.forEach((node: any) => {
    g.setNode(node.id, { width, height })
  })

  // 为每条边在 Dagre 图中设置边信息
  edges.forEach((edge: any) => {
    const source = edge.getSource() // 获取边的源节点
    const target = edge.getTarget() // 获取边的目标节点
    g.setEdge(source.cell, target.cell) // 在 Dagre 图中设置边
  })

  // 执行 Dagre 布局
  dagre.layout(g)

  // 更新每个节点的位置
  g.nodes().forEach((id: any) => {
    const node = graph.getCellById(id) // 获取节点对象
    if (node) {
      const pos = g.node(id) // 获取节点的布局位置
      // node.position(pos.x, pos.y) // 设置节点的位置
      node.setProp('position', pos) // New
    }
  })

  // 居中
  graph.centerContent()
}

//
const stencilGroups: any = ref([])
const clearStencil = () => {
  stencilGroups.value.forEach((groupName: any) => {
    stencil.removeGroup(groupName)
  })
  stencilGroups.value = []
}
// 工具栏刷新节点
const refreshFuncs = () => {
  clearStencil()
  //
  if (props.stencils && props.stencils.length > 0) {
    props.stencils.map((item: any) => {
      const newGroup = {
        name: item.type,
        title: item.type,
        graphHeight: 60 * item.category.length + 20
      }
      stencilGroups.value.push(newGroup.name)
      stencil.addGroup(newGroup)
      //
      let temp: any = []
      item.category.map((category: any) => {
        let node = getNode(item.type, category)
        temp.push(graph.createNode(node))
      })
      stencil.load(temp, item.type)
    })
  }
}
// 将保存的数据格式化为flow的数据
const clearFlow = () => {
  flowInfos.flowID = ''
  flowInfos.name = ''
  flowInfos.datas = {}
  //
  graph.clearCells()
}
const refreshData = (data: any) => {
  flowInfos.type = data.type ?? ''
  flowInfos.topic = data.topic ?? ''

  flowInfos.flowID = data.flowID
  flowInfos.name = data.name ?? ''
  flowInfos.datas = data.datas ?? {}

  const nodes = data.nodes ?? []
  nodes.forEach((item: any) => {
    const node: any = {
      ...getNode(item.type, item.category),
      id: item.id
    }
    Object.assign(node.data, item)
    //
    graph.addNode(node)
  })
  const edges = data.edges ?? []
  edges.forEach((item: any) => {
    graph.addEdge({
      ...getEdge(),
      id: item.id,
      source: item.source,
      target: item.target
    })

    const targetID = item.target.cell
    const sourceID = item.source.cell
    if (targetID && sourceID) {
      const node = graph.getCellById(targetID)

      if (node) {
        const nodeData = node.getData() as NodeData

        const preInfos = [
          ...(nodeData.preInfos ?? []),
          {
            id: sourceID,
            resultID: null
          }
        ]

        node.setData({
          preInfos
        })
      }
    }
  })

  //
  autoLayout()
}
//#endregion

// Run节点 & 状态更新
const start = async (id: string) => {
  const node = graph.getCellById(id)
  const nodeData: NodeData = node.getData() as NodeData
  //
  if (node) {
    // 检查前置信息
    const check = refreshNodePre(id)
    if (!check.status) {
      messages.showError(check.message)
      return false
    }

    // 设置running
    node.setData({ status: 'running' })
    // 获取方法名 & 调整参数
    const fn = runNodeMap[nodeData.category.id.toLowerCase()]
    let resp = await fn(nodeData, nodeData.params)
    console.log('[Flow] run infos: ', resp)
    const { status, result } = resp
    if (status == 1) {
      // 结束状态，记录结果
      updateResult({
        id: id,
        resultID: result.node_data_id
      })
      return true
    } else {
      messages.showError(result)
      //
      node.setData({
        status: 'error'
      })
      return false
    }
  }
}
// 检查前置节点 & 刷新前置信息
const refreshNodePre = (nodeID: string) => {
  let node = graph.getCellById(nodeID)
  let nodeData = node.getData() as NodeData

  let result = {
    status: true,
    message: ''
  }

  // 检查 前置信息所需数量
  switch (nodeData.preCheck) {
    case 'single':
    case 'double': {
      const limit = nodeData.preCheck == 'single' ? 1 : 2
      if (nodeData.preInfos.length < limit) {
        result.status = false
        result.message += nodeData.preCheck + ' 前置信息未设置完成！\r\n'
      }
      if (nodeData.preInfos.length > limit) {
        result.status = false
        result.message += nodeData.preCheck + ' 前置信息设置超出限制！\r\n'
      }
      break
    }
    case 'multi': {
      if (nodeData.preInfos.length < 2) {
        result.status = false
        result.message += nodeData.preCheck + ' 前置信息未设置完成！\r\n'
      }
      break
    }
    default: {
      break
    }
  }
  console.log('[Flow] check pre/length:', nodeData.preCheck, nodeData.preInfos.length)

  // 检查 前置节点是否完成 resultID
  const temp = [...nodeData.preInfos]
  temp.map((item: any) => {
    let source = graph.getCellById(item.id)
    const sourceData = source.getData() as NodeData
    //
    item.resultID = sourceData.resultID
    // 告知后一个节点我的数据存在flow里
    if (sourceData.model == 'root') {
      item.resultID = item.id
    }
    //
    if (!item.resultID) {
      result.status = false
      result.message += '前置节点未完成结果！\r\n'
    }
    console.log('[Flow] check pre node data:', sourceData)
    console.log('[Flow] check pre id/resultID:', item.id, item.resultID)
  })
  // 刷新 前置信息
  node.setData({
    preInfos: [...temp]
  })
  //
  return result
}

//#region Update Events
// 更新参数
const updateParams = (values: { id: string; params: any; mark: boolean }) => {
  console.log('[Flow] update params: ', values)
  const node = graph.getCellById(values.id)
  // node.setData({
  //   params: { ...values.params }
  // })
  const currentData = node.getData() || {}
  // 创建新的 data
  const newData = { ...currentData }
  // 通用处理每个字段
  for (const key in values.params) {
    const val = values.params[key]
    // 如果是数组，直接覆盖，而不是累加
    if (Array.isArray(val)) {
      newData.params[key] = [...val]
    } else if (typeof val === 'object' && val !== null) {
      newData.params[key] = { ...val }
    } else {
      newData.params[key] = val
    }
  }
  // 直接 overwrite
  node.setData(newData, { overwrite: true })
  //
  if (values.mark) {
    configDraw.value = false
  }
  //
  syncData()
}
// 更新结果
const updateResult = (values: { id: string; resultID: string }) => {
  console.log('[Flow] update result: ', values)
  const node = graph.getCellById(values.id)
  node.setData({
    status: 'success',
    resultID: values.resultID.toString()
  })
  //
  syncData()
}
// 更新flow datas
const updateFlowData = (values: { id: string; datas: any }) => {
  console.log('[Flow] update flow/datas: ', values)
  flowInfos.datas[values.id] = values.datas
  //
  syncData()
}
// 自定义事件
const customEvent = (values: { action: string; datas: any }) => {
  syncData()
  //
  console.log('[Flow] custom event: ', values)
  emits('customEvent', values)
}
//#endregion

// 工具栏
const flowNameForm: any = ref(null)

// Run
let nodeMap = new Map()
const onRun = () => {
  // 获取所有节点的列表
  const allNodes = graph.getNodes()
  allNodes.map((node: any) => {
    const nodeData = node.getData()
    if (nodeData.model != 'show') {
      nodeMap.set(nodeData.id, {
        preCheck: nodeData.preCheck,
        preCount: nodeData.preInfos.length,
        preReady: 0
      })
    }
  })
  // 开始 none 节点
  nodeMap.forEach((value, key) => {
    if (value.preCheck == 'none') {
      runNode(key)
    }
  })
}
const runNode = async (id: string) => {
  let nodeInfos = nodeMap.get(id)
  //
  if (nodeInfos.preCount == nodeInfos.preReady) {
    const result = await start(id)
    if (result) {
      let node = graph.getCellById(id)
      const outgoingEdges = graph.getOutgoingEdges(node)
      if (outgoingEdges) {
        // 遍历出边，获取目标节点
        outgoingEdges.forEach((edge: any) => {
          const targetID = edge.getTargetCellId()
          // 节点在Map中 且 节点真实存在
          if (nodeMap.has(targetID) && graph.getCellById(targetID)) {
            nodeMap.get(targetID).preReady += 1
            //
            runNode(targetID)
          }
        })
      }
    }
  }
}

// Save
const onSave = () => {
  syncData()
  //
  emits('save')
  pageInfos.anyChange = false
}
const syncData = () => {
  const flowDatas = formatFlowDatas()
  emits('update:datas', flowDatas)
  console.log('[Flow] sync datas: ', flowDatas)
  //
  pageInfos.anyChange = true
}
// 将flow的数据处理成存储的格式
const formatFlowDatas = () => {
  const sourceNodes = graph.getNodes()
  const sourceEdges = graph.getEdges()
  //
  const nodes = sourceNodes.map((node: any) => {
    const data = node.getData() as NodeData
    return {
      id: node.id,
      flowID: flowInfos.flowID,
      type: data.type,
      category: data.category,
      name: data.name,
      params: data.params,
      resultID: data.resultID
    }
  })
  //
  const edges = sourceEdges.map((edge: any) => {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target
    }
  })

  return {
    ...flowInfos,
    nodes,
    edges
  }
}

const onCopy = () => {
  messages.showConfirm(
    { title: 'Copy Flow', message: 'Operation will create a new flow, please confirm' },
    (resp: boolean) => {
      if (resp) {
        emits('copy', flowInfos.flowID)
      }
    }
  )
}

//#region Rename Node Modal
const renameModal = ref(false)
const renameInfos = reactive({
  id: '',
  name: ''
})
const updateName = () => {
  if (renameInfos.name != '') {
    const node = graph.getCellById(renameInfos.id)
    node.setData({
      name: renameInfos.name
    })
    renameModal.value = false
  }
}
//#endregion

//#region Configs Modal
const configDraw = ref(false)
const configMark = ref(false)
let configForm: any = reactive({})
//#endregion

// Debug
const onDebug = (action: string) => {
  switch (action) {
    case 'save': {
      console.log('[Debug] save: ', formatFlowDatas())
      break
    }
    case 'flow': {
      console.log('[Debug] flow: ', flowInfos)
      break
    }
    case 'clear': {
      flowInfos.datas = {}
      console.log('[Debug] clear: ', flowInfos)
      break
    }
    case 'clearAll': {
      clearStencil()
      clearFlow()
      break
    }
    case 'log': {
      showModal('log', {})
      break
    }
    default: {
      break
    }
  }
}

// Modal
const showModal = (action: string, values: any) => {
  const nodeID = values.id
  switch (action) {
    case 'configs': {
      // 需要前置信息
      if (values.preCheck != 'none') {
        const check = refreshNodePre(nodeID)
        if (!check.status) {
          messages.showError(check.message)
          return false
        }
      }
      // 获取最新数据
      let node = graph.getCellById(nodeID)
      let nodeData = node.getData() as NodeData
      // 同步flow数据
      if (values.model == 'root' || values.model == 'param') {
        let dataID = values.model == 'root' ? nodeID : values.preInfos[0].resultID
        let datas = flowInfos.datas[dataID]
        console.log('[Flow] from flow data: ', datas)
        if (datas) {
          Object.assign(nodeData.params, datas)
        }
      }
      //
      configForm = reactive({ ...nodeData })
      configMark.value = !configMark.value
      //
      configDraw.value = true
      break
    }
    case 'rename': {
      renameInfos.id = nodeID
      renameInfos.name = ''
      //
      renameModal.value = true
      break
    }
    default: {
      break
    }
  }
}
</script>

<template>
  <div class="view-workflows">
    <!-- 工具栏 -->
    <div class="flows-left">
      <div class="title">
        <slot name="home-btn"></slot>
        <span>{{ flowInfos.topic }}</span>
      </div>
      <div ref="stencilRef" class="container-stencil"></div>
    </div>

    <!-- 画布 -->
    <div class="flows-right">
      <div ref="graphRef" class="container"></div>
    </div>

    <!-- 编辑工具 -->
    <div class="flows-tools">
      <div class="btns">
        <div class="item-name">
          <a-input
            ref="flowNameForm"
            placeholder="名称"
            v-model:value="flowInfos.name"
            size="small"
            :bordered="false"
          />
        </div>
        <a-tooltip>
          <template #title>重命名</template>
          <button type="button" class="btn btn-tools" @click="flowNameForm?.focus()">
            <i class="fa-solid fa-edit"></i>
          </button>
        </a-tooltip>
        <a-tooltip>
          <template #title>自动布局</template>
          <button type="button" class="btn btn-tools" @click="autoLayout">
            <i class="fa-solid fa-layer-group"></i>
          </button>
        </a-tooltip>
        <a-tooltip>
          <template #title>运行</template>
          <button type="button" class="btn btn-tools" @click="onRun">
            <i class="fa-solid fa-play"></i>
          </button>
        </a-tooltip>
        <a-tooltip>
          <template #title>保存</template>
          <a-badge>
            <template #count>
              <div class="icon-changed" v-if="pageInfos.anyChange">
                <i class="fa-solid fa-exclamation"></i>
              </div>
              <div v-else></div>
            </template>
            <button type="button" class="btn btn-tools" @click="onSave">
              <i class="fa-solid fa-floppy-disk"></i>
            </button>
          </a-badge>
        </a-tooltip>
        <a-tooltip>
          <template #title>复制</template>
          <button type="button" class="btn btn-tools" @click="onCopy">
            <i class="fa-solid fa-copy"></i>
          </button>
        </a-tooltip>
        <a-dropdown placement="top" v-if="pageInfos.debug">
          <button type="button" class="btn btn-tools">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </button>
          <template #overlay>
            <a-menu>
              <a-menu-item> 调试工具 </a-menu-item>
              <a-menu-item>
                <a target="_blank" rel="noopener noreferrer" @click="onDebug('save')">
                  获取 保存数据
                </a>
              </a-menu-item>
              <a-menu-item>
                <a target="_blank" rel="noopener noreferrer" @click="onDebug('flow')">
                  获取 flow数据
                </a>
              </a-menu-item>
              <a-menu-item>
                <a target="_blank" rel="noopener noreferrer" @click="onDebug('clear')">
                  清除 flow数据
                </a>
              </a-menu-item>
              <a-menu-item>
                <a target="_blank" rel="noopener noreferrer" @click="onDebug('clearAll')">
                  清空 flow
                </a>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
      <!-- 额外按钮组 -->
      <slot name="ex-btns"></slot>
    </div>

    <div class="loading" v-if="pageInfos.loading > 0"></div>
  </div>

  <!-- Configs -->
  <a-drawer
    v-model:open="configDraw"
    :maskClosable="false"
    :destroy-on-close="true"
    placement="right"
    :title="configForm.category?.name"
    width="70%"
    root-class-name="drawer-configs"
  >
    <flowConfigs
      :datas="configForm"
      :change-mark="configMark"
      @update-params="updateParams"
      @update-result="updateResult"
      @update-flow-data="updateFlowData"
      @custom-event="customEvent"
    ></flowConfigs>
  </a-drawer>

  <!-- Rename -->
  <a-modal v-model:open="renameModal" width="500px" title="Rename" @ok="updateName">
    <a-input v-model:value="renameInfos.name" placeholder="new name" />
  </a-modal>
</template>

<style scoped lang="scss">
.view-workflows {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;

  .flows-left {
    position: relative;
    margin: 20px 10px;
    width: 350px;
    border-radius: 10px;
    box-shadow:
      rgba(9, 30, 66, 0.25) 0px 4px 8px -2px,
      rgba(9, 30, 66, 0.08) 0px 0px 0px 1px;
    display: flex;
    flex-direction: column;

    .title {
      position: absolute;
      top: 0;
      z-index: 1;
      width: 100%;
      height: 60px;
      font-size: 21px;
      font-weight: 700;
      border-radius: 10px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container-stencil {
      flex: 1;
      overflow: auto;
    }
  }

  .flows-right {
    flex: 1;

    .container {
      width: 100%;
      height: 100%;
    }
  }

  .flows-tools {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;

    .btns {
      padding: 5px 10px;
      border-radius: 0 5px;
      background: #fff;
      box-shadow:
        rgba(9, 30, 66, 0.25) 0px 4px 8px -2px,
        rgba(9, 30, 66, 0.08) 0px 0px 0px 1px;
      display: flex;
      align-items: center;
      gap: 10px;

      .item-name {
        min-width: 120px;
        border-bottom: 1px dashed #0000007d;
      }

      .icon-changed {
        width: 16px;
        height: 16px;
        text-align: center;
        color: #fff;
        font-size: 14px;
        line-height: 16px;
        font-weight: 700;
        border-radius: 50%;
        background: #ff4d4f;
      }

      .btn {
        cursor: pointer;
        padding: 5px;
        font-size: 16px;
        border: unset;
        background: unset;
      }
    }
  }
}
</style>
