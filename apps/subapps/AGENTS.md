# 子应用标准

每个子应用为：React + Vite 前端，Express 后端。
需要在服务端自己留数据时用 `node:sqlite`。
Node 22 及以上，启动参数带 `--experimental-sqlite`。

页面挂在门户的 `/apps/{appid}/`。
接口由这个进程自己提供，不经过主应用转发。
只使用 GET 和 POST。

## 模板选型

新项目从 `apps/subapps/template` 复制。先写页面，再用 `+` 加上需要的能力。没写的能力不做。

```text
{appid}：{一句话}
- web
+ service
+ sqlite
+ mssql
```

- `web`：页面，挂在 `/apps/{appid}/`。每个项目都有。
- `service`：这个进程自己的接口、上传和日志。只使用 GET 和 POST。
- `sqlite`：数据留在 `dbs/datas.sqlite`。
- `mssql` / `oracle`：连接外部库。连接放 `dbs/db_connect.json`，口令不进仓库。

## 项目标准结构

`apps/subapps/` 里每个目录是一个子应用。门户在 `{project_root}/apps/web`。页面挂在 `/apps/{appid}/`，由 gateway 提供。接口由该子应用自己的进程提供，不进平台 `/api`。

新子应用按下面摆。目录名就是 `{appid}`，小写，和登记时的 id 一致。

```text
apps/{appid}/
├── demos/                   # 样例和一次性脚本。build 不打包，进程不读
│   └── table.sql            # 建表脚本。在库里执行一次
├── dbs/                     # 运行时数据。不打进 dist
│   ├── datas.sqlite         # 生产放在 server.cjs 同级的 dbs\，发版不覆盖
│   └── db_connect.json      # 外部库连接。口令只放这里或服务器 bat
├── logs/                    # 按本地日期一个文件。不打进 dist，发版不覆盖
│   └── YYYY-MM-DD.log
├── uploads/                 # 上传文件。不打进 dist，发版不覆盖
├── public/                  # 静态资源，存放图片文档等。需要时才建
├── src/                     # 页面。可以引用 shared，不引用 service
│   ├── components/
│   ├── api.ts               # 读 VITE_{APP}_API_ORIGIN
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── service/                 # 进程。可以引用 shared，不引用 src
│   ├── utils/               # 通用方法，可复制到其他子应用，后面继续往这里加
│   │   ├── sqlite.ts
│   │   ├── mssql.ts
│   │   ├── logger.ts        # 按日期追加 logs\
│   │   └── access-log.ts    # 挂到进程上，自动记页面打开和 /api
│   ├── server.ts            # 入口。开发时挂 Vite，生产只提供接口
│   └── swagger.ts           # OpenAPI，挂在 /swagger
├── shared/                  # 两边都引用的类型和常量才建
│   ├── datas.ts             # 公用数据
│   └── datas.type.ts        # 不引用 src、service，也不引用数据库驱动
├── scripts/                 # 打包脚本
│   └── build-service.mjs    # esbuild → dist/service/server.cjs，并拷 swagger-ui
├── .env.development         # pnpm dev 读取。变量 VITE_{APP}_API_ORIGIN
├── .env.test                # pnpm build:test 读取
├── .env.production          # pnpm build:prod 读取
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts           # base=/apps/{appid}/
                             # outDir=dist/web
```

业务 SQL 写在 `service/server.ts`。`service/utils/` 放打开连接、执行语句、写日志这种每个子应用都能原样复制的方法。

主动记一条日志用 `POST /api/logs`，请求体至少带 `kind`。页面打开时发 `{ kind: "page", path, title }`。除此以外，每个其它 `/api` 请求由进程自动追加方法、路径、query、body、状态码和是否成功。`GET /api/logs/{date}` 返回这一天的文件原文，日期格式 `YYYY-MM-DD`。`/api/logs` 自己的读写不写进日志。口令字段写成 `***`。`uploads/` 留给上传文件，没有上传功能时目录可以是空的。

`node_modules`、`dist`、`dbs/*.sqlite`、`dbs/db_connect.json`、`uploads/` 里的文件、`logs/*.log` 不进仓库。

## 本地调试

在应用目录执行 `pnpm dev`。同一进程里挂 Vite 中间件，前后端一起调。

```text
node --experimental-sqlite --import tsx service/server.ts
```

`package.json` 里 `dev` 和 `start` 都用上面这条。开发时不要设 `NODE_ENV=production`，否则不会挂 Vite。Vite 不要监视 `logs`、`uploads`、`dbs`，否则写入日志会刷新页面并再次写日志。

## 打包后端

```cmd
pnpm build:service
```
用 esbuild 把 `service/server.ts` 打成 `dist/service/server.cjs`。

- `platform: node`，`format: cjs`，`external: ['vite']`。`mssql` 打进 `server.cjs`，服务器目录不用再装 `node_modules`
- banner 写死 `process.env.NODE_ENV = 'production'`，生产进程不再加载 Vite
- 把 `swagger-ui-dist` 里用到的 css、bundle、map、favicon 拷到 `dist/service/swagger-ui`
- `demos/table.sql` 不拷贝。建表在库里执行一次，进程启动不读它
- `dbs/`、`uploads/`、`logs/` 不打进包

本地试跑打包结果：

```cmd
pnpm start:service
```

即 `node --experimental-sqlite dist/service/server.cjs`。

生产模式下根目录是 `server.cjs` 所在目录，不是启动时的当前目录。SQLite、swagger-ui、证书相对路径都从这里解析。

## 服务器部署

目录：

```text
{project_root}\apps\services\{appid}\
  server.cjs
  swagger-ui\
  dbs\                 运行时数据。SQLite 在这里生成
  dbs\db_connect.json  有外部库时才需要。重新发版不要删、不要覆盖
  uploads\             上传文件。重新发版不要删、不要覆盖
  logs\                按日期的日志。重新发版不要删、不要覆盖
{project_root}\apps\services\*.pfx
```

NSSM 把下面的 bat 设为服务程序。bat 里直接跑 `node.exe`，不要加 `start`，否则服务会马上退出。

```bat
@echo off
cd /d {project_root}\apps\services\{appid}
set PORT={port}
set SSL_PFX=..\szhmeais002.apac.bosch.com.pfx
set SSL_PASSPHRASE={passphrase}
"C:\Program Files\nodejs\node.exe" --experimental-sqlite server.cjs
```

口令只放在服务器上的 bat 里，不写进仓库和这份说明。

`service/server.ts` 必须读这些变量，否则设了也不会变成 HTTPS：

- `PORT`：监听端口，绑定 `0.0.0.0`
- `SSL_PFX` + `SSL_PASSPHRASE`：pfx 证书。相对路径相对 `server.cjs` 所在目录
- 或者 `SSL_CERT` + `SSL_KEY`：pem 证书和私钥
- 都没设时才退回 HTTP。服务器上的服务必须走 HTTPS

外部数据库连接先读环境变量 `MSSQL_CONNECTION`，没有则读 `dbs\db_connect.json` 数组里 `name` 为 Default 的那条。这个文件和 SQLite 放在一起，不打进 `dist`。Swagger 在 `/swagger`。

发版把 `dist/service` 里的 `server.cjs` 和 `swagger-ui` 换到服务目录，保留 `dbs\`、`uploads\`、`logs\`。

## 打包前端

`pnpm build`、`pnpm build:test`、`pnpm build:prod` 把页面输出到该子应用自己的 `dist/web`。构建不会自动复制。

Vite 配置：

- `base` 为 `/apps/{appid}/`
- `build.outDir` 为 `dist/web`

要在门户打开时，把 `dist/web` 里的文件复制到 `{project_root}/apps/web/public/apps/{appid}/`。gateway 的 `/apps/` 读的就是这个 `public` 目录。

前端请求的 API 地址在构建时写死，变量为 `VITE_{APP}_API_ORIGIN`。测试环境写在 `.env.test`，用 `pnpm build:test`。正式环境写在 `.env.production`，用 `pnpm build:prod`。这个值必须是该子应用服务的 `https://主机:{port}`。地址变了要重新打包。

## 出现在 Apps Hub

新子应用不改 `apps/web` 的页面代码。

1. 在门户登记这个应用。`id` 用小写，和 `apps/subapps/{appid}` 的目录名一致。
2. 在子应用目录执行对应的 `pnpm build`、`build:test` 或 `build:prod`。产物在该子应用的 `dist/web`。
3. 把 `dist/web` 复制到 `{project_root}/apps/web/public/apps/{appid}/`，从门户打开 `/apps/{appid}`。
