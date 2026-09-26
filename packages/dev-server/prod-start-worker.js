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

// 启动 Vendure Worker（已编译为 JS，不依赖 ts-node）
// dev-config 已把 runTasksInWorkerOnly 置为 true：ScheduledTask 只在 worker 进程执行，
// 故生产必须常驻本进程，否则预留单超时释放 / 订单超时补偿 / 秒杀状态转换都不会运行。
require('./dist/index-worker');