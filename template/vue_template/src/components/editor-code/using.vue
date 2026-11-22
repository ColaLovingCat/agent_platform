<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'

import codeView from './view.vue'

// name
defineOptions({
    name: 'custom-name'
})

const txt = ref('')
const configs = ref({
    language: 'json',
    theme: 'vs-dark',
    readOnly: false,
})

onMounted(() => {
    changeLan('json')
})

const lans = [
    { code: 'json', sample: '{"a":"a","b":"b"}' },
    { code: 'xml', sample: '<?xml version="1.0"?><RECORD><FIELD ID="1" xsi:type="CharTerm" TERMINATOR="\t" MAX_LENGTH="12"/></RECORD>' },
    { code: 'sql', sample: "SELECT * FROM dbo.Table WHERE [Status] = 'Open'" },
    { code: 'html', sample: '<html><header></header><body></body></html>' },
    { code: 'css', sample: '.btn { font-size: 16px; }' },
    { code: 'scss', sample: '.btn { font-size: 16px; &.active { background: red; } }' },
    { code: 'javascript', sample: 'function test(a, b) { return a + b; }' },
    { code: 'typescript', sample: 'const test = (a: number, b: number) => { return a + b; }' },
    
    { code: 'python', sample: 'def add(a, b): return a + b' },
    { code: 'cpp', sample: 'int main() { return 0; }' },
    { code: 'csharp', sample: 'class Test { static void Main() {} }' },
    { code: 'java', sample: 'public class Main { public static void main(String[] args) {} }' },
    { code: 'go', sample: 'package main func main() {}' },
]
const changeLan = (lan: any) => {
    configs.value.language = lan
    txt.value = lans.find((a: any) => a.code == lan)?.sample ?? ""
}
</script>

<template>
    <div class="sections">
        <codeView v-model:value="txt" :configs="configs"></codeView>
        <div class="box-edit">
            <a-select ref="select" style="width: 100%" v-model:value="configs.language" @change="changeLan">
                <a-select-option v-for="item in lans" :value="item.code">{{ item.code }}</a-select-option>
            </a-select>
            <a-textarea v-model:value="txt" style="height: 300px;" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.sections {
    position: relative;
    padding: 0;

    .box-edit {
        position: absolute;
        right: 140px;
        bottom: 12px;
        width: 500px;
        height: 332px;
        border-radius: 8px;
        background: #ffffff8d;
    }
}
</style>
