<template>
  <div
    class="absolute top-20 left-20 w-96 h-64 bg-white shadow-lg rounded-md border flex flex-col"
    ref="windowRef"
    v-draggable
  >
    <!-- 标题栏 -->
    <div class="flex items-center bg-gray-100 px-3 py-1 cursor-move">
      <div class="flex gap-2 mr-2">
        <button class="w-3 h-3 rounded-full bg-red-500" @click="$emit('close')" />
        <button class="w-3 h-3 rounded-full bg-yellow-500" />
        <button class="w-3 h-3 rounded-full bg-green-500" />
      </div>
      <span class="text-sm">{{ title }}</span>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-auto">
      <component :is="component" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

defineProps<{ title: string; component: string }>()
const windowRef = ref<HTMLElement | null>(null)
</script>
