import {
  Graph,
  Stencil,
  Snapline,
  Transform,
  Selection,
  Keyboard,
} from "@antv/x6";
import { register } from "@antv/x6-vue-shape";
//@ts-ignore
import dagre from "dagre";

import flowNode from "../flows-node.vue";
import { getEdge } from "@/views/func/flows/modules";

const ports = {
  groups: {
    left: {
      position: "left",
      attrs: {
        circle: {
          r: 6,
          magnet: true,
          stroke: "#87ab7b",
          strokeWidth: 2,
          fill: "#fff",
        },
      },
    },
    right: {
      position: "right",
      attrs: {
        circle: {
          r: 6,
          magnet: true,
          stroke: "#87ab7b",
          strokeWidth: 2,
          fill: "#fff",
        },
      },
    },
  },
};
register({
  shape: "flows-node",
  component: flowNode,
  ports,
});
Graph.registerEdge(
  "dag-edge",
  {
    inherit: "edge",
    attrs: {
      line: {
        stroke: "#C2C8D5",
        strokeWidth: 1,
        targetMarker: null,
      },
    },
  },
  true,
);

export function useGraph(containerRef: any) {
  const graph: any = new Graph({
    container: containerRef,
    width: containerRef.clientWidth,
    height: containerRef.clientHeight,
    // 网格
    grid: {
      visible: true,
      size: 20,
      type: "dot",
      args: {
        color: "#a0a0a0",
        thickness: 1,
      },
    },
    // 平移
    panning: true,
    // 缩放
    mousewheel: true,
    //
    connecting: {
      anchor: "center",
      connectionPoint: "anchor",
      connector: "smooth", // 设置连接线样式
      allowBlank: false,
      allowMulti: false,
      snap: true,
      highlight: true,
      createEdge() {
        return graph.createEdge(getEdge());
      },
    },
  });

  graph
    .use(
      // 移动
      new Transform({
        resizing: false,
        rotating: false,
      }),
    )
    .use(new Snapline()) // 对齐线
    .use(
      new Selection({
        rubberband: false,
        showNodeSelectionBox: true,
      }),
    )
    .use(new Keyboard());

  // 删除节点
  graph.bindKey("backspace", () => {
    const cells = graph.getSelectedCells();
    if (cells.length) {
      graph.removeCells(cells);
    }
  });
  graph.bindKey("delete", () => {
    const cells = graph.getSelectedCells();
    if (cells.length) {
      graph.removeCells(cells);
    }
  });

  return graph;
}

export function useStencil(graph: any, stencilRef: any) {
  const stencil: any = new Stencil({
    title: "",
    target: graph,
    groups: [],
    //
    stencilGraphWidth: 320,
    stencilGraphHeight: 60,
    collapsable: true,
    layoutOptions: {
      columns: 1,
      columnWidth: 320,
      rowHeight: 60,
    },
  });
  stencilRef.appendChild(stencil.container);

  return stencil;
}
