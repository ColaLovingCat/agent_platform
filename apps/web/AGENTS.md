# Agent Platform

## Main Tech

- Vite + Recat 
- React Ant Design
- Typescript + Scss + Tailwindcss
- react-router
- react-i18next
- zustand
- xlsx
- @tailwindcss
- @file-viewer
- @excalidraw
- @xyflow
- echarts

## Directory Layout

```
web/
├── public/
│   ├── apps/                        # 子应用的打包产物
│   ├── docs/                        # 项目所需静态文件
│   ├── systems/                     # 框架所需静态文件
│   │   ├── lan/                     # 语言图标
│   │   └── logos/                   # 系统图标
│   └── favicon.svg                  # 主图标
├── src/
│   ├── assets/                      # 资源文件
│   │   ├── fonts/                   # 字体
│   │   ├── locales/                 # 本地化翻译
│   │   └── styles/                  # 常用样式
│   ├── commons/                     # 公共功能   
│   │   ├── bootstrap/
│   │   ├── datas/
│   │   ├── hooks/
│   │   ├── mocks/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   ├── components/                  # 公共组件
│   │   ├── chats/
│   │   ├── echarts/
│   │   ├── file-preview/
│   │   ├── file-tree/
│   │   ├── layouts/                 # Content：无 token 走未登录
│   │   ├── micro-app/
│   │   ├── uploads/
│   │   ├── whiteboard/              # 模板通用画布。infos 菜单打开全屏 Modal
│   │   └── workflow/
│   ├── router/   
│   │   ├── imports.tsx
│   │   └── index.tsx  
│   ├── services/                    # 调用后端接口的统一入口，平铺
│   │   ├── login.services.ts        # login/
│   │   ├── users.services.ts        # configs/users/
│   │   ├── providers.services.ts    # configs/providers/
│   │   ├── system.services.ts       # configs/system/
│   │   ├── chat.services.ts         # Task 与 Event。对话界面由 dsh web 承担
│   │   ├── schedulers.services.ts
│   │   ├── agents.services.ts       # Hub、我的 Agent、Skill、Tool
│   │   ├── workflows.services.ts
│   │   ├── requests.services.ts     # 预留，审批再写接口
│   │   ├── artifacts.services.ts
│   │   ├── portals.services.ts      # 子应用登记与发布
│   │   ├── knowledges.services.ts
│   │   ├── docs.services.ts         # resources/docs/
│   │   ├── connections.services.ts
│   │   └── models.services.ts       # resources/models/
│   ├── views/                       # 与根目录约定一致，对应后端服务
│   │   ├── login/                   # /login、/sso-auth
│   │   ├── home/                    # /home
│   │   ├── func/                    # 业务页
│   │   │   ├── coms/                # 通用的业务数据类型
│   │   │   ├── chat/                # 嵌入 DeepSeek Harness web profile
│   │   │   ├── schedulers/          # 定时/日历
│   │   │   ├── agents/              # agents / skills / tools
│   │   │   ├── workflows/           # DAG Graph Editor
│   │   │   ├── requests/            # 预留 /requests，后期审批
│   │   │   ├── artifacts/           # 轻应用/制品
│   │   │   ├── portals/             # /hub-apps。挂载页在 public/apps/{appid}/
│   │   │   ├── knowledges/          # 知识 + RAG
│   │   │   └── resources/           # 工作区资源
│   │   │       ├── docs/            # 文件池
│   │   │       ├── connections/     # 数据池
│   │   │       └── models/          # 自定义模型接入配置
│   │   └── configs/                 # 平台设置
│   │       ├── users/               # 用户及权限管理
│   │       ├── providers/           # 平台级模型提供商
│   │       └── system/              # 系统设置、404
│   ├── App.tsx  
│   └── main.tsx  
├── env.***
├── AGENTS.md
└── index.html
```

## Function Module

### Template Function

- Login `/login`：本地登录
- SSO `/sso-auth`：单点登录回调
- Home `/home`：登录后的落地页
- Users `/configs-user`：用户
- 404：未匹配路由
- 壳子：`components/layouts/` 的 Content 读取本地 token，没有 token 走未登录处理。公共能力在 `commons/`（bootstrap、stores、utils）、`router/`、`assets/locales/`
- Whiteboard：`components/whiteboard/`。从 infos 菜单打开全屏 Modal，不换路由。`@excalidraw/excalidraw` 懒加载。画布变更防抖后写入浏览器本地，按用户分 key

### Agents Function

- Workspace
  - My Agents `/my-agents`
    - [ ] 我的 Group / Agent 列表：创建或被授权。列表含 id、name、description、skills
    - [ ] 卡片：头像用 `getInitial`。按钮是 chat 和分配任务
    - [ ] Team 显示 members 与 memberMode：`list` 自由分配，`flow` 用 memberLinks 首尾相连，`org` 用 memberOrgs 按角色就位
    - [ ] Conversational UI: 点击 chat 后进入 `/chat-agents`，单聊或一组队友
  - Schedule `/my-tasks`
    - [ ] Calendar 视图显示定时任务排布及当前状态
    - [ ] 分配任务：schedule 填名称和周期；event 的触发是 webhook、邮件或文件变化
    - [ ] Execution Results: 点击任务后显示运行记录，再点开展示 report
    - [ ] 点击任务 chat 后就任务结果进行回溯讨论
  - Chat `/chat-agents`
- Agent Studio
  - Agent Hub `/hub-agents`
    - [ ] Agent Market：name、description、skills、creator、hired
    - [ ] 卡片按钮是雇佣。已雇佣在卡片上显示状态
    - [ ] Agent Builder 通过 Chat 式找寻/创建
  - Skill Center `/hub-skill`
    - [ ] Skill Directory 基本内容展示
    - [ ] Skills Builder 通过 Chat 式找寻/创建
- Tools Library
  - Data Connection `/connections`
  - Data pre-solving
  - Model/Algorithm
  - Function
    - [ ] Tools 同页面不同标签的过滤展示
    - [ ] Tools Chat 式找寻/创建
- Knowledge Base `/knowledge`
  - Domain Knowledge
    - [ ] Document Management 知识所需文档的上传管理
- Model Providers `/llm`
  - LLM
    - [ ] 订阅分配 key
    - [ ] 直接 Chat
  - VLM
- Workflow `/flows`、`/flow/:id`：已发布 DAG 的列表和编辑
- Requests `/requests`：预留。后期做审批，目录为 `views/func/requests/`
- Portals `/hub-apps`、`/apps/:appId/*`：子应用登记与挂载。目录为 `views/func/portals/`。源码在 `apps/subapps/{appid}/`，静态页在 `public/apps/{appid}/`