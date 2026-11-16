-- 在 SQLite 里执行一次。进程不读这个文件，build 也不打包。
-- 示例进程首次启动时会执行同样的 IF NOT EXISTS，已有的库再跑一遍不会改数据。

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
