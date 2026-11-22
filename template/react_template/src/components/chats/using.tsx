import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { readLlmSse } from '@/commons/utils/streams';
import { WebSocketService } from '@/commons/utils/websocket';

import AppChats, { type ChatMessage, type ChatRef } from '@/components/chats';
import type { ChatModelOption, ChatSendInfos } from '@/components/chats/com/chats.types';

import { MODEL_SERVER_URL } from '@/components/workflow/lib/serverConfig';

const DEMO_TRIGGER = '测试全功能';
const LLM_CHAT_URL = `${MODEL_SERVER_URL}/v1/llm/locals/chat/completions`;
const ROBOT_NAME = 'Agent Bot';

const DEMO_PLANS: ChatMessage['plans'] = [
    { id: 'plan-1', content: '分析问题并规划回复结构', status: 'open' },
    { id: 'plan-2', content: '流式展示 Markdown 文本与代码块', status: 'open' },
    { id: 'plan-3', content: '渲染列表、表格与多媒体', status: 'open' },
    { id: 'plan-4', content: '加载图表与附件预览', status: 'open' },
    { id: 'plan-5', content: '汇总结果并推送快捷建议', status: 'open' },
];

/** 全功能演示：按预估 flows 节奏推进 plan 状态 */
function runPlanStatusDemo(
    chatRef: RefObject<ChatRef | null>,
    connectionID: string,
) {
    const steps: { id: string; status: 'running' | 'done' | 'error'; delay: number }[] = [
        { id: 'plan-1', status: 'running', delay: 600 },
        { id: 'plan-1', status: 'done', delay: 3200 },
        { id: 'plan-2', status: 'running', delay: 3400 },
        { id: 'plan-2', status: 'done', delay: 9000 },
        { id: 'plan-3', status: 'running', delay: 9200 },
        { id: 'plan-3', status: 'done', delay: 16000 },
        { id: 'plan-4', status: 'running', delay: 16200 },
        { id: 'plan-4', status: 'done', delay: 21000 },
        { id: 'plan-5', status: 'running', delay: 21200 },
        { id: 'plan-5', status: 'done', delay: 23000 },
    ];
    steps.forEach(({ id, status, delay }) => {
        window.setTimeout(() => {
            chatRef.current?.updatePlanStatus(connectionID, id, status);
        }, delay);
    });
}

const fullFeatureDemo = (connectionID: string, robotName: string): ChatMessage => ({
    action: 'flows',
    connectionID,
    isBot: true,
    name: robotName,
    status: 'open',
    hasThinking: true,
    plans: DEMO_PLANS.map((plan) => ({ ...plan })),
    thought: [
        '1. 分析问题：用户希望看到 Chat 组件的全部渲染能力。',
        '2. 规划回复：依次展示文本、列表、表格、媒体、图表、错误等消息类型。',
        '3. 附加能力：附件预览、快捷建议、可点击文本与表格单元格。',
    ].join('\n'),
    messages: [
        {
            type: 'text',
            data: [
                '## Chat 全功能演示',
                '',
                '你好！这是一条 **流式 Markdown 文本**，支持公式 $E=mc^2$。',
                '',
                '```javascript',
                "const demo = '代码块支持语法高亮，点击 Copy 可复制';",
                '```',
                '',
                '可点击文本：[量子纠缠]{:data-topic="quantum"}',
            ].join('\n'),
        },
        {
            type: 'list',
            data: [
                '文本流式输出（Markdown + 公式 + 代码高亮）',
                '深度思考过程（可展开/收起）',
                '有序列表逐项推送',
                '可点击表格单元格',
                '图片 / 音频 / 视频内嵌播放',
                'ECharts 图表交互',
                '附件网格预览（图片、PDF、文件、视频）',
                '底部快捷建议按钮',
            ],
        },
        {
            type: 'table',
            data: {
                key: 'test-table',
                columns: [
                    { key: 'feature', title: '功能模块' },
                    { key: 'type', title: '消息类型' },
                    { key: 'status', title: '状态' },
                ],
                rows: [
                    { feature: '流式文本', type: 'text', status: '✓ 已启用' },
                    { feature: '深度思考', type: 'thought', status: '✓ 已启用' },
                    { feature: '数据表格', type: 'table', status: '✓ 点击单元格' },
                    { feature: '图表可视化', type: 'echart', status: '✓ 点击图表' },
                    { feature: '附件展示', type: 'attachments', status: '✓ 见下方' },
                ],
            },
        },
        {
            type: 'image',
            data: {
                url: 'https://picsum.photos/seed/chat-inline-image/480/270',
            },
        },
        {
            type: 'audio',
            data: {
                url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                contentType: 'audio/mpeg',
            },
        },
        {
            type: 'video',
            data: {
                url: 'https://www.w3schools.com/html/mov_bbb.mp4',
                contentType: 'video/mp4',
            },
        },
        {
            type: 'echart',
            data: {
                key: 'test-chart',
                options: {
                    title: { text: '周访问量（点击柱子交互）', left: 'center' },
                    tooltip: { trigger: 'axis' },
                    xAxis: {
                        type: 'category',
                        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    },
                    yAxis: { type: 'value' },
                    series: [
                        {
                            name: '访问量',
                            type: 'bar',
                            data: [120, 200, 150, 80, 70, 110, 130],
                            itemStyle: { color: '#419e98' },
                        },
                    ],
                },
            },
        },
        {
            type: 'error',
            data: '这是一条 error 类型消息，用于展示错误样式（演示用途，非真实故障）。',
        },
        {
            type: 'text',
            data: '以上即为全部消息类型。你还可以：**重新生成** 用户消息、**复制** 内容、点击 **建议按钮** 继续对话。',
        },
    ],
    attachments: [
        {
            type: 'image',
            url: 'https://picsum.photos/seed/chat-attachment/200/200',
            name: 'landscape.jpg',
        },
        {
            type: 'pdf',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            name: 'report.pdf',
        },
        {
            type: 'file',
            url: 'https://example.com/data/export.csv',
            name: 'export.csv',
        },
        {
            type: 'video',
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            name: 'demo-clip.mp4',
        },
    ],
    sources: [
        { href: 'https://stripe.com/docs/api', title: 'Stripe API Documentation' },
        { href: 'https://docs.github.com/en/rest', title: 'GitHub REST API' },
        {
            href: 'https://docs.aws.amazon.com/sdk-for-javascript/',
            title: 'AWS SDK for JavaScript',
        },
    ],
    suggests: [
        { content: '什么是贝尔不等式？', icon: 'fa-calculator', key: 'bell' },
        { content: '量子计算机是如何利用纠缠的？', icon: 'fa-microchip', key: 'qc' },
        { content: DEMO_TRIGGER, icon: 'fa-wand-magic-sparkles', key: 'test' },
    ],
});

const ChatUse = () => {
    const chatRef = useRef<ChatRef>(null);
    const [chatsConfigs, setChatsConfigs] = useState({
        robotName: ROBOT_NAME,
        speed: 3,
        limit: 60,
        show_bot: false,
        show: {
            input: true,
            model: true,
            thinking: false,
            search: false,
            upload: true,
            tools: false,
        },
        model: 'Qwen3-1.7B',
        models: [
            { name: 'Qwen3-1.7B', provider: 'local' },
        ] as ChatModelOption[],
    });

    const loadModels = useCallback(async () => {
        setChatsConfigs((prev) => ({
            ...prev,
            models: [
                { name: 'Qwen3-1.7B', provider: 'local' },
                { name: 'gpt-4o', provider: 'local' },
                { name: 'gpt-4o-mini', provider: 'local' },
            ]
        }));
    }, []);

    const initialChat = useCallback(() => {
        chatRef.current?.sendChat({
            action: 'tips',
            connectionID: 'welcome',
            name: ROBOT_NAME,
            isBot: true,
            status: 'done',
            messages: [
                {
                    type: 'text',
                    data: `你好，我是 ${ROBOT_NAME}。输入 **「${DEMO_TRIGGER}」** 可一次性体验全部聊天能力。`,
                },
            ],
            suggests: [
                { content: DEMO_TRIGGER, icon: 'fa-wand-magic-sparkles', key: 'test' },
            ],
        });
    }, []);
    useEffect(() => {
        initialChat();
    }, [initialChat]);

    const wssRef = useRef<WebSocketService | null>(null);
    const wsConnectionIDRef = useRef('');
    const wsActiveRef = useRef(false);
    const receiveMessage = useCallback((msg: any) => {
        if (wsConnectionIDRef.current != '' && wsConnectionIDRef.current == msg.connectionID)
            chatRef.current?.receiveMessage(msg)
    }, []);

    useEffect(() => {
        void loadModels();

        wssRef.current = new WebSocketService(import.meta.env.VITE_WEBSOCKET_URL, receiveMessage,
            () => {
                wsActiveRef.current = true;
            },
            () => {
                wsActiveRef.current = false;
            }
        )
        wssRef.current.connect();

        return () => {
            wssRef.current?.close();
            wssRef.current = null;
        }
    }, [loadModels, receiveMessage]);

    const handleMessage = useCallback((connectionID: string, userMessage: string) => {
        if (userMessage === DEMO_TRIGGER) {
            chatRef.current?.sendChat(
                fullFeatureDemo(connectionID, ROBOT_NAME),
            );
            runPlanStatusDemo(chatRef, connectionID);
            return;
        }

        chatRef.current?.sendChat({
            action: 'flows',
            connectionID,
            name: ROBOT_NAME,
            isBot: true,
            messages: [
                {
                    type: 'text',
                    data: `你刚才说的是「${userMessage}」。输入 **「${DEMO_TRIGGER}」** 查看完整功能演示。`,
                },
            ],
            suggests: [
                { content: DEMO_TRIGGER, icon: 'fa-wand-magic-sparkles', key: 'test' },
            ],
        });
    }, []);
    const handleStream = useCallback(
        async (connectionID: string, userMessage: string, model: string) => {
            const chat = chatRef.current;
            if (!chat) return;

            const modelName = model || chatsConfigs.model;
            const ac = new AbortController();
            chat.setStreamAbortHandler(() => ac.abort());

            // 等 waiting 气泡入队后再开始拉流
            await new Promise((r) => setTimeout(r, 450));
            chat.beginStream(connectionID);

            let errored = false;
            const finish = (err?: string) => {
                if (errored) return;
                errored = true;
                chat.setStreamAbortHandler(null);
                chat.endStream(connectionID, err);
            };

            try {
                const resp = await fetch(LLM_CHAT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ac.signal,
                    body: JSON.stringify({
                        model: modelName,
                        messages: [
                            {
                                role: 'system',
                                content: '你是一个大语言模型，允许有10s的思考过程，并快速返回结果就行',
                            },
                            { role: 'user', content: userMessage },
                        ],
                        stream: true,
                        temperature: 0.7,
                        top_p: 1,
                        max_tokens: 1024,
                        connectionID,
                    }),
                });

                if (!resp.ok) {
                    let detail = `HTTP ${resp.status}`;
                    try {
                        const j = await resp.json();
                        if (j?.detail) {
                            detail =
                                typeof j.detail === 'string'
                                    ? j.detail
                                    : JSON.stringify(j.detail);
                        }
                    } catch {
                        /* ignore */
                    }
                    finish(detail);
                    return;
                }

                await readLlmSse(
                    resp,
                    (delta) => chat.appendStreamDelta(connectionID, delta),
                    (err) => {
                        const detail =
                            typeof err.detail === 'string'
                                ? err.detail
                                : JSON.stringify(err.detail ?? err);
                        finish(`[${err.status ?? 'error'}] ${detail}`);
                    },
                );
                finish();
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    finish();
                    return;
                }
                finish(err instanceof Error ? err.message : String(err));
            }
        },
        [chatsConfigs.model],
    );

    const handleMethod: string = 'test';
    const afterSend = useCallback(
        ({ connectionID, message: msg, tools }: ChatSendInfos) => {
            chatRef.current?.sendChat({
                action: 'waiting',
                connectionID,
                name: ROBOT_NAME,
                isBot: true,
                status: 'waiting',
                messages: [],
            });
            setTimeout(() => {
                switch (handleMethod) {
                    case 'stream': {
                        void handleStream(connectionID, msg, tools.model || '');
                        break;
                    }
                    case 'websocket': {
                        if (wsActiveRef.current) {
                            wsConnectionIDRef.current = connectionID
                        } else {
                            chatRef.current?.sendChat({
                                action: 'flows',
                                connectionID,
                                name: ROBOT_NAME,
                                isBot: true,
                                messages: [{ type: 'error', data: 'Websocket disconnect' }],
                            });
                        }
                        break;
                    }
                    default: {
                        handleMessage(connectionID, msg);
                        break;
                    }
                }
            }, 400);
        },
        [handleMessage, handleStream, wsConnectionIDRef],
    );

    const afterClick = useCallback(
        ({ action, values }: { action: string; values: any }) => {
            let data = `${action} 类型的交互事件`;
            switch (action) {
                case 'suggest':
                case 'text': {
                    data = values.content
                    break
                }
                case 'table':
                case 'chart':
                default: {
                    break
                }
            }
            chatRef.current?.sendChat({
                action: 'question',
                connectionID: '',
                isBot: false,
                name: ROBOT_NAME,
                messages: [{
                    type: "text",
                    data
                }],
            });
        },
        [handleMessage],
    );

    return (
        <div className="sections flex justify-center">
            <div className="box-chats h-full bg-white py-4 w-[1000px]">
                <AppChats
                    ref={chatRef}
                    configs={chatsConfigs}
                    cleared={initialChat}
                    sended={afterSend}
                    clickItem={afterClick}
                />
            </div>
        </div>
    );
};

export default ChatUse;
