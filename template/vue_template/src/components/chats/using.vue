<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'

import { WebSocketService } from '@/commons/utils/websocket'
import chatsView from '@/components/chats/view.vue'

// name
defineOptions({
    name: 'custom-name'
})

onMounted(async () => {
    await initialChat()
    demo()
})
const demo = async () => {
    // 提出问题
    chatRef.value.sendChat({
        action: 'question',
        connectionID: '',
        isBot: false,
        messages: [
            {
                type: 'text',
                data: '如何优化前端页面加载速度？'
            }
        ]
    })
}
const handleMessage = (connectionID: string, message: any) => {
    switch (message) {
        case '如何优化前端页面加载速度？': {
            chatRef.value.sendChat({
                action: 'flows',
                connectionID,
                name: chatsConfigs.robotName,
                isBot: true,
                thought:`#### 思考过程
1. **初步评估状态**：
    * 检查整体内存使用率（使用 \`free -h\` 或 \`top\`）。
    * 确认是物理内存不足还是交换空间（Swap）使用过多。
2. **定位“罪魁祸首”**：
    * 利用 \`top\` 或 \`htop\` 等工具按内存占用大小进行排序。
    * 区分是单个进程占用过高，还是多个进程累积导致。
3. **分析进程背景**：
    * 查看该进程的启动用户、启动时间和命令行参数。
    * 判断该进程是否为异常程序。
4. **采取行动**：
    * 确定处理方案（扩容、优化或杀进程）。
5. **后续预防**：
    * 检查系统日志并配置监控报警。`,
                messages: [
                    {
                        type: 'text',
                        data: `当服务器出现卡顿时，请按照以下步骤进行排查：

#### 步骤 1：检查资源占用情况
首先，使用 \`free -h\` 查看内存总量与已用量，或者直接运行 \`top\` 命令。

> **提示**：在 \`top\` 界面中，按下键盘上的 **\`M\`** 键，进程列表将自动按照内存占用率（%MEM）进行降序排列。

#### 步骤 2：识别高消耗进程
查看是否存在异常高占用的进程，参考下表分析：

| 指标 | 含义 | 建议 |
| :--- | :--- | :--- |
| **%MEM** | 物理内存占用百分比 | 重点关注超过 50% 的进程 |
| **RES** | 常驻内存大小 | 实际使用的物理内存 |
| **S** | 进程状态 | 若为 \`Z\` 则为僵尸进程，需处理 |

#### 步骤 3：查看进程详细信息
如果发现某个进程（例如进程 ID 为 \`1234\`）占用异常，你可以通过以下命令定位其来源：

\`\`\`bash
# 查看该进程运行的完整路径和参数
ps -ef | grep 1234

# 查看该进程打开的文件，有助于定位泄露源
lsof -p 1234`
                       },
                ],
                suggests: [
                    { content: '什么是贝尔不等式？', icon: 'fa-calculator' },
                    { content: '量子计算机是如何利用纠缠的？', icon: 'fa-microchip' },
                    { content: '爱因斯坦为什么反对这个理论？', icon: 'fa-user-astronaut' },
                ],
            })
            break
        }
        case '测试文本': {
            chatRef.value.sendChat({
                action: 'flows',
                connectionID,
                name: chatsConfigs.robotName,
                isBot: true,
                messages: [
                    {
                        type: 'text',
                        data: `List\n`
                    },
                    {
                        type: 'list',
                        data: [
                            "首先需要这样这样",
                            "其次那样那样",
                            "组后再这样这样",
                        ]
                    },
                    {
                        type: 'text',
                        data: `MD Table\n\n`
                    },
                    {
                        type: 'text',
                        data: `| 名称 | 年龄 | 职业 |\n|------|-----|------|\n| Alice | 25  | 工程师 |\n| Bob   | 30  | 设计师 |\n\n`
                    },
                    {
                        type: 'text',
                        data: `Table\n\n`
                    },
                    {
                        type: 'table',
                        data: {
                            columns: [
                                { key: 'name', title: '名称' },
                                { key: 'age', title: '年龄' },
                                { key: 'address', title: '职业' },
                            ],
                            rows: [
                                { id: 1, name: "Alice", age: 25, address: '工程师' },
                                { id: 1, name: "Bob", age: 30, address: '设计师' },
                            ],
                        },
                    },
                    {
                        type: 'echart',
                        data: {
                            options: {
                                xAxis: {
                                    type: 'category',
                                    data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                                },
                                yAxis: {
                                    type: 'value'
                                },
                                series: [
                                    {
                                        data: [150, 230, 224, 218, 135, 147, 260],
                                        type: 'line'
                                    }
                                ]
                            }
                        }
                    },
                    {
                        type: 'text',
                        data: `可点击 [ERP]{:data-action="code"} 或 [@User A]{:data-user="89062945"} 或 [百度](https://baidu.com) 来跳转至详情页。`
                    },
                ],
            })
            break
        }
        case '测试附件': {
            chatRef.value.sendChat({
                action: 'tips',
                connectionID,
                name: chatsConfigs.robotName,
                isBot: true,
                messages: [
                    {
                        type: 'text',
                        data: `下面是附件列表`
                    },
                ],
                attachments: [
                    {
                        type: 'image',
                        url: imageCode,
                        name: '示例图片',
                    },
                    {
                        type: 'image',
                        url: 'https://szhlinvma75.apac.bosch.com:59193/uploads/322f3d45-5176-4f51-b8b5-45063f95f4ae_0437508983_1550_20250822171409.jpg',
                        name: '示例图片',
                    },
                    {
                        type: 'pdf',
                        url: 'https://szhlinvma75.apac.bosch.com:59193/uploads/9f4f681c-8a07-48a1-843d-b224100e82b3_TCD_Xin1_QL_BEV_v01%201.pdf',
                        name: '示例pdf',
                    },
                    {
                        type: 'file',
                        url: '',
                        name: '示例文件',
                    },
                ],
            })
            break
        }
        default: {
            // 普通回复
            chatRef.value.sendChat({
                action: 'flows',
                connectionID,
                name: chatsConfigs.robotName,
                isBot: true,
                //
                messages: [
                    {
                        type: 'text',
                        data: `你刚才说的是 ${message} 吗? 很有趣!`
                    }
                ]
            })
            break
        }
    }
}
const imageCode = "data:image/png;base64,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"

//#region WebSocket
let wss: WebSocketService | null = null;
const wsInfos = reactive({
    host: "wss://szhlinvma75.apac.bosch.com:59193/ws",
    isActive: false,
})
onMounted(async () => {
    // 启用websocket服务
    wss = new WebSocketService(wsInfos.host, receiveMessage,
        () => {
            wsInfos.isActive = true
        }, (status: boolean) => {
            wsInfos.isActive = false
        })
    wss.connect()
})
const receiveMessage = (msg: any) => {
    chatRef.value.receiveMessage(msg)
}
//#endregion

//#region 配置
const chatRef: any = ref(null)
const chatsConfigs = {
    robotName: '小博',
    speed: 3,
    limit: 10,
    //
    show: {
        input: true,
        model: true,
        thinking: true,
        search: true,
        upload: true,
        tools: true,
    },
    //
    model: 'GPT-4o',
    hasThinking: true,
    hasSearch: true,
}
// 初始化
const initialChat = async () => {
    chatRef.value.sendChat({
        action: 'flows',
        connectionID: '001',
        name: chatsConfigs.robotName,
        isBot: true,
        messages: [
            {
                type: 'text',
                data: `any question?`
            }
        ]
    })
}
// 用户发送了信息
const afterSend = (event: any) => {
    const { connectionID, message } = event

    // 先 push loading
    chatRef.value.sendChat({
        action: 'waiting',
        connectionID,
        name: chatsConfigs.robotName,
        isBot: true,
        status: 'waiting',
        messages: []
    })

    // 处理消息
    handleMessage(connectionID, message)
}
// 接收完信息
const afterReceive = (event: any) => {
}
// 用户清空了信息
const afterClear = () => {
    initialChat()
}
// 用户点击事件
const clickItem = (event: any) => {
}
//#endregion
</script>

<template>
    <div class="box-chats">
        <chatsView ref="chatRef" :configs="chatsConfigs" @sended="afterSend($event)" @received="afterReceive($event)"
            @cleared="afterClear()" @clickItem="clickItem($event)"></chatsView>
    </div>
</template>

<style scoped lang="scss">
.box-chats {
    margin: 0 auto;
    padding: 0 20px;
    width: 1000px;
    height: 100%;
    border-radius: 15px;
    background: var(--color-page-bg);
}
</style>
