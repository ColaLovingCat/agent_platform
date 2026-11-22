<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch, onBeforeUnmount } from 'vue'

import * as extend from '@/commons/utils/extends'

interface Pen {
    stroke: string; // 颜色
    strokeWidth: number; // 线宽
    dashed?: boolean; // 虚实线
    radius?: number; // 圆角 点半径
    fill?: string; // 填充色
}
interface Shape {
    id: string;
    type: 'rect' | 'circle' | 'ellipse' | 'point';
    // 图形
    x: number; // 起始点
    y: number; // 起始点
    w: number; // 宽
    h: number; // 高
    // 框
    stroke: string;
    strokeWidth: number;
    dashed?: boolean;
    radius?: number;
    fill?: string;
    //
    infos?: any
}

// name
defineOptions({
    name: 'custom-name'
})

// props
const props = defineProps({
    mode: {
        type: String,
        default: '',
        require: false
    },
    imgUrl: {
        type: String,
        default: '',
        require: true,
    },
    shapes: {
        type: Array<Shape>,
        default: [],
        require: true,
    },
})

// emits
const emits = defineEmits<{
    (event: 'update:shapes', values: any): void
}>()

// 指示方向
type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | ''
const cursorMap: Record<ResizeDirection, string> = {
    nw: 'nwse-resize',
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
    move: 'move',
    '': 'default',
};

const isEditable = computed(() => props.mode === 'edit')
const pageInfos = reactive({
    drawMode: 'select' as any,
    //
    shapes: [] as Shape[],
    // 拖动画布
    isSpacePressed: false,
    isPanning: false,
    scrollStart: { left: 0, top: 0 },
    panStart: { x: 0, y: 0 },
    // 缩放
    scale: 1,
    size: { width: 0, height: 0 },
    // 绘画
    isDrawing: false,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    // 拖动形状
    isDragging: false,
    selectedShapeID: '',
    dragOffset: { x: 0, y: 0 },
    //
    isResizing: false,
    direction: '' as ResizeDirection,
})
// 选中形状
const selectedShape: any = computed(() => {
    return pageInfos.shapes.find(shape => shape.id === pageInfos.selectedShapeID)
})
// 画笔
const penInfos: Pen = reactive({
    stroke: '#ed0007', // 边框颜色
    strokeWidth: 4, // 边框宽度
    dashed: false, // 虚实线
    radius: 2, // 圆角
    fill: '', // 填充色
})

const canvasRef: any = ref(null)
const ctxRef: any = ref(null)
const imgRef: any = ref(null)
const containerRef: any = ref(null)

// 重新绘制 canvas 上的所有内容
const redraw = (rects: Shape[], tempShape?: Shape) => {
    if (imgRef.value) {
        // 清空
        pageInfos.shapes = [];
        ctxRef.value.clearRect(0, 0, ctxRef.value.width, ctxRef.value.height);

        ctxRef.value.save();
        ctxRef.value.scale(pageInfos.scale, pageInfos.scale);

        // 绘制图片
        ctxRef.value.drawImage(imgRef.value, 0, 0);

        // 绘制所有已保存的矩形
        rects.forEach((shape) => {
            draw(shape)
            pageInfos.shapes = [...pageInfos.shapes, shape];
        });

        // 绘制当前正在绘制的矩形
        if (tempShape) {
            draw(tempShape)
        }

        ctxRef.value.restore();
    };
}

onMounted(() => {
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    ctxRef.value = ctx;

    const img = new Image();
    img.src = props.imgUrl;
    img.onload = () => {
        pageInfos.size.width = img.width;
        pageInfos.size.height = img.height;
        //
        canvas.width = img.width;
        canvas.height = img.height;
        imgRef.value = img;
        redraw(props.shapes);
    }

    // 监听
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    //
    containerRef.value.addEventListener('wheel', handleWheel, { passive: false });
})
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    //
    containerRef.value.removeEventListener('wheel', handleWheel);
})

// 监听键盘
const handleKeyDown = (e: KeyboardEvent) => {
    // 拖动
    if (e.code === 'Space') {
        e.preventDefault()
        pageInfos.isSpacePressed = true
    }

    // 删除选中的图形
    if (e.code === 'Delete') {
        if (pageInfos.selectedShapeID != '') {
            // 删除对应的 shape
            pageInfos.shapes = pageInfos.shapes.filter(
                (shape) => shape.id !== pageInfos.selectedShapeID
            );
            // 重绘 canvas
            redraw(pageInfos.shapes);

            // 清空选中状态
            pageInfos.selectedShapeID = '';
            pageInfos.isDragging = false;

            // 同步数据
            syncData();
        }
    }
}
const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
        pageInfos.isSpacePressed = false
        pageInfos.isPanning = false
    }
}
// 监听滚轮
const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
        e.preventDefault();
        // 比例
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        pageInfos.scale = Math.round(Math.min(5, Math.max(0.2, pageInfos.scale + delta)) * 100) / 100
        // 缩放canvas
        const canvas = canvasRef.value;
        canvas.width = pageInfos.size.width * pageInfos.scale;
        canvas.height = pageInfos.size.width * pageInfos.scale;
        // 重绘
        redraw(pageInfos.shapes);
    }
};

watch(() => props.shapes, (newShapes) => {
    // 数据更新
    pageInfos.shapes = JSON.parse(JSON.stringify(newShapes))
    redraw(pageInfos.shapes)
}, { immediate: true, deep: true })
// 同步数据
const syncData = () => {
    emits('update:shapes', pageInfos.shapes)
}

//#region Events
// 处理鼠标事件
const handleMousedown = (event: MouseEvent) => {
    // 拖动画布
    if (pageInfos.isSpacePressed) {
        pageInfos.isPanning = true
        pageInfos.panStart = { x: event.clientX, y: event.clientY }
        pageInfos.scrollStart = {
            left: containerRef.value.scrollLeft,
            top: containerRef.value.scrollTop,
        }
        event.preventDefault()
        return;
    }

    // 不可编辑
    if (!isEditable) return;

    // 记录位置
    const pos = getMousePos(canvasRef.value, event);
    pageInfos.startPosition = pos
    pageInfos.currentPosition = pos

    // 已有选中的形状
    if (pageInfos.selectedShapeID != '') {
        const shape = pageInfos.shapes.find(s => s.id === pageInfos.selectedShapeID);
        if (shape) {
            const direction = getResizeHandleDirection(shape, pos);
            // 改变自己的位置
            if (direction == 'move') {
                pageInfos.drawMode = 'select'
                pageInfos.isDragging = true;
                pageInfos.dragOffset = { x: pageInfos.startPosition.x - shape.x, y: pageInfos.startPosition.y - shape.y }
                return;
            }
            // 改变自己的形状
            if (direction != '') {
                pageInfos.isResizing = true;
                pageInfos.direction = direction;
                return;
            }
        }
    }

    // 重新点击图形，进行操作
    if (pageInfos.drawMode === 'select') {
        // 找寻图形
        const shape = pageInfos.shapes.slice().reverse().find(
            (shape: Shape) => (checkInside(pageInfos.startPosition, shape))
        );
        if (shape) {
            pageInfos.selectedShapeID = shape.id;
            pageInfos.isDragging = true;
            pageInfos.dragOffset = { x: pageInfos.startPosition.x - shape.x, y: pageInfos.startPosition.y - shape.y }
        } else {
            pageInfos.selectedShapeID = '';
            pageInfos.isDragging = false;
        }
        redraw(pageInfos.shapes);
        return
    }

    // 开始
    switch (pageInfos.drawMode) {
        case 'point': {
            let shape: Shape = {
                id: extend.ExString.uuid(),
                type: 'point',
                //
                x: pageInfos.startPosition.x,
                y: pageInfos.startPosition.y,
                w: 0,
                h: 0,
                //
                stroke: penInfos.stroke,
                strokeWidth: penInfos.strokeWidth,
                radius: 5,
            }
            //
            pageInfos.shapes = [...pageInfos.shapes, shape];
            redraw(pageInfos.shapes);
            // 同步数据
            syncData();
            break
        }
        default: {
            pageInfos.isDrawing = true
            break
        }
    }
    return
}
const handleMousemove = (event: MouseEvent) => {
    // 拖动画布
    if (pageInfos.isPanning) {
        const dx = event.clientX - pageInfos.panStart.x
        const dy = event.clientY - pageInfos.panStart.y
        containerRef.value.scrollLeft = pageInfos.scrollStart.left - dx
        containerRef.value.scrollTop = pageInfos.scrollStart.top - dy
        event.preventDefault()
        return;
    }

    // 获取当前鼠标位置
    const pos = getMousePos(canvasRef.value, event);

    // 切换鼠标样式
    const hoveredDir = detectHoveredHandle(pos.x, pos.y);
    canvasRef.value.style.cursor = cursorMap[hoveredDir];

    // 重新计算形状大小
    if (pageInfos.isResizing) {
        resizeShapeByHandle(pageInfos.selectedShapeID, pageInfos.direction, pos);
        redraw(pageInfos.shapes);
        return;
    }

    //
    if (pageInfos.isDrawing) {
        pageInfos.currentPosition = pos;
        Drawing();
        return;
    }

    //
    if (pageInfos.isDragging) {
        Dragging(event);
        return;
    }
}
const handleMouseup = (event: MouseEvent) => {
    // 拖动画布
    if (pageInfos.isPanning) {
        pageInfos.isPanning = false
        event.preventDefault()
    }

    //
    if (pageInfos.isResizing) {
        pageInfos.isResizing = false;
        pageInfos.direction = '';
        syncData();
        return;
    }

    //
    if (pageInfos.isDrawing) {
        endDrawing();
    }

    //
    if (pageInfos.isDragging) {
        endDragging();
    }
}
// 处理改变图形大小
const resizeShapeByHandle = (
    shapeID: string,
    direction: ResizeDirection,
    cursorPos: { x: number, y: number }
) => {
    const shape = pageInfos.shapes.find(s => s.id === shapeID);
    if (!shape) return;

    let { x, y, w, h } = shape;
    const start = pageInfos.startPosition;
    const dx = cursorPos.x - start.x;
    const dy = cursorPos.y - start.y;

    switch (direction) {

        case 'nw':
            x += dx;
            y += dy;
            w -= dx;
            h -= dy;
            break;
        case 'n':
            y += dy;
            h -= dy;
            break;
        case 'ne':
            y += dy;
            w += dx;
            h -= dy;
            break;
        case 'e':
            w += dx;
            break;
        case 'se':
            w += dx;
            h += dy;
            break;
        case 's':
            h += dy;
            break;
        case 'sw':
            x += dx;
            w -= dx;
            h += dy;
            break;
        case 'w':
            x += dx;
            w -= dx;
            break;
    }

    shape.x = x;
    shape.y = y;
    shape.w = Math.max(1, w);
    shape.h = Math.max(1, h);
    pageInfos.startPosition = cursorPos; // 更新起点为当前值，便于连续缩放
};
// 处理绘制过程
const Drawing = () => {
    const size = {
        w: pageInfos.currentPosition.x - pageInfos.startPosition.x,
        h: pageInfos.currentPosition.y - pageInfos.startPosition.y,
    }
    const shape = initialShape(size);
    if (shape) {
        redraw(pageInfos.shapes, shape);
    }
};
const Dragging = (event: MouseEvent) => {
    const pos = getMousePos(canvasRef.value, event);
    pageInfos.shapes.map((shape: Shape) => {
        if (shape.id == pageInfos.selectedShapeID) {
            shape.x = pos.x - pageInfos.dragOffset.x;
            shape.y = pos.y - pageInfos.dragOffset.y;
        }
    })
    //
    redraw(pageInfos.shapes);
};
// 处理结束绘制
const endDrawing = () => {
    const size = {
        w: pageInfos.currentPosition.x - pageInfos.startPosition.x,
        h: pageInfos.currentPosition.y - pageInfos.startPosition.y,
    }
    const shape = initialShape(size);
    if (shape) {
        pageInfos.shapes = [...pageInfos.shapes, shape];
        redraw(pageInfos.shapes);
        //
        pageInfos.selectedShapeID = shape.id;
    }
    // 结束绘制
    pageInfos.startPosition = { x: 0, y: 0 }
    pageInfos.currentPosition = { x: 0, y: 0 }
    pageInfos.isDrawing = false;
    // 同步数据
    syncData();
};
const endDragging = () => {
    pageInfos.isDragging = false;
};
//#endregion

// 获取鼠标位置
const getMousePos = (canvas: any, event: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const position = {
        x: (event.clientX - rect.left) / pageInfos.scale,
        y: (event.clientY - rect.top) / pageInfos.scale,
    }
    return position
};
// 判断点击位置是否在控制点上
const getResizeHandleDirection = (shape: Shape, pos: { x: number, y: number }): ResizeDirection | '' => {
    const handles = getResizeHandles(shape);
    for (const handle of handles) {
        const dx = pos.x - handle.x;
        const dy = pos.y - handle.y;
        const radius = 6;
        if (dx * dx + dy * dy <= radius * radius) {
            return handle.dir;
        }
    }

    if (checkInside(pos, shape)) {
        return 'move';
    }
    return '';
};
// 获取控制点
const getResizeHandles = (shape: Shape): { x: number; y: number; dir: ResizeDirection }[] => {
    const { x, y, w, h } = shape;
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const right = x + w;
    const bottom = y + h;

    return [
        { x: x, y: y, dir: 'nw' },
        { x: centerX, y: y, dir: 'n' },
        { x: right, y: y, dir: 'ne' },
        { x: right, y: centerY, dir: 'e' },
        { x: right, y: bottom, dir: 'se' },
        { x: centerX, y: bottom, dir: 's' },
        { x: x, y: bottom, dir: 'sw' },
        { x: x, y: centerY, dir: 'w' },
    ];
};
const detectHoveredHandle = (mouseX: number, mouseY: number): ResizeDirection => {
    if (!pageInfos.selectedShapeID) return '';

    const shape = pageInfos.shapes.find(s => s.id === pageInfos.selectedShapeID);
    if (!shape) return '';

    return getResizeHandleDirection(shape, { x: mouseX, y: mouseY })
};
const checkInside = (pos: { x: number, y: number }, shape: Shape): boolean => {
    return pos.x >= shape.x &&
        pos.x <= shape.x + shape.w &&
        pos.y >= shape.y &&
        pos.y <= shape.y + shape.h;
}

//#region Shape
const initialShape = (size: { w: number, h: number }): Shape | null => {
    let { w, h } = size;
    //
    if (w * h == 0) return null;
    //
    let x = pageInfos.startPosition.x;
    let y = pageInfos.startPosition.y;
    if (w < 0) { x = x + w; w = -w }
    if (h < 0) { y = y + h; h = -h }
    //
    if (pageInfos.drawMode == 'circle') {
        w = Math.min(w, h);
        h = Math.min(w, h);
    }
    //
    return {
        id: extend.ExString.uuid(),
        type: pageInfos.drawMode,
        //
        x,
        y,
        w,
        h,
        //
        strokeWidth: penInfos.strokeWidth,
        stroke: penInfos.stroke,
        //
        infos: {}
    };
}
// 基于shape绘制图形
const draw = (shape: Shape) => {
    switch (shape.type) {
        case 'rect': {
            drawRect(shape);
            break
        }
        case 'circle': {
            drawCircle(shape);
            break
        }
        case 'ellipse': {
            drawEllipse(shape);
            break
        }
        case 'point': {
            drawPoint(shape);
            break
        }
        default: {
            break
        }
    }
}
const drawRect = (shape: Shape) => {
    ctxRef.value.beginPath();
    ctxRef.value.strokeStyle = shape.stroke;
    ctxRef.value.lineWidth = shape.strokeWidth;
    ctxRef.value.setLineDash([]);
    //
    ctxRef.value.strokeRect(shape.x, shape.y, shape.w, shape.h);
    ctxRef.value.closePath();
    //
    if (shape.id === pageInfos.selectedShapeID) {
        drawSelected(shape)
    }
}
const drawCircle = (shape: Shape) => {
    ctxRef.value.beginPath();
    ctxRef.value.strokeStyle = shape.stroke;
    ctxRef.value.lineWidth = shape.strokeWidth;
    ctxRef.value.setLineDash([]);
    //
    let radius = Math.min(shape.w, shape.h) / 2;
    ctxRef.value.arc(shape.x + radius, shape.y + radius, radius, 0, Math.PI * (360 / 180));
    ctxRef.value.stroke();
    ctxRef.value.closePath();
    //
    if (shape.id === pageInfos.selectedShapeID) {
        drawSelected(shape)
    }
}
const drawEllipse = (shape: Shape) => {
    ctxRef.value.beginPath();
    ctxRef.value.strokeStyle = shape.stroke;
    ctxRef.value.lineWidth = shape.strokeWidth;
    ctxRef.value.setLineDash([]);
    //
    ctxRef.value.ellipse(shape.x + shape.w / 2, shape.y + shape.h / 2, shape.w / 2, shape.h / 2, 0, 0, Math.PI * (360 / 180));
    ctxRef.value.stroke();
    ctxRef.value.closePath();
    //
    if (shape.id === pageInfos.selectedShapeID) {
        drawSelected(shape)
    }
}
const drawPoint = (shape: Shape) => {
    ctxRef.value.beginPath();
    //
    ctxRef.value.strokeStyle = shape.stroke;
    ctxRef.value.lineWidth = shape.strokeWidth;
    ctxRef.value.setLineDash([]);
    //
    let radius = shape.radius || 5;
    ctxRef.value.arc(shape.x + radius, shape.y + radius, radius, 0, Math.PI * (360 / 180));
    ctxRef.value.stroke();
    //
    ctxRef.value.fillStyle = shape.stroke;
    ctxRef.value.fill();
    //
    ctxRef.value.closePath();
    //
    if (shape.id === pageInfos.selectedShapeID) {
        drawSelected(shape)
    }
}
// 选中框
const drawSelected = (shape: Shape) => {
    // 绘制 虚线框
    ctxRef.value.beginPath();
    ctxRef.value.strokeStyle = 'red';
    ctxRef.value.lineWidth = 2;
    ctxRef.value.setLineDash([5, 5]);
    ctxRef.value.rect(
        shape.x - 5, // 向外扩展一些距离
        shape.y - 5,
        shape.w + 10,
        shape.h + 10
    );
    ctxRef.value.stroke();
    ctxRef.value.closePath();

    // 绘制 8 个控制点
    const points = getResizeHandles(shape);
    points.forEach(({ x, y }) => drawHandle(x, y));
}
const drawHandle = (x: number, y: number) => {
    ctxRef.value.beginPath();
    ctxRef.value.fillStyle = '#007bc0';
    ctxRef.value.arc(x, y, 4, 0, Math.PI * 2);
    ctxRef.value.fill();
    ctxRef.value.closePath();
};
// 信息框
const getInfosPos = () => {
    const shape = selectedShape.value
    const pos = {
        x: (shape.x + shape.w) * pageInfos.scale,
        y: (shape.y + shape.h) * pageInfos.scale,
    }
    return {
        left: pos.x + 'px',
        top: pos.y + 'px',
    }
}
const updateInfos = (values: any) => {
    let temp = pageInfos.shapes.find((a: any) => a.id == values.id)
    if (temp) {
        Object.assign(temp.infos, values.infos)
        syncData()
    }
}
//#endregion

//#region Tools
// 切换工具
const changeMode = (mode: string): any => {
    pageInfos.drawMode = mode
    //
    if (mode != 'select') {
        pageInfos.selectedShapeID = '';
        redraw(pageInfos.shapes);
    }
}
// 清空框
const clear = () => {
    pageInfos.shapes = []
    redraw(pageInfos.shapes);
    // 同步数据
    syncData();
}
// 删除前一个画的框
const deletePrev = () => {
    if (pageInfos.shapes.length > 0) {
        pageInfos.shapes.pop()
        redraw(pageInfos.shapes);
        // 同步数据
        syncData();
    }
}
//
const radiusList = ref([])
const colors = ['#ed0007', '#78be20', '#ffcf00']
const changeStroke = (color: string) => {
    penInfos.stroke = color
}
//#endregion
</script>

<template>
    <div class="box-annotations">
        <!-- 工具栏 -->
        <div class="box-tools" v-if="isEditable">
            <div class="btns">
                <button type="button" class="btn" @click="clear">
                    <i class="fa-solid fa-eraser"></i>
                </button>
                <button type="button" class="btn" @click="deletePrev">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
                <button type="button" class="btn" :class="pageInfos.isSpacePressed ? 'active' : ''">
                    <i class="fa-solid fa-hand"></i>
                </button>
                <button type="button" class="btn" :class="pageInfos.drawMode == 'select' ? 'active' : ''"
                    @click="changeMode('select')">
                    <i class="fa-solid fa-arrow-pointer"></i>
                </button>
            </div>
            <div class="btns">
                <button type="button" class="btn" :class="pageInfos.drawMode == 'rect' ? 'active' : ''"
                    @click="changeMode('rect')">
                    <i class="fa-solid fa-square"></i>
                </button>
                <button type="button" class="btn" :class="pageInfos.drawMode == 'circle' ? 'active' : ''"
                    @click="changeMode('circle')">
                    <i class="fa-solid fa-circle"></i>
                </button>
                <button type="button" class="btn" :class="pageInfos.drawMode == 'point' ? 'active' : ''"
                    @click="changeMode('point')">
                    <i class="fa-solid fa-arrows-to-dot"></i>
                </button>
            </div>
            <div class="btns">
            </div>
        </div>
        <div class="box-tools-sub" v-if="isEditable">
            <div class="tool-scale">{{ Math.round(pageInfos.scale * 100) }}%</div>
            <a-dropdown>
                <a class="ant-dropdown-link" @click.prevent>
                    <div class="item-color" :style="`border-color: ${penInfos.stroke}`"></div>
                </a>
                <template #overlay>
                    <a-menu>
                        <a-menu-item v-for="color in colors" @click="changeStroke(color)">
                            <div class="item-color" :style="`border-color: ${color}`"></div>
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>
        <!-- 画布 -->
        <div class="box-canvas" ref="containerRef" :class="pageInfos.isSpacePressed ? 'space-press' : ''">
            <!-- 画布 -->
            <canvas ref="canvasRef" @mousedown="handleMousedown" @mousemove="handleMousemove"
                @mouseup="handleMouseup"></canvas>
            <!-- 信息框 -->
            <div v-if="selectedShape" class="box-shape-infos" :style="getInfosPos()">
                <slot name="infos" :value="selectedShape" :onChange="(val: any) => updateInfos(val)"></slot>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.box-annotations {
    position: relative;
    width: 100%;
    height: 100%;
}

.box-tools {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 99;
    display: flex;
    gap: 10px;

    .btns {
        display: flex;
    }

    .btn {
        width: 30px;
    }

    .btn.active {
        color: #fff;
        background: #007bc0;
    }
}

.box-tools-sub {
    position: absolute;
    top: 60px;
    left: 20px;
    z-index: 99;
    display: flex;
    align-items: center;
    gap: 10px;

    .tool-scale {
        padding: 0 5px;
        border-radius: 5px;
        background: #c4cecf6d;
    }
}

.box-canvas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: auto;

    &.space-press {
        cursor: grab;
    }
}

.box-shape-infos {
    position: absolute;
    z-index: 99;
    padding: 5px;
    width: 195px;
    font-size: 12px;
    border: 1px solid #ddd;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.item-color {
    width: 40px;
    height: 20px;
    border: 3px solid;
}
</style>
