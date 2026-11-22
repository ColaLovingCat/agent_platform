<script lang="ts" setup>
import { reactive, onMounted, ref } from 'vue'

import flipView from './group.vue'
import * as extend from '@/commons/utils/extends'

// name
defineOptions({
  name: 'custom-name'
})

const data = ref(100)
const dataB = 12345.67

onMounted(() => {
  setInterval(() => {
    data.value += extend.ExNumber.createRand(1000, 3000, 2)
  }, 5000)
})

const flipConfig = {
  type: 'flip',
  dec: 2,
  fontSize: 80,
}
const rollerConfig = {
  type: 'roller',
  dec: 2,
  fontSize: 80,
  auto: false,
  timer: 0,
}
const rollerConfigB = {
  type: 'roller',
  dec: 2,
  fontSize: 80,
  auto: true,
  timer: 5000,
}
</script>

<template>
  <h4>数据更新翻转</h4>
  <flipView :value="data" :configs="flipConfig"></flipView>
  <h4>数据更新滚动</h4>
  <flipView :value="data" :configs="rollerConfig"></flipView>
  <h4>自动滚动</h4>
  <flipView :value="dataB" :configs="rollerConfigB"></flipView>
</template>

<style scoped lang="scss"></style>
