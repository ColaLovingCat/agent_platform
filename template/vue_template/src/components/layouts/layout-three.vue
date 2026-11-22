<script lang="ts" setup>
import { onMounted, ref, computed, watch, reactive } from 'vue'

import { useSystemInfosStore } from '@/commons/stores/index'
const systemInfosStore = useSystemInfosStore()

import menuItem from './menu-item.vue'
import type { MenuInfos } from '@/commons/types/datas.types'

// name
defineOptions({
  name: 'layout-three'
})

// props
const props = defineProps({
  datas: {
    type: Array as () => Array<MenuInfos>,
    default: () => ([])
  },
  status: {
    type: Boolean,
    default: true
  }
})

const pageInfos = reactive({
  collapsed: false
})

onMounted(() => { })

const current = ref<string[]>(['mail'])
const headerStatus = computed(() => props.status)

const menus = ref(props.datas)
watch(
  () => props.datas,
  (newValue, oldValue) => {
    menus.value = newValue
  }
)
</script>

<template>
  <a-layout class="pages page-three">
    <a-layout-sider v-if="systemInfosStore.systemStatus.siderShow" v-model:collapsed="pageInfos.collapsed" :trigger="null" collapsible>
      <div class="sider-logo">
        <slot v-if="pageInfos.collapsed" name="logos-mini"></slot>
        <slot v-else name="logos"></slot>
      </div>
      <div class="menus">
        <a-menu v-model:selectedKeys="current" mode="inline">
          <template v-for="item in menus" :key="item.key">
            <menuItem :item="item">
            </menuItem>
          </template>
        </a-menu>
      </div>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="page-header" v-if="headerStatus">
        <div class="headers">
          <div class="logos">
            <div class="btn-sider" @click="() => (pageInfos.collapsed = !pageInfos.collapsed)">
              <i class="fa-solid fa-bars"></i>
            </div>
          </div>
          <div class="infos">
            <slot name="infos"></slot>
          </div>
        </div>
      </a-layout-header>
      <a-layout-content class="page-contents" :class="headerStatus ? '' : 'full'">
        <router-view></router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="scss">
.ant-layout .ant-layout-sider {
  background: #fff;
}

.menus {
  height: 60px;
  line-height: 60px;
}
</style>
