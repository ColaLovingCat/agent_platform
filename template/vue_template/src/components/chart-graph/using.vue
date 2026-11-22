<script setup>
import { reactive, ref } from 'vue'

import graphView from "@/components/chart-graph/view.vue";

import * as extend from '@/commons/utils/extends'

const childRef = ref(null);

const datas = reactive({
    nodes: [
        {
            id: '1',
            label: 'Center',
            type: 'level1',
            data: { type: 'level1' },
            size: 60,
            color: '#6366f1',
        },
        {
            id: '2',
            label: '2',
            type: 'level2',
            data: { type: 'level2' },
            size: 40,
            color: '#8b5cf6',
        },
        {
            id: '3',
            label: '3',
            type: 'level2',
            data: { type: 'level2' },
            size: 40,
            color: '#8b5cf6',
        },
        {
            id: '4',
            label: '4',
            type: 'level3',
            data: { type: 'level2' },
            size: 20,
            color: '#a855f7',
        },
        {
            id: '5',
            label: '5',
            type: 'level3',
            data: { type: 'level2' },
            size: 20,
            color: '#a855f7',
        },
    ],
    edges: [
        {
            id: '1-2',
            source: '1',
            target: '2',
            label: 'connects',
            data: { weight: 20 }
        },
        {
            id: '1-3',
            source: '1',
            target: '3',
            label: 'connects',
            data: { weight: 10 }
        },
        {
            id: '1-4',
            source: '1',
            target: '4',
            label: 'links',
            data: { weight: 5 }
        },
        {
            id: '1-5',
            source: '1',
            target: '5',
            label: 'links',
            data: { weight: 5 }
        }
    ],
});

const addNode = () => {
    const id = extend.ExString.uuid()
    const types = ['level2', 'level3'];
    const colors = ['#8b5cf6', '#a855f7', '#ec4899'];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = type === 'level2' ? 40 : 30;

    const node = {
        id,
        label: `Node ${id.slice(0, 4)}`,
        type,
        data: { type },
        size,
        color,
    };

    const targetNodes = datas.nodes.filter(n => n.type !== 'level3');
    const randomTarget = targetNodes[Math.floor(Math.random() * targetNodes.length)];

    datas.nodes.push(node);
    datas.edges.push({
        id: `${randomTarget.id}-${id}`,
        source: randomTarget.id,
        target: id,
        label: 'link',
        data: { weight: Math.floor(Math.random() * 10) + 1 }
    });
};

const removeNode = () => {
    if (datas.nodes.length <= 1) return;
    const index = extend.ExNumber.createRand(1, datas.nodes.length - 1);
    const node = datas.nodes[index];
    datas.edges = datas.edges.filter(e => e.source !== node.id && e.target !== node.id);
    datas.nodes = extend.ExArray.delete(datas.nodes, index);
};

const removeEdge = () => {
    if (datas.edges.length <= 0) return;
    const index = extend.ExNumber.createRand(0, datas.edges.length - 1);
    datas.edges = extend.ExArray.delete(datas.edges, index);
};

const onNodeClick = (node) => {
    console.log('Node clicked:', node);
};

const onNodeDblclick = (node) => {
    console.log('Node double-clicked:', node);
    childRef.value?.focusNode(node.id);
};

const onEdgeClick = (edge) => {
    console.log('Edge clicked:', edge);
};

const onCanvasClick = () => {
    console.log('Canvas clicked, clear selection');
};

const fitView = () => {
    childRef.value?.fitView();
};

const clearStates = () => {
    childRef.value?.clearStates();
};
</script>

<template>
    <div class="sections">
        <div class="btns">
            <a-button @click="addNode">Add Node</a-button>
            <a-button @click="removeNode">Remove Node</a-button>
            <a-button @click="removeEdge">Remove Edge</a-button>
            <a-button @click="fitView">Fit View</a-button>
            <a-button @click="clearStates">Clear States</a-button>
        </div>
        <div class="box-chart">
            <graphView
                ref="childRef"
                :datas="datas"
                @node-click="onNodeClick"
                @node-dblclick="onNodeDblclick"
                @edge-click="onEdgeClick"
                @canvas-click="onCanvasClick"
            />
        </div>
    </div>
</template>

<style lang="css" scoped>
.sections {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 20px;
}

.btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
}

.box-chart {
    width: 80vw;
    height: 70vh;
    border-radius: 12px;
    border: 1px solid rgba(229, 231, 235, 0.8);
    background: #fff;
    box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(0, 0, 0, 0.03);
    overflow: hidden;
}
</style>
