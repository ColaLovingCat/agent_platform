# Chat 组件 (app-chats)

一个功能完善的 Vue3 聊天组件，支持流式输出、Markdown 渲染、多种消息类型、思考过程展示等特性。

## 目录结构

```
src/components/chats/
├── view.vue              # 主体组件
├── using.vue             # 测试用例/使用示例
├── chats.types.ts        # TypeScript 类型定义
├── chats.scss            # 组件样式
├── markdown/
│   ├── markdown.ts       # Markdown 渲染配置
│   └── markdown.scss     # Markdown 样式
└── ReadMe.md             # 说明文档
```

## 快速开始

### 基本使用

```vue
<script setup>
import { ref, onMounted } from 'vue'
import chatsView from '@/components/chats/view.vue'

const chatRef = ref(null)

const chatsConfigs = {
  robotName: '助手',
  speed: 2,           // 打字速度 (1慢/2中/3快)
  limit: 60,          // 超时时间(秒)
  show: {
    input: true,      // 显示输入框
    model: false,     // 显示模型选择
    thinking: true,   // 显示思考过程
    search: false,    // 显示搜索按钮
    upload: false,    // 显示上传按钮
    tools: false,     // 显示工具按钮
  },
  model: 'GPT-4o',
}

// 用户发送消息后的回调
const afterSend = (event) => {
  const { connectionID, message } = event
  // 处理消息...
}
</script>

<template>
  <chatsView 
    ref="chatRef" 
    :configs="chatsConfigs" 
    @sended="afterSend"
    @received="afterReceive"
    @cleared="afterClear"
    @clickItem="clickItem"
  />
</template>
```

## 类型定义

### ChatMessage

```typescript
interface ChatMessage {
  connectionID: string;       // 连接标识（用于追踪对话）
  isBot?: boolean;            // 是否为机器人消息
  name?: string;              // 发送者名称
  status?: "waiting" | "open" | "done";  // 消息状态
  
  // 思考过程 (Deep Thinking)
  thought?: string;           // 思考内容
  hasThinking?: boolean;      // 是否启用思考
  isThinking?: boolean;       // 是否正在思考
  showThinking?: boolean;     // 是否展开思考
  
  // 消息动作类型
  action?: "flows" | "tips" | "question" | "waiting" | "error";
  
  // 消息内容数组
  messages: {
    type: "error" | "text" | "list" | "table" | "image" | 
          "audio" | "video" | "echart" | "citation" | "confirm";
    data: any;
  }[];
  
  // 附件
  attachments?: {
    type: "image" | "pdf" | "file" | "video";
    url: string;
    name: string;
  }[];
  
  // 建议/快捷回复
  suggests?: {
    key?: string;
    icon?: string;
    content: string;
    infos?: any;
  }[];
}
```

### ChatConfigs

```typescript
interface ChatConfigs {
  robotName: string;    // 机器人名称
  limit: number;        // 超时时间(秒)
  speed: number;        // 打字速度 (1/2/3)
  show: {
    input: boolean;     // 输入框
    model: boolean;     // 模型选择
    thinking: boolean;  // 思考过程
    search: boolean;    // 搜索功能
    upload: boolean;    // 上传功能
    tools: boolean;     // 工具栏
  };
  model: string;        // 当前模型
}
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| configs | ChatConfigs | 见下方 | 组件配置 |

默认配置：
```javascript
{
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
```

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| sended | `{ connectionID, message }` | 用户发送消息后触发 |
| received | `{ connectionID, action }` | 消息接收完成后触发 |
| cleared | `{}` | 清空对话后触发 |
| clickItem | `{ action, values }` | 点击可交互元素时触发 |

### clickItem 详情

```javascript
// 点击文本
{ action: 'text', values: { category, content, text } }

// 点击表格单元格
{ action: 'table', values: { column, row } }

// 点击图表
{ action: 'chart', values: event }

// 点击建议
{ action: 'suggest', values: suggest }
```

## Expose 方法

通过 `ref` 调用组件方法：

### sendChat(record: ChatMessage)

向聊天组件发送消息，支持多种 action 类型：

#### 1. flows - 流式输出（推荐）

```javascript
chatRef.value.sendChat({
  action: 'flows',
  connectionID: 'unique-id',
  name: '助手',
  isBot: true,
  thought: '这是思考过程...', // 可选
  messages: [
    { type: 'text', data: '这是回复内容' },
    { type: 'table', data: { columns: [...], rows: [...] } },
  ],
  suggests: [
    { content: '继续问题1' },
    { content: '继续问题2' },
  ],
})
```

#### 2. question - 外部触发提问

```javascript
chatRef.value.sendChat({
  action: 'question',
  connectionID: 'unique-id',
  isBot: false,
  messages: [{ type: 'text', data: '用户的问题' }]
})
```

#### 3. waiting - 等待状态

```javascript
chatRef.value.sendChat({
  action: 'waiting',
  connectionID: 'unique-id',
  name: '助手',
  isBot: true,
  status: 'waiting',
  messages: []
})
```

#### 4. tips - 提示消息

```javascript
chatRef.value.sendChat({
  action: 'tips',
  connectionID: 'unique-id',
  name: '助手',
  isBot: true,
  messages: [{ type: 'text', data: '提示内容' }],
  attachments: [
    { type: 'image', url: '...', name: '图片名称' },
  ],
})
```

#### 5. error - 错误消息

```javascript
chatRef.value.sendChat({
  action: 'error',
  connectionID: '',
  isBot: true,
  messages: []
})
```

### receiveMessage(msg)

接收 WebSocket 实时消息：

```javascript
chatRef.value.receiveMessage({
  connectionID: 'unique-id',
  category: 'text',  // 消息类型
  message: '内容',
  remarks: JSON.stringify({ 
    paragraph_start: false,  // 是否新段落
    response_end: false,     // 是否结束
  })
})
```

### clearChat()

清空所有对话记录。

### refreshConnectionID(oldID, newID)

更新指定对话的 connectionID。

## 消息类型示例

### 文本 (text)

```javascript
{ type: 'text', data: '支持 **Markdown** 语法' }
```

### 列表 (list)

```javascript
{ type: 'list', data: ['项目1', '项目2', '项目3'] }
```

### 表格 (table)

```javascript
{
  type: 'table',
  data: {
    columns: [
      { key: 'name', title: '名称' },
      { key: 'age', title: '年龄' },
    ],
    rows: [
      { id: 1, name: 'Alice', age: 25 },
      { id: 2, name: 'Bob', age: 30 },
    ],
  }
}
```

### 图表 (echart)

```javascript
{
  type: 'echart',
  data: {
    options: {
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
      yAxis: { type: 'value' },
      series: [{ data: [150, 230, 224], type: 'line' }]
    }
  }
}
```

### 图片/音频/视频

```javascript
{ type: 'image', data: { url: 'https://...' } }
{ type: 'audio', data: { url: '...', contentType: 'audio/mp3' } }
{ type: 'video', data: { url: '...', contentType: 'video/mp4' } }
```

## 可点击文本

在文本中使用特殊语法创建可点击元素：

```
[显示文本]{:data-action="code"}
[显示文本]{:data-user="12345"}
```

点击后会触发 `clickItem` 事件：

```javascript
{ action: 'text', values: { category: 'action', content: 'code', text: '显示文本' } }
```

## 完整使用示例

参考 `using.vue` 文件，展示了：

- WebSocket 集成
- 初始化欢迎消息
- 处理用户发送的消息
- 模拟各种回复类型
- 事件处理

## 样式定制

- 组件样式在 `chats.scss` 中定义
- Markdown 渲染样式在 `markdown/markdown.scss` 中定义
- 可通过 CSS 变量自定义主题色

## 注意事项

1. `connectionID` 用于追踪同一轮对话，确保请求和响应匹配
2. 使用 `flows` action 时，消息会以打字机效果逐字显示
3. 思考过程 (thinking) 需要配置 `configs.show.thinking = true` 才会显示
4. 组件自带自动滚动功能，用户手动滚动时会暂停自动滚动
