<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue'

import menuItem from './menu-item.vue'
import type { MenuInfos } from '@/commons/types/datas.types'

// name
defineOptions({
  name: 'custom-name'
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
  <a-layout class="pages" :class="headerStatus ? '' : 'full'">
    <a-layout-header class="page-header" v-if="headerStatus">
      <div class="headers">
        <div class="logos">
          <slot name="logos"></slot>
        </div>
        <div class="menus menus-inline">
          <a-menu v-model:selectedKeys="current" mode="horizontal">
            <template v-for="item in menus" :key="item.id">
              <menuItem :item="item">
              </menuItem>
            </template>
          </a-menu>
        </div>
        <div class="infos">
          <slot name="infos"></slot>
        </div>
      </div>
    </a-layout-header>
    <a-layout-content class="page-contents">
      <router-view></router-view>
    </a-layout-content>
  </a-layout>
</template>

<style scoped lang="scss">
.menus {
  height: 60px;
  line-height: 60px;
}
</style>
