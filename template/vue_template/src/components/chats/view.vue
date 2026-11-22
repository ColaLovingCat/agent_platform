<script lang="ts" setup>
import { onMounted, onUnmounted, ref, type Ref, reactive, watch, type PropType } from 'vue'
import type { ChatMessage, ChatConfigs } from './chats.types';

import chartView from '@/components/echarts/view.vue'

import * as extend from '@/commons/utils/extends'
import * as messages from '@/commons/utils/messages'
import { logger } from '@/commons/utils/logger'
const log = logger.create("Chat");

//#region Markdown
import md from './markdown/markdown'
// 重写文本渲染规则以支持可点击文本
const defaultTextRule = md.renderer.rules.text!
md.renderer.rules.text = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    try {
        const content = tokens[idx]?.content
        if (content && typeof content === 'string') {
            return renderClickableText(content)
        }
        return defaultTextRule(tokens, idx, options, env, self)
    } catch (error) {
        log.error('Error in markdown text rule:', error)
        return defaultTextRule(tokens, idx, options, env, self)
    }
}
// 渲染带有点击功能的文本
const renderClickableText = (text: string) => {
    try {
        if (!text || typeof text !== 'string') {
            return md.utils.escapeHtml(text || '')
        }

        const segments = parseClickableText(text)

        return segments.map(segment => {
            if (segment.type === 'clickable') {
                const escapedCategory = md.utils.escapeHtml(String(segment.category))
                const escapedContent = md.utils.escapeHtml(String(segment.content))
                const escapedText = md.utils.escapeHtml(String(segment.text))

                return `<span class="clickable-text" data-category="${escapedCategory}" data-content="${escapedContent}">${escapedText}</span>`
            } else {
                return md.utils.escapeHtml(String(segment.content || ''))
            }
        }).join('')
    } catch (error) {
        console.error('❌ 渲染可点击文本时出错:', error)
        return md.utils.escapeHtml(text)
    }
}
// 解析文本中的可点击词汇 - [显示文本]{:data-action="code"}
const parseClickableText = (text: string) => {
    if (!text || typeof text !== 'string') {
        return [{ type: 'text', content: text || '' }]
    }

    const segments: any[] = []
    let currentIndex = 0
    const textLength = text.length

    while (currentIndex < textLength) {
        const remainingText = text.slice(currentIndex)

        // 查找第一个出现的特殊模式
        let earliestMatch: any = null
        let matchType = ''

        // 检查 [显示文本]{:data-action="code"}
        const bracketRegex = /\[([^\]]+)\]\{:data-([^=]+)=[“"]([^”"]+)[”"]\}/;
        const bracketMatch = remainingText.match(bracketRegex);
        if (bracketMatch && bracketMatch.index !== undefined) {
            if (!earliestMatch || bracketMatch.index < earliestMatch.index) {
                earliestMatch = bracketMatch
                matchType = 'bracket'
            }
        }

        if (earliestMatch) {
            const matchIndex = earliestMatch.index

            // 添加匹配前的普通文本
            if (matchIndex > 0) {
                segments.push({
                    type: 'text',
                    content: remainingText.slice(0, matchIndex)
                })
            }

            // 根据匹配类型添加可点击文本
            if (matchType == 'bracket') {
                segments.push({
                    type: 'clickable',
                    text: earliestMatch[1],
                    category: earliestMatch[2],
                    content: earliestMatch[3].trim()
                })
            }

            // 更新当前位置
            currentIndex += matchIndex + earliestMatch[0].length
        } else {
            // 没有更多匹配，添加剩余文本
            segments.push({
                type: 'text',
                content: remainingText
            })
            break
        }
    }

    return segments.length > 0 ? segments : [{ type: 'text', content: text }]
}
//#endregion

// name
defineOptions({
    name: 'app-chats'
})

// props
const props = defineProps({
    // 配置
    configs: {
        type: Object as PropType<ChatConfigs>,
        default: () => {
            return {
                show: {
                    input: true,
                    model: false,
                    thinking: false,
                    search: false,
                    upload: false,
                    tools: false,
                },
                model: '',
                speed: 2,
            }
        }
    },
})

// emits
const emits = defineEmits<{
    (event: 'sended', values: any): void // 发送信息后触发外部方法
    (event: 'received', values: any): void // 回答已接收完
    (event: 'cleared', values: any): void // 清空对话框
    (event: 'clickItem', values: any): void // 点击了某一元素 table|chart
}>()

const chatInfos = reactive({
    connectionID: '',
    records: [] as ChatMessage[],
    message: '',
    //
    isThinking: false,
    // 计时器
    count: 0,
    timer: null as any,
})

onMounted(() => { })

onUnmounted(() => {
    endChat()
})

//#region Click
// 监听点击
document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    // 代码复制
    if (target.classList.contains("code-copy")) {
        const codeElement = target.nextElementSibling?.querySelector("code");
        if (codeElement) {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                target.innerText = "Copied";
                setTimeout(() => (target.innerText = "Copy"), 1500);
            });
        }
    }

    // 可点击文本
    if (target.classList.contains('clickable-text')) {
        const text = target.innerHTML
        const category = target.getAttribute('data-category')
        const content = target.getAttribute('data-content')
        if (category && content) {
            handleTextClick({ category, content, text })
        }
    }
});
// 文本点击处理函数
const handleTextClick = (values: any) => {
    log.log('Text clicked:', values)
    emits('clickItem', { action: 'text', values })
}
// Table
const handleTableClick = (column: string, row: any) => {
    log.log('Table clicked:', column, row)
    emits('clickItem', {
        action: 'table',
        values: {
            column,
            row,
        }
    })
}
// Chart
const handleChartClick = (event: any) => {
    log.log('Chart clicked:', event)
    emits('clickItem', {
        action: 'chart',
        values: event
    })
}
//
const handleSuggestClick = (suggest: any) => {
    log.log('suggest clicked:', suggest)
    emits('clickItem', {
        action: 'suggest',
        values: suggest
    })
}
//#endregion

//#region Scroll
// 是否自动滚动
const isAutoScroll = ref(true)
const container: Ref<any> = ref(null)
watch(() => chatInfos.records, async () => {
    scrollTo('bottom')
}, { deep: true })
const scrollTo = (action: string = 'bottom', force: boolean = false) => {
    // 强制滚动
    if (force) isAutoScroll.value = true

    if (isAutoScroll.value) {
        requestAnimationFrame(() => {
            container.value?.scrollTo({ top: action == 'bottom' ? container.value.scrollHeight : 0, behavior: "smooth" });
        });
    }
}
const handleUserScroll = () => {
    isAutoScroll.value = false;
};
//#endregion

//#region Chat
const chatQueues = reactive({
    isProcessing: false,
    sendQueues: [] as any[],
    resolveSignal: null as null | ((value?: unknown) => void)
})
//
const sendChat = (record: ChatMessage) => {
    chatQueues.sendQueues.push(record);
    processQueue();
};
const processQueue = async () => {
    if (chatQueues.isProcessing) return;

    chatQueues.isProcessing = true;
    while (chatQueues.sendQueues.length > 0) {
        const record = chatQueues.sendQueues.shift();
        if (!record) continue;

        log.log('run', record)
        isAutoScroll.value = true
        handleRecord(record)

        const needWait = record.action === 'flows';

        if (needWait) {
            await new Promise((resolve) => {
                chatQueues.resolveSignal = resolve;
            });
        } else {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    chatQueues.isProcessing = false;
};
//
const tempID = ref('') // 用于存储外部传入的指定ID
const handleRecord = async (record: ChatMessage) => {
    const { connectionID, messages, thought, suggests } = record

    //
    switch (record.action) {
        // 将外部的文本处理成流式
        case 'flows': {
            // 开始对话
            chatInfos.connectionID = connectionID

            let target = chatInfos.records.find((a: any) => a.connectionID === connectionID && a.isBot);

            // 占位
            if (!target) {
                target = {
                    ...record,
                    status: 'open',
                    messages: [],
                    suggests: [],
                }
                chatInfos.records.push(target)
            }

            target.status = 'open'

            // 处理思考过程 (Thinking)
            if (thought) {
                target.hasThinking = true

                target.isThinking = true
                target.showThinking = true

                await streamText(connectionID, thought, true);

                target.isThinking = false;
            }

            // 处理正文内容 (Messages)
            for (let index = 0; index < messages.length; index++) {
                if (shouldAbortFlow(record.connectionID)) break;

                const mes = messages[index];
                switch (mes.type) {
                    case 'text': {
                        await streamText(connectionID, mes.data, false);
                        break;
                    }
                    case 'list': {
                        for (const content of mes.data) {
                            if (shouldAbortFlow(record.connectionID)) break;

                            pushList({ connectionID, content });
                            await extend.Optimize.sleep(300);
                        }
                        break;
                    }
                    default: {
                        await extend.Optimize.sleep(400);
                        pushMessage({ connectionID, isBot: true, messages: [mes] });
                        break;
                    }
                }
            }

            // 补充建议 (Suggests)
            if (suggests && suggests.length > 0) {
                await extend.Optimize.sleep(200); // 稍微停顿一下再出建议
                let temp = chatInfos.records.find((a: any) => a.connectionID == record.connectionID && a.isBot)
                if (temp) {
                    temp.suggests = suggests
                    // 触发最后的滚动
                    scrollTo('bottom', true)
                }
            }

            // 确保 Loading 状态移除
            let finalTemp = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot);
            if (finalTemp) {
                finalTemp.messages = finalTemp.messages.filter((item: any) => item.type !== 'loading');
            }

            chatInfos.connectionID = ''
            target.status = 'done'

            if (chatQueues.resolveSignal) {
                chatQueues.resolveSignal();
                chatQueues.resolveSignal = null; // 重置锁
            }
            break
        }
        // 外部直接提问
        case 'question': {
            tempID.value = connectionID
            sendDirect(messages[0].data)
            break
        }
        // 等待回答
        case 'waiting': {
            chatInfos.connectionID = record.connectionID
            chatInfos.records.push({
                ...record,
                status: 'waiting',
            })
            break
        }
        // 报错信息
        case 'error': {
            pushError()
            break
        }
        case 'tips':
        default: {
            let target = chatInfos.records.find((a: any) => a.connectionID === connectionID && a.isBot);

            if (target) {
                target = Object.assign(target, record)
                target.status = 'done'
                console.log('Testing: ', target)

            } else {
                chatInfos.records.push(record)
            }

            chatInfos.connectionID = ""
            break
        }
    }

    emits('received', {
        connectionID,
        action: record.action
    })
}
// 定义流式输出的逻辑
const streamText = async (connectionID: string, text: string, isThinking: boolean = false) => {
    const chars = Array.from(text); // 使用 Array.from 正确处理 emoji 和中文

    for (const char of chars) {
        // 安全检查：如果对话被清除或切换，停止循环
        if (shouldAbortFlow(connectionID)) return;

        if (isThinking) {
            pushThinking({ connectionID, message: char })
            // 思考通常比输出文本快一点
            await extend.Optimize.sleep(10 + Math.random() * 20);
        } else {
            pushText({ connectionID, text: char })
            // 智能延迟
            await extend.Optimize.sleep(getSmartDelay(char));
        }

        // 保持滚动到底部
        scrollTo('bottom');
    }
}
// 模拟自然打字延迟
const speedConfigs: any = {
    1: { min: 60, max: 100 },
    2: { min: 20, max: 50 },
    3: { min: 5, max: 15 }
};
const getSmartDelay = (char: string) => {
    const { min, max } = speedConfigs[props.configs.speed];

    let delay = Math.floor(Math.random() * (max - min + 1)) + min;

    if (['，', ',', '。', '.', '！', '!', '？', '?', ':', '：', '\n'].includes(char)) {
        const pauseFactor = props.configs.speed === 3 ? 0.5 : 1;
        delay += Math.floor(150 * pauseFactor);
    }

    return delay;
}
// 检查是否应该中断流式输出 (例如用户清除了对话)
const shouldAbortFlow = (connectionID: string) => {
    return chatInfos.connectionID === '' // 对话被中止
        || chatInfos.records.length === 0; // 对话被清空
}
//#endregion

//#region Message
// Send
const sendMessage = (event?: KeyboardEvent) => {
    // 阻止原本的事件
    if (event) event.preventDefault();

    // 是否有其他聊天正在继续
    if (chatInfos.connectionID != '') {
        log.log('another conversation wait')
        messages.showInfo(
            'Another conversation is currently in progress. Please wait until it is completed.'
        )
        return false
    }

    isAutoScroll.value = true
    const message = chatInfos.message
    if (message != '') {
        let connectionID = extend.ExString.uuid()
        //
        if (tempID.value != "") {
            connectionID = tempID.value
            tempID.value = ""
        }
        //
        chatInfos.records.push({
            connectionID,
            name: 'You',
            isBot: false,
            status: 'done',
            messages: [
                {
                    type: 'text',
                    data: message
                }
            ]
        })

        // 通知外部已开始对话
        emits('sended', {
            connectionID,
            message,
        })

        // 清空输入框
        chatInfos.message = ''
    } else {
        messages.showError('please input something')
    }
}
const stopMessage = () => {
    endChat()
}
// 直接提问
const sendDirect = (message: any) => {
    log.log('send directly')
    chatInfos.message = message
    sendMessage()
}
//
const receiveMessage = (msg: any) => {
    const message: any = formatStr(msg.message);
    const remarks: any = formatStr(msg.remarks);

    if (chatInfos.connectionID == msg.connectionID) {
        log.log('message:', msg, message, remarks)

        const target = chatInfos.records.find(a => a.connectionID == msg.connectionID && a.isBot)
        if (target) target.status = 'open'

        // 重置当前计时器
        if (chatInfos.timer) {
            clearTimer()
            log.log('clear timer with receive')
        }

        switch (msg.category) {
            case 'text': {
                // 思考开始
                if (message == '<think>') {
                    chatInfos.isThinking = true
                    return false
                }
                // 思考结束
                if (message == '</think>') {
                    chatInfos.isThinking = false
                    endThinking(msg.connectionID)
                    return false
                }

                if (chatInfos.isThinking) {
                    pushThinking({
                        connectionID: msg.connectionID,
                        message: message
                    })
                }
                else {
                    if (remarks.paragraph_start) {
                        pushMessage({
                            connectionID: msg.connectionID,
                            messages: [
                                {
                                    type: msg.category,
                                    data: message
                                }
                            ]
                        })
                    } else {
                        // 填补前一个段落
                        pushText({
                            connectionID: msg.connectionID,
                            text: message
                        })
                    }
                }
                break
            }
            default: {
                pushMessage({
                    connectionID: msg.connectionID,
                    messages: [
                        {
                            type: msg.category,
                            data: message
                        }
                    ]
                })
                break
            }
            case 'error': {
                pushMessage({
                    connectionID: msg.connectionID,
                    messages: [
                        {
                            type: 'error',
                            data: message
                        }
                    ]
                })
                break
            }
        }

        if (remarks.response_end) {
            log.log('end with response_end')
            // 对话结束
            if (target) target.status = 'done'
            endChat()
        }
        return false
    }
}
const formatStr = (str: string) => {
    let result = str
    try { result = JSON.parse(str); } catch (e) { }
    return result
}
//#endregion

//#region Push
// 接收信息
const pushMessage = (values: ChatMessage) => {
    const { connectionID, messages } = values
    let target = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot)
    if (target) {
        target.status = 'open'
        target.messages = [...target.messages, ...messages]
    }
}
// 文本流
const pushText = (values: any) => {
    const { connectionID, text } = values
    let temp = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot)
    if (temp) {
        // 清除loading元素
        temp.messages = temp.messages.filter((item: any) => item.type !== 'loading')
        let latestMessage = temp.messages[temp.messages.length - 1]
        if (latestMessage && latestMessage.type == 'text') {
            latestMessage.data += text
        } else {
            temp.messages.push({
                type: 'text',
                data: text
            })
        }
    }
}
//
const pushList = (values: any) => {
    const { connectionID, content } = values
    let temp = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot)
    if (temp) {
        // 清除loading元素
        temp.messages = temp.messages.filter((item: any) => item.type !== 'loading')
        // 检查是否最后的类型是text，不是则补充一个新的
        let latestMessage = temp.messages[temp.messages.length - 1]
        if (latestMessage && latestMessage.type == 'list') {
            latestMessage.data.push(content)
        } else {
            temp.messages.push({
                type: 'list',
                data: [content]
            })
        }
    }
}
//
const pushThinking = (values: any) => {
    const { connectionID, message } = values
    let temp = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot)
    if (temp) {
        temp.isThinking = true
        temp.thought = temp.thought ? temp.thought + message : message
    }
}
const endThinking = (connectionID: string) => {
    let temp = chatInfos.records.find((a: any) => a.connectionID == connectionID && a.isBot)
    if (temp) {
        temp.isThinking = false
    }
}
// Error
const pushError = () => {
    chatInfos.records.push({
        connectionID: '',
        isBot: true,
        messages: [
            {
                type: 'error',
                data: 'server is busy, please try again later.'
            }
        ]
    })
}
// support
const checkEmpty = (str: string) => {
    const sWithoutNewlines = str.replace(/\n/g, '');
    return sWithoutNewlines.length === 0;
}
//#endregion

//#region 计时器
const startTimer = () => {
    // 已经在计时了
    if (chatInfos.timer) return;

    chatInfos.count = 0
    chatInfos.timer = setInterval(() => {
        chatInfos.count++
        log.log('timer:', chatInfos.count)

        // 已超时
        if (chatInfos.count > props.configs.limit) {
            log.log('clear timer with timeout')
            messages.showError('The conversation has timed out')
            outTimer()
        }
    }, 1000)
}
// 已超时
const outTimer = () => {
    log.log('timeout')
    let loadingChat = chatInfos.records.find((a: any) => a.connectionID == chatInfos.connectionID && a.isBot)
    if (loadingChat) {
        // 清除loading元素
        loadingChat.messages = loadingChat.messages.filter((item: any) => item.type !== 'loading')
        loadingChat.messages = [
            ...loadingChat.messages,
            {
                type: 'text',
                data: 'server is busy, please try again later.'
            }
        ]
    }
    // 结束对话
    log.log('end with timeout')
    endChat()
}
// 清除超时计时器
const clearTimer = () => {
    chatInfos.count = 0
    clearInterval(chatInfos.timer)
    chatInfos.timer = null
}
//#endregion


//#region 对话工具栏
// 复制信息
const copyToClipboard = async (message: any) => {
    try {
        await navigator.clipboard.writeText(message);
        messages.showInfo('The information has been copied to the clipboard.')
    } catch (err) {
        console.error("复制失败:", err);
    }
};
// 重新生成该问题
const regenerate = (values: any) => {
    log.log('regenerate')
    // 信息
    const connectionID = values.connectionID
    const message = values.messages[0].data
    // 清除原有的信息
    chatInfos.records = chatInfos.records.filter(
        (record: any) => record.connectionID != connectionID
    );
    //
    sendDirect(message)
}
//#endregion

const chatTools = reactive({
    model: 'GPT-4o', // 模型
    //
    activeThinking: true,
    activeSearch: false,
    //
    activeTools: false,
    activeImage: false,
    activeCode: false,
})

//#region 输入框工具栏
// 录音
const voiceInfos: any = reactive({
    show: false,
    count: 0,
    timer: null
})
const startRecord = () => {
    voiceInfos.show = !voiceInfos.show
    //
    if (voiceInfos.show) {
        voiceInfos.count = 0
        voiceInfos.timer = setInterval(() => {
            voiceInfos.count++
        }, 1000);
    } else {
        voiceInfos.count = 0
        clearInterval(voiceInfos.timer)
        voiceInfos.timer = null
        //
        sendAudio()
    }

}
const sendAudio = () => {
    messages.showInfo("暂未开放")
}
//
const models = ref([
    { name: 'GPT-4o' },
    { name: 'Claude 3.5' },
    { name: 'Gemini 3.0' },
    { name: 'DeepSeek R1' },
    { name: 'Qwen' },
])
// 上传文件
const upload = () => {
    messages.showInfo("暂未开放")
}
//
const toggleSwitch = (action: keyof typeof chatInfos) => {
    // chatInfos[action] = !chatInfos[action]
}
//#endregion

// 清空对话
const clearChat = (mark: boolean = false) => {
    endChat()
    //
    chatInfos.records = []
    log.log('cleared')
    emits('cleared', {})
}
// 结束对话
const endChat = () => {
    log.log('end chat')
    // 结束对话
    chatInfos.connectionID = ''
    clearTimer()
}

// 更新 connectionID
const refreshConnectionID = (oldID: string, newID: string) => {
    chatInfos.records.filter(a => a.connectionID == oldID).map(item => item.connectionID = newID)
    if (chatInfos.connectionID == oldID) chatInfos.connectionID = newID
}

defineExpose({
    sendChat,
    receiveMessage,
    clearChat,
    refreshConnectionID
})
</script>

<template>
    <div class="app-chat">
        <div ref="container" class="chat-contents" @wheel="handleUserScroll">
            <div class="chat-empty" v-if="chatInfos.records.length == 0">
                <span>What can I do for you?</span>
            </div>
            <div class="list-chats" v-else>
                <template v-for="record in chatInfos.records" :key="record.connectionID">
                    <div class="chat-item" :class="record.isBot ? '' : 'item-user'">
                        <div class="item-content">
                            <!-- Thinking -->
                            <template v-if="chatTools.activeThinking && record.hasThinking">
                                <div class="item-thinks">
                                    <div class="item-think" @click="record.showThinking = !record.showThinking">
                                        <i class="fa-solid fa-atom"></i>
                                        <i class="think-status" :class="record.isThinking ? 'shimmer' : ''">
                                            {{ record.isThinking ? 'deep thinking...' : 'thoughts' }}
                                        </i>
                                        <i v-if="!record.showThinking" class="fa-solid fa-angle-down"></i>
                                        <i v-if="record.showThinking" class="fa-solid fa-angle-up"></i>
                                    </div>
                                    <p class="think-contents markdown-contents" v-if="record.showThinking"
                                        v-html="md.render(record.thought)"></p>
                                </div>
                            </template>

                            <!-- Message -->
                            <div class="item-messages">
                                <template v-for="msg in record.messages" :key="msg.type">
                                    <div class="item-message">

                                        <!-- 文本 -->
                                        <template v-if="msg.type == 'text'">
                                            <p class="item-txt markdown-contents" v-html="md.render(msg.data)"></p>
                                        </template>

                                        <!-- 列表 -->
                                        <template v-if="msg.type == 'list'">
                                            <div class="markdown-contents">
                                                <ul>
                                                    <li v-for="item in msg.data">{{ item }}</li>
                                                </ul>
                                            </div>
                                        </template>

                                        <!-- 表格 -->
                                        <template v-if="msg.type == 'table'">
                                            <div class="markdown-contents">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th v-for="th in msg.data.columns" :key="th.key">{{ th.title
                                                                }}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr v-for="row in msg.data.rows">
                                                            <td v-for="column in msg.data.columns" :key="column.key"
                                                                @click="handleTableClick(column, row)">
                                                                {{ row[column.key] }}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </template>

                                        <!-- 图片 -->
                                        <template v-if="msg.type === 'image'">
                                            <img :src="msg.data.url" />
                                        </template>

                                        <!-- 音频 -->
                                        <template v-if="msg.type === 'audio'">
                                            <audio controls>
                                                <source :src="msg.data.url" :type="msg.data.contentType" />
                                                Your browser does not support the audio tag.
                                            </audio>
                                        </template>

                                        <!-- 视频 -->
                                        <template v-if="msg.type === 'video'">
                                            <video controls>
                                                <source :src="msg.data.url" :type="msg.data.contentType" />
                                                Your browser does not support the video tag.
                                            </video>
                                        </template>

                                        <!-- eChart -->
                                        <template v-if="msg.type == 'echart'">
                                            <div class="item-chart">
                                                <chartView width="100%" height="300px" :options="msg.data.options"
                                                    @chartClick="handleChartClick">
                                                </chartView>
                                            </div>
                                        </template>
                                    </div>
                                </template>
                            </div>

                            <!-- Attachments -->
                            <div class="item-attachments" v-if="record.attachments && record.attachments.length > 0">
                                <div class="attach-item" v-for="attach in record.attachments">
                                    <template v-if="attach.type == 'image'">
                                        <img :src="attach.url" alt="" srcset="">
                                    </template>
                                    <template v-else>
                                        <i class="fa-solid fa-file"></i>
                                        <span>{{ attach.name }}</span>
                                    </template>
                                </div>
                            </div>

                            <!-- Suggests -->
                            <div class="item-suggests" v-if="record.suggests && record.suggests.length > 0">
                                <div class="suggest-item" v-for="suggest in record.suggests" :key="suggest.content"
                                    @click="handleSuggestClick(suggest)">
                                    <i v-if="suggest.icon" class="fa-solid" :class="suggest.icon"></i>
                                    <i v-else class="fa-solid fa-arrow-right"></i>
                                    {{ suggest.content }}
                                </div>
                            </div>

                            <!-- Btns -->
                            <div class="item-tools" v-if="!record.isBot">
                                <a-tooltip placement="bottom">
                                    <template #title>Regenerate</template>
                                    <button class="btn btn-tools" @click="regenerate(record)">
                                        <i class="fa-solid fa-arrows-rotate"></i>
                                    </button>
                                </a-tooltip>
                                <a-tooltip placement="bottom">
                                    <template #title>Copy</template>
                                    <button class="btn btn-tools" @click="copyToClipboard(record.messages[0].data)">
                                        <i class="fa-solid fa-copy"></i>
                                    </button>
                                </a-tooltip>
                            </div>
                            <div class="item-tools" v-if="record.isBot && record.status == 'done'">
                                <a-tooltip placement="bottom">
                                    <template #title>Copy</template>
                                    <button class="btn btn-tools" @click="copyToClipboard(record.messages[0].data)">
                                        <i class="fa-solid fa-copy"></i>
                                    </button>
                                </a-tooltip>
                                <a-tooltip placement="bottom">
                                    <template #title>Like</template>
                                    <button class="btn btn-tools">
                                        <i class="fa-solid fa-thumbs-up"></i>
                                    </button>
                                </a-tooltip>
                            </div>
                        </div>

                        <template v-if="record.status != 'done'">
                            <div class="dots">
                                <div></div>
                                <div></div>
                                <div></div>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
        </div>

        <!-- 输入区域 -->
        <div class="chat-view" v-if="props.configs.show.input">
            <div class="chat-input">
                <div class="files"></div>
                <div class="input">
                    <a-textarea :autoSize="{ minRows: 1, maxRows: 3 }" v-model:value="chatInfos.message"
                        @keydown.enter="sendMessage" placeholder="Message here..." />
                </div>
                <div class="btns">
                    <div class="btns-left">
                        <!-- Model -->
                        <a-dropdown v-if="configs.show.model" placement="topLeft">
                            <a-button class="btn btn-tool"><i class="fa-solid fa-atom"></i><a>{{ chatTools.model
                                    }}</a></a-button>
                            <template #overlay>
                                <a-menu class="custom-menu">
                                    <a-menu-item v-for="model in models" @click="chatTools.model = model.name">
                                        <a-button class="btn btn-tool"><i class="fa-solid fa-atom"></i>{{ model.name
                                        }}</a-button>
                                    </a-menu-item>
                                </a-menu>
                            </template>
                        </a-dropdown>
                        <!-- Reason/Thinking -->
                        <a-button v-if="configs.show.thinking" class="btn btn-tool"
                            :class="chatTools.activeThinking ? 'active' : ''"
                            @click="chatTools.activeThinking = !chatTools.activeThinking"><i
                                class="fa-solid fa-globe"></i><a>Reason</a></a-button>
                        <!-- Web Search -->
                        <a-button v-if="configs.show.search" class="btn btn-tool"
                            :class="chatTools.activeSearch ? 'active' : ''"
                            @click="chatTools.activeSearch = !chatTools.activeSearch"><i
                                class="fa-solid fa-globe"></i><a>Search</a></a-button>
                        <!-- Upload -->
                        <a-dropdown v-if="configs.show.upload" placement="topLeft">
                            <a-button class="btn btn-tool"><i class="fa-solid fa-upload"></i>Upload</a-button>
                            <template #overlay>
                                <a-menu class="custom-menu">
                                    <a-menu-item>
                                        <a-button class="btn btn-tool" @click="upload"><i
                                                class="fa-solid fa-image"></i>Upload
                                            images</a-button>
                                    </a-menu-item>
                                    <a-menu-item>
                                        <a-button class="btn btn-tool" @click="upload"><i
                                                class="fa-solid fa-file"></i>Upload
                                            files</a-button>
                                    </a-menu-item>
                                </a-menu>
                            </template>
                        </a-dropdown>
                        <!-- Tools -->
                        <a-dropdown v-if="configs.show.tools" placement="topLeft">
                            <a-button class="btn btn-tool"><i class="fa-solid fa-sliders"></i> Tools</a-button>
                            <template #overlay>
                            </template>
                        </a-dropdown>
                    </div>
                    <div class="btns-right">
                        <div class="btns-send">
                            <!-- Send -->
                            <a-tooltip v-if="chatInfos.connectionID == ''">
                                <template #title>Send Message</template>
                                <a-button shape="circle" class="btn btn-send" @click="sendMessage()"
                                    :disabled="chatInfos.message == ''">
                                    <i class="fa-solid fa-arrow-up"></i>
                                </a-button>
                            </a-tooltip>
                            <!-- Stop -->
                            <a-tooltip v-else>
                                <template #title>Stop Message</template>
                                <a-button shape="circle" class="btn btn-stop" @click="stopMessage()">
                                    <i class="fa-solid fa-stop"></i>
                                </a-button>
                            </a-tooltip>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="chat-tools">
            <a-button shape="circle" title="Scroll to top" class="btn btn-tools" @click="scrollTo('top', true)">
                <i class="fa-solid fa-arrow-up"></i>
            </a-button>
            <a-button shape="circle" title="Scroll to bottom" class="btn btn-tools" @click="scrollTo('bottom', true)">
                <i class="fa-solid fa-arrow-down"></i>
            </a-button>
            <a-button shape="circle" title="Clear Chat" class="btn btn-tools" @click="clearChat()">
                <i class="fa-solid fa-brush"></i>
            </a-button>
        </div>

        <div class="debugs">
            <span>{{ chatInfos.connectionID }}</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
@import url(./chats.scss);

.debugs {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
}
</style>
