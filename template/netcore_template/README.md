## 公共服务API

一个基于 **ASP.NET Core 8 + EF Core** 的服务，支持：
- 分层结构（Models / DTOs / DbContext / Repositories / Services / Controllers）
- SQL Server / Oracle 数据库连接
- CORS 配置
- 登录方式 多样处理
- JWT 鉴权
- 用户及角色 管理
- 数据库密码加密
- 文件上传及管理
- Excel文件 生成导出
- WebSocket 实现
- 日志文件 管理
- Swagger 文档
- Docker 部署

## 项目结构

```plaintext
CommonService
├── CommonService.Core
│   ├── Models/            # 实体类，对应数据库表结构
│   │   ├── ApiResponse.cs
│   │   ├── Configs.cs
│   │   ├── Pagination.cs
│   │   └── ...
│   ├── DbContexts/        # DbContext 定义
│   │   ├── AppDbContext.cs
│   │   └── OracleDbContext.cs
│   ├── Repositories/      # 数据访问层，封装 EF Core 查询
│   │   ├── Interfaces/
│   │   └── ...
│   ├── Utils/             # 工具类，如加解密、通用方法
│   │   ├── AesEncryptionHelper.cs
│   │   ├── CacheHelper.cs
│   │   ├── JwtHelper.cs
│   │   └── LogHelper.cs
│   └── ...
│
├── CommonService.Application
│   ├── DTOs/                  # 数据传输对象（输入输出接口）
│   ├── Mappings/              
│   ├── Services/              # 业务逻辑层，组合仓库、工具类等
│   │   ├── Interfaces/
│   │   └── ...
│   └── ...
│
├── CommonService.WebApi
│   ├── Controllers/       # API 控制器，负责接收请求、返回响应
│   │   ├── AesController.cs
│   │   ├── AuthController.cs
│   │   ├── AzureController.cs
│   │   ├── HealthController.cs
│   │   └── ...
│   ├── Middlewares/       # 自定义中间件，如 WebSocket、日志等
│   ├── appsettings.json   # 配置文件（数据库、JWT、CORS 等）
│   ├── Program.cs         # 启动入口，配置管道 & 依赖注入
│   └── ...
│
└── README.md              # 项目说明文档
```

## 依赖

### JWT
```
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

### BCrypt AES
```
dotnet add package BCrypt.Net-Next
```

### Redis
```
dotnet add package StackExchange.Redis
```

### MSSQL
```
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools
```

### Oracle
```
dotnet add package Oracle.EntityFrameworkCore
dotnet add package Oracle.ManagedDataAccess.Core
```

### MySQL
```
dotnet add package Microsoft.EntityFrameworkCore.MySql
```

### Excel
```
dotnet add package ClosedXML
```

### Swagger
```
dotnet add package Swashbuckle.AspNetCore
```

### Serilog
```
dotnet add package Serilog
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.File

```

### Websocket

- 使用 WebSocketMiddleware.cs 和 WebSocketConnectionManager.cs 配合
- 使用 WsController.cs，暴露 send 方法直接发送信息，getlist 方法查询当前链接中的所有 socketID
- 可以自由控制 单一通讯 广播通讯

## This Way
基础层
- Models 下创建实体类，对应数据库表结构
- DbContext 下配置 DbSet<T> 对应每个实体，连接数据库
- Repositories 下封装对 DbContext 的操作（CRUD、查询等）
业务
- Services 下实现业务逻辑
- DTOs 下定义对外接口的数据结构
对外
- Controllers 下暴露接口
收尾
- Program.cs 下注册依赖
