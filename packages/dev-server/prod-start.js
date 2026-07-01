process.env.NODE_ENV = 'production';

// 加载 .env 环境变量
require('dotenv').config();

// 确保 PostgreSQL 连接配置
if (!process.env.DB) {
    process.env.DB = 'postgres';
}
if (!process.env.DB_HOST) {
    process.env.DB_HOST = '127.0.0.1';
}

// 禁用开发调试工具（生产环境不需要）
process.env.DEV_BYPASS_SMS = 'false';
process.env.DEV_BYPASS_WECHAT = 'false';

// 启动 Vendure Server（已编译为 JS，不依赖 ts-node）
require('./dist/index');
