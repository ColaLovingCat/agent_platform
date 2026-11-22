<script lang="ts" setup>
import { defineProps, inject, type Ref } from "vue";
import type { Token, Word, WordMatch, WordTip } from "./types";

const props = defineProps<{
    text: string;
    words: WordMatch[];
}>();

const emit = defineEmits<{
    (e: "select", payload: any): void;
}>();

const wordDic = inject<Ref<Word[]>>('wordDic')

// tokenize，支持普通短语/单词和占位符短语 
function tokenize(text: string): Token[] {
    if (!wordDic?.value || !wordDic.value.length || !props.words?.length) return [{ type: "text", text }];

    let remaining = text;

    // 替换占位符
    props.words.forEach((w, idx) => {
        const regex = new RegExp(w.word, "gi");
        remaining = remaining.replace(regex, `@@WORD_${idx}@@`);
    });

    const tokens: Token[] = [];
    const parts = remaining.split(/(@@WORD_\d+@@)/);

    parts.forEach(part => {
        const match = part.match(/@@WORD_(\d+)@@/);
        if (match) {
            const wordInfo = props.words[parseInt(match[1], 10)]

            const matchs: any[] = wordInfo.matchs
                .map((m) => wordDic?.value.find((a: any) => a.word.toLowerCase() === m.toLowerCase()))
                .filter((a) => a)

            const tip: WordTip = {
                word: wordInfo.word,
                isPhrase: wordInfo.isPhrase,
                means: [],
            }

            if (wordInfo.isPhrase) {
                matchs.forEach((item) => {
                    item.means.forEach((m: any) => {
                        m.phrases.forEach((p: any) => {
                            const matchWord = wordInfo.phrase ?? wordInfo.word
                            if (p.content.toLowerCase() === matchWord.toLowerCase()) {
                                tip.word = p.content;
                                tip.means.push({ mean: p.mean });
                            }
                        });
                    });
                });
            } else if (matchs.length) {
                tip.word = matchs[0].word;
                tip.means = matchs[0].means;
            } else {
                // ❌ 没找到词典里的单词，仍然高亮
                tip.word = wordInfo.word;
                tip.means = [{ mean: '', ranges: ["未收录"] }];
                tip.notFound = true;
            }

            tokens.push({
                type: "match",
                text: wordInfo.word,
                matchs,
                tip,
            });
        } else if (part.length) {
            tokens.push({ type: "text", text: part });
        }
    });

    return tokens;
}
// 渲染提示信息
function renderTip(tip: WordTip | undefined): string {
    if (!tip) return "";

    const lines: string[] = [`<b>${tip.word}</b>`];
    if (tip.isPhrase) {
        lines.push(tip.means[0].mean);
    } else {
        tip.means?.forEach((m: any) => {
            lines.push(`${m.class || ""}${m.mean} [${m.ranges || ""}]`);
        });
    }
    return lines.join("<br>");
}

const clickItem = (tk: any) => {
    tk.matchs.forEach((word: Word) => emit('select', word.word));
}
</script>

<template>
    <span>
        <template v-for="(tk, i) in tokenize(props.text)" :key="i">
            <a-popover v-if="tk.type === 'match'" placement="top" trigger="hover">
                <template #content>
                    <!-- <pre style="margin: 0; white-space: pre-wrap">{{ renderTip(tk.tip) }}</pre> -->
                    <pre style="margin: 0; white-space: pre-wrap" v-html="renderTip(tk.tip)"></pre>
                </template>
                <!-- 点击时触发 select -->
                <span :class="tk.tip?.notFound ? 'txt-none' : 'txt-highlight'" @click="clickItem(tk)">
                    {{ tk.text }}
                </span>
            </a-popover>
            <span v-else>{{ tk.text }}</span>
        </template>
    </span>
</template>

<style scoped lang="scss">
.txt-highlight {
    cursor: pointer;
    color: #1890ff;
    border-bottom: 1px solid #1890ff;
}

.txt-none {
    cursor: help;
    color: var(--color-page-text);
    border-bottom: 1px dashed var(--color-page-text);
}
</style>
