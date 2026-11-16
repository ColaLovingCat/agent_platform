# Agent Platform

## Main Tech

- Python
- FastAPI + Uvicorn
- Pydantic v2
- SQLAlchemy 2.0 + Alembic
- HTTPX
- Pytest + Ruff + Mypy
- DeepSeek Harness：执行循环由 RuntimePort 拉起 `dsh --profile sdk`，不在 FastAPI 里重写

## Directory Layout

每个模块自带 router、models、迁移和事件。模块之间禁止互相 import。`registry.py` 里注释一行即屏蔽该模块。

```
api/
├── main.py                        # 读 ENABLED_MODULES，importlib 动态注册
├── registry.py                    # 模块注册表
└── modules/
    ├── identity/                  # login/、configs/users/：login/token、用户、角色
    ├── logs/                      # 系统级日志
    ├── files/                     # resources/docs/：上传、分片、删除
    ├── models/                    # resources/models/、configs/providers/：模型路由与 model-gateway
    ├── connections/               # resources/connections/：数据源、API、MCP、凭证引用
    ├── memory/                    # 记忆分层。会话归 Session，偏好归 User，长期归 Agent
    ├── runtime/                   # chat/：创建 Task，注入 Hub 快照，拉起 dsh，回写平台 Event
    ├── knowledge/                 # knowledges/：文档、切片、检索
    ├── hub/                       # agents/：Agent、Skill、Tool 的定义与发布。快照不可变
    ├── workflow/                  # workflows/：已发布 DAG 的定义与运行
    ├── scheduler/                 # schedulers/：定时与日历触发
    ├── requests/                  # 预留。对应 views/func/requests/，后期审批
    ├── artifacts/                 # artifacts/、portals/：制品创建、发布、部署
    ├── vibe/                      # 轻应用生成循环（Workspace + Git）。产物交给 artifacts
    └── sandbox/                   # 代码执行。默认独立部署。Pi / CodeWork 只用于代码 Run
```
