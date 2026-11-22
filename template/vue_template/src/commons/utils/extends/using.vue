<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch, watchEffect } from 'vue'

import * as extend from '@/commons/utils/extends'
import dayjs from 'dayjs'

import { Funcs } from '@/commons/utils/extends/calc'
Funcs.register("REVERSE", async (str: string) => str.split("").reverse().join(""));

// name
defineOptions({
    name: 'custom-name'
})

const pageInfos = reactive({
    string: {
        str: '',
        replace: {
            str: 'ABCDBCE',
            old: 'BC',
            new: 'z',
        },
        calc: {
            values: '{"a":"abc","b":"abcxyz"}',
            template: '${REVERSE(${a})}&${RIGHT(${b},3)}&${DATENOW(YYYYMMDD)}',
        },
        capture: {
            values: '@120250101@11666666@13',
            from: '@1',
            to: '@11'
        },
    },
    number: {
        rand: {
            min: 1,
            max: 10,
            fix: 2,
        },
        fix: {
            value: 1234.5,
            fix: 2,
        },
        money: 362485960.135,
        radix: 1024,
        split: 1234.5678,
        limit: {
            min: 1,
            max: 10,
            value: 15,
        },
        gap: {
            a: 10,
            b: 5
        },
    },
    date: {
        value: dayjs("2025/08/31 09:00:00"),
        format: "YYYY/MM/DD HH:mm:ss",
        type: 'A',
        interval: 'd' as any,
        add: 3,
        gap: dayjs("2025/09/17 09:00:00"),
        period: '7d' as any,
    },
    object: {
        sample: {
            user: {
                profile: {
                    name: "Alice",
                    age: 20
                }
            },
            users: [
                { name: "Tom", age: 25 },
                { name: "Jerry", age: 30 }
            ]
        },
        path: 'users.0.name',
        oData: {
            and: [
                { Name: { op: "contains", value: 'ad', not: true } },
                {
                    and: [
                        { Age: { op: "gt", value: 21 } },
                        { Birthday: { op: "now", link: "eq" } },
                        { Address: { op: "length", link: "eq", value: 5 } },
                    ]
                }
            ]
        }
    },
    interval: new extend.ExInterval(),
    schedule: {
        hour: 0,
        minute: 0
    },
    nextTime: '',
    localStorage: '',
})

const calcResult = ref<string | null>(null)
watchEffect(async () => {
    if (!pageInfos.string.calc.template) {
        calcResult.value = null
        return
    }
    try {
        const parsedValues = JSON.parse(pageInfos.string.calc.values || "{}")
        calcResult.value = await extend.ExString.calcStr(
            pageInfos.string.calc.template,
            parsedValues
        )
    } catch (err) {
        calcResult.value = "❌ JSON 解析失败"
    }
})

const datas = ref<extend.ExPaginator<any> | null>(null);
const columns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Age", dataIndex: "age", key: "age" },
    { title: "Email", dataIndex: "email", key: "email" },
];

onMounted(() => {
    getlistData()
})

const getlistData = () => {
    const size = 12
    fetch('/api/user/list?size=' + size)
        .then((resp: any) => {
            if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }
            return resp.json();
        })
        .then((resp: any) => {
            const { status, result } = resp
            datas.value = new extend.ExPaginator(
                [...result.list],
                5
            )
        })
        .catch(err => {
            console.error('Fetch 错误:', err);
        });
}
const handleTableChange = (pagination: any) => {
    if (!datas.value) return;

    datas.value.setSize(pagination.pageSize);
    datas.value.goTo(pagination.current - 1);
};

const create = () => {
    pageInfos.interval.create(() => {
        console.log('Testing: ', '已运行')
    }, 5000, "测试", true)
}
const schedule = () => {
    extend.ExInterval.scheduleTask(pageInfos.schedule, (nextTime: Date) => {
        pageInfos.nextTime = nextTime.toLocaleString()
    }, true)
}

const setLocal = () => {
    extend.ExLocalStore.set('extend-using', { value: 'extend-using' })
}
const getLocal = () => {
    pageInfos.localStorage = extend.ExLocalStore.get('extend-using')
}
</script>

<template>
    <div class="sections">
        <!-- ExString -->
        <div class="box box-string box-shadow">
            <div class="box-header">
                <h4 class="titles">ExString</h4>
            </div>
            <div class="box-contents">
                <a-input v-model:value="pageInfos.string.str" style="width: 200px;" />
                <div class="example-item">
                    <span class="item-func">isNotEmpty</span>
                    {{ extend.ExString.isNotEmpty(pageInfos.string.str) }}
                </div>
                <div class="example-item">
                    <span class="item-func">isNumber</span>
                    {{ extend.ExString.isNumber(pageInfos.string.str) }}
                </div>
                <div class="example-item">
                    <span class="item-func">isEmail</span>
                    {{ extend.ExString.isEmail(pageInfos.string.str) }}
                </div>
                <div class="example-item">
                    <span class="item-func">isFilePath</span>
                    {{ extend.ExString.isFilePath(pageInfos.string.str) }}
                </div>
                <div class="example-item">
                    <span class="item-func">fileType</span>
                    {{ extend.ExString.fileType(pageInfos.string.str) }}
                </div>
                <div class="example-item">
                    <span class="item-func">fileIcon</span>
                    {{ extend.ExString.fileIcon(extend.ExString.fileType(pageInfos.string.str) || '') }}
                </div>
                <div class="example-item">
                    <span class="item-func">trim</span>
                    <span>1-[{{ extend.ExString.trim(pageInfos.string.str, 1) }}]</span>
                    <span>2-[{{ extend.ExString.trim(pageInfos.string.str, 2) }}]</span>
                    <span>3-[{{ extend.ExString.trim(pageInfos.string.str, 3) }}]</span>
                    <span>4-[{{ extend.ExString.trim(pageInfos.string.str, 4) }}]</span>
                </div>
                <div class="example-item">
                    <span class="item-func">toCase</span>
                    <span>upper-[{{ extend.ExString.toCase(pageInfos.string.str, "upper") }}]</span>
                    <span>lower-[{{ extend.ExString.toCase(pageInfos.string.str, "lower") }}]</span>
                    <span>first-[{{ extend.ExString.toCase(pageInfos.string.str, "first") }}]</span>
                    <span>unfirst-[{{ extend.ExString.toCase(pageInfos.string.str, "unfirst") }}]</span>
                    <span>reverse-[{{ extend.ExString.toCase(pageInfos.string.str, "reverse") }}]</span>
                </div>
                <div class="example-item">
                    <span class="item-func">replaceAll</span>
                    <a-input v-model:value="pageInfos.string.replace.str" style="width: 200px;" />
                    <a-input v-model:value="pageInfos.string.replace.old" style="width: 200px;" />
                    <a-input v-model:value="pageInfos.string.replace.new" style="width: 200px;" />
                    <span>
                        = {{
                            extend.ExString.replaceAll(pageInfos.string.replace.str, pageInfos.string.replace.old,
                                pageInfos.string.replace.new)
                        }}
                    </span>
                </div>
                <div class="example-item"><span class="item-func">uuid</span> {{ extend.ExString.uuid() }}</div>
                <div class="example-item">
                    <span class="item-func">calcStr</span>
                    <a-textarea style="width: 200px;" v-model:value="pageInfos.string.calc.values"></a-textarea>
                    <a-textarea style="width: 250px;" v-model:value="pageInfos.string.calc.template"></a-textarea>
                    {{ calcResult }}
                </div>
                <div class="example-item">
                    <span class="item-func">captureStr</span>
                    <a-input v-model:value="pageInfos.string.capture.values" style="width: 250px;" />
                    <a-input v-model:value="pageInfos.string.capture.from" style="width: 80px;" />
                    <a-input v-model:value="pageInfos.string.capture.to" style="width: 80px;" />
                    {{
                        extend.ExString.captureStr(pageInfos.string.capture.values, pageInfos.string.capture.from,
                            pageInfos.string.capture.to)
                    }}
                </div>
            </div>
        </div>

        <!-- ExNumber -->
        <div class="box box-number box-shadow">
            <div class="box-header">
                <h4 class="titles">ExNumber</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <span class="item-func">createRand</span>
                    <a-input-number v-model:value="pageInfos.number.rand.min" style="width: 100px;" />
                    <a-input-number v-model:value="pageInfos.number.rand.max" style="width: 100px;" />
                    <a-input-number v-model:value="pageInfos.number.rand.fix" style="width: 80px;" />
                    <span>
                        {{
                            extend.ExNumber.createRand(pageInfos.number.rand.min, pageInfos.number.rand.max,
                                pageInfos.number.rand.fix)
                        }}
                    </span>
                </div>
                <div class="example-item">
                    <span class="item-func">toFixed</span>
                    <a-input-number v-model:value="pageInfos.number.fix.value" style="width: 100px;" />
                    <a-input-number v-model:value="pageInfos.number.fix.fix" style="width: 80px;" />
                    <span>{{ extend.ExNumber.toFixed(pageInfos.number.fix.value, pageInfos.number.fix.fix) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">formatMoney</span>
                    <a-input-number v-model:value="pageInfos.number.money" style="width: 150px;" />
                    <span>{{ extend.ExNumber.formatMoney(pageInfos.number.money) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">transRadix</span>
                    <a-input-number v-model:value="pageInfos.number.radix" style="width: 100px;" />
                    <span>2={{ extend.ExNumber.transRadix(pageInfos.number.radix, 10, 2) }}</span>
                    <span>8={{ extend.ExNumber.transRadix(pageInfos.number.radix, 10, 8) }}</span>
                    <span>16={{ extend.ExNumber.transRadix(pageInfos.number.radix, 10, 16) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">split</span>
                    <a-input-number v-model:value="pageInfos.number.split" style="width: 100px;" />
                    <span>{{ extend.ExNumber.split(pageInfos.number.split) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">limit</span>
                    <a-input-number v-model:value="pageInfos.number.limit.min" style="width: 100px;" />
                    <a-input-number v-model:value="pageInfos.number.limit.max" style="width: 100px;" />
                    <a-input-number v-model:value="pageInfos.number.limit.value" style="width: 100px;" />
                    <span>
                        {{ extend.ExNumber.limit(pageInfos.number.limit.value, pageInfos.number.limit.min,
                            pageInfos.number.limit.max) }}
                    </span>
                </div>
                <div class="example-item">
                    <span class="item-func">gap</span>
                    <a-input-number v-model:value="pageInfos.number.gap.a" style="width: 80px;" />
                    <span>-</span>
                    <a-input-number v-model:value="pageInfos.number.gap.b" style="width: 80px;" />
                    <span>= {{ extend.ExNumber.gap(pageInfos.number.gap.a, pageInfos.number.gap.b) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">fixFloatingPointError</span>
                    <span>{{ 0.1 + 0.2 }}</span>
                    <span>{{extend.ExNumber.fixFloatingPointError(0.1, 0.2, (a, b) => a + b)}}</span>
                </div>
            </div>
        </div>

        <!-- Array -->
        <div class="box box-array box-shadow">
            <div class="box-header">
                <h4 class="titles">ExArray</h4>
            </div>
            <div class="box-contents">
                <div class="example-item"><span class="item-func">initial</span> {{ extend.ExArray.initial(10) }}</div>
            </div>
        </div>

        <!-- ExDate -->
        <div class="box box-date box-shadow">
            <div class="box-header">
                <h4 class="titles">ExDate</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <a-date-picker show-time v-model:value="pageInfos.date.value" />
                </div>
                <div class="example-item">
                    <span class="item-func">format</span>
                    <a-input v-model:value="pageInfos.date.format" style="width: 200px;" />
                    <span>{{ extend.ExDate.format(pageInfos.date.value, pageInfos.date.format) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">formatUTC</span>
                    <span>{{ extend.ExDate.formatUTC(pageInfos.date.value) }}</span>
                    <span>{{ new Date(pageInfos.date.value.toString()).getTime() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">formatShow</span>
                    <span>{{ extend.ExDate.formatShow(pageInfos.date.value) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">getCW</span>
                    <a-select ref="select" v-model:value="pageInfos.date.type" style="width: 80px">
                        <a-select-option value="A">A</a-select-option>
                        <a-select-option value="B">B</a-select-option>
                    </a-select>
                    <span>CW{{ extend.ExDate.getCW(pageInfos.date.value.toString(), pageInfos.date.type) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">add</span>
                    <a-input-number v-model:value="pageInfos.date.add" style="width: 80px;" />
                    <a-select ref="select" v-model:value="pageInfos.date.interval" style="width: 120px">
                        <a-select-option value="y">Year</a-select-option>
                        <a-select-option value="M">Month</a-select-option>
                        <a-select-option value="q">Quarter</a-select-option>
                        <a-select-option value="w">Week</a-select-option>
                        <a-select-option value="d">Day</a-select-option>
                        <a-select-option value="h">Hour</a-select-option>
                        <a-select-option value="m">Minute</a-select-option>
                        <a-select-option value="s">Second</a-select-option>
                    </a-select>
                    <span>
                        {{ extend.ExDate.format(extend.ExDate.add(pageInfos.date.value.toString(),
                            pageInfos.date.interval,
                            pageInfos.date.add), pageInfos.date.format)
                        }}
                    </span>
                </div>
                <div class="example-item">
                    <span class="item-func">gap</span>
                    <a-date-picker show-time v-model:value="pageInfos.date.gap" />
                    <span>{{ extend.ExDate.gap(pageInfos.date.gap.toString(), pageInfos.date.value.toString(),
                        pageInfos.date.interval) }}{{ pageInfos.date.interval }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">period</span>
                    <a-select ref="select" v-model:value="pageInfos.date.period" style="width: 150px">
                        <a-select-option value="24h">Last 24 Hours</a-select-option>
                        <a-select-option value="3d">Last 3 Days</a-select-option>
                        <a-select-option value="7d">Last 7 Days</a-select-option>
                        <a-select-option value="last_week">Last week</a-select-option>
                        <a-select-option value="last_month">Last month</a-select-option>
                        <a-select-option value="last_year">Last year</a-select-option>
                    </a-select>
                    <span>{{ extend.ExDate.period(pageInfos.date.period) }}</span>
                </div>
            </div>
        </div>

        <!-- ExObject -->
        <div class="box box-object box-shadow">
            <div class="box-header">
                <h4 class="titles">ExObject</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <span class="item-func">stringifyParams</span>
                    <span>{{ extend.ExObject.stringifyParams({ a: "a1", b: "b1" }) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">typeOf</span>
                </div>
                <div class="example-item">
                    <span>null = {{ extend.ExObject.typeOf(null) }}</span>
                    <span>undefined = {{ extend.ExObject.typeOf(undefined) }}</span>
                    <span>"a" = {{ extend.ExObject.typeOf("") }}</span>
                    <span>1 = {{ extend.ExObject.typeOf(1) }}</span>
                    <span>true = {{ extend.ExObject.typeOf(true) }}</span>
                    <span>Symbol() = {{ extend.ExObject.typeOf(Symbol()) }}</span>
                    <span>10n = {{ extend.ExObject.typeOf(10n) }}</span>
                </div>
                <div class="example-item">
                    <span>{ a: "a1" } = {{ extend.ExObject.typeOf({ a: "a1" }) }}</span>
                    <span>["a1"] = {{ extend.ExObject.typeOf(["a1"]) }}</span>
                    <span>function(){} = {{ extend.ExObject.typeOf(function () { }) }}</span>
                    <span>/abc/ = {{ extend.ExObject.typeOf(/abc/) }}</span>
                    <span>new Date() = {{ extend.ExObject.typeOf(new Date()) }}</span>
                    <span>new Error() = {{ extend.ExObject.typeOf(new Error()) }}</span>
                </div>
                <div class="example-item">
                    <span>new Map() = {{ extend.ExObject.typeOf(new Map()) }}</span>
                    <span>new Set() = {{ extend.ExObject.typeOf(new Set()) }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">getValuebyPath</span>
                    <a-input v-model:value="pageInfos.object.path" style="width: 200px;" />
                    <span>{{ extend.ExObject.getValuebyPath(pageInfos.object.sample, pageInfos.object.path) }}</span>
                </div>
                <div class="example-item">
                    <span>{{ pageInfos.object.sample }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">buildODataFilter</span>
                    <span>{{ extend.ExObject.buildODataFilter(pageInfos.object.oData) }}</span>
                </div>
            </div>
        </div>

        <!-- ExWeb -->
        <div class="box box-web box-shadow">
            <div class="box-header">
                <h4 class="titles">ExWeb</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <span class="item-func">url</span>
                    <span>{{ extend.ExWeb.url() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">params</span>
                    <span>{{ extend.ExWeb.params() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">query</span>
                    <span>(encode/decode) {{ extend.ExWeb.query('type') }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">browser</span>
                    <span>{{ extend.ExWeb.browser() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">device</span>
                    <span>{{ extend.ExWeb.device() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">viewSize</span>
                    <span>{{ extend.ExWeb.viewSize() }}</span>
                </div>
                <div class="example-item">
                    <span class="item-func">close</span>
                    <a-button type="default" @click="extend.ExWeb.close()">close</a-button>
                </div>
            </div>
        </div>

        <!-- ExInterval -->
        <div class="box box-promise box-shadow">
            <div class="box-header">
                <h4 class="titles">ExInterval</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <span>LastID: {{ pageInfos.interval.lastID }}</span>
                    <span>IDs: {{ pageInfos.interval.list }}</span>
                </div>
                <div class="example-item">
                    <a-button @click="create">create</a-button>
                    <a-button @click="pageInfos.interval.stop()">stop</a-button>
                    <a-button @click="pageInfos.interval.clear()">clear</a-button>
                    <a-button @click="pageInfos.interval.clearAll()">clearAll</a-button>
                </div>
                <div class="example-item">
                    <span class="item-func">scheduleTask</span>
                    <a-input-number v-model:value="pageInfos.schedule.hour" style="width: 200px;" :max="24" />
                    <a-input-number v-model:value="pageInfos.schedule.minute" style="width: 200px;" :max="60" />
                    <a-button @click="schedule">schedule</a-button>
                </div>
                <div class="example-item">
                    <span>Next Run: {{ pageInfos.nextTime }}</span>
                </div>
            </div>
        </div>

        <!-- ExLocalStore -->
        <div class="box box-promise box-shadow">
            <div class="box-header">
                <h4 class="titles">ExLocalStore</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <a-button @click="setLocal">set</a-button>
                    <a-button @click="getLocal">get</a-button>
                </div>
                <div class="example-item">
                    <span>{{ pageInfos.localStorage }}</span>
                </div>
            </div>
        </div>

        <!-- ExPaginator -->
        <div class="box box-pagination box-shadow">
            <div class="box-header">
                <h4 class="titles">ExPaginator</h4>
            </div>
            <div class="box-contents">
                <a-table v-if="datas" :columns="columns" :dataSource="datas.rows" :pagination="{
                    current: datas.pagination.index + 1, // 转换成 antd 从1开始
                    pageSize: datas.pagination.size,
                    total: datas.pagination.total,
                    showSizeChanger: true, // 允许修改每页大小
                    pageSizeOptions: ['5', '10', '20', '50']
                }" rowKey="_rowNo" @change="handleTableChange" />
            </div>
        </div>

        <!-- Optimize -->
        <div class="box box-optimize box-shadow">
            <div class="box-header">
                <h4 class="titles">Optimize</h4>
            </div>
            <div class="box-contents">
                <div class="example-item">
                    <span class="item-func">promiseFlow</span>
                </div>
                <div class="example-item">
                    <span class="item-func">promiseQueue</span>
                </div>
                <div class="example-item">
                    <span class="item-func">debounceFn</span>
                </div>
                <div class="example-item">
                    <span class="item-func">throttleFn</span>
                </div>
                <div class="example-item">
                    <span class="item-func">curryFn</span>
                </div>
                <div class="example-item">
                    <span class="item-func">composeFns</span>
                </div>
                <div class="example-item">
                    <span class="item-func">singletonFn</span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.sections {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;

    .box {
        width: 48%;
    }
}

.box-contents {
    display: flex;
    flex-direction: column;
    gap: 20px;

    .example-item {
        display: flex;
        align-items: center;
        gap: 10px;

        .item-func {
            padding: 2px 5px;
            color: #fff;
            font-size: 14px;
            border-radius: 5px;
            background: #71767c;
        }
    }
}

.box-show,
.box-code {
    flex: 1;
}
</style>
