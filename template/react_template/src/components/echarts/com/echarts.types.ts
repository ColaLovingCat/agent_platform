export const defaultOptions: any = {
  // ... 全局样式 (为了篇幅简洁，使用与原来相同的配置内容)
  color: [
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
  backgroundColor: "transparent",
  textStyle: {
    color: "#071c43",
    fontWeight: 500,
    fontSize: 18,
  },
  title: {
    show: false,
    left: "center",
    text: "",
    textStyle: {},
    subtext: "",
    subtextStyle: {},
    link: "",
    target: "blank",
  },
  grid: {
    left: 0,
    bottom: 0,
    containLabel: true,
  },
  legend: {
    show: true,
    data: [],
    orient: "vertical",
    x: "right",
    y: "middle",
    type: "scroll",
    height: 600,
    textStyle: {},
  },
  tooltip: {
    show: true,
    trigger: "axis",
    axisPointer: { type: "cross" },
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
  xAxis: {
    show: true,
    type: "category",
    data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    boundaryGap: false,
    name: "",
    nameLocation: "center",
    nameGap: 15,
    axisLine: {
      show: false,
      lineStyle: { type: "solid" },
    },
    axisTick: { show: false },
    axisLabel: {
      show: false,
      color: "#fff",
      fontSize: 14,
      formatter: "{value} %",
    },
    splitLine: {
      show: false,
      lineStyle: { type: "dashed", opacity: 0.6 },
    },
    splitArea: { show: false },
  },
  yAxis: [
    {
      type: "value",
      axisLabel: { formatter: "{value} %" },
      offset: 0,
    },
    { type: "value" },
  ],
  series: [
    {
      name: "Bar",
      type: "bar",
      stack: "",
      data: [820, 932, 901, 934, 1290, 1330, 1320],
      color: "#ea0016",
      barWidth: 30,
      itemStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "#007bc0" },
            { offset: 1, color: "#007bc03d" },
          ],
        },
      },
      label: {
        show: false,
        color: "#fff",
        fontWeight: "normal",
        fontSize: 12,
      },
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
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "#B7E88F8D" },
            { offset: 1, color: "#B7E88F2D" },
          ],
        },
      },
    },
  ],
  toolbox: {
    feature: {
      dataZoom: { yAxisIndex: "none" },
      restore: {},
      saveAsImage: {},
    },
  },
  dataZoom: [
    { type: "inside", xAxisIndex: [0], start: 0, end: 100 },
    { type: "slider", xAxisIndex: [0], start: 0, end: 100 },
  ],
  animationDuration: 1000,
  animationEasing: "cubicOut",
  responsive: true,
  maintainAspectRatio: true,
};
