<script lang="ts" setup>
import { reactive } from 'vue'
import chartView from './view.vue'

// name
defineOptions({
    name: 'custom-name'
})

const chartInfos = reactive({
    optionsA: {
        xAxis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        yAxis: {
            type: 'value'
        },
        //
        series: [
            {
                type: 'line',
                data: [150, 230, 224, 218, 135, 147, 260],
            }
        ]
    },
    optionsB: {
        xAxis: {
            type: 'category',
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        },
        yAxis: {
            type: 'value'
        },
        //
        series: [
            {
                type: 'bar',
                stack: 'one',
                data: [150, 230, 224, 218, 135, 147, 260],
            },
            {
                type: 'bar',
                stack: 'one',
                data: [150, 230, 224, 218, 135, 147, 260],
            },
            {
                type: 'bar',
                data: [150, 230, 224, 218, 135, 147, 260],
            },
        ]
    },
    optionsC: {
        tooltip: {
            trigger: 'item'
        },
        legend: {
            top: '5%',
            left: 'center'
        },
        //
        series: [
            {
                type: 'pie',
                name: 'Access From',
                data: [
                    { value: 1048, name: 'Search Engine' },
                    { value: 735, name: 'Direct' },
                    { value: 580, name: 'Email' },
                    { value: 484, name: 'Union Ads' },
                    { value: 300, name: 'Video Ads' }
                ],
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 40,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: false
                },

            }
        ]
    },
    optionsD: {
        xAxis: {},
        yAxis: {},
        //
        series: [
            {
                symbolSize: 20,
                data: [
                    [10.0, 8.04],
                    [8.07, 6.95],
                    [13.0, 7.58],
                    [9.05, 8.81],
                    [11.0, 8.33],
                    [14.0, 7.66],
                    [13.4, 6.81],
                    [10.0, 6.33],
                    [14.0, 8.96],
                    [12.5, 6.82],
                    [9.15, 7.2],
                    [11.5, 7.2],
                    [3.03, 4.23],
                    [12.2, 7.83],
                    [2.02, 4.47],
                    [1.05, 3.33],
                    [4.05, 4.96],
                    [6.03, 7.24],
                    [12.0, 6.26],
                    [12.0, 8.84],
                    [7.08, 5.82],
                    [5.02, 5.68]
                ],
                type: 'scatter'
            }
        ]
    },
    changeMark: false, // 刷新整个chart
    changeData: false, // 只刷新数据
})
</script>

<template>
    <div class="box-charts">
        <div class="box-chart">
            <chartView :options="chartInfos.optionsA" :change-mark="chartInfos.changeMark"
                :change-data="chartInfos.changeData"></chartView>
        </div>
        <div class="box-chart">
            <chartView :options="chartInfos.optionsB" :change-mark="chartInfos.changeMark"
                :change-data="chartInfos.changeData"></chartView>
        </div>
        <div class="box-chart">
            <chartView :options="chartInfos.optionsC" :change-mark="chartInfos.changeMark"
                :change-data="chartInfos.changeData"></chartView>
        </div>
        <div class="box-chart">
            <chartView :options="chartInfos.optionsD" :change-mark="chartInfos.changeMark"
                :change-data="chartInfos.changeData"></chartView>
        </div>
    </div>
</template>

<style scoped lang="scss">
.box-charts {
    display: flex;
    flex-wrap: wrap;

    .box-chart {
        width: 50%;
        height: 45vh;
    }
}
</style>
