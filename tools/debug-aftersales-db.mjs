#!/usr/bin/env node
// 调试：直接查 PostgreSQL，确认售后回补相关数据状态
import pg from 'pg';
const { Client } = pg;
(async () => {
  const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
  await c.connect();

  // 1. order_line 自定义字段列名
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='order_line' AND column_name LIKE '%stockLocation%' OR (table_name='order_line' AND column_name LIKE 'customFields%')`
  );
  console.log('order_line customFields columns:', cols.rows.map(r => r.column_name));

  // 2. 最近订单行 stockLocationId 值
  const ol = await c.query(
    `SELECT id, quantity, "customFieldsStocklocationid" AS sloc FROM order_line ORDER BY id DESC LIMIT 10`
  );
  console.log('recent order_lines:', JSON.stringify(ol.rows));

  // 3. 售后单
  const as = await c.query(
    `SELECT id, state, "orderLineId" AS olid, "receivedQuantity" AS rqty, "refundAmount" AS ref FROM after_sales_request ORDER BY id`
  );
  console.log('after_sales_request:', JSON.stringify(as.rows));

  // 4. 账本表名探测
  const tbls = await c.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%ledger%' OR table_name LIKE '%stock%'`
  );
  console.log('stock tables:', tbls.rows.map(r => r.table_name));

  // 5. 账本表 schema 与 AS 开头流水
  try {
    const t = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='marketplace_inventory_ledger'`);
    console.log('marketplace_inventory_ledger cols:', JSON.stringify(t.rows));
    const l = await c.query(`SELECT * FROM marketplace_inventory_ledger WHERE code LIKE 'AS%' ORDER BY id DESC LIMIT 20`);
    console.log('AS* ledger:', JSON.stringify(l.rows, null, 1));
    const recent = await c.query(`SELECT * FROM marketplace_inventory_ledger ORDER BY id DESC LIMIT 5`);
    console.log('recent ledger:', JSON.stringify(recent.rows, null, 1));
  } catch (e) { console.log('ledger query failed:', e.message); }

  // 5b. order_stock_ledger 表（另一个可能账本）
  try {
    const t = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='order_stock_ledger'`);
    console.log('order_stock_ledger cols:', JSON.stringify(t.rows));
    const l = await c.query(`SELECT * FROM order_stock_ledger ORDER BY id DESC LIMIT 5`);
    console.log('order_stock_ledger recent:', JSON.stringify(l.rows, null, 1));
  } catch (e) { console.log('order_stock_ledger query failed:', e.message); }

  // 6. 库存分配（Allocation）数量
  try {
    const alloc = await c.query(`SELECT count(*)::int AS n FROM stock_movement WHERE type='ALLOCATION'`);
    console.log('ALLOCATION movements:', alloc.rows);
  } catch (e) { console.log('stock_movement query failed:', e.message); }

  // 7. 订单行 50-59 对应的全部库存流水
  try {
    const mv = await c.query(
      `SELECT id, type, quantity, "orderLineId" AS ol, "createdAt" AS ts, "productVariantId" AS pv, "stockLocationId" AS sloc FROM stock_movement WHERE "orderLineId" IN (50,51,52,53,54,55,56,57,58,59) ORDER BY id`
    );
    console.log('movements for ol 50-59:', JSON.stringify(mv.rows, null, 1));
    const c2 = await c.query(`SELECT type, count(*)::int AS n, max("createdAt") AS latest FROM stock_movement GROUP BY type`);
    console.log('movement type counts:', JSON.stringify(c2.rows));
  } catch (e) { console.log('stock_movement detail failed:', e.message); }

  // 8. order_stock_ledger 中的 afterSales 流水
  try {
    const l = await c.query(`SELECT * FROM order_stock_ledger WHERE bizType='afterSales' ORDER BY id DESC LIMIT 20`);
    console.log('afterSales ledger:', JSON.stringify(l.rows, null, 1));
  } catch (e) { console.log('afterSales ledger failed:', e.message); }

  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
