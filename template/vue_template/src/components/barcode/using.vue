<script lang="ts" setup>
import { ref } from 'vue'

import barcodeView from './barcode.vue'
import qrcodeView from './qrcode.vue'

// name
defineOptions({
    name: 'custom-name'
})

const code = ref('S1234567890')
</script>

<template>
    <div class="sections">
        <a-input v-model:value="code" style="width: 200px" placeholder="code" />
        <barcodeView :data="code"></barcodeView>
        <qrcodeView :data="code"></qrcodeView>
    </div>
</template>

<style scoped lang="scss">
.sections {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 20px;
}
</style>
