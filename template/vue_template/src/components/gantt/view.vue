<script setup lang="ts">
import { computed, toRefs, ref, onMounted, onUnmounted } from 'vue'
import slideView from './time-slide.vue'
import type { GanttInfos } from './datas.type';

const props = defineProps<{
    mode?: 'month' | 'week',
    pageInfos: GanttInfos,
}>()
const { pageInfos: info, mode } = toRefs(props)

// ---- 配置常量 ----
const MILESTONE_SIZE = 14
const ROW_HEIGHT = 32
const ITEM_PADDING = 20 // 任务水平间距
const CHAR_WIDTH_AVG = 7 // 字符宽度估算

const containerRef = ref<HTMLDivElement | null>(null)
const containerWidth = ref(1000)

// ---- 时间解析与视口范围 ----
const parseDate = (str: string | undefined) => {
    if (!str) return 0
    const [y, m, d] = str.replace(/[-/]/g, '/').split('/').map(Number)
    return new Date(y, m - 1, d || 1).getTime()
}

// 视口开始时间
const viewStartTime = computed(() => parseDate(info.value.periods[0]))
// 视口结束时间（取选中月份的下个月1号作为截止点）
const viewEndTime = computed(() => {
    const d = new Date(parseDate(info.value.periods[1]))
    d.setMonth(d.getMonth() + 1)
    return d.getTime()
})
const totalDuration = computed(() => viewEndTime.value - viewStartTime.value)

// ---- 自动布局引擎 ----
// 辅助：时间转像素
const timeToPx = (time: number) => {
    if (totalDuration.value <= 0) return 0
    return ((time - viewStartTime.value) / totalDuration.value) * containerWidth.value
}

// 辅助：百分比位置
// const getPercent = (time: number) => {
//     return Math.max(0, Math.min(100, ((time - viewStartTime.value) / totalDuration.value) * 100))
// }
const getPercent = (time: number) => {
    const start = viewStartTime.value
    const end = viewEndTime.value

    // 如果是周模式，且我们希望任务完全按照日期比例对齐：
    // 注意：如果 columns 的范围超出了 [viewStartTime, viewEndTime]，需要微调
    return Math.max(0, Math.min(100, ((time - start) / (end - start)) * 100))
}

// 1. 新增：管理折叠状态
const collapsedIds = ref<Set<string | number>>(new Set())
const toggleCollapse = (id: string | number) => {
    if (collapsedIds.value.has(id)) {
        collapsedIds.value.delete(id)
    } else {
        collapsedIds.value.add(id)
    }
}

// 2. 修改：布局引擎
const layoutData = computed(() => {
    const categories: any[] = []
    const renderItems: any[] = []
    let globalRowIndex = 0

    const vStart = viewStartTime.value
    const vEnd = viewEndTime.value
    const currentViewWidth = containerWidth.value

    info.value.list.forEach(cat => {
        const catStartRow = globalRowIndex
        const isCollapsed = collapsedIds.value.has(cat.id) // 判断是否折叠

        // 预处理所有数据（计算时间戳）
        const processedDatas = cat.datas.map(d => {
            const sTime = parseDate(d.startDate)
            const isActivity = !!(d.endDate && d.endDate.trim() !== '')
            const eTime = isActivity ? parseDate(d.endDate) : sTime
            return { ...d, sTime, eTime, isActivity }
        })

        if (isCollapsed) {
            // --- 折叠逻辑 ---
            // 1. 找出该分类下所有任务的全局时间范围
            const validTimes = processedDatas.filter(d => d.eTime >= vStart && d.sTime <= vEnd)

            if (validTimes.length > 0) {
                const minS = Math.min(...validTimes.map(d => d.sTime))
                const maxE = Math.max(...validTimes.map(d => d.eTime))

                // 2. 添加一个特殊的汇总条
                renderItems.push({
                    _type: 'SUMMARY',
                    _catColor: cat.color,
                    _style: {
                        top: `${catStartRow * ROW_HEIGHT}px`,
                        left: `${getPercent(minS)}%`,
                        width: `${getPercent(maxE) - getPercent(minS)}%`
                    }
                })
            }

            // 折叠后固定占用 1 行
            globalRowIndex += 1
            categories.push({
                ...cat,
                _isCollapsed: true,
                _style: {
                    top: `${catStartRow * ROW_HEIGHT}px`,
                    height: `${ROW_HEIGHT}px`,
                    lineHeight: `${ROW_HEIGHT}px`
                }
            })

        } else {
            // --- 展开逻辑 (原逻辑) ---
            const lanes: number[] = []
            const validItems = processedDatas
                .map(d => {
                    if (d.eTime < vStart || d.sTime > vEnd) return null
                    const startPx = timeToPx(d.sTime)
                    const endPx = d.isActivity ? timeToPx(d.eTime) : startPx + MILESTONE_SIZE
                    const textW = d.description.length * CHAR_WIDTH_AVG + 12
                    let labelPos: 'right' | 'left' = 'right'
                    let boxStart = startPx
                    let boxEnd = endPx + textW
                    if (endPx + textW > currentViewWidth) {
                        labelPos = 'left'
                        boxStart = startPx - textW
                        boxEnd = endPx
                    }
                    return {
                        raw: d,
                        type: d.isActivity ? 'A' : 'M',
                        sTime: d.sTime,
                        eTime: d.eTime,
                        widthPercent: d.isActivity ? (getPercent(d.eTime) - getPercent(d.sTime)) : 0,
                        leftPercent: getPercent(d.sTime),
                        boxStart,
                        boxEnd,
                        labelPos
                    }
                })
                .filter(Boolean)
                .sort((a, b) => a!.sTime - b!.sTime)

            validItems.forEach(item => {
                if (!item) return
                let placedLane = -1
                for (let i = 0; i < lanes.length; i++) {
                    if (item.boxStart >= lanes[i] + ITEM_PADDING) {
                        placedLane = i
                        lanes[i] = item.boxEnd
                        break
                    }
                }
                if (placedLane === -1) {
                    placedLane = lanes.length
                    lanes.push(item.boxEnd)
                }
                renderItems.push({
                    ...item.raw,
                    _type: item.type,
                    _catColor: cat.color,
                    _labelPos: item.labelPos,
                    _style: {
                        top: `${(catStartRow + placedLane) * ROW_HEIGHT}px`,
                        left: `${item.leftPercent}%`,
                        width: item.type === 'A' ? `${item.widthPercent}%` : undefined
                    }
                })
            })

            const rowsUsed = Math.max(1, lanes.length)
            globalRowIndex += rowsUsed
            categories.push({
                ...cat,
                _isCollapsed: false,
                _style: {
                    top: `${catStartRow * ROW_HEIGHT}px`,
                    height: `${rowsUsed * ROW_HEIGHT}px`,
                    lineHeight: `${rowsUsed * ROW_HEIGHT}px`
                }
            })
        }
    })

    return {
        categories,
        items: renderItems,
        totalHeight: globalRowIndex * ROW_HEIGHT
    }
})

// ---- 3. 头部刻度 (年/月) ----
// const timeScales = computed(() => {
//     const start = new Date(viewStartTime.value)
//     const end = new Date(viewEndTime.value)
//     const months = []
//     const yearsMap: Record<number, number> = {}
//     const curr = new Date(start)

//     // 循环生成月份，直到大于等于结束时间
//     while (curr < end) {
//         const y = curr.getFullYear()
//         const m = curr.getMonth() + 1
//         months.push({ label: m, key: `${y}-${m}` })
//         yearsMap[y] = (yearsMap[y] || 0) + 1
//         curr.setMonth(curr.getMonth() + 1)
//     }
//     return {
//         years: Object.entries(yearsMap).map(([y, c]) => ({ label: y, flex: c })),
//         months
//     }
// })
const timeScales = computed(() => {
    const start = new Date(viewStartTime.value)
    const end = new Date(viewEndTime.value)

    const yearsMap: Record<number, number> = {}
    const columns: { label: string | number, key: string, year: number }[] = []

    if (mode.value === 'month') {
        // --- 月模式逻辑 ---
        const curr = new Date(start)
        while (curr < end) {
            const y = curr.getFullYear()
            const m = curr.getMonth() + 1
            columns.push({ label: m, key: `${y}-${m}`, year: y })
            yearsMap[y] = (yearsMap[y] || 0) + 1
            curr.setMonth(curr.getMonth() + 1)
        }
    } else {
        // --- 周模式逻辑 ---
        // 1. 寻找视口开始时间所在周的周日
        const curr = new Date(start)
        curr.setDate(curr.getDate() - curr.getDay()) // 回退到周日
        curr.setHours(0, 0, 0, 0)

        while (curr < end) {
            // 计算当前周属于哪一年及其周数
            // 规则：如果本周（周日至周六）包含下一年的1月1日，则属于下一年第一周
            const sunday = new Date(curr)
            const saturday = new Date(curr)
            saturday.setDate(sunday.getDate() + 6)

            const belongsToYear = saturday.getFullYear()

            // 计算在该年份中的周号
            // 找到该年1月1日所在的周日作为第一周的起点
            const jan1 = new Date(belongsToYear, 0, 1)
            const firstSundayOfYear = new Date(jan1)
            firstSundayOfYear.setDate(jan1.getDate() - jan1.getDay())

            const weekNum = Math.round((sunday.getTime() - firstSundayOfYear.getTime()) / (7 * 24 * 3600 * 1000)) + 1
            const weekLabel = weekNum < 10 ? `0${weekNum}` : `${weekNum}`

            columns.push({
                label: weekLabel,
                key: `${belongsToYear}-w${weekNum}-${sunday.getTime()}`,
                year: belongsToYear
            })

            yearsMap[belongsToYear] = (yearsMap[belongsToYear] || 0) + 1

            // 步进 7 天
            curr.setDate(curr.getDate() + 7)
        }
    }

    return {
        years: Object.entries(yearsMap).map(([y, c]) => ({ label: y, flex: c })),
        columns // 统一叫 columns，可以是月也可以是周
    }
})

// ---- 4. Resize ----
const updateWidth = () => {
    if (containerRef.value) {
        containerWidth.value = containerRef.value.offsetWidth || 1000
    }
}

onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth)
})
onUnmounted(() => window.removeEventListener('resize', updateWidth))

// ---- Today Line ----
const todayStyle = computed(() => {
    const now = Date.now()
    if (now < viewStartTime.value || now > viewEndTime.value) return null
    return { left: `${getPercent(now)}%` }
})

// ---- 侧边栏拖拽宽度逻辑 ----
const sidebarWidth = ref(160) // 默认宽度
const isResizing = ref(false)

const startResizing = (e: MouseEvent) => {
    isResizing.value = true
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'col-resize' // 改变鼠标指针
}

const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return
    // 最小 80px，最大 400px，根据需求调整
    const newWidth = e.clientX - 20 // 20 是微调偏置，根据布局容器位置调整
    if (newWidth > 80 && newWidth < 400) {
        sidebarWidth.value = newWidth
        // 关键：侧边栏宽度变了，绘图区宽度也会变，需要重新计算像素坐标
        updateWidth()
    }
}

const stopResizing = () => {
    isResizing.value = false
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', stopResizing)
    document.body.style.cursor = 'default'
}

const getCW = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    const date = new Date(parseDate(dateStr))

    // 1. 寻找该日期所在周的周日
    const sunday = new Date(date)
    sunday.setDate(date.getDate() - date.getDay())
    sunday.setHours(0, 0, 0, 0)

    // 2. 寻找该周的周六，判断这周属于哪一年
    const saturday = new Date(sunday)
    saturday.setDate(sunday.getDate() + 6)
    const belongsToYear = saturday.getFullYear()

    // 3. 计算该年1月1日所在的周日（该年的起点）
    const jan1 = new Date(belongsToYear, 0, 1)
    const firstSundayOfYear = new Date(jan1)
    firstSundayOfYear.setDate(jan1.getDate() - jan1.getDay())

    // 4. 计算周数差值
    const weekNum = Math.round((sunday.getTime() - firstSundayOfYear.getTime()) / (7 * 24 * 3600 * 1000)) + 1

    return `CW${weekNum < 10 ? '0' : ''}${weekNum}`
}
</script>

<template>
    <div class="gantt-wrapper">
        <!-- 时间选择 -->
        <slideView v-model:periods="info.periods" :min="info.range[0]" :max="info.range[1]" />

        <div class="gantt-container">
            <!-- 左侧分类 -->
            <div class="gantt-sidebar" :style="{ flex: `0 0 ${sidebarWidth}px` }">
                <div class="sidebar-header">Category</div>
                <div class="sidebar-body" :style="{ height: layoutData.totalHeight + 'px' }">
                    <div v-for="cat in layoutData.categories" :key="cat.id" class="cat-item" :style="cat._style">
                        <div class="cat-content" @click="toggleCollapse(cat.id)">
                            <!-- 折叠图标 -->
                            <span class="collapse-icon" :class="{ 'is-collapsed': cat._isCollapsed }">▶</span>

                            <!-- <img v-if="cat.imgPath && cat.imgPath != '' && !cat._isCollapsed" :src="cat.imgPath" alt=""> -->
                            <span class="cat-name">{{ cat.category }}</span>
                        </div>
                    </div>
                </div>
                <!-- 拖拽控制条 -->
                <div class="sidebar-resizer" @mousedown="startResizing"></div>
            </div>

            <!-- 右侧绘图区 -->
            <div class="gantt-main" ref="containerRef">
                <div class="timeline-header">
                    <div class="year-row">
                        <div v-for="y in timeScales.years" :key="y.label" class="year-cell" :style="{ flex: y.flex }">
                            {{ y.label }}
                        </div>
                    </div>
                    <div class="column-row">
                        <div v-for="m in timeScales.columns" :key="m.key" class="column-cell">
                            {{ m.label }}
                        </div>
                    </div>
                </div>

                <div class="task-body" :style="{ height: layoutData.totalHeight + 'px' }">
                    <!-- 纵向网格线 -->
                    <div class="grid-lines">
                        <div v-for="m in timeScales.columns" :key="'line-' + m.key" class="grid-col"></div>
                    </div>

                    <!-- 横向分隔线 -->
                    <div class="category-lines">
                        <div v-for="cat in layoutData.categories" :key="'cat-line-' + cat.id" class="category-line-row"
                            :style="cat._style"></div>
                    </div>

                    <!-- 任务渲染 -->
                    <template v-for="(item, i) in layoutData.items" :key="i">
                        <!-- 汇总条 (SUMMARY) -->
                        <div v-if="item._type === 'SUMMARY'" class="gantt-item summary-wrapper" :style="item._style">
                            <div class="summary-bar" :style="{ background: item._catColor }"></div>
                        </div>

                        <template v-else>
                            <a-tooltip destroyTooltipOnHide>
                                <template #title>
                                    <div style="font-size: 12px; line-height: 1.6;">
                                        <div
                                            style="font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); margin-bottom: 4px;">
                                            {{ item.description }}
                                        </div>
                                        <div>Start: {{ item.startDate }} <span style="opacity: 0.8">({{
                                            getCW(item.startDate) }})</span></div>
                                        <div v-if="item._type === 'A'">End: {{ item.endDate }} <span
                                                style="opacity: 0.8">({{ getCW(item.endDate) }})</span></div>
                                    </div>
                                </template>

                                <!-- 里程碑 (M) -->
                                <div v-if="item._type === 'M'" class="gantt-item milestone-wrapper" :style="item._style"
                                    :title="`${item.description} (${item.startDate} ${getCW(item.startDate)})`">
                                    <div class="milestone-shape" :style="{ background: item.color || item._catColor }">
                                    </div>
                                    <span class="gantt-label" :class="item._labelPos">{{ item.description }}</span>
                                </div>

                                <!-- 活动 (A) -->
                                <div v-else class="gantt-item activity-wrapper" :style="item._style">
                                    <div class="activity-bar" :style="{ background: item.color || item._catColor }">
                                    </div>
                                    <span class="gantt-label" :class="item._labelPos">{{ item.description }}</span>
                                </div>
                            </a-tooltip>
                        </template>
                    </template>

                    <!-- Today -->
                    <div v-if="todayStyle" class="today-line" :style="todayStyle"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
@use "sass:color";
$border-color: #e5e7eb;
$bg-sidebar: #f9fafb;

.gantt-wrapper {
    width: 100%;
    height: 100%;
    color: #374151;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .gantt-container {
        flex: 1;
        position: relative;
        overflow: auto;
        border: 1px solid $border-color;
        border-radius: 6px;
        display: flex;

        &::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        &::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 4px;
        }
    }
}

/* Sidebar */
.gantt-sidebar {
    position: sticky;
    left: 0;
    z-index: 30;
    background: $bg-sidebar;
    border-right: 1px solid $border-color;
    display: flex;
    flex-direction: column;

    .sidebar-header {
        position: sticky;
        top: 0;
        z-index: 40;
        padding-left: 12px;
        height: 60px;
        font-weight: bold;
        border-bottom: 1px solid $border-color;
        background: #fff;
        display: flex;
        align-items: center;
    }

    .sidebar-body {
        position: relative;

        .cat-item {
            position: absolute;
            left: 0;
            right: 0;
            padding: 0 10px;
            border-bottom: 1px solid color.adjust($border-color, $lightness: 5%);
            display: flex;
            flex-direction: column;
            align-items: center;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }

    /* 拖拽条样式 */
    .sidebar-resizer {
        position: absolute;
        top: 0;
        right: -3px;
        /* 跨在边界线上 */
        width: 6px;
        height: 100%;
        cursor: col-resize;
        z-index: 50;
        transition: background 0.2s;

        &:hover {
            background: rgba(59, 130, 246, 0.5); // 悬浮时显示蓝色线条
        }
    }
}

.cat-item {
    cursor: pointer;
    justify-content: flex-start !important;
    align-items: center !important;
    padding-left: 12px !important;
    transition: background 0.2s;

    &:hover {
        background: #f3f4f6;
    }

    .cat-content {
        width: 100%;
        padding-left: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .collapse-icon {
        font-size: 10px;
        color: #9ca3af;
        transition: transform 0.2s;
        display: inline-block;
        transform: rotate(90deg); // 默认向下（展开）

        &.is-collapsed {
            transform: rotate(0deg); // 折叠向右
        }
    }

    .cat-name {
        flex: 1;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}

.summary-wrapper {
    height: 32px; // 与 ROW_HEIGHT 一致
    display: flex;
    align-items: center;
    pointer-events: none; // 汇总条通常不需要交互

    .summary-bar {
        height: 8px; // 汇总条比普通任务条窄一点
        width: 100%;
        border-radius: 4px;
        opacity: 0.6; // 浅色显示
        position: relative;

        // 可选：给汇总条两端加个小尖角装饰，表示它是聚合范围
        &::before,
        &::after {
            content: '';
            position: absolute;
            top: 0;
            width: 2px;
            height: 12px;
            background: inherit;
            margin-top: -2px;
        }

        &::before {
            left: 0;
        }

        &::after {
            right: 0;
        }
    }
}


/* Main Area */
.gantt-main {
    flex: 1;
    position: relative;
    overflow: visible;

    .timeline-header {
        position: sticky;
        top: 0;
        z-index: 20;
        background: #fff;
        border-bottom: 1px solid $border-color;

        .year-row {
            display: flex;
            height: 30px;
            border-bottom: 1px solid $border-color;

            .year-cell {
                display: flex;
                align-items: center;
                justify-content: center;
                border-right: 1px solid $border-color;
                background: #f3f4f6;
                font-weight: 600;
            }
        }

        .column-row {
            display: flex;
            height: 29px;

            .column-cell {
                flex: 1;
                min-width: 30px; // 周模式下宽度可以窄一点
                display: flex;
                align-items: center;
                justify-content: center;
                border-right: 1px solid $border-color;
                color: #6b7280;
                font-size: 11px;
            }
        }
    }

    .task-body {
        position: relative;
        min-width: 100%;
        background: #fff;

        .grid-lines {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            pointer-events: none;
            z-index: 0;

            .grid-col {
                flex: 1;
                border-right: 1px solid #f3f4f6; // 颜色加深一点以便看清

                &:last-child {
                    border-right: none;
                }
            }
        }

        .category-lines {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none; // 确保鼠标能穿透点击到底下的空白处
            z-index: 0; // 层级要在任务之下，纵向网格线之上(或同级)

            .category-line-row {
                position: absolute;
                left: 0;
                right: 0;
                box-sizing: border-box;
                // border-bottom: 1px solid color.adjust($border-color, $lightness: 5%);
                border-bottom: 1px solid #f3f4f6;
            }
        }

        .gantt-item {
            position: absolute;
            z-index: 1;
            display: flex;
            align-items: center;

            &:hover {
                z-index: 10;
            }
        }

        .milestone-wrapper {
            height: 24px;
            margin-top: 4px;
            transform: translateX(-50%);

            .milestone-shape {
                width: 14px;
                height: 14px;
                transform: rotate(45deg);
                border: 1px solid rgba(0, 0, 0, 0.1);
                box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
            }
        }

        .activity-wrapper {
            height: 20px;
            margin-top: 6px;

            .activity-bar {
                width: 100%;
                height: 100%;
                border-radius: 4px;
                border: 1px solid rgba(0, 0, 0, 0.05);
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
        }

        .gantt-label {
            position: absolute;
            white-space: nowrap;
            font-size: 11px;
            color: #4b5563;
            pointer-events: none;
            top: 50%;
            transform: translateY(-50%);

            &.right {
                left: 100%;
                padding-left: 6px;
            }

            &.left {
                right: 100%;
                padding-right: 6px;
            }
        }

        .today-line {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #ef4444;
            pointer-events: none;
            z-index: 5;
        }
    }
}

img {
    height: unset !important;
}
</style>