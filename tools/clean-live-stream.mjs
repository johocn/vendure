// 清理阶段38 直播实测造的脏数据
// 目标: 名称以 "E2E 带货" 开头的 LiveRoom + 关联 LiveRoomProduct / join 表
//       若实测产生订单归因佣金（commission_record 经 order.customFields.liveRoomId 关联），
//       MVP 冒烟不产生订单，故不在此清理；如需可经分销插件清理脚本处理。
// 用法: node tools/clean-live-stream.mjs          (默认 dry-run, 只报告)
//       node tools/clean-live-stream.mjs --commit
import('pg').then(async ({ Client }) => {
  const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
  await c.connect();
  const commit = process.argv.includes('--commit');

  const namePattern = 'E2E 带货%';
  const roomRes = await c.query(`SELECT id FROM live_room WHERE name LIKE $1`, [namePattern]);
  const roomIds = roomRes.rows.map(r => r.id);

  const q = (sql, args) => c.query(sql, args);
  const tableOf = async (tname) => {
    const cls = await q(`SELECT to_regclass('public.'||$1) AS t`, [tname]);
    return !!cls.rows[0].t;
  };

  // 收集直播间的商品 id（经 join 表 或 直接查）
  let prodIds = [];
  if (await tableOf('live_room_products_live_room_product') && roomIds.length) {
    const pr = await q(`SELECT DISTINCT "liveRoomProductId" AS id FROM live_room_products_live_room_product WHERE "liveRoomId" = ANY($1)`, [roomIds]);
    prodIds = prodIds.concat(pr.rows.map(r => r.id));
  }

  const steps = [];
  if (roomIds.length) {
    steps.push([`live_room_products_live_room_product`, `"liveRoomId" = ANY($1)`, [roomIds], '直播间-商品 join']);
    steps.push([`live_room_channels_channel`, `"liveRoomId" = ANY($1)`, [roomIds], '直播间-渠道 join']);
    steps.push([`live_room`, `id = ANY($1)`, [roomIds], '直播间 live_room']);
  }
  if (prodIds.length) {
    const uniqProd = [...new Set(prodIds)];
    steps.push([`live_room_product_channels_channel`, `"liveRoomProductId" = ANY($1)`, [uniqProd], '商品-渠道 join']);
    steps.push([`live_room_product`, `id = ANY($1)`, [uniqProd], '商品 live_room_product']);
  }

  if (!commit) console.log(`# DRY-RUN（加 --commit 执行删除）`);
  console.log(`命中: 直播间=${roomIds.length} 商品=${prodIds.length}`);

  let total = 0;
  await c.query('BEGIN');
  for (const [table, cond, args, label] of steps) {
    const tname = table.replace(/"/g, '');
    if (!(await tableOf(tname))) continue; // 表可能不存在
    const r = await q(`DELETE FROM "${tname}" WHERE ${cond} RETURNING 1`, args);
    total += r.rowCount;
    console.log(`  ${commit ? 'DEL' : 'would-del'} ${label}: ${r.rowCount}`);
  }
  await c.query(commit ? 'COMMIT' : 'ROLLBACK');
  console.log(`合计受影响行: ${total}（commit=${commit}）`);
  await c.end();
}).catch(e => { console.error(e); process.exit(1); });