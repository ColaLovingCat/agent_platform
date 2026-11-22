<script lang="ts" setup>
import { onMounted, ref, onUnmounted, watch } from 'vue'

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

// ===== JSON & Data =====
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import "monaco-editor/esm/vs/basic-languages/xml/xml.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
// ===== Web =====
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import "monaco-editor/esm/vs/basic-languages/scss/scss.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
// ===== Scripting =====
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
// ===== System / Compiled Languages =====
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import "monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution";
import "monaco-editor/esm/vs/basic-languages/java/java.contribution";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution";

import vkbeautify from "vkbeautify";
import { format as sqlFormatter } from "sql-formatter";

// name
defineOptions({
    name: 'code-editor'
})

// props
const props = defineProps({
    value: {
        type: String,
        default: '',
        require: true
    },
    configs: {
        type: Object,
        default: () => ({
            language: 'json',
            theme: 'vs-dark',
            readOnly: false,
        })
    }
})

// emits
const emits = defineEmits<{
    (event: 'update:value', values: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor

onMounted(() => {
    editor = monaco.editor.create(containerRef.value!, {
        value: props.value,
        //
        language: props.configs.language,
        theme: props.configs.theme,
        readOnly: props.configs.readOnly,
        //
        automaticLayout: true,
        wordWrap: 'on', // 开启自动换行
        wrappingIndent: "indent" // 换行后缩进，可选：none / same / indent / deepIndent
    })

    formatTxt()

    // console.log('[monaco] languages:', monaco.languages.getLanguages());
    // console.log('[monaco] language:', editor.getModel()?.getLanguageId());

    editor.onDidChangeModelContent(() => {
        emits('update:value', editor.getValue())
    })
})
onUnmounted(() => {
    editor.dispose();
})

watch(
    () => props.value,
    (newValue) => {
        if (!editor) return;

        if (newValue !== editor.getValue()) {
            const formatted = format(newValue, props.configs.language);
            editor.setValue(formatted);
            emits("update:value", formatted);
        }
    }
);
watch(
    () => props.configs,
    (newConfig) => {
        if (!editor) return;
        const code = editor.getValue();
        const formatted = format(code, newConfig.language);
        editor.setValue(formatted);
        emits("update:value", formatted);

        // 可选：如果 language 改变，更新 Monaco 模型语言
        monaco.editor.setModelLanguage(editor.getModel()!, newConfig.language);
    },
    { deep: true }
);

const formatTxt = () => {
    if (!editor) return

    const formatted: any = format(editor.getValue())
    editor.setValue(formatted)
    emits('update:value', formatted)
}
const format = (str: string, language: string = props.configs.language) => {
    try {
        switch (language) {
            case 'json': {
                return JSON.stringify(JSON.parse(str), null, 2)
            }
            case 'xml': {
                return vkbeautify.xml(str, 2);
            }
            case 'css': {
                return vkbeautify.css(str, 2);
            }
            case 'sql': {
                return sqlFormatter(str, { language: "sql" });
            }
        }
        return str
    } catch (e) {
        return str
    }
}

const iconClass = ref("fa-copy")
const copyCode = async () => {
    if (!editor) return
    try {
        await navigator.clipboard.writeText(editor.getValue())
        //
        iconClass.value = "fa-check"
        setTimeout(() => {
            iconClass.value = "fa-copy"
        }, 2000)
    } catch (err) {
        console.error('[copy] failed:', err)
    }
}
</script>

<template>
    <div class="editor-wrapper">
        <div class="editor-tools">
            <div class="left">
                <button class="btn btn-tools" @click="formatTxt"><i class="fa-solid fa-align-right"></i></button>
                <span>{{ configs.language }}</span>
            </div>
            <div class="right">
                <button class="btn btn-tools" @click="copyCode" title="复制代码">
                    <i class="fa-solid" :class="iconClass"></i>
                </button>
            </div>
        </div>
        <div ref="containerRef" class="editor-container"></div>
    </div>
</template>

<style scoped lang="scss">
.editor-wrapper {
    width: 100%;
    height: 100%;
    min-height: 80px;
    background: #1e1e1e;
    display: flex;
    flex-direction: column;

    .editor-tools {
        color: #ffffff7d;
        display: flex;
        justify-content: space-between;

        .left,
        .right {
            display: flex;
            padding: 0 10px;
            gap: 10px;
        }

        .btn {
            color: #ffffff7d;
        }
    }

    .editor-container {
        width: 100%;
        height: calc(100% - 20px);
    }
}
</style>
