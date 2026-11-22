<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'

// name
defineOptions({
    name: 'app-robot'
})

// props
const props = defineProps({
    status: {
        type: String,
        default: 'idle'
    },
})

onMounted(() => { })

/**
 * 嘴巴控制点 Y 值（用来控制弧度）
 * M 70 130 Q 100 controlY 130 130
 */
const mouthControlY = ref(130)

/**
 * 根据 status 决定目标的控制点 Y
 */
const targetMouthY = computed(() => {
    switch (props.status) {
        case 'idle':
            return 150 // 轻微上扬（130 上方一点）
        case 'sad':
            return 115 // 向下（130 下方一点）
        case 'think':
            return 130 // 平嘴
        case 'normal':
        default:
            return 130 // 平嘴
    }
})

/**
 * 计算当前 path 的 d
 */
const mouthD = computed(() => {
    const cy = mouthControlY.value
    // 基线从 140 -> 130
    return `M 70 130 Q 100 ${cy} 130 130`
})

/**
 * 监听 status，做一个嘴巴弧度的过渡动画
 */
let mouthAnimationFrame: number | null = null

watch(
    () => props.status,
    () => {
        // 动画参数
        const duration = 200 // 动画时长 ms
        const start = performance.now()
        const from = mouthControlY.value
        const to = targetMouthY.value

        if (mouthAnimationFrame != null) {
            cancelAnimationFrame(mouthAnimationFrame)
        }

        const animate = (time: number) => {
            const progress = Math.min((time - start) / duration, 1)
            // 这里用线性插值，你也可以换成 ease-in-out 等缓动
            const value = from + (to - from) * progress
            mouthControlY.value = value

            if (progress < 1) {
                mouthAnimationFrame = requestAnimationFrame(animate)
            }
        }

        mouthAnimationFrame = requestAnimationFrame(animate)
    },
    { immediate: true },
)
</script>

<template>
    <div class="box-robot" :class="status">
        <svg class="robot-svg" width="200" height="200" viewBox="0 0 200 200">
            <!-- 头部背景 -->
            <!-- <rect x="30" y="30" width="140" height="140" rx="30" fill="#f5f5f5" stroke="#ccc" /> -->

            <!-- 左眼 -->
            <g class="eye eye-left">
                <rect x="60" y="70" width="20" height="40" rx="10" />
            </g>

            <!-- 右眼 -->
            <g class="eye eye-right">
                <rect x="120" y="70" width="20" height="40" rx="10" />
            </g>

            <!-- 嘴巴：只用一条 path，通过 mouthD 动态控制弧度 -->
            <path class="mouth" :d="mouthD" />

            <!-- think 状态：头上一个小气泡 -->
            <g class="think-bubble">
                <circle cx="150" cy="40" r="6" />
                <circle cx="165" cy="30" r="10" />
                <circle cx="180" cy="22" r="6" />
            </g>
        </svg>
    </div>
</template>

<style scoped lang="scss">
.box-robot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.robot-svg {
    overflow: visible;
}

/* 通用眼睛样式 */
.eye rect {
    fill: #333;
}

/* --- 眨眼动画 (idle) --- */
@keyframes blink-double {

    0%,
    5%,
    10%,
    100% {
        transform: scaleY(1);
    }

    2%,
    7% {
        transform: scaleY(0.1);
    }
}

/* idle 时眨眼 */
.box-robot.idle .eye {
    transform-origin: center 90px;
    animation: blink-double 3s infinite;
}

/* 其它状态不眨眼 */
.box-robot.normal .eye,
.box-robot.sad .eye,
.box-robot.think .eye {
    animation: none;
}

/* 嘴巴通用样式 */
.mouth {
    fill: none;
    stroke: #333;
    stroke-width: 8;
    stroke-linecap: round;

    /* 再加一点 transform 的过渡（比如 think 时轻微晃动） */
    transition: transform 0.2s ease;
}

/* idle：嘴巴轻微上下跳动一点点 */
@keyframes mouth-bounce {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-2px);
    }
}

.box-robot.idle .mouth {
    animation: mouth-bounce 1.5s infinite;
}

/* sad：嘴巴轻微抖动 */
@keyframes mouth-sad-shiver {

    0%,
    100% {
        transform: translateX(0);
    }

    25% {
        transform: translateX(-1px);
    }

    75% {
        transform: translateX(1px);
    }
}

.box-robot.sad .mouth {
    animation: mouth-sad-shiver 1.2s infinite;
}

/* --- think 状态 --- */
/* 气泡默认隐藏 */
.think-bubble {
    opacity: 0;
}

/* think 状态展示小气泡 */
.box-robot.think .think-bubble {
    opacity: 1;
    animation: bubble-breathe 1.4s infinite;
}

.think-bubble circle {
    fill: #a0c4ff;
}

/* 气泡呼吸动画 */
@keyframes bubble-breathe {

    0%,
    100% {
        transform: scale(1) translateY(0);
    }

    50% {
        transform: scale(1.05) translateY(-3px);
    }
}

/* think 状态：眼睛左右轻微移动 */
@keyframes eye-think-move {

    0%,
    100% {
        transform: translateX(0);
    }

    50% {
        transform: translateX(3px);
    }
}

.box-robot.think .eye {
    animation: eye-think-move 1s infinite;
}
</style>
