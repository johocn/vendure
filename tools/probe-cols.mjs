#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
await c.connect();

const orders = await c.query(
  `SELECT o.id, o.code, o.state, o."totalWithTax" AS total, o."currencyCode" AS cur,
     (SELECT json_agg(json_build_object('id',p.id,'method',p.method,'amount',p.amount,'state',p.state))
        FROM payment p WHERE p."orderId"=o.id) AS payments
   FROM "order" o WHERE o.id IN (371,373,375) ORDER BY o.id`
);
orders.rows.forEach(x => console.log(JSON.stringify(x)));

await c.end();