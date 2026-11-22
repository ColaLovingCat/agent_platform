<script lang="ts" setup>
import { reactive } from 'vue'

import typeView from '@/components/type-writer/view.vue'

// name
defineOptions({
    name: 'custom-name'
})

const configs = reactive({
    staticText: 'Pioneering the era of',
    words: ['Digital Supply Chain', 'Smart Manufacturing', 'Seamless Integration'],
    subTitle: 'The ultimate internal platform for material lifecycle and change management.'
})
</script>

<template>
    <div class="sections">
        <typeView :static-text="configs.staticText" :words="configs.words" :sub-title="configs.subTitle"></typeView>
    </div>
</template>

<style scoped lang="scss">
.sections {
    width: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
