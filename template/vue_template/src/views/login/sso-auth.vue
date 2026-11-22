<script lang="ts" setup>
import { onMounted } from 'vue'
import eventBus from '@/commons/utils/eventBus'

import { useRouter } from 'vue-router'
const routers = useRouter()

import { useLoadingStore } from '@/commons/stores/index'
const loadingStore = useLoadingStore()

import * as extend from '@/commons/utils/extends'
import * as meessageBox from '@/commons/utils/messages'

import * as login from '@/services/login.services'

onMounted(() => {
  let params = extend.ExWeb.params()
  if (params.code) {
    loadingStore.loading()
    //
    const redirect_uri = extend.ExWeb.url().server + '/sso-auth'
    let param = {
      code: params.code,
      redirectUri: redirect_uri
    }
    login.loginAzure(param).then(
      (resp: any) => {
        loadingStore.end()
        //
        const { status, message } = resp
        if (status) {
          eventBus.emit('getinfosUser')
          //
          if (params.state) {
            const path = decodeURIComponent(atob(decodeURIComponent(decodeURIComponent(params.state)))) || '/'
            routers.push(path)
          } else {
            eventBus.emit('jumpHome')
          }
        } else {
          meessageBox.showError(message)
        }
      },
      (err: any) => {
        loadingStore.end()
        meessageBox.showError(err)
        //
        eventBus.emit('logout')
      }
    )
  }
})
</script>

<template>
  <div class="sections">{{ $t('login.ssoing') }}</div>
</template>

<style scoped>
.sections {
  font-size: 35px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
