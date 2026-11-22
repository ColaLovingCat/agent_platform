<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'

import robotView from './view.vue'

// name
defineOptions({
    name: 'custom-name'
})

onMounted(() => { })

const pageInfos = reactive({
    status: 'idle'
})
</script>

<template>
    <div class="sections">
        <robotView :status="pageInfos.status"></robotView>
        <div class="btns">
            <a-button type="default" @click="pageInfos.status='idle'">idle</a-button>
            <a-button type="default" @click="pageInfos.status='normal'">normal</a-button>
            <a-button type="default" @click="pageInfos.status='sad'">sad</a-button>
            <a-button type="default" @click="pageInfos.status='think'">think</a-button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.sections {
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>
