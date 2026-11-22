export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Template User API',
    version: '0.1.0',
    description: '用户管理示例。数据在 SQLite。',
  },
  paths: {
    '/api/health': {
      get: { summary: '进程与 SQLite 路径', responses: { '200': { description: '已就绪' } } },
    },
    '/api/logs': {
      post: {
        summary: '写入一条日志，追加到当天文件。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['kind'],
                properties: {
                  kind: { type: 'string', description: '例如 page' },
                  path: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: '已写入' } },
      },
    },
    '/api/logs/{date}': {
      get: {
        summary: '读取某一天的日志文件内容。',
        parameters: [
          { name: 'date', in: 'path', required: true, schema: { type: 'string', example: '2026-11-12' } },
        ],
        responses: { '200': { description: '文件原文' } },
      },
    },
    '/api/users': {
      get: {
        summary: '用户列表',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: '按姓名或邮箱包含匹配' },
        ],
        responses: { '200': { description: '用户列表' } },
      },
    },
    '/api/users/save': {
      post: {
        summary: '新建或更新用户。带 id 为更新。',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'role'],
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: '保存后的用户' } },
      },
    },
    '/api/users/remove': {
      post: {
        summary: '删除用户',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'integer' } },
              },
            },
          },
        },
        responses: { '200': { description: '已删除' } },
      },
    },
  },
};

export const swaggerHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>Template API</title>
    <link rel="stylesheet" href="/swagger/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/swagger/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/swagger.json',
        dom_id: '#swagger-ui',
      });
    </script>
  </body>
</html>`;
