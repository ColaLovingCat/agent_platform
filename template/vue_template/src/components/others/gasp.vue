<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap';

// name
defineOptions({
  name: 'custom-name'
})

onMounted(() => {
  ctx = gsap.context((self) => {
    const boxes: any = gsap.utils.toArray('.box');
    tl = gsap
      .timeline()
      .to(boxes[0], { x: 120, rotation: 360 })
      .to(boxes[1], { x: -120, rotation: -360 }, '<')
      .to(boxes[2], { y: -166 })
      .reverse();
  }, main.value);
})

onUnmounted(() => {
  ctx.revert(); // <- Easy Cleanup!
});

const main = ref();
let tl: any;
let ctx: any;

function toggleTimeline() {
  tl.reversed(!tl.reversed());
}
</script>

<template>
  <div class="box-gsap">
    <button @click="toggleTimeline">Toggle Timeline</button>
    <div class="box gradient-green">Box 1</div>
    <div class="box gradient-green">Box 2</div>
    <div class="box gradient-green">Box 3</div>
  </div>
</template>

<style scoped lang="scss">
.box-gsap {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  button {
    margin: 20px 0;
    padding: 12px 25px;
    border: unset;
    border-radius: 15px;
  }
}

.box {
  margin-bottom: 20px;
  width: 75px;
  height: 75px;
  border-radius: 12px;
  color: #0e100f;
  text-align: center;
  line-height: 1.2;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform;
}

.gradient-green {
  background: linear-gradient(114.41deg, #0ae448 20.74%, #abff84 65.5%);
}
</style>
