#!/usr/bin/env node
// 清理卡在 ArrangingPayment/AddingItems 的残留测试订单（含订单级所有关联），得到干净库态
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
await c.connect();

const r = await c.query(
  `SELECT o.id, o.code, o.state, o.active,
     (SELECT count(*) FROM payment p WHERE p."orderId"=o.id) pay,
     (SELECT count(*) FROM order_line ol WHERE ol."orderId"=o.id) lines
   FROM "order" o
   WHERE o.state='ArrangingPayment' OR o.state='AddingItems'
   ORDER BY o.id`
);
console.log('待清理残留订单:');
r.rows.forEach(x => console.log(JSON.stringify(x)));

let removed = 0;
for (const o of r.rows) {
  try {
    await c.query('BEGIN');
    for (const t of ['order_process_join', 'order_line', 'stock_movement', 'payment',
      'order_item', 'order_surcharge', 'order_package', 'fulfillment', 'order_tax_line',
      'order_history_entry', 'order']) {
      // order_history_entry 有 content JSON 列，仅当表存在
      const cols = await c.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
        [t, 'orderId']
      );
      const colName = cols.rows.length ? 'orderId' : null;
      if (!colName) {
        // stock_movement 等表用 orderLineId 关联，间接删除
        const col2 = await c.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
          [t, 'orderLineId']
        );
        if (col2.rows.length) {
          await c.query(
            `DELETE FROM ${t} WHERE "orderLineId" IN (SELECT id FROM order_line WHERE "orderId"=$1)`,
            [o.id]
          );
        }
      } else {
        await c.query(`DELETE FROM ${t} WHERE "orderId"=$1`, [o.id]);
      }
    }
    await c.query('DELETE FROM "order" WHERE id=$1', [o.id]);
    await c.query('COMMIT');
    removed++;
  } catch (e) {
    await c.query('ROLLBACK');
    console.log(`跳过 order#${o.id}(${o.state}): ${e.message}`);
  }
}
console.log(`清理 ${removed}/${r.rows.length} 个残留订单`);

// 重置库存：双仓各 10 onHand, 0 allocated
await c.query(`UPDATE stock_level SET "stockOnHand"=10, "stockAllocated"=0`);
console.log('库存已重置: 全仓 onHand=10, allocated=0');

await c.end();