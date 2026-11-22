<script lang="ts" setup>
import { computed } from "vue";
import flipView from "./flip.vue";
import rollerView from "./roller.vue";

// name
defineOptions({
  name: 'app-flip'
})

// props
const props = defineProps({
  value: {
    type: Number,
    required: true,
  },
  configs: {
    type: Object,
    default: () => ({
      type: 'flip',
      dec: 2,
      fontSize: 18,
      auto: true,
      timer: 3000,
    })
  },
})

const digits = computed(() => props.value.toFixed(props.configs.dec).split(""));
</script>

<template>
  <div class="flip-group">
    <template v-for="(char, index) in digits" :key="index">
      <template v-if="char == '.'">
        <span :style="`width: ${configs.fontSize * 0.5}px; font-size: ${configs.fontSize}px; font-weight: 700`">.</span>
      </template>
      <template v-else>
        <template v-if="configs.type == 'flip'">
          <flipView :number="char" :font-size="configs.fontSize" />
        </template>
        <template v-else>
          <rollerView :number="char" :font-size="configs.fontSize" :auto="configs.auto" :timer="configs.timer" />
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
.flip-group {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
