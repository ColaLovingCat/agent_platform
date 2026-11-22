# React 门户模板

这是门户前端模板。登录、首页、用户、布局、流程画布、聊天、图表和上传演示都在这里。新门户从本目录复制。

子应用从 `template/sub_template` 复制。页面构建后放进本模板的 `public/apps/{appid}/`，目录名与子应用 id 一致，且包含 `index.html`。门户用 `/apps/:appId` 打开，子应用占满页面，不显示门户菜单。子应用自己的接口不进门户转发。

Apps Hub 在 `/hub-apps`，用来登记应用。顶栏信息菜单可以打开白板。文件预览组件在 `src/components/file-preview/`。

## 组件约定

```text
comp_name/
├── com/
│   ├── comp_name.scss
│   └── comp_name.types.ts
├── index.tsx
└── using.tsx
```
