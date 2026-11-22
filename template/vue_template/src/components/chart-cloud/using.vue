<script setup>
import { ref } from 'vue'

import cloudView from "@/components/chart-cloud/view.vue";

const words = ref([
    { text: "Vue", value: 150 },
    { text: "D3", value: 90 },
    { text: "Three.js", value: 130 },
    { text: "JavaScript", value: 90 },
    { text: "AntV", value: 85 },
    { text: "ECharts", value: 125 },
    { text: "AI", value: 125 },
    { text: "Data", value: 115 },
]);
</script>

<template>
    <div class="sections">
        <div class="box-chart">
            <cloudView :words="words" />
        </div>
    </div>
</template>

<style lang="css" scoped>
.sections {
    display: flex;
    justify-content: center;
    align-items: center;
}

.box-chart {
    width: 80vw;
    height: 70vh;
    border-radius: 10px;
    border: 1px solid #c4cecf9d;
    background: #fff;
}
</style>
