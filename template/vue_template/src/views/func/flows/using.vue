<script lang="ts" setup>
import { ref, type Ref, reactive, onMounted } from 'vue'
import { useQueryChange } from '@/commons/hooks/useQueryChange'

import Workflow from '@/components/workflows/flows.vue'

import * as extend from '@/commons/utils/extends'

// name
defineOptions({
  name: 'app-workflows'
})

onMounted(async () => {
  await getlistFunc()
  await refreshData()
  pageInfos.changeMark = !pageInfos.changeMark
})

const pageInfos = reactive({
  loading: 0,
  changeMark: false,
})

// 工具栏节点
interface Stencil {
  type: string;
  category: { id: string, name: string }[]
}
const stencils: Ref<Stencil[]> = ref([])
const getlistFunc = async () => {
  stencils.value = [
    {
      type: "触发方式",
      category: [
        {
          id: "Trigger_Manually",
          name: "手动触发",
        },
        {
          name: "计划任务",
          id: "Trigger_Schedule",
        },
        {
          id: "Trigger_WebCall",
          name: "API请求",
        },
        {
          id: "Trigger_Chat",
          name: "聊天信息",
        },
      ]
    },
    {
      type: "数据输入",
      category: [
        {
          id: "Data_Input_Const",
          name: "常量参数",
        },
        {
          id: "Data_Input_File",
          name: "文件上传",
        },
        {
          id: "Data_Input_SQL",
          name: "数据库",
        },
        {
          id: "Data_Input_HTTP_Request",
          name: "HTTP请求",
        },
      ]
    },
    {
      type: "逻辑节点",
      category: [
        {
          id: "Logi_If",
          name: "判断",
        },
        {
          id: "Logi_Switch",
          name: "分支",
        },
        {
          id: "Logi_Merge",
          name: "分支合并",
        },
        {
          id: "Logi_Loops",
          name: "循环",
        },
        {
          id: "Logi_Loops_Continue",
          name: "循环继续",
        },
        {
          id: "Logi_Loops_Break",
          name: "循环中止",
        },
        {
          id: "Logi_Error_Output",
          name: "错误输出",
        },
      ]
    },
    {
      type: "数据处理",
      category: [
        {
          id: "Data_Process_Filter",
          name: "筛选",
        },
        {
          id: "Data_Process_Sort",
          name: "排序",
        },
        {
          id: "Data_Process_Remove_Duplicates",
          name: "去重",
        },
        {
          id: "Data_Process_Summarize",
          name: "聚合",
        },
        {
          id: "Data_Process_Code",
          name: "代码处理",
        },
      ]
    },
    {
      type: "数据输出",
      category: [
        {
          id: "Data_Output_Data",
          name: "数据输出",
        },
        {
          id: "Data_Output_File",
          name: "文件下载",
        },
      ]
    },
  ]
}

// 加载原始数据
const flowInfos = ref({
  type: '',
  topic: '工作流',
  flowID: '',
  name: '',
  datas: {},
  nodes: [],
  edges: []
})
const refreshData = async () => {
  const flowId = extend.ExWeb.query('flow_id')
  if (flowId) {
    // 获取历史数据
    flowInfos.value.flowID = flowId
    await getinfosWorkflow()
  } else {
    flowInfos.value.flowID = extend.ExString.uuid()
    flowInfos.value.name = 'newFlow01'
    // 选择模板
    showModal('template', {})
  }
}
const getinfosWorkflow = async () => {
  Object.assign(flowInfos.value, {
    type: '',
    topic: '工作流',
    flowID: '12345678',
    name: 'Test Flow',
    datas: {},
    nodes: [
      {
        "id": "c810da9f-dbe3-49ca-a60d-7cd3c9924717",
        "flowID": "12345678",
        "type": "触发方式",
        "category": {
          "name": "计划任务",
          "id": "Trigger_Schedule"
        },
        "name": "",
        "params": {
          "taskName": "test",
          "interval": "Seconds",
          "value": 12,
          "day": null,
          "weeks": [],
          "hour": null,
          "minute": null
        }
      },
      {
        "id": "68f1a5ba-eab3-46f9-8976-2221b8d29834",
        "flowID": "12345678",
        "type": "数据输入",
        "category": {
          "id": "Data_Input_Const",
          "name": "常量参数"
        },
        "name": "",
        "params": {}
      },
      {
        "id": "00e7a863-1f9b-47aa-b0a0-b67b220ab535",
        "flowID": "12345678",
        "type": "逻辑节点",
        "category": {
          "id": "Logi_Switch",
          "name": "分支"
        },
        "name": "",
        "params": {}
      },
      {
        "id": "9878f61c-d3ed-4a56-8aca-87cdbf33b853",
        "flowID": "12345678",
        "type": "数据输出",
        "category": {
          "id": "Data_Output_Data",
          "name": "数据输出"
        },
        "name": "",
        "params": {}
      }
    ],
    edges: [
      {
        "id": "e500fb11-34e6-4166-acec-44c99d36003a",
        "source": {
          "cell": "c810da9f-dbe3-49ca-a60d-7cd3c9924717",
          "port": "right"
        },
        "target": {
          "cell": "68f1a5ba-eab3-46f9-8976-2221b8d29834",
          "port": "left"
        }
      },
      {
        "id": "21b6a5b8-641a-4c80-8c36-32fe17625ce9",
        "source": {
          "cell": "68f1a5ba-eab3-46f9-8976-2221b8d29834",
          "port": "right"
        },
        "target": {
          "cell": "00e7a863-1f9b-47aa-b0a0-b67b220ab535",
          "port": "left"
        }
      },
      {
        "id": "758dd7ca-2d50-4b9b-92f3-47abd0d809a0",
        "source": {
          "cell": "00e7a863-1f9b-47aa-b0a0-b67b220ab535",
          "port": "right"
        },
        "target": {
          "cell": "9878f61c-d3ed-4a56-8aca-87cdbf33b853",
          "port": "left"
        }
      }
    ]
  })
}

// 保存数据
const onSave = async () => {
  console.log('Testing: ', flowInfos.value)
}

const handleCustomEvent = async ({ action, datas }: { action: string, datas: any }) => {
  console.log('Testing: ', action, datas)
}

//
useQueryChange(
  async (newQuery, oldQuery) => {
    await refreshData()
    pageInfos.changeMark = !pageInfos.changeMark
  },
  ['flow_id']
)
const onCopy = async (flowID: string) => {
  console.log('[flow] copy: ', flowID)
}

const templateModal = ref(false)
const setTemplate = async (data: any | null) => {
  templateModal.value = false

  if (data) {
    // if (data.name) {
    //   flowInfos.name = data.name
    // }
    // try {
    //   const resp: any = await current.template_create({
    //     function_name: flowInfos.topic,
    //     template_id: data.id
    //   })
    //   const { status, result } = resp

    //   if (status === 1 && result) {
    //     processWorkflowData({
    //       ...result,
    //       nodes: (result.nodes ?? []).map((node: any) => ({
    //         flowID: pageInfos.flowID,
    //         ...node
    //       })),
    //       edges: (result.edges ?? []).map((edge: any) => {
    //         if (edge.sourceID || edge.targetID) {
    //           return {
    //             source: {
    //               cell: edge.sourceID,
    //               port: 'right'
    //             },
    //             target: {
    //               cell: edge.targetID,
    //               port: 'left'
    //             }
    //           }
    //         }

    //         return edge
    //       })
    //     })
    //   }
    // } catch (error) {
    //   console.error(error)
    // }
  }
}

const showModal = (action: string, values: any) => {
  switch (action) {
    case 'template': {
      templateModal.value = true
      break
    }
    default: {
      break
    }
  }
}
</script>

<template>
  <Workflow ref="workflow" :stencils="stencils" v-model:datas="flowInfos" :change-mark="pageInfos.changeMark"
    @save="onSave" @custom-event="handleCustomEvent" @copy="onCopy"></Workflow>
</template>

<style scoped lang="scss"></style>
