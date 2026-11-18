# RAG

可单独启动的知识库服务。本进程负责入库和检索。平台接入后，原文件仍在 `api/files`，模型密钥仍在 `api/models`，`dsh` 只调用检索接口。

## 功能点

- 知识库：创建、列出、删除。记录所属 Workspace。单独运行时使用一个本地默认 Workspace。
- 文档：上传文件，或登记已有的 `file_id`。状态为 `pending`、`parsing`、`indexing`、`ready`、`failed`。
- 入库：`source` 取文件，`parse` 提取文本，`chunk` 切片，`embed` 向量化，`index` 写入 pgvector。大文档由 worker 异步处理，接口立即返回文档 id。
- 检索：按知识库 id 和查询返回 top-k 片段。结果带文档 id、页码和原文位置。调用方传入租户和知识库范围，本服务只按这个范围过滤。
- 更新与删除：文档重新入库或删除时，同步删除旧切片和向量。
- 健康检查：数据库和队列可达即返回成功。

单独运行时提供这些接口：

- `GET /health`
- `POST /knowledge-bases`、`GET /knowledge-bases`
- `POST /knowledge-bases/{id}/documents`、`GET /documents/{id}`
- `POST /retrieve`，请求体包含 `knowledge_base_ids`、`query`、`top_k`

本服务不建用户表，不生成回答，不调用 `engine`、`dsh`、`vibe`、`sandbox`。

## 技术选型

| 用途 | 选型 | 说明 |
| --- | --- | --- |
| 服务 | Python、FastAPI、Uvicorn、Pydantic v2 | 监听 `127.0.0.1:8001`。平台网关把 `/api/knowledge/` 转到这里 |
| 元数据与向量 | PostgreSQL、pgvector、SQLAlchemy 2.0、Alembic | 镜像用 `pgvector/pgvector`。向量列在 `rag.chunks`。本服务使用 schema `rag` 和自己的数据库账号 |
| 原文件 | MinIO | 只存对象键。单独运行时可用本地目录代替 |
| 入库队列 | Redis、ARQ | worker 与 API 同一份代码 |
| 解析 | Docling | PDF、Word、复杂版面。PDF、Word、Excel 分别用 PyMuPDF、python-docx、openpyxl 兜底 |
| 嵌入 | FastEmbed，`BAAI/bge-small-zh-v1.5` | 维度 512，本地 CPU 可跑。维度写进配置和向量列，换模型必须整库重新入库 |
| 检索 | pgvector 相似度 + 元数据过滤 | 重排留在 `retrieve` 内，第一版默认关闭 |
| 质量 | Pytest、Ruff、Mypy | 入库和检索可在无平台的情况下跑通 |

不部署 Qdrant。不把 LangChain 或 LangGraph 当作本服务的骨架。接入平台后，嵌入可以改走 `api/models`，本地 FastEmbed 仍是默认可运行的实现。

## 项目目录

```
rag/
├── main.py                         # FastAPI 入口
├── pyproject.toml
├── alembic.ini
├── .env.example                    # 数据库、Redis、对象存储、嵌入模型和维度
├── compose.yaml                    # 单独启动 postgres、redis、minio、rag
├── modules/
│   ├── knowledge_bases/            # 知识库和 Workspace 归属
│   ├── documents/                  # 文档状态、file_id、重新入库
│   ├── ingest/                     # 入库流水线。对外不拆成多个服务
│   │   ├── source/                 # 从 MinIO、本地目录或 file_id 取文件
│   │   ├── parse/                  # Docling 与格式兜底
│   │   ├── chunk/                  # 切片
│   │   ├── embed/                  # 本地 FastEmbed。维度与配置一致
│   │   └── index/                  # 写入 rag.chunks
│   └── retrieve/                   # 唯一检索接口。过滤、重排、引用都在这里
├── workers/                        # ARQ 入库任务
├── migrations/                     # 只迁移 schema rag
└── tests/
```

模块之间不互相引用仓储。`ingest` 按 source、parse、chunk、embed、index 的顺序调用。`retrieve` 只读 `rag.chunks`。

单独运行：

```bash
docker compose up
```

`compose.yaml` 启动 `pgvector/pgvector`、Redis、MinIO 和本服务。平台总编排以后把这个进程纳入 `infrastructure/docker-compose.yml`，不另建一套向量库。
