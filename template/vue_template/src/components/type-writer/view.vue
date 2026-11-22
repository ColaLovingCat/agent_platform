<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
    staticText: { type: String, default: "test text for" },
    words: { type: Array as () => string[], default: () => ["demo1", "demo2"] },
    subTitle: { type: String, default: "subtitle" },
    typeSpeed: { type: Number, default: 100 },
    deleteSpeed: { type: Number, default: 50 },
    pause: { type: Number, default: 2000 }
});

const displayText = ref("");
const wordIndex = ref(0);
const charIndex = ref(0);
const isDeleting = ref(false);
let timeoutId: any = null;

const type = () => {
    const currentWord = props.words[wordIndex.value];

    if (isDeleting.value) {
        // 正在删除
        displayText.value = currentWord.substring(0, charIndex.value - 1);
        charIndex.value--;
    } else {
        // 正在打字
        displayText.value = currentWord.substring(0, charIndex.value + 1);
        charIndex.value++;
    }

    // 逻辑判断
    let delta = isDeleting.value ? props.deleteSpeed : props.typeSpeed;

    if (!isDeleting.value && charIndex.value === currentWord.length) {
        // 打完了，停顿
        isDeleting.value = true;
        delta = props.pause;
    } else if (isDeleting.value && charIndex.value === 0) {
        // 删完了，换下一个词
        isDeleting.value = false;
        wordIndex.value = (wordIndex.value + 1) % props.words.length;
        delta = 500;
    }

    timeoutId = setTimeout(type, delta);
};

onMounted(() => {
    type();
});

onUnmounted(() => {
    clearTimeout(timeoutId);
});
</script>

<template>
    <div class="hero-container">
        <h1 class="hero-title">
            <span class="static-text">{{ staticText }}</span>
            <span class="dynamic-wrapper">
                <span class="dynamic-text">{{ displayText }}</span>
                <span class="cursor">|</span>
            </span>
        </h1>
        <p class="hero-subtitle">{{ subTitle }}</p>
    </div>
</template>

<style scoped lang="scss">
.hero-container {
    padding: 80px 40px;
    text-align: center;
    background: transparent;

    .hero-title {
        text-align: left;
        font-size: 3.5rem;
        font-weight: 800;
        color: #1a1a1a;
        letter-spacing: -0.02em;
        line-height: 1.2;

        .static-text {
            color: #1f2937;
            text-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        }

        .dynamic-wrapper {
            margin-left: 15px;
            display: inline-block;
            min-width: 300px;

            .dynamic-text {
                text-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
                background: linear-gradient(120deg, #007bc0 0%, #005a8c 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .cursor {
                margin-left: 2px;
                color: #007bc0;
                font-weight: 300;
                animation: blink 1s infinite;
            }
        }
    }

    .hero-subtitle {
        margin-top: 24px;
        font-size: 1.25rem;
        color: #64748b;
    }
}

@keyframes blink {

    from,
    to {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }
}

/* 响应式适配 */
@media (max-width: 1024px) {
    .hero-container .hero-title {
        font-size: 2.5rem;
    }
}
</style>