<script lang="ts">
import { reactive, defineComponent } from 'vue'

import { MenuClass } from '@/commons/types/datas.types'

export default defineComponent({
  name: 'menu-item',
  props: {
    item: {
      type: MenuClass,
      require: true
    }
  },
  components: {},
  emits: [],
  setup(props, { emit }) {
    const item: any = reactive(props.item || {})

    return {
      item
    }
  }
})
</script>

<template>
  <template v-if="item.children">
    <!-- 多层级菜单 -->
    <a-sub-menu :key="item.key">
      <template #title>
        <template v-if="item.icon">
          <span role="img" aria-label="user" class="anticon">
            <i class="fa-solid" :class="item.icon"></i>
          </span>
        </template>
        <template v-if="item.lang">
          <span>{{ $t(item.lang) }}</span>
        </template>
        <template v-else>
          <span>{{ item.title }}</span>
        </template>
      </template>
      <!-- 子菜单 -->
      <template v-for="sub in item.children">
        <template v-if="item.children">
          <menu-item :item="sub"></menu-item>
        </template>
        <template v-else>
          <a-menu-item :key="sub.key" :title="sub.title">
            <RouterLink :to="item.path">
              <template v-if="item.icon">
                <span role="img" aria-label="user" class="anticon">
                  <i class="fa-solid" :class="item.icon"></i>
                </span>
              </template>
              <template v-if="item.lang">
                <span>{{ $t(item.lang) }}</span>
              </template>
              <template v-else>
                <span>{{ item.title }}</span>
              </template>
            </RouterLink>
          </a-menu-item>
        </template>
      </template>
    </a-sub-menu>
  </template>
  <template v-else>
    <!-- 单层级菜单 -->
    <a-menu-item :key="item.key" :title="item.title">
      <RouterLink :to="item.path">
        <template v-if="item.icon">
          <span role="img" aria-label="user" class="anticon">
            <i class="fa-solid" :class="item.icon"></i>
          </span>
        </template>
        <template v-if="item.lang">
          <span>{{ $t(item.lang) }}</span>
        </template>
        <template v-else>
          <span>{{ item.title }}</span>
        </template>
      </RouterLink>
    </a-menu-item>
  </template>
</template>

<style lang="scss" scoped></style>
