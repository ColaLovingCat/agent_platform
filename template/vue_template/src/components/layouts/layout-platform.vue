<script lang="ts">
import { ref, defineComponent, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { MenuInfos } from '@/commons/types/datas.types'

export default defineComponent({
  props: {
    datas: {
      // type: Array as () => Array<any>,
      type: Array as () => Array<MenuInfos>,
      default: () => []
    }
  },
  components: {},
  emits: [],
  setup(props, { emit }) {
    const menus = ref(props.datas)
    watch(
      () => props.datas,
      (newValue, oldValue) => {
        menus.value = newValue
      }
    )

    let menuInfos: Ref<any> = ref({
      timer: null,
      height: 0,
      currentKey: '',
      currentSubKey: ''
    })
    const currentMenu: any = computed(() => {
      let result: any[] = []
      if (menuInfos.value.currentKey != '') {
        let temp: any = menus.value.find((a: any) => a.key == menuInfos.value.currentKey)
        if (temp) {
          result = { ...temp }
        }
      }
      return result
    })
    const currentSubMenu: any = computed(() => {
      let result: any[] = []
      if (menuInfos.value.currentKey != '' && menuInfos.value.currentSubKey != '') {
        let temp = currentMenu.value.children?.find(
          (a: any) => a.key == menuInfos.value.currentSubKey
        )
        if (temp) {
          result = { ...temp }
        }
      }
      return result
    })

    const clearMenu = () => {
      menuInfos.value.timer = null
      menuInfos.value.height = 0
      menuInfos.value.currentKey = ''
    }
    const showMenu = (item: MenuInfos | any) => {
      // 先清除定时器
      if (menuInfos.value.timer) {
        clearTimeout(menuInfos.value.timer)
        menuInfos.value.timer = null
      }
      // 显示
      if (item.infos.height > 0) {
        menuInfos.value.height = item.infos.height
        //
        menuInfos.value.currentKey = item.key
        menuInfos.value.currentSubKey = item.children[0].key
      }
    }
    const hideMenu = (immediate = false) => {
      if (immediate) {
        clearMenu()
      } else {
        menuInfos.value.timer = setTimeout(() => {
          clearMenu()
        }, 500)
      }
    }
    const showSubMenu = (item: any) => {
      menuInfos.value.currentSubKey = item.key
    }

    return {
      menus,
      menuInfos,
      showMenu,
      hideMenu,
      currentMenu,
      showSubMenu,
      currentSubMenu
    }
  }
})
</script>

<template>
  <a-layout class="pages">
    <a-layout-header class="page-header">
      <div class="headers">
        <div class="logos">
          <slot name="logos"></slot>
        </div>
        <div class="menus">
          <div
            class="menu-item"
            v-for="menu in menus"
            :key="menu.index"
            :class="menu.key == menuInfos.currentKey ? 'active' : ''"
            @mouseover="showMenu(menu)"
            @mouseleave="hideMenu()"
          >
            <div class="item-title">
              {{ $t(menu.lang) }}
              <i class="fa-solid fa-angle-up"></i>
            </div>
          </div>
        </div>
        <div class="infos">
          <slot name="infos"></slot>
        </div>
      </div>
      <!-- 子菜单 -->
      <div
        class="header-sub-menu"
        @mouseover="showMenu({ infos: { height: -1 } })"
        @mouseleave="hideMenu()"
        :style="{ height: menuInfos.height + 'px' }"
      >
        <div class="btn btn-close" @click="hideMenu(true)">
          <i class="fa-solid fa-xmark"></i>
        </div>
        <div class="sub-menu">
          <div class="sub-left">
            <div class="sub-menus">
              <div
                class="menu-item"
                v-for="menu in currentMenu.children"
                :key="menu.index"
                :class="menu.key == menuInfos.currentSubKey ? 'active' : ''"
                @mouseover="showSubMenu(menu)"
              >
                <span> {{ menu.title }}</span>
              </div>
            </div>
          </div>
          <div class="sub-middle">
            <h3 class="titles">{{ currentSubMenu.title }}</h3>
            <div class="sub-sections">
              <div class="sub-section" v-for="sec in currentSubMenu.children" :key="sec.index">
                <div class="sec-header">
                  <span class="text">{{ sec.title }}</span>
                  <div class="border"></div>
                </div>
                <div class="sub-section-children">
                  <div class="sub-section-item" v-for="item in sec.children" :key="item.index">
                    <router-link
                      class="item-title"
                      v-if="!item.infos.isJump"
                      :to="item.path"
                      @click="hideMenu"
                    >
                      {{ item.title }}
                      <span>{{ item.infos.status }}</span>
                      <i class="fa-solid fa-angle-right"></i>
                    </router-link>
                    <a class="item-title" v-else :href="item.path" target="_blank">
                      {{ item.title }}
                      <span>{{ item.infos.status }}</span>
                      <i class="fa-solid fa-angle-right"></i>
                    </a>
                    <div class="item-desc">{{ item.infos.desc }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="sub-right"></div>
        </div>
      </div>
    </a-layout-header>

    <a-layout-content class="page-contents">
      <router-view></router-view>
    </a-layout-content>
  </a-layout>
</template>

<style lang="scss" scoped>
.menus {
  display: flex;

  .menu-item {
    color: var(--color-page-text);

    .item-title {
      height: 60px;
      padding: 0 20px;
      font-size: 14px;
      line-height: 60px;

      i.fa-solid {
        transform: rotate(0deg);
        transition: all 0.4s;
      }
    }

    &.active .item-title,
    &:hover .item-title {
      color: #1975ff;
      border-bottom: 3px solid #1975ff;

      i.fa-solid {
        transform: rotate(180deg);
      }
    }
  }
}

.header-sub-menu {
  position: absolute;
  width: 100%;
  top: 60px;
  left: 0;
  overflow: hidden;
  z-index: 10;
  transition: height 0.5s ease;
  background-color: var(--color-content-bg);
  box-shadow: rgba(0, 0, 0, 0.09) 0px 12px 11px 0px;

  .btn-close {
    position: absolute;
    top: 0;
    right: 0;
    padding: 10px;
    color: #969696;
  }

  .sub-menu {
    position: relative;
    margin: 0 auto;
    width: 1200px;
    height: 100%;
    transition: height 0.5s ease;
    overflow: hidden;
    display: flex;
    column-gap: 30px;

    .sub-left {
      min-width: 80px;

      .sub-menus {
        padding: 20px 0;
        display: flex;
        flex-direction: column;
        row-gap: 8px;

        .menu-item {
          padding: 10px 0;
          line-height: 27px;

          &.active {
            color: #1975ff;

            span::before {
              transform: translate(-50%, 0) scaleX(1);
            }
          }

          span {
            position: relative;

            &::before {
              content: '';
              position: absolute;
              left: 50%;
              bottom: 0;
              width: 100%;
              height: 2px;
              background-color: #1975ff;
              transform-origin: center;
              transform: translate(-50%, 0) scaleX(0);
              transition: transform 0.3s ease-in-out;
            }
          }
        }
      }
    }

    .sub-middle {
      flex: 1;
      padding: 20px;
      background: #f6f8fc9d;

      .titles {
        margin: 10px 0 10px 0;
        color: #252b3a;
        font-size: 20px;
        line-height: 21px;
      }

      .sub-sections {
        display: flex;
        flex-direction: column;
        row-gap: 30px;

        .sec-header {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          margin-bottom: 20px;

          .text {
            color: #7b818d;
            line-height: 25px;
          }

          .border {
            flex: 1;
            margin-left: 11px;
            border-bottom: 1px solid #e3e3e3;
          }
        }

        .sub-section-children {
          display: flex;
          flex-wrap: wrap;
          column-gap: 20px;
          row-gap: 15px;

          .sub-section-item {
            width: 240px;

            .item-title {
              line-height: 21px;
              display: flex;
              align-items: center;

              span {
                margin-left: 5px;
                color: #ff8e4d;
                font-size: 12px;
                font-weight: 400;
              }

              i.fa-solid {
                opacity: 0;
                margin-left: 0px;
                font-size: 12px;
                transition: all 0.4s;
              }
            }

            &:hover {
              .item-title {
                color: #1975ff;

                i.fa-solid {
                  opacity: 1;
                  margin-left: 8px;
                }
              }
            }

            .item-desc {
              padding-top: 3px;
              color: #afb4c0;
              font-size: 12px;
              line-height: 17px;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }
          }
        }
      }
    }
  }
}
</style>
