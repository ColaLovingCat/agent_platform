<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, reactive } from 'vue'
import type { Ref } from 'vue'
import eventBus from '@/commons/utils/eventBus'

import { useLoadingStore } from '@/commons/stores/index'
const loadingStore = useLoadingStore()
const loadingStatus = computed(() => loadingStore.status)

import { useUserInfosStore } from '@/commons/stores/index'
const userInfosStore = useUserInfosStore()

import { useSystemInfosStore } from '@/commons/stores/index'
const systemInfosStore = useSystemInfosStore()
const headerStatus = computed(() => systemInfosStore.state.headerShow)
const theme = computed(() => systemInfosStore.state.theme)

const env = import.meta.env.VITE_APP_ENV

import * as systemDB from '@/commons/datas/menus'
import layoutView from '@/components/layouts/layout.vue'
import formView from '@/components/forms/view.vue'

import * as extend from '@/commons/utils/extends'
import * as messages from '@/commons/utils/messages'
import { logger } from '@/commons/utils/logger'
const log = logger.create("App");

import * as current from '@/services/login.services'
import * as user from '@/services/users.services'

// 设备类型
const deviceType = ref("");
// 当前宽高
const width = ref(0);
const height = ref(0);

onMounted(async () => {
  systemInfosStore.setHeader(true)

  // 清除所有的loading状态
  loadingStore.clear()

  updateSize();
  window.addEventListener("resize", updateSize);

  deviceType.value = extend.ExWeb.device()

  // 设置语言，默认en
  let lang = extend.ExLocalStore.get('lang')
  locale.value = lang ? lang : 'en'

  // 设置主题
  let theme = extend.ExLocalStore.get('theme')
  theme = theme ? theme : 'default'
  //
  themesStatus.value = theme == 'default'
  setTheme(theme)

  // 检测token
  let token = extend.ExLocalStore.get('token')
  if (token && token != '') {
    // 如果有token则加载用户信息和菜单
    await getinfosUser()
  }
  // 后刷新菜单
  getlistMenus()

  // SSO配置
  if (systemInfosStore.infos.azure == 'request') {
    // 从后台获取获取
    await getinfosAzure()
  }

  // 注册全局方法
  eventBus.on('getinfosUser', getinfosUser)
  eventBus.on('jumpHome', jumpHome)
  eventBus.on('clearSystem', clearSystem)
  eventBus.on('logout', logout)
})

onUnmounted(() => {
  window.removeEventListener("resize", updateSize);
  // 注销全局方法
  eventBus.off('getinfosUser', getinfosUser)
  eventBus.off('jumpHome', jumpHome)
  eventBus.off('clearSystem', clearSystem)
  eventBus.off('logout', logout)
})

// 更新窗口大小
const updateSize = () => {
  const size = extend.ExWeb.viewSize()
  width.value = size.w;
  height.value = size.h;
};

// 语言
import { useI18n } from 'vue-i18n'
const { locale, t } = useI18n()
const changeLanguage = (lang: string) => {
  locale.value = lang
  //
  extend.ExLocalStore.set('lang', lang)
}

// 主题
const themesStatus = ref(true)
const toggleThemes = () => {
  const theme = themesStatus.value ? 'default' : 'dark'
  setTheme(theme)
}
const setTheme = (theme: string) => {
  // css样式
  document.documentElement.setAttribute('data-theme', theme)
  // 全局状态
  extend.ExLocalStore.set('theme', theme)
  systemInfosStore.setTheme(theme)
}

const getinfosAzure = async () => {
  let resp: any = await current.getinfosAzure()
  const { status, data } = resp;
  if (status) {
    log.log('azure', data)
    systemInfosStore.setAzure({
      host: data.host,
      client_id: data.clientID,
      scope: data.scope,
      response_type: data.responseType,
    })
  }
}

// 菜单数据
let menus: Ref<any[]> = ref([])
// 获取用户和菜单
const getinfosUser = async () => {
  loadingStore.loading()
  try {
    // 先获取用户信息
    const resp: any = await current.getinfosUser()
    const { status, data, message } = resp
    if (status) {
      userInfosStore.refresh({ ...data })
      log.log('user', userInfosStore.userInfos)
    } else {
      messages.showError(message)
    }
  } catch (error) {
    log.error('error', error)
    logout()
  } finally {
    loadingStore.end()
  }
}
// 获取菜单
const getlistMenus = () => {
  menus.value = [...systemDB.menus]
}

// 用于后续统一跳转主页
const jumpHome = () => {
  pageGo('/home')
}

// 注销
const logout = () => {
  clearSystem()
  log.log('user', 'log out')
  pageGo('/login', {
    type: 'logout'
  })
}
const clearSystem = () => {
  // 清除用户信息
  extend.ExLocalStore.delete('token')
  userInfosStore.clear()
  // 清除菜单
  menus.value = []
}

// 跳转
import { useRouter } from 'vue-router'
const router = useRouter()
const pageGo = (path: string, query: any = {}) => {
  router.push({
    path,
    query
  })
}

//
const changeModal = ref(false)
const changeConfig = reactive({
  class: {
    forms: '',
    items: 'inline',
    label: 'col-4'
  },
  format: {
    date: 'YYYY-MM-DD',
    time: 'HH:mm:ss'
  },
  showError: false
})
const changeList: any = ref([
  {
    type: 'input',
    key: 'newPassword',
    label: 'New Password',
    isPassword: true,
    required: true,
  },
  {
    type: 'input',
    key: 'confirmPassword',
    label: 'Confirm Password',
    isPassword: true,
    required: true,
  },
])
const changeInfos = ref({
  newPassword: '',
  confirmPassword: '',
})
const changePassword = async () => {
  const { newPassword, confirmPassword } = changeInfos.value;

  const vaild = current.checkPassword(newPassword, confirmPassword)
  if (vaild == -1) {
    messages.showError(t("message.password.notmatch"))
    return;
  }
  if (vaild == -2) {
    messages.showError(t("message.password.notcom"))
    return;
  }

  const params = {
    id: userInfosStore.userInfos.id,
    newPassword: newPassword
  }
  let resp: any = await user.updatePassword(params)
  const { status, data, message } = resp;
  if (status) {
    messages.showSuccess(t("message.password.success"))
    changeModal.value = false;
    //
    logout()
  } else {
    messages.showError(message)
  }
}

const showModal = (action: string, values: any) => {
  switch (action) {
    case 'changePassword': {
      if (extend.ExString.isNotEmpty(userInfosStore.userInfos.id)) {
        changeInfos.value = {
          newPassword: '',
          confirmPassword: '',
        }
        changeModal.value = true
      }
      break
    }
    default: {
      break
    }
  }
}
</script>

<template>
  <layoutView :datas="menus" :status="headerStatus">
    <!-- Logo -->
    <template #logos>
      <img class="logo" :src="`/systems/logos/logo-name${theme == 'default' ? '' : '-white'}.png`" alt="" srcset=""
        @click="pageGo('/home')" />
    </template>
    <template #logos-mini>
      <img class="logo-mini" :src="`/systems/logos/logo${theme == 'default' ? '' : '-white'}.png`" alt="" srcset=""
        @click="pageGo('/home')" />
    </template>
    <!-- Right -->
    <template #infos>
      <a-dropdown class="top-infos">
        <a class="ant-dropdown-link" @click.prevent>
          <i class="fa-solid fa-circle-info"></i>
        </a>
        <template #overlay>
          <a-menu>
            <a-menu-item key="0">
              <i class="fa-solid fa-code"></i>
              <span>{{ t(`env.${env}`) }}</span>
            </a-menu-item>
            <a-menu-item key="1">
              <i class="fa-solid fa-globe"></i>
              <span>{{ deviceType }}</span>
            </a-menu-item>
            <a-menu-item key="2">
              <i class="fa-solid fa-display"></i>
              <span>{{ width }} × {{ height }}</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
      <!-- 主题 -->
      <div class="themes">
        <a-switch v-model:checked="themesStatus" :checked-children="t('theme.light')"
          :un-checked-children="t('theme.dark')" @change="toggleThemes" />
      </div>
      <!-- 语言 -->
      <div class="langs">
        <img class="img-lan" :src="`/systems/lan/lan-${locale}.png`"
          @click="changeLanguage(locale == 'zh' ? 'en' : 'zh')" />
      </div>
      <!-- 用户 -->
      <a-dropdown class="top-users">
        <a class="ant-dropdown-link" @click.prevent>
          <i class="fa-solid fa-user"></i>
          <span>{{ userInfosStore.userInfos.username }}</span>
        </a>
        <template #overlay>
          <a-menu>
            <a-menu-item key="0" @click="logout">
              <i class="fa-solid fa-power-off"></i>
              <span>{{ $t('btn.logout') }}</span>
            </a-menu-item>
            <a-menu-item key="1" @click="showModal('changePassword', {})">
              <i class="fa-solid fa-key"></i>
              <span>{{ $t('btn.change_password') }}</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </template>
  </layoutView>
  <div class="loading" v-if="loadingStatus"></div>

  <a-modal v-model:open="changeModal" width="600px" title="Change Password" @ok="changePassword">
    <formView ref="searchRef" :config="changeConfig" :forms="changeList" v-model:values="changeInfos">
    </formView>
  </a-modal>
</template>

<style scoped lang="scss"></style>