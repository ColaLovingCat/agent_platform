<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Graph } from '@antv/g6';
import * as extend from '@/commons/utils/extends'

defineOptions({
  name: 'app-graph'
});

const props = defineProps({
  datas: {
    type: Object,
    required: true,
    default: () => ({ nodes: [], edges: [] })
  },
  configs: {
    type: Object,
    required: false,
    default: () => ({})
  },
  changeMark: {
    type: Boolean,
    required: false
  }
});

const emit = defineEmits<{
  (e: 'node-click', node: any): void;
  (e: 'node-dblclick', node: any): void;
  (e: 'edge-click', edge: any): void;
  (e: 'canvas-click'): void;
}>();

const graphRef = ref<HTMLDivElement | null>(null);
let graph: Graph | null = null;
let observer: ResizeObserver | null = null;

/**
 * 自适应计算参数
 */
const getAdaptiveParams = (nodeCount: number, width: number, height: number) => {
  const area = width * height;
  const baseNodeSize = Math.max(25, Math.min(60, Math.sqrt(area / Math.max(nodeCount, 1)) * 0.12));
  const baseLinkDistance = Math.max(100, Math.min(250, Math.sqrt(area / Math.max(nodeCount, 1)) * 0.4));
  
  return {
    baseNodeSize,
    baseLinkDistance,
    nodeStrength: -300,
  };
};

/**
 * 初始化图实例
 */
const initGraph = async () => {
  await nextTick();

  const container = graphRef.value;
  if (!container) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;

  if (graph) {
    graph.destroy();
    graph = null;
  }

  const { nodes = [], edges = [] } = props.datas || {};
  const adaptive = getAdaptiveParams(nodes.length, width, height);

  const nodeIds = new Set(nodes.map((n: any) => n.id));
  const safeEdges = edges.filter(
    (e: any) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  graph = new Graph({
    container,
    width,
    height,
    autoFit: 'view',
    data: {
      nodes: nodes.map((n: any) => ({
        id: n.id,
        data: { ...n }
      })),
      edges: safeEdges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        style: {
          lineWidth: Math.max(1, Math.min(5, (e.data?.weight || 1) * 0.5))
        },
        data: { 
          ...e,
          weight: e.data?.weight || e.weight || 1
        }
      }))
    },
    layout: {
      type: 'd3-force',
      link: {
        distance: (model: any) => {
          const w = model?._original?.data?.weight || 1;
          const base = adaptive.baseLinkDistance;
          // weight 越大距离越近：1->150%, 5->100%, 10->50%, 20->最小20%
          const factor = Math.max(0.2, 1.5 - w * 0.065);
          console.log('weight:', w, 'distance:', base * factor);
          return base * factor;
        },
      },
      manyBody: {
        strength: adaptive.nodeStrength,
      },
      collide: {
        radius: adaptive.baseNodeSize,
        strength: 0.8,
      },
    },
    node: {
      type: 'circle',
      style: {
        size: (d: any) => d.data?.size || adaptive.baseNodeSize,
        fill: (d: any) => d.data?.color || '#6366f1',
        stroke: '#fff',
        lineWidth: 2,
        labelText: (d: any) => d.data?.label || d.id,
        labelFill: '#fff',
        labelFontSize: 12,
        labelFontWeight: 500,
        labelPlacement: 'center',
      },
      state: {
        selected: {
          stroke: '#8b5cf6',
          lineWidth: 3,
          halo: true,
          haloStroke: '#8b5cf6',
          haloLineWidth: 10,
        },
        highlight: {
          stroke: '#ec4899',
          lineWidth: 3,
        },
      },
    },
    edge: {
      type: 'line',
      style: {
        stroke: '#94a3b8',
        lineWidth: 2,
        labelText: (d: any) => d.data?.label || '',
        labelFontSize: 10,
        labelFill: '#666',
        labelBackground: true,
        labelBackgroundFill: '#fff',
        labelBackgroundOpacity: 0.8,
        labelPadding: [2, 6],
      },
      state: {
        selected: {
          stroke: '#8b5cf6',
          lineWidth: 3,
        },
        highlight: {
          stroke: '#a855f7',
          lineWidth: 3,
        },
      },
    },
    behaviors: [
      'zoom-canvas',
      'drag-canvas',
      'drag-element',
      'click-select',
    ],
  });

  await graph.render();
  
  bindEvents();
};

/**
 * 绑定图事件
 */
const bindEvents = () => {
  if (!graph) return;

  graph.on('node:click', (e: any) => {
    const nodeId = e.target?.id;
    if (nodeId) {
      const nodeData = graph?.getNodeData(nodeId);
      emit('node-click', { id: nodeId, data: nodeData });
    }
  });

  graph.on('node:dblclick', (e: any) => {
    const nodeId = e.target?.id;
    if (nodeId) {
      const nodeData = graph?.getNodeData(nodeId);
      emit('node-dblclick', { id: nodeId, data: nodeData });
    }
  });

  graph.on('edge:click', (e: any) => {
    const edgeId = e.target?.id;
    if (edgeId) {
      const edgeData = graph?.getEdgeData(edgeId);
      emit('edge-click', { id: edgeId, data: edgeData });
    }
  });

  graph.on('canvas:click', () => {
    emit('canvas-click');
  });
};

/**
 * 更新图数据
 */
const updateGraph = async () => {
  if (!graph) {
    await initGraph();
    return;
  }

  const { nodes = [], edges = [] } = props.datas || {};
  const nodeIds = new Set(nodes.map((n: any) => n.id));
  const safeEdges = edges.filter(
    (e: any) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  graph.setData({
    nodes: nodes.map((n: any) => ({
      id: n.id,
      data: { ...n }
    })),
    edges: safeEdges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { ...e }
    }))
  });

  await graph.render();
};

/**
 * 监听容器大小变化
 */
const handleResize = () => {
  if (!graph || !graphRef.value) return;
  
  const width = graphRef.value.clientWidth;
  const height = graphRef.value.clientHeight;
  if (!width || !height) return;

  graph.setSize(width, height);
  graph.fitView();
};
const debouncedResize = extend.Optimize.debounceFn(handleResize, 300);

/**
 * 暴露方法给父组件
 */
defineExpose({
  getGraph: () => graph,
  refresh: () => initGraph(),
  fitView: () => graph?.fitView(),
  focusNode: (nodeId: string) => graph?.focusElement(nodeId),
  clearStates: () => {
    graph?.setElementState(graph.getNodeData().map((n: any) => n.id), []);
    graph?.setElementState(graph.getEdgeData().map((e: any) => e.id), []);
  }
});

onMounted(() => {
  initGraph();

  observer = new ResizeObserver(() => {
    debouncedResize();
  });
  if (graphRef.value) observer.observe(graphRef.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  graph?.destroy();
  graph = null;
});

watch(
  () => props.datas,
  () => updateGraph(),
  { deep: true }
);

watch(
  () => props.changeMark,
  () => graph?.fitView()
);
</script>

<template>
  <div class="graph-view" ref="graphRef" style="width: 100%; height: 100%"></div>
</template>

<style scoped lang="scss"></style>
