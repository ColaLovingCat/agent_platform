<script lang="ts" setup>
import { reactive, onMounted, ref, nextTick } from 'vue'

import uploadView from '@/components/upload-form/view.vue'

// name
defineOptions({
    name: 'using-upload'
})

const uploadRef: any = ref()
const configs = {
    formName: 'file',
    multiple: true,
    showUploadList: true,
    supports: ['*']
}
const params = {
    a: 123
}
const uploaded = (event: any) => {
}

onMounted(async () => {
    await nextTick()
    if (uploadRef.value) {
        uploadRef.value.clearFiles()
    }
})
</script>

<template>
    <div class="sections">
        <div class="box-upload">
            <uploadView ref="uploadRef" :configs="configs" :params="params" @uploaded="uploaded"></uploadView>
        </div>
        <uploadView ref="uploadRef" mode="simple" :configs="configs" :params="params" @uploaded="uploaded"></uploadView>
    </div>
</template>

<style scoped lang="scss">
.sections {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 50px
}

.box-upload {
    width: 300px;
    height: 200px;
}
</style>
