<script lang="ts" setup>
import cameraView from './view.vue'

// name
defineOptions({
    name: 'custom-name'
})

const scanned = (event: any) => {
    console.log('扫码结果: ', event)
}
</script>

<template>
    <div class="sections">
        <cameraView @scanned="scanned"></cameraView>
    </div>
</template>

<style scoped lang="scss">
.sections {
    padding: 0;
    height: calc(100vh - 70px);
}
</style>
