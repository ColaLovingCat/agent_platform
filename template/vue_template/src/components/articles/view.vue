<script lang="ts" setup>
import { ref, provide, onMounted, computed, reactive, onBeforeUnmount } from "vue";

import * as XLSX from 'xlsx'
import * as extend from '@/commons/utils/extends'

import wordTip from "./wordTip.vue";
import wordCard from "./wordCard.vue";

import type { Article, Word } from "./types";

// name
defineOptions({
    name: 'custom-name'
})

// props
const props = defineProps<{
    article: Article;
}>();

const wordDic = ref<Word[]>([])

onMounted(() => {
    loadWordDic()
    //
    document.addEventListener("selectionchange", handleSelection)
})
onBeforeUnmount(() => {
    document.removeEventListener("selectionchange", handleSelection)
})

const loadWordDic = async () => {
    let temps: any = await readExcel()
    // 处理词库
    const wordMap: Record<string, Word> = {};
    const orgWords = temps.words.sort((a: any, b: any) => a.word.localeCompare(b.word))
    orgWords.forEach((row: any) => {
        const word = row.word.trim();
        // 新单词
        if (!wordMap[word]) {
            wordMap[word] = {
                word,
                root: row.root || "",
                tense: row.tense ? row.tense.split("//").map((t: string) => t.trim()) : [],
                related: row.related ? row.related.split("//").map((r: string) => ({ word: r.trim(), inDic: false })) : [],
                means: []
            };
        }

        const mean: any = {
            class: row.class,
            mean: row.mean,
            ranges: row.ranges.split("//"),
            examples: row.examples ? row.examples.split("//").map((a: string) => ({
                content: a.split("→")[0],
                mean: a.split("→")[1],
            })) : [],
            phrases: row.phrases ? row.phrases.split("//").map((a: string) => ({
                content: a.split("→")[0],
                mean: a.split("→")[1],
            })) : []
        };

        wordMap[word].means.push(mean);
    });
    // 匹配 related 单词
    const allWords = Object.keys(wordMap).map(w => w.toLowerCase()); // 词典里的所有单词
    Object.values(wordMap).forEach(w => {
        w.related.forEach(r => {
            r.inDic = allWords.includes(r.word.toLowerCase()); // 判断 related 是否在词典里
        });
    });
    //
    wordDic.value = Object.values(wordMap)
}
const readExcel = async () => {
    try {
        // 动态导入Excel文件
        const response = await fetch(new URL('/docs/datas/words.xlsx', import.meta.url).href)
        const arrayBuffer = await response.arrayBuffer()

        // 解析Excel数据
        const data = new Uint8Array(arrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // 获取第一个工作表的数据
        const words = XLSX.utils.sheet_to_json(workbook.Sheets['words'])

        return { words }
    } catch (error) {
        console.error('读取Excel文件失败:', error)
    }
    return {}
}

provide('wordDic', wordDic)

// 控制是否显示所有中文
const showAllChinese = ref(false);
function toggleZH() {
    showAllChinese.value = !showAllChinese.value;
}
// 当前激活句子
const activeKey = ref<string | null>(null);

// 展示词卡
const words: any = ref([])
const showCard = (word: string) => {
    const wordInfo = wordDic.value.find((a: any) => a.word == word)
    if (wordInfo)
        if (!words.value.find((w: any) => w.word === wordInfo.word))
            words.value.unshift(wordInfo);
}
const closeCard = (index: number) => {
    words.value.splice(index, 1);
}

const searchBtn = reactive({
    visible: false,
    x: 0,
    y: 0,
    word: ""
})
function handleSelection() {
    const selection = window.getSelection()
    if (!selection) return

    const text = selection.toString().trim()
    // 判断是否是单词
    if (text && /^[A-Za-z]+$/.test(text)) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()

        searchBtn.visible = true
        searchBtn.x = rect.right + window.scrollX + 10
        searchBtn.y = rect.top + window.scrollY - 10
        searchBtn.word = text
    } else {
        searchBtn.visible = false
    }
}
function doSearch() {
    if (searchBtn.word) {
        window.getSelection()?.removeAllRanges() // 清除选中
        searchBtn.visible = false

        searchTxt.value = searchBtn.word
        dicModal.value = true
    }
}

//#region Dic
const dicModal = ref(false)
const searchTxt = ref('')
const showWords: any = computed(() => {
    if (searchTxt.value == '') return wordDic.value
    return wordDic.value.filter((a: any) => a.word.toLowerCase().indexOf(searchTxt.value.toLowerCase()) > -1)
})
//#endregion

//#region Study
const studyModal = ref(false)
const studyInfos = reactive({
    model: 'show',
    word: '',
    class: '',
    mean: '',
    example: {
        content: '',
        mean: '',
    },
})
const randomWord = () => {
    if (!wordDic.value.length) return

    studyInfos.model = 'hidden';

    let index = extend.ExNumber.createRand(0, wordDic.value.length - 1, 0);
    const wordInfo = wordDic.value[index]
    studyInfos.word = wordInfo.word

    if (!wordInfo.means?.length) return
    let meanIndex = extend.ExNumber.createRand(0, wordInfo.means.length - 1, 0);
    const meanInfo = wordInfo.means[meanIndex]
    studyInfos.class = meanInfo.class ?? ''
    studyInfos.mean = meanInfo.mean
    studyInfos.example = meanInfo.examples?.[0] ?? {
        content: '',
        mean: '',
    }
}
//#endregion

const showModal = (action: string, values: any) => {
    switch (action) {
        case 'dic': {
            searchTxt.value = ""
            dicModal.value = true
            break
        }
        case 'study': {
            randomWord()
            studyModal.value = true
            break
        }
        default: {
            break
        }
    }
}
</script>

<template>
    <div class="box-articles">
        <div class="box-article">
            <!-- 标题 -->
            <h2 class="title">
                <div>
                    <wordTip :text="article.title.en" :words="article.title.words" @select="showCard" />
                </div>
                <div style="cursor: pointer;" @click="toggleZH">{{ article.title.zh }}</div>
            </h2>

            <template v-for="(para, pIdx) in article.contents" :key="pIdx">
                <!-- 英文行 -->
                <div class="paragraph-item paragraph-en">
                    <template v-for="(sent, sIdx) in para.sentences" :key="'en-' + sIdx">
                        <span class="sentence-item en" :class="{ active: activeKey === `${pIdx}-${sIdx}` }"
                            @mouseenter="activeKey = `${pIdx}-${sIdx}`" @mouseleave="activeKey = null">
                            <wordTip :text="sent.en" :words="sent.words" @select="showCard" />
                        </span>
                        <span v-if="sIdx < para.sentences.length - 1">&nbsp;</span>
                    </template>
                </div>

                <!-- 中文行 -->
                <div class="paragraph-item paragraph-zh">
                    <template v-for="(sent, sIdx) in para.sentences" :key="'en-' + sIdx">
                        <span class="sentence-item zh"
                            :class="{ active: activeKey === `${pIdx}-${sIdx}`, visible: showAllChinese, }">
                            {{ sent.zh }}
                        </span>
                    </template>
                </div>
            </template>
        </div>
        <div class="box-words">
            <div class="tools">
                <a-button class="btn btn-tools" @click="showModal('study', {})">
                    <i class="fa-solid fa-trophy"></i>
                </a-button>
                <a-button class="btn btn-tools" @click="showModal('dic', {})">
                    <i class="fa-solid fa-book-bookmark"></i>
                </a-button>
            </div>
            <div class="list-words">
                <template v-for="(word, index) in words">
                    <wordCard :word="word" @close="closeCard(index)" @related="showCard"></wordCard>
                </template>
            </div>
        </div>
    </div>

    <!-- 悬浮搜索按钮 -->
    <div v-if="searchBtn.visible" class="search-float-btn"
        :style="{ top: searchBtn.y + 'px', left: searchBtn.x + 'px' }">
        <a-button class="btn btn-tools" @click="doSearch">
            <i class="fa-solid fa-search"></i>
        </a-button>
    </div>

    <a-modal v-model:open="dicModal" title="Word Dictionary" width="80vw" centered :footer="[]">
        <div class="box-search">
            <a-input style="width: 200px" placeholder="search" v-model:value="searchTxt" />
            <span>{{ showWords.length }}</span>
        </div>
        <div class="list-cards">
            <template v-for="word in showWords">
                <wordCard :word="word"></wordCard>
            </template>
        </div>
    </a-modal>

    <a-modal v-model:open="studyModal" title="Can you Learn" centered :footer="[]">
        <div class="word-study">
            <div class="item-word">{{ studyInfos.word }}</div>
            <div class="item-means">
                <span class="item-class">{{ studyInfos.class }}</span>
                <span class="item-mean" :class="`item-${studyInfos.model}`">{{ studyInfos.mean }}</span>
            </div>
            <div class="item-example">{{ studyInfos.example.content }}</div>
            <div class="item-mean" :class="`item-${studyInfos.model}`">{{ studyInfos.example.mean }}</div>
        </div>
        <div class="btns">
            <a-button class="btn btn-tools" @click=" studyInfos.model = 'show'">
                <i class="fa-solid fa-eye"></i>
            </a-button>
            <a-button class="btn btn-tools" @click="randomWord">
                <i class="fa-solid fa-angles-right"></i>
            </a-button>
        </div>
    </a-modal>
</template>

<style scoped lang="scss">
.box-articles {
    display: flex;
    gap: 10px;

    .box-article {
        flex: 1;
    }

    .box-words {
        width: 350px;
    }
}

.box-article {
    height: calc(100vh - 100px);
    overflow-y: auto;
    padding: 10px;
    font-size: 16px;
    line-height: 1.8;

    .en {
        cursor: zoom-in;
        transition: all 0.6s ease-in-out;

        &:hover {
            background-color: #ffcf005d;
        }
    }

    .zh {
        color: var(--color-page-text);
        letter-spacing: 2px;
        opacity: 0.05;
        transition: all 0.6s ease-in-out;

        &.visible {
            opacity: 1;
        }

        &.active {
            opacity: 1;
            background-color: #ffcf005d;
        }
    }

    .title {
        margin-bottom: 20px;
        text-align: center;

        & * {
            font-size: 18px;
            font-weight: 700;
        }
    }

    .paragraph-item {
        text-indent: 18px;

        &.paragraph-zh {
            margin-bottom: 20px;
        }
    }
}

.list-words {
    height: calc(100vh - 130px);
    overflow-y: hidden;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px
}

.search-float-btn {
    position: absolute;
    z-index: 9999;
    background: #ffcf00;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s;

    .btn-tools {
        padding: 3px 9px;
    }

    &:hover {
        transform: scale(1.2);
    }
}

.box-search {
    display: flex;
    align-items: center;
    gap: 10px;
}

.list-cards {
    height: calc(100vh - 150px);
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;

    .word-view {
        width: 270px;
        height: 300px;
        overflow-y: auto;
    }
}

.word-study {
    text-align: center;

    .item-word {
        font-size: 37px;
        font-weight: 700;
    }

    .item-means {
        font-size: 21px;
    }

    .item-mean {
        position: relative;

        &.item-hidden::after {
            content: " ";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #ffffff00;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }
    }

    .item-example {
        margin-top: 20px;
    }
}
</style>
