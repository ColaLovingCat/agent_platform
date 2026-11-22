<script lang="ts" setup>
// name
defineOptions({
    name: 'custom-name'
})

const emits = defineEmits<{
    (event: 'related', word: any): void
    (event: 'close', word: any): void
}>()

// props
const props = defineProps({
    word: {
        type: Object,
        default: () => ({})
    },
})
</script>

<template>
    <div class="word-view">
        <h3 class="item-word">{{ word.word }}</h3>
        <div class="item-root">{{ word.root }}</div>
        <div class="item-related">
            <span>[近义]</span>
            <span class="related-item" v-for="item in word.related" :class="{ active: item.inDic }"
                @click="emits('related', item.word)">
                {{ item.word }}
            </span>
        </div>
        <div class="item-means" v-for="(m, idx) in word.means" :key="idx">
            <div>
                <sapn style="font-weight: 700;">{{ m.class }}</sapn>
                <sapn style="font-weight: 800;">{{ m.mean }}</sapn>
                <sapn class="range-item" v-for="range in m.ranges">{{ range }}</sapn>
            </div>

            <div v-for="(ex, i) in m.examples" :key="i" class="item-root">
                [例句] {{ ex.content }}
                <div v-if="ex.mean">- {{ ex.mean }}</div>
            </div>
            <div v-for="(ph, i) in m.phrases" :key="i" class="item-root">
                [短语] {{ ph.content }} - {{ ph.mean }}
            </div>
        </div>
        <div class="item-btn">
            <a-button type="default" class="btn btn-close" @click="emits('close', word)">
                <i class="fa-solid fa-close"></i>
            </a-button>
        </div>
    </div>
</template>

<style scoped lang="scss">
.word-view {
    position: relative;
    padding: 10px;
    border-radius: 8px;
    background: var(--color-page-bg);
    box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;

    .item-word {
        margin-bottom: 5px;
        color: var(--color-page-text);
        font-size: 18px;
        font-weight: 700;
    }

    .item-root {
        color: var(--color-page-text);
        font-size: 12px;
        opacity: 0.5;
    }

    .item-related {
        font-size: 12px;
        display: flex;
        gap: 8px;

        .related-item {
            &.active {
                cursor: pointer;
                color: #1890ff;
                border-bottom: 1px solid #1890ff;
            }
        }
    }

    .item-means {
        margin-top: 5px;
        padding: 5px 0;
        border-top: 2px dashed #c4cecf8d;
    }


    .range-item {
        margin: 0 2px;
        padding: 2px 5px;
        color: #000;
        font-size: 11px;
        border-radius: 3px;
        background: #c4cecf6d;
    }

    .item-btn {
        position: absolute;
        top: 5px;
        right: 5px;
    }
}
</style>
