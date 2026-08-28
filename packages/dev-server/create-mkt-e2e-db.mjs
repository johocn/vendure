// 临时脚本：创建 marketplace e2e 专用数据库（本地 postgres）
import { Client } from 'pg';

const DB_NAME = process.argv[2] || 'vendure_mkt_e2e';

const c = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'postgres',
});

await c.connect();
const r = await c.query("SELECT datname FROM pg_database WHERE datistemplate = false");
const dbs = r.rows.map(x => x.datname);
console.log('现有库:', dbs.join(', '));
if (dbs.includes(DB_NAME)) {
    console.log(`库 ${DB_NAME} 已存在，删除重建`);
    await c.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
}
await c.query(`CREATE DATABASE "${DB_NAME}"`);
console.log(`已创建数据库 ${DB_NAME}`);
await c.end();
