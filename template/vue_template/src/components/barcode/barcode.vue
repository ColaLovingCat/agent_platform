<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'
import JsBarcode from 'jsbarcode'

// name
defineOptions({
    name: 'custom-name'
})

// props
const props = defineProps({
    data: {
        type: String,
        default: ''
    },
    configs: {
        type: Object,
        default: () => ({
            height: 40,
            displayValue: true,
        })
    },
})

const codeRef = ref(null)

const render = () => {
    if (!codeRef.value) return

    if (props.data && props.data != '') {
        JsBarcode(codeRef.value, props.data, Object.assign({
            format: 'CODE128',
            lineColor: '#000',
            width: 2,
            height: 40,
            displayValue: true
        }, props.configs))
    }
}

onMounted(() => { render() })
watch(
    () => props.data,
    (newValue, oldValue) => { render() }
)
watch(
    () => props.configs,
    (newValue, oldValue) => { render() },
    { deep: true, immediate: true }
)
</script>

<template>
    <svg ref="codeRef"></svg>
</template>

<style scoped lang="scss"></style>
