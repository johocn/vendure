#!/usr/bin/env node
// 清理 dev 数据库：重置 stock_level + 取消残留订单
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
await c.connect();

// 1. 清理库存：variant 1 (NF-WATER-500) 双仓各 20 onHand, 0 allocated
await c.query(`UPDATE stock_level SET "stockOnHand" = 20, "stockAllocated" = 0 WHERE "productVariantId" = 1 AND "stockLocationId" = 1`);
await c.query(`UPDATE stock_level SET "stockOnHand" = 20, "stockAllocated" = 0 WHERE "productVariantId" = 1 AND "stockLocationId" = 2`);
console.log('库存已重置: variant 1 (NF-WATER-500) 双仓 onHand=20, allocated=0');

// 2. 清除所有 AddingItems 状态的残留订单（先删 order_line 再删 order；被 stock_movement 引用的跳过）
const stale = await c.query(`SELECT id FROM "order" WHERE state = 'AddingItems' AND active = true`);
const ids = stale.rows.map(r => r.id);
let removed = 0;
for (const id of ids) {
  try {
    await c.query('BEGIN');
    await c.query(`DELETE FROM order_line WHERE "orderId" = $1`, [id]);
    await c.query(`DELETE FROM "order" WHERE id = $1`, [id]);
    await c.query('COMMIT');
    removed++;
  } catch (e) {
    await c.query('ROLLBACK');
    console.log(`跳过残留订单 id=${id}（有 stock_movement 引用）`);
  }
}
console.log(`已清理 ${removed}/${ids.length} 个 AddingItems 残留订单`);

const sl = await c.query('SELECT * FROM stock_level WHERE "productVariantId" = 1 ORDER BY "stockLocationId"');
console.table(sl.rows);

await c.end();
