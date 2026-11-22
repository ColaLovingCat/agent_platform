<script lang="ts" setup>
import { ref, watch, computed } from "vue";

// name
defineOptions({
  name: 'app-flip'
})

// props
const props = defineProps({
  number: {
    type: String,
    require: true
  },
  fontSize: {
    type: [Number, String],
    default: 16,
  },
})

const prevNumber = ref(props.number);
const flipping = ref(false);

watch(() => props.number, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    prevNumber.value = oldVal;
    flipping.value = true;
    setTimeout(() => {
      flipping.value = false;
    }, 500);
  }
});

const computedFontSize = computed(() => props.fontSize * 1);
</script>

<template>
  <div class="flip-container" :style="{
    fontSize: `${computedFontSize}px`,
    height: `${computedFontSize * 1.25}px`,
    width: `${computedFontSize * 0.8}px`
  }">
    <!-- 前一个数字 -->
    <transition name="flip" mode="out-in">
      <span v-if="flipping" class="number old">{{ prevNumber }}</span>
    </transition>

    <!-- 当前数字 -->
    <transition name="flip" mode="out-in">
      <span v-if="!flipping" class="number new">{{ number }}</span>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.flip-container {
  position: relative;
  font-weight: 700;
  text-align: center;
  overflow: hidden;
  display: inline-block;
}

.number {
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
  text-align: center;
  font-weight: 700;
  border-radius: 5px;
}

/* 翻转动画 */
.flip-enter-active,
.flip-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}

.flip-enter-from {
  transform: rotateX(90deg);
  opacity: 0;
}

.flip-leave-to {
  transform: rotateX(-90deg);
  opacity: 0;
}
</style>
