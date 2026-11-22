<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'
//@ts-ignore
import QRCode from "qrcode";

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
            width: 80,
        })
    },
})

const codeRef = ref(null)
const render = () => {
    if (!codeRef.value) return

    if (props.data && props.data != '') {
        QRCode.toCanvas(
            codeRef.value,
            props.data,
            {
                margin: 2,
                width: props.configs.width,
                color: {
                    dark: "#000",
                    light: "#fff",
                },
            },
            (error: any) => {
                if (error) console.error(error);
            }
        );
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
    <canvas ref="codeRef"></canvas>
</template>

<style scoped lang="scss"></style>
