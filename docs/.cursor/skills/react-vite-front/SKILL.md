---
name: react-vite-front
description: 使用 React + Vite + TypeScript 构建现代企业级 SaaS 前端项目
---

# React Vite Front Engineering Specification

你是一名资深 React 前端架构师和开发者。

你的任务是：

根据用户提供的 需求描述 或 标准的 `spec.md` 需求文档，
自动完成一个可维护、可扩展、现代化的 React 前端项目。

你必须严格遵循本规范。

---

# Core Principles

## 必须遵守

- 强类型优先
- 组件复用优先
- 可维护优先
- 禁止过度耦合
- 页面模块化
- 样式隔离
- 目录职责清晰
- 优先函数式组件
- 优先 hooks
- 禁止 class component

---

# Tech Stack

| 名称            | 功能       |
| --------------- | ---------- |
| React           | 底层框架   |
| Vite            | 打包工具   |
| TypeScript/SCSS | 现代化语言 |
| Ant Dedign      | 组件库     |
| React Router    | 路由       |
| Zustand         | 状态持久化 |
| lucide-react    | 图标库     |
| react-i18next   | 国际化     |
| eChart          | 图表支持   |

# Folder Structure

```txt
flow_react/
├── public/
│   ├── doc/                     # 项目所需静态文件
│   ├── systems/                 # 框架所需静态文件
│   │   ├── lan/                 # 语言图标
│   │   └── logos/               # 系统图标
│   └── favicon.svg              # 主图标
├── src/
│   ├── assets/
│   │   ├── fonts/               # 补充字体包/图标库
│   │   ├── locales/             # 语言对应翻译
│   │   │   └── *.json
│   │   └── styles/              # 标准样式
│   ├── commons/
│   │   ├── bootstrap/
│   │   ├── datas/
│   │   │   ├── enum.ts          # 枚举
│   │   │   └── menus.ts         # 菜单数据
│   │   ├── hooks/
│   │   ├── mocks/
│   │   ├── stores/              # 全局状态管理
│   │   ├── types/               # 通用数据类型
│   │   └── utils/               # 工具库
│   ├── components/              # 自定义组件
│   ├── router/
│   │   └── index.tsx
│   ├── services/                # 后台api管理
│   │   ├── login.services.ts
│   │   └── users.services.ts
│   ├── views/
│   │   ├── func/                # 业务页面
│   │   ├── home/                # 首页
│   │   ├── login/               # 登录模块
│   │   └── system/              # 配置模块
│   ├── App.tsx
│   └── main.tsx
├── README.md
└── index.html
```

# Deatil

## TypeScript Rules

必须：
- interface 优先
- 类型文件独立 *.types.ts

## Zustand Rules

store 必须：
- 按模块拆分
- 禁止单一巨大 store
- 禁止业务逻辑直接写在组件
- 必须使用 selector

## API Rules

所有 API：
- 必须放在 services
- 禁止页面直接请求
- 必须统一 fetch 封装

示例：
```TypeScript
import { fetchRequest } from '@/commons/utils/fetch';

export const health = (data?: any) => {
  return fetchRequest("/api/health", {
    method: "GET",
    data,
  });
};
```

## 子目录规则

views/func 下的每个页面
- 单独需求，单目录实现
- 对应 services/ 下的单 *.services.ts 文件调用api接口

## Function Modules

当生成页面，编写业务功能模块时，以简单的 product 为例

- 自动分析
哪些应该拆 组件
哪些应该抽 hooks
哪些应该抽 types
哪些应该抽 store
哪些应该抽 service

- 新建目录和文件
src/views/func/product/index.tsx 编写crud管理页面
src/services/product.services.ts 编写后api的调用方法

- 导入路由
在 src/router/imports.tsx 中使用懒加载
在 src/router/index.tsx 中写入路由
需要token验证的模块则放在 <Content />下
-

## 拆组件规范

遇到可以复用的功能时，按照复用程度可分为三个层级
- 模块层级
在该业务功能模块内部可复用，则将该组件放在该模块目录下独立文件
- 业务模块
在该业务不同模块间可复用，则将该组件放在 src/views/func/commons/ 的独立目录中
- 公共模块
若该功能可以复用在不同项目中，属于公共功能或需求，则放在 src/components/ 的独立目录中

遵循
-单一职责
-可复用
-props 强类型
-必须有默认边界处理
-文件名 PascalCase

# 单一规范

## Table Rules

表格页面必须支持：
- total items
- search form
- filter columns
- add/edit/delete
- pagination
- empty
- loading
- responsive

优先使用：
- Ant Design Table
- 可以参考 [`templates/curd.tsx`] 中对于table的整体功能使用