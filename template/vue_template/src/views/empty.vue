<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'

// name
defineOptions({
  name: 'custom-name'
})

// props
const props = defineProps({
  datas: {
    type: Object,
    default: () => ({})
  },
  changeMark: {
    type: Boolean,
    require: false
  }
})

// emits
const emits = defineEmits<{
  (event: 'update', values: any): void
}>()

onMounted(() => { })

watch(
  () => props.changeMark,
  (newValue, oldValue) => { }
)
</script>

<template>Empty</template>

<style scoped lang="scss"></style>
