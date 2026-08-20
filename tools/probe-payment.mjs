#!/usr/bin/env node
// 排查支付结算链路：列出最近订单的 金额 vs 支付金额 vs 状态 差异
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
await c.connect();

const r = await c.query(
  `SELECT o.id, o.code, o.state, o."subTotalWithTax", o."shippingWithTax", o."currencyCode",
     (SELECT coalesce(json_agg(json_build_object('id',p.id,'method',p.method,'amount',p.amount,'state',p.state)), '[]')
        FROM "payment" p WHERE p."orderId"=o.id) AS "payments"
   FROM "order" o
   ORDER BY o.id DESC LIMIT 15`
);
for (const x of r.rows) {
  const paySum = (x.payments||[]).reduce((s,p)=>s+p.amount,0);
  const total = Number(x.subTotalWithTax) + Number(x.shippingWithTax);
  console.log(`#${x.id} ${x.code} state=${x.state} total=${total} (sub=${x.subTotalWithTax}+ship=${x.shippingWithTax}) paySum=${paySum} flag=${total===paySum?'OK':'MISMATCH'} pays=${JSON.stringify(x.payments)}`);
}

await c.end();