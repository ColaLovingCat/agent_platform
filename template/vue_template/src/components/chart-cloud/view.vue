<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";

import * as d3 from "d3";
import cloud from "d3-cloud";

// name
defineOptions({
  name: 'app-cloud'
})

const props = defineProps({
  words: {
    type: Array,
    required: true,
    default: () => []
  },
});

const containerRef = ref(null);
const svgRef = ref(null);
let observer = null;

const handleResize = () => {
  const el = containerRef.value;
  if (!el) return;

  const { width, height } = el.getBoundingClientRect();
  drawWordCloud(width, height);
};

// 生命周期
onMounted(() => {
  handleResize();

  // 监听容器大小变化
  observer = new ResizeObserver(handleResize);
  observer.observe(containerRef.value);
});
onBeforeUnmount(() => {
  if (observer && containerRef.value) observer.unobserve(containerRef.value);
});
// 监听数据变化
watch(() => props.words, handleResize, { deep: true });

// 绘制函数
const drawWordCloud = (width, height) => {
  const svg = d3.select(svgRef.value);
  svg.selectAll("*").remove(); // 清空旧内容

  if (width <= 0 || height <= 0) return;

  const g = svg
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const layout = cloud()
    .size([width, height])
    .words(props.words.map(d => ({ text: d.text, size: d.value })))
    .padding(5)
    .rotate(() => (Math.random() > 0.5 ? 0 : 90))
    .font("Impact")
    .fontSize(d => d.size)
    .on("end", words => {
      g.selectAll("text")
        .data(words)
        .enter()
        .append("text")
        .style("font-family", "Impact")
        .style("fill", () => d3.schemeCategory10[Math.floor(Math.random() * 10)])
        .attr("text-anchor", "middle")
        .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
        .style("font-size", d => `${d.size}px`)
        .text(d => d.text);
    });

  layout.start();
};
</script>

<template>
  <div ref="containerRef" class="wordcloud-container">
    <svg ref="svgRef"></svg>
  </div>
</template>

<style scoped>
.wordcloud-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

svg {
  width: 100%;
  height: 100%;
}
</style>
