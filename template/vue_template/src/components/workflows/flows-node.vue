<script lang="ts">
import { getIcon } from '@/views/func/flows/modules'

export default {
  name: 'vueNode',
  inject: ['getNode'], // x6使用依赖注入向vue节点传递数据
  data() {
    return {
      datas: null as any
    }
  },
  methods: {
    getIcon(category: string) {
      return getIcon(category)
    }
  },
  created() {
    //@ts-ignore
    const node = this.getNode()
    if (node) {
      this.datas = node.store.data.data

      // 监听 `change:data` 事件
      node.on('change:data', ({ current }: any) => {
        this.datas = current
      })
    }
  }
}
</script>

<template>
  <div class="flow-node" :class="datas.isStencil ? 'thmub' : ''">
    <!-- Header -->
    <div class="item-header">
      <div class="item-titles">
        <div class="item-icon">
          <i class="fa-solid" :class="getIcon(datas.type)"></i>
        </div>
        <div class="item-title">{{ datas.type }}</div>
      </div>
      <div class="item-btns">
        <button type="button" class="btn btn-run" v-if="datas.model == 'normal' || datas.model == 'read'"
          v-bind:disabled="datas.status == 'running'">
          <i class="fa-solid fa-play btn-run"> </i>
        </button>
        <button type="button" class="btn btn-configs"
          v-if="datas.model == 'normal' || datas.model == 'show' || datas.model == 'root' || datas.model == 'param'">
          <i class="fa-solid fa-gear btn-configs"></i>
        </button>
      </div>
    </div>
    <!-- Content -->
    <div class="item-contents">
      <div class="item-category" :class="`item-${datas.status}`">
        <div class="item-txt">
          <div class="item-icon">
            <i class="fa-solid" :class="getIcon(datas.category.id)"></i>
          </div>
          {{ datas.category.name }}
        </div>
        <!-- Status -->
        <div class="item-status" v-if="datas.model == 'normal' || datas.model == 'read'">
          <div v-show="datas.status == 'initial'" class="item-initial">
            <i class="fa-solid fa-spinner"></i>
          </div>
          <div class="item-loading" v-show="datas.status == 'running'">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div v-show="datas.status == 'success'" class="item-success">
            <i class="fa-solid fa-check"> </i>
          </div>
          <div v-show="datas.status == 'error'" class="item-error">
            <i class="fa-solid fa-close"> </i>
          </div>
        </div>
      </div>
    </div>
    <!-- Name -->
    <div class="item-rename">
      <button type="button" class="btn btn-rename">
        <i class="fa-solid fa-circle-info btn-rename"></i>
      </button>
      <div class="item-name txts-nowrap" v-if="datas.name && datas.name != ''" :title="datas.name">
        {{ datas.name }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import url(./contents/flow-nodes.scss);
</style>
