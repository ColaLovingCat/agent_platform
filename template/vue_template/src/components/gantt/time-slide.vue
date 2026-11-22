<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
    periods: [string, string], 
    min: string,               
    max: string                
}>();

const emit = defineEmits(['update:periods']);

const container = ref<HTMLDivElement | null>(null);
const trackRef = ref<HTMLDivElement | null>(null);
const width = ref(0);

// ---- 初始化与 Resize ----
const updateWidth = () => {
    width.value = trackRef.value?.offsetWidth || 0;
};

onMounted(() => {
    // 稍微延迟一下确保 DOM 渲染完成，或者直接调用
    requestAnimationFrame(updateWidth);
    window.addEventListener('resize', updateWidth);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', updateWidth);
});

function toIndex(monthStr: string) {
    const [y, m] = monthStr.split('-').map(Number);
    return y * 12 + (m - 1);
}

function fromIndex(index: number) {
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
}

const minPos = computed(() => toIndex(props.min));
const maxPos = computed(() => toIndex(props.max));

function clampIndex(v: number) {
    return Math.min(maxPos.value, Math.max(minPos.value, Math.round(v)));
}

const leftPos = ref(toIndex(props.periods[0]));
const rightPos = ref(toIndex(props.periods[1]));

watch(() => props.periods, (p) => {
    leftPos.value = toIndex(p[0]);
    rightPos.value = toIndex(p[1]);
});

const currentLeftDate = computed(() => fromIndex(Math.round(leftPos.value)));
const currentRightDate = computed(() => fromIndex(Math.round(rightPos.value)));

function indexToPixel(idx: number) {
    if (!width.value || maxPos.value === minPos.value) return 0;
    return ((idx - minPos.value) / (maxPos.value - minPos.value)) * width.value;
}

const leftStyle = computed(() => ({ left: indexToPixel(leftPos.value) + 'px' }));
const rightStyle = computed(() => ({ left: indexToPixel(rightPos.value) + 'px' }));

const selectedStyle = computed(() => {
    const l = indexToPixel(leftPos.value);
    const r = indexToPixel(rightPos.value);
    return { left: l + 'px', width: Math.abs(r - l) + 'px' };
});

const monthTicks = computed(() => {
    const ticks = [];
    for (let i = minPos.value; i <= maxPos.value; i++) {
        const dateStr = fromIndex(i);
        const isYearStart = dateStr.endsWith('-01');
        ticks.push({
            id: i,
            label: isYearStart ? dateStr.split('-')[0] : '',
            left: indexToPixel(i),
            isMajor: isYearStart
        });
    }
    return ticks;
});

const todayIdx = toIndex(new Date().toISOString().slice(0, 7));
const showTodayLine = computed(() => todayIdx >= minPos.value && todayIdx <= maxPos.value);
const todayStyle = computed(() => ({
    left: indexToPixel(todayIdx) + 'px'
}));

// ---- 拖拽逻辑 ----
let dragging = '' as 'left' | 'right' | 'middle' | '';
let startX = 0;
let startLeftIdx = 0;
let startRightIdx = 0;

function startDrag(type: 'left' | 'right' | 'middle', e: MouseEvent) {
    e.preventDefault();
    dragging = type;
    startX = e.clientX;
    startLeftIdx = leftPos.value;
    startRightIdx = rightPos.value;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
}

function onMove(e: MouseEvent) {
    if (!width.value) return;
    const range = maxPos.value - minPos.value;
    if (range <= 0) return;

    const dxPx = e.clientX - startX;
    const dxIdx = dxPx / (width.value / range);

    if (dragging === 'left') {
        let newLeft = clampIndex(startLeftIdx + dxIdx);
        if (newLeft > rightPos.value) newLeft = rightPos.value;
        leftPos.value = newLeft;
    } else if (dragging === 'right') {
        let newRight = clampIndex(startRightIdx + dxIdx);
        if (newRight < leftPos.value) newRight = leftPos.value;
        rightPos.value = newRight;
    } else if (dragging === 'middle') {
        const span = startRightIdx - startLeftIdx;
        let newLeft = startLeftIdx + dxIdx;
        let newRight = newLeft + span;
        if (newLeft < minPos.value) {
            newLeft = minPos.value;
            newRight = newLeft + span;
        }
        if (newRight > maxPos.value) {
            newRight = maxPos.value;
            newLeft = newRight - span;
        }
        leftPos.value = Math.round(newLeft);
        rightPos.value = Math.round(newRight);
    }
    emitUpdate();
}

function onEnd() {
    dragging = '';
    leftPos.value = Math.round(leftPos.value);
    rightPos.value = Math.round(rightPos.value);
    emitUpdate();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
}

function emitUpdate() {
    emit('update:periods', [fromIndex(leftPos.value), fromIndex(rightPos.value)]);
}
</script>

<template>
    <div class="timeline-container" ref="container">
        <!-- 刻度区域 -->
        <div class="timeline-ticks-area">
            <template v-for="tick in monthTicks" :key="tick.id">
                <div v-if="tick.isMajor" class="tick-year-text" :style="{ left: tick.left + 'px' }">
                    {{ tick.label }}
                </div>
                <div class="tick-mark" 
                     :class="{ 'tick-major': tick.isMajor, 'tick-minor': !tick.isMajor }"
                     :style="{ left: tick.left + 'px' }">
                </div>
            </template>
        </div>

        <!-- 3. 绑定 ref="trackRef" -->
        <div class="timeline-track" ref="trackRef" @mousedown.stop>
            <div class="timeline-selected" :style="selectedStyle" @mousedown.prevent="startDrag('middle', $event)"></div>
            
            <div class="timeline-handle left-handle" :style="leftStyle" @mousedown.prevent="startDrag('left', $event)">
                <div class="handle-label">{{ currentLeftDate }}</div>
                <div class="handle-grip"></div>
            </div>

            <div class="timeline-handle right-handle" :style="rightStyle" @mousedown.prevent="startDrag('right', $event)">
                <div class="handle-label">{{ currentRightDate }}</div>
                <div class="handle-grip"></div>
            </div>

            <div v-if="showTodayLine" class="today-line" :style="todayStyle"></div>
        </div>
    </div>
</template>

<style scoped>
.timeline-container {
    user-select: none;
    padding: 10px 20px 10px; 
    font-family: sans-serif;
    box-sizing: border-box;
    width: 100%;
}

.timeline-ticks-area {
    position: relative;
    height: 24px;
    margin-bottom: 0;
}

.tick-year-text {
    position: absolute;
    top: 0;
    font-size: 12px;
    font-weight: bold;
    color: #333;
    transform: translateX(-50%);
    white-space: nowrap;
}

.tick-mark {
    position: absolute;
    bottom: 0;
    transform: translateX(-50%);
    pointer-events: none;
}

.tick-major { width: 2px; height: 8px; background: #333; z-index: 1; }
.tick-minor { width: 1px; height: 4px; background: #ccc; }

.timeline-track {
    position: relative;
    height: 12px;
    background: #e5e7eb;
    border-radius: 6px;
    margin-top: 2px;
    width: 100%; 
}

.timeline-selected {
    position: absolute;
    top: 0; bottom: 0;
    background: #3b82f6;
    border-radius: 6px;
    cursor: grab;
    opacity: 0.8;
}
.timeline-selected:active { cursor: grabbing; }

.timeline-handle {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    background: #fff;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    transform: translate(-50%, -50%); 
    cursor: ew-resize;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
}

.timeline-handle:hover,
.timeline-handle:active {
    z-index: 12;
}

.handle-label {
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.handle-label::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 4px 4px 0;
    border-style: solid;
    border-color: #333 transparent transparent transparent;
}

.handle-grip {
    width: 4px; height: 4px;
    background: #3b82f6;
    border-radius: 50%;
}

.today-line {
    position: absolute;
    width: 2px;
    top: -4px;
    bottom: -4px;
    background: #ef4444;
    z-index: 5;
    pointer-events: none;
    transform: translateX(-50%);
}
</style>