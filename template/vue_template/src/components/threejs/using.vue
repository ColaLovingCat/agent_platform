<script lang="ts" setup>
import { onMounted } from 'vue'

import threeView from './view.vue'

// name
defineOptions({
  name: 'three-using'
})

onMounted(() => { })

const onChange = (event: any) => {
  console.log('[Change]: ', event)
}
</script>

<template>
  <div class="sections">
    <threeView @changed="onChange"></threeView>
  </div>
</template>

<style scoped lang="scss">
.sections {
  padding: 0
}
</style>
