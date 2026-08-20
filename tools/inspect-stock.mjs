#!/usr/bin/env node
// 临时排查脚本：查看 postgres dev 库最近订单与包裹状态
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
await c.connect();

const r = await c.query('SELECT id, code, state, active, "customFieldsFulfillmentdeliveredat" AS fda FROM "order" ORDER BY id DESC LIMIT 8');
r.rows.forEach(x => console.log(`order id=${x.id} state=${x.state} active=${x.active} fda=${x.fda}`));

const p = await c.query('SELECT id, "orderId", status, "deliveryOrderId" FROM order_package ORDER BY id DESC LIMIT 10');
p.rows.forEach(x => console.log(`pkg id=${x.id} order#${x.orderId} status=${x.status} deliveryOrderId=${x.deliveryOrderId}`));

const d = await c.query('SELECT id, code, "orderId", "packageId", status FROM delivery_order ORDER BY id DESC LIMIT 8');
d.rows.forEach(x => console.log(`dlv id=${x.id} code=${x.code} order#${x.orderId} pkg=${x.packageId} status=${x.status}`));

await c.end();
