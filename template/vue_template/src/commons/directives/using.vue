<script lang="ts" setup>
import { onMounted, reactive } from 'vue'

// name
defineOptions({
    name: 'custom-name'
})

onMounted(() => {
    getlistData(20)
})

const handleInput = () => {
    addLog('Input Change')
}
const handleClick = () => {
    addLog('Button Click')
}

const pageInfos = reactive({
    logs: [] as any[],
    currentTime: new Date(),
    data: 1234.56789,
    items: [] as any[]
})

const loadMore = () => {
    addLog('Scroll Load')
    getlistData(10)
}
const getlistData = (size: number) => {
    fetch('/api/user/list?size=' + size)
        .then((resp: any) => {
            return resp.json();
        })
        .then((resp: any) => {
            const { status, result } = resp
            pageInfos.items = [...pageInfos.items, ...result.list]
        })
        .catch(err => {
        });
}

const onResize = (el: HTMLElement) => {
    addLog('Height: ' + el.offsetHeight)
}

const addLog = (message: string) => {
    pageInfos.logs.push({
        time: new Date(),
        message,
    })
}
</script>

<template>
    <div class="box-dir">
        <div class="box-test">
            <div class="test-item">
                <p class="titles">输入防抖 默认500ms</p>
                <p class="txt-code">v-debounce:input="handleInput"</p>
                <a-input v-debounce:input="handleInput" />
            </div>
            <div class="test-item">
                <p class="titles">点击防抖 1000ms</p>
                <p class="txt-code">v-debounce:click.1000="handleClick"</p>
                <a-button v-debounce:click.1000="handleClick">Click</a-button>
            </div>
            <div class="test-item">
                <p class="titles">点击节流（1秒内只触发一次）</p>
                <p class="txt-code">v-throttle:click.1000="handleClick"</p>
                <button v-throttle:click.1000="handleClick">节流点击</button>
            </div>
            <div class="test-item">
                <p class="titles">日期格式化</p>
                <p class="txt-code">v-date-format="pageInfos.currentTime" :data-format="'YYYY-MM-DD HH'"</p>
                <p>{{ pageInfos.currentTime }}</p>
                <p v-date-format="pageInfos.currentTime"></p>
                <p v-date-format="pageInfos.currentTime" :data-format="'YYYY-MM-DD HH'"></p>
            </div>
            <div class="test-item">
                <p class="titles">保留小数</p>
                <p class="txt-code">v-data-fixed:3="pageInfos.data"</p>
                <p>{{ pageInfos.data }}</p>
                <p v-data-fixed="pageInfos.data"></p>
                <p v-data-fixed:3="pageInfos.data"></p>
            </div>
            <div class="test-item">
                <p class="titles">滚动底部加载新数据</p>
                <p class="txt-code">v-scroll-load="loadMore"</p>
                <div v-scroll-load="loadMore" class="box-scrolls">
                    <p class="scorll-item" v-for="item in pageInfos.items" :key="item">{{ item.title }}</p>
                </div>
            </div>
            <div class="test-item">
                <p class="titles">监听元素大小变化，支持防抖</p>
                <p class="txt-code">v-resize:500="onResize"</p>
                <a-textarea :rows="6" v-resize:500="onResize"></a-textarea>
            </div>
        </div>
        <div class="box-logs">
            <template v-for="log in pageInfos.logs">
                <p>{{ log.message }}</p>
            </template>
        </div>
    </div>
</template>

<style scoped lang="scss">
.box-dir {
    padding: 20px;
    display: flex;
    gap: 20px;
}

.box-test {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .titles {
        font-weight: 700;
        margin-bottom: 5px;
    }
}

.box-logs {
    flex: 1;
}

.box-scrolls {
    height: 200px;
    overflow-y: auto;
}
</style>
