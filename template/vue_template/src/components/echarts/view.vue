<script lang="ts" setup>
import {
  onMounted,
  onBeforeUnmount,
  onUnmounted,
  ref,
  watch,
  useTemplateRef,
} from "vue";
import * as echarts from "echarts";

import * as extend from '@/commons/utils/extends'
import { logger } from '@/commons/utils/logger'
const log = logger.create("eCharts");

const defaultOptions: any = {
  // 全局样式
  color: [
    // 颜色
    "#c23531",
    "#2f4554",
    "#61a0a8",
    "#d48265",
    "#91c7ae",
    "#749f83",
    "#ca8622",
    "#bda29a",
    "#6e7074",
    "#546570",
    "#c4ccd3",
  ],
  backgroundColor: "transparent", // 背景
  textStyle: {
    // 文本
    color: "#071c43",
    fontWeight: 500,
    fontSize: 18,
  },
  // 标题
  title: {
    show: false,
    left: "center",
    //
    text: "",
    textStyle: {},
    subtext: "",
    subtextStyle: {},
    //
    link: "",
    target: "blank",
  },
  // 网格
  grid: {
    left: 0,
    bottom: 0,
    containLabel: true,
  },
  //
  legend: {
    // 图例
    show: true,
    data: [],
    orient: "vertical", // vertical| horizontal
    x: "right", // left| center| right
    y: "middle", // top| middle| bottom
    // 分页
    type: "scroll",
    height: 600,
    textStyle: {},
  },
  tooltip: {
    // 提示
    show: true,
    trigger: "axis", // item| axis
    axisPointer: {
      type: "cross", // line| cross| shadow
    },
    formatter: function (params: any) {
      if (Array.isArray(params)) {
        return params
          .map((p) => `<b>${p.seriesName}</b>: ${p.value}<br>`)
          .join("");
      } else {
        return `<b>${params.seriesName}</b>: ${params.value}`;
      }
    },
  },
  //
  xAxis: {
    show: true,
    type: "category", // category| value| time
    data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    boundaryGap: false, // 边界不留空隙
    //
    name: "",
    nameLocation: "center",
    nameGap: 15,
    // 轴线
    axisLine: {
      show: false,
      lineStyle: {
        type: "solid",
      },
    },
    // 刻度线
    axisTick: {
      show: false,
    },
    // 标签
    axisLabel: {
      show: false,
      color: "#fff",
      fontSize: 14,
      formatter: "{value} %",
    },
    // 网格线分割
    splitLine: {
      show: false,
      lineStyle: {
        type: "dashed",
        opacity: 0.6,
      },
    },
    // 网格颜色分割
    splitArea: {
      show: false,
    },
  },
  yAxis: [
    {
      type: "value",
      axisLabel: {
        formatter: "{value} %",
      },
      offset: 0,
    },
    {
      type: "value",
    },
  ],
  //
  series: [
    {
      name: "Bar",
      type: "bar",
      stack: "",
      data: [820, 932, 901, 934, 1290, 1330, 1320],
      color: "#ea0016",
      barWidth: 30,
      itemStyle: {
        // 柱状图样式配置
        color: {
          // 设置颜色为渐变色
          type: "linear", // 渐变类型为线性渐变
          x: 0, // 渐变起点为 x 轴坐标 0
          y: 0, // 渐变起点为 y 轴坐标 0
          x2: 0, // 渐变终点为 x 轴坐标 0
          y2: 1, // 渐变终点为 y 轴坐标 1
          colorStops: [
            {
              // 渐变颜色点列表
              offset: 0, // 渐变颜色点的偏移值（0-1）
              color: "#007bc0", // 第一个颜色点的颜色为红色
            },
            {
              offset: 1, // 渐变颜色点的偏移值（0-1）
              color: "#007bc03d", // 第二个颜色点的颜色为绿色
            },
          ],
        },
      },
      label: {
        show: false,
        color: "#fff",
        fontWeight: "normal",
        fontSize: 12,
      },
      // 刻度线
      markLine: {},
    },
    {
      name: "Line",
      type: "line",
      yAxisIndex: 1,
      data: [10, 12, 15, 17, 21, 8, 2],
      symbol: "none",
      smooth: false,
      lineStyle: {
        type: "dashed",
        width: 4,
      },
      // 区域图
      areaStyle: {
        color: {
          // 设置颜色为渐变色
          type: "linear", // 渐变类型为线性渐变
          x: 0, // 渐变起点为 x 轴坐标 0
          y: 0, // 渐变起点为 y 轴坐标 0
          x2: 0, // 渐变终点为 x 轴坐标 0
          y2: 1, // 渐变终点为 y 轴坐标 1
          colorStops: [
            {
              // 渐变颜色点列表
              offset: 0, // 渐变颜色点的偏移值（0-1）
              color: "#B7E88F8D", // 第一个颜色点的颜色为红色
            },
            {
              offset: 1, // 渐变颜色点的偏移值（0-1）
              color: "#B7E88F2D", // 第二个颜色点的颜色为绿色
            },
          ],
        },
      },
    },
  ],
  //
  toolbox: {
    feature: {
      dataZoom: { yAxisIndex: "none" },
      restore: {},
      saveAsImage: {},
    },
  },
  dataZoom: [
    {
      type: "inside", // 支持鼠标滚轮缩放
      xAxisIndex: [0],
      start: 0,
      end: 100,
    },
    {
      type: "slider", // 底部带滑块的缩放
      xAxisIndex: [0],
      start: 0,
      end: 100,
    },
  ],
  //
  animationDuration: 1000,
  animationEasing: "cubicOut",
  //
  responsive: true,
  maintainAspectRatio: true,
};

// name
defineOptions({
  name: "custom-name",
});

// props
const props = defineProps({
  options: {
    type: Object,
    default: () => ({}),
  },
  width: {
    type: String,
    default: "100%",
  },
  height: {
    type: String,
    default: "100%",
  },
  changeMark: {
    type: Boolean,
    require: false,
  },
});

// emits
const emit = defineEmits<{
  (event: "chartClick", values: any): void;
}>();

const echartsRef: any = useTemplateRef("echartsRef");
let chartInstance: any = null;
let observer: ResizeObserver | null = null;

const error = ref(false);

const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize();
    log.log("resize");
  }
};
const debouncedResize = extend.Optimize.debounceFn(handleResize, 500);

onMounted(() => {
  observer = new ResizeObserver(() => {
    debouncedResize()
  });
  observer.observe(echartsRef.value.parentElement);
  //
  chartInstance = echarts.init(echartsRef.value);
  refreshChart();
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

onUnmounted(() => {
  chartInstance.dispose();
});

watch(
  () => props.options,
  (newVal) => {
    if (chartInstance) {
      chartInstance.setOption(newVal);
    }
  },
  { deep: true }
);

watch(
  () => props.changeMark,
  () => {
    chartInstance.clear();
    refreshChart();
  }
);

const refreshChart = () => {
  error.value = false;
  //
  try {
    log.log("options", props.options);
    // 初始化图表
    chartInstance.setOption(props.options);
    //
    chartInstance.on("click", (params: any) => {
      emit("chartClick", params);
    });
  } catch (err) {
    error.value = true;
  }
};
</script>

<template>
  <div class="echart-ele" :style="{ width: width, height: height }" ref="echartsRef"></div>
  <div class="echart-error" v-if="error" :style="{ width: width, height: height }">
    图表初始化失败，请检查数据或配置
  </div>
</template>

<style scoped lang="scss">
:host {
  position: relative;

  .echart-error {
    position: absolute;
    top: 0;
    color: #5a5a5f4d;
    font-size: 16px;
    border: 2px dashed #c4cecf6d;
    border-radius: 8px;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>
