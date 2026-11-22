<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from "vue";
import { BrowserMultiFormatReader } from '@zxing/library';

import { logger } from '@/commons/utils/logger'
const log = logger.create("Scan");

defineOptions({
    name: "CameraScanner"
});

const emits = defineEmits<{
    (event: 'scanned', values: any): void
}>()

// 摄像头
const videoRef = ref<HTMLVideoElement | null>(null);
let stream: MediaStream | null = null;

// ZXing 扫码器
const codeReader = new BrowserMultiFormatReader();

// 打开摄像头
const startCamera = async (facingMode: "user" | "environment" = "environment") => {
    try {
        if (stream) stopCamera();

        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false
        });

        if (videoRef.value) {
            videoRef.value.srcObject = stream;
            await videoRef.value.play();

            // 扫描结果
            codeReader.decodeFromVideoDevice(null, videoRef.value, (result, err) => {
                if (result) {
                    const txt = result.getText()
                    log.log('', txt)
                    emits('scanned', txt)
                }
                if (err && !(err.name === 'NotFoundException')) {
                }
            });
        }
    } catch (err) {
        console.error("无法访问摄像头:", err);
    }
};

// 关闭摄像头
const stopCamera = () => {
    codeReader.reset(); // 停止 decodeFromVideoElement 内部循环
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
};

onMounted(() => {
    startCamera("environment"); // 默认后置摄像头
});

onBeforeUnmount(() => {
    stopCamera();
});

// 暴露方法给外部调用
defineExpose({
    startCamera,
    stopCamera,
});
</script>

<template>
    <div class="camera-wrapper">
        <video ref="videoRef" autoplay playsinline muted class="camera-video"></video>
    </div>
</template>

<style scoped>
.camera-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    background: black;
}

.camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
