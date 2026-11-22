<script lang="ts" setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  number: { type: [String, Number], required: true },
  fontSize: { type: Number, default: 18 },
  auto: { type: Boolean, default: false },
  timer: { type: Number, default: 3000 },
});

const roller = ref<HTMLElement | null>(null);
// 两圈数字 0-9, 0-9，方便滚动一圈后回位
const digits = [...Array(10).keys(), ...Array(10).keys()];

let currentIndex = Number(props.number) % 10 || 0; // 当前“稳定”位置（0-9）
let intervalId: any = null;

// 立即设置 transform（无过渡），用于首次初始化或在 transitionend 后回位置
function setTransformNoTransition(idx: number) {
  if (!roller.value) return;
  roller.value.style.transition = 'none';
  roller.value.style.transform = `translateY(-${idx * props.fontSize * 1.25}px)`;
  // 强制回流（可选，确保浏览器应用样式）
  // void roller.value.offsetHeight;
}

// 执行动画滚动到 newNum（0-9）
function startRolling(newNum?: string | number) {
  if (!roller.value) return;
  const target = typeof newNum === 'undefined' ? currentIndex : Number(newNum) % 10;
  if (isNaN(target)) return;

  const targetIndex = target + 10; // 从第二圈滚动到目标，视觉上是一圈滚动

  // 先无动画跳到当前稳定位置（防止中途显示其它值）
  setTransformNoTransition(currentIndex);

  // 下一帧开启动画到目标位置
  requestAnimationFrame(() => {
    if (!roller.value) return;
    roller.value.style.transition = 'transform 1.5s ease-in-out';
    roller.value.style.transform = `translateY(-${targetIndex * props.fontSize * 1.25}px)`;

    // 动画结束后把位置回置到“第二圈对应的原位”，并更新 currentIndex
    const onEnd = () => {
      if (!roller.value) return;
      setTransformNoTransition(target);
      currentIndex = target;
    };

    // use once:true 保证监听只触发一次
    roller.value.addEventListener('transitionend', onEnd, { once: true });
  });
}

// 当 props.number 改变时触发滚动（注意首次初始化已在 onMounted 处理）
watch(
  () => props.number,
  (val) => {
    // 如果 roller 还没准备好则不做（首次会在 onMounted 里初始化）
    if (!roller.value) return;
    startRolling(val);
  }
);

onMounted(async () => {
  // 等 DOM 绑定完毕
  await nextTick();

  // 初始化 currentIndex 为初始传入的数字（避免初次显示 0）
  currentIndex = Number(props.number) % 10 || 0;
  // 立即把 roller 定位到正确位置（无动画）
  setTransformNoTransition(currentIndex);

  // 如果需要自动滚动，启动定时器
  if (props.auto) {
    intervalId = setInterval(() => {
      startRolling(currentIndex);
    }, props.timer);
  }
});

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId);
});

const getKey = (num: number) => {
  return num + '-' + Math.random()
}
</script>

<template>
  <div class="number-roller" :style="{
    height: `${fontSize * 1.25}px`,
    width: `${fontSize * 0.8}px`
  }">
    <span ref="roller" class="roller">
      <span v-for="num in digits" :key="getKey(num)" class="digit" :style="{
        fontSize: `${fontSize}px`,
        height: `${fontSize * 1.25}px`,
        lineHeight: `${fontSize * 1.25}px`,
        width: `${fontSize * 0.8}px`
      }">
        {{ num }}
      </span>
    </span>
  </div>
</template>

<style scoped lang="scss">
.number-roller {
  display: inline-block;
  overflow: hidden;
  width: auto;
  text-align: center;
  position: relative;
}

.roller {
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;
}

.digit {
  text-align: center;
  font-weight: bold;
}
</style>
