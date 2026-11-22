<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'

import { configComponentMap } from '@/views/func/flows/modules'

// name
defineOptions({
  name: 'flows-configs'
})

// props
const props = defineProps({
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
const emit = defineEmits<{
  // 刷新参数
  (event: 'updateParams', values: { id: string, params: any, mark: boolean }): void
  // 刷新结果
  (event: 'updateResult', values: { id: string, resultID: string }): void
  // 刷新过程参数
  (event: 'updateFlowData', values: { id: string, datas: any }): void
  // 自定义事件
  (event: 'customEvent', values: { action: string, datas: any }): void
}>()

const configInfos = reactive({
  changeMark: false,
})

const currentComponent = ref()
onMounted(() => {
  // 加载对应的配置表单
  if (props.datas.category?.id) {
    const id = props.datas.category.id.toLowerCase()
    currentComponent.value = configComponentMap[id]
    //
    configInfos.changeMark = !configInfos.changeMark
  } else {
    currentComponent.value = null
  }
})
</script>

<template>
  <component v-if="currentComponent" :is="currentComponent" :datas="datas" @update-params="emit('updateParams', $event)"
    @update-result="emit('updateResult', $event)" @update-flow-data="emit('updateFlowData', $event)"
    @custom-event="emit('customEvent', $event)" />
  <div v-else>
    暂无对应配置组件
  </div>
</template>

<style scoped lang="scss"></style>
