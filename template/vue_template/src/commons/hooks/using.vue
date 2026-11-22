<script lang="ts" setup>
import { useQueryChange } from "@/commons/hooks/useQueryChange"

import { useRouter } from 'vue-router'
const routers = useRouter()

// name
defineOptions({
    name: 'custom-name'
})

useQueryChange((newQuery, oldQuery) => {
    console.log('Testing: ', '监听到id发生变化')
}, ["id"])

const changeRoute = () => {
    routers.push({
        path: 'hooks-using',
        query: {
            id: Math.round(Math.random() * 100)
        }
    })
}
</script>

<template>
    <div class="sections">
        <div class="box-test">
            <div class="test-item">
                <p class="titles">监听路由变化</p>
                <a-button @click="changeRoute">随机跳转</a-button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.sections {
    display: flex;
    gap: 20px;
}
</style>
