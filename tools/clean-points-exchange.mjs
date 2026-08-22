// 清理阶段37 兑换实测造的脏数据
// 目标: exchange-*/poor-*@example.com 测试顾客 + 积分明细 + EXCHANGE券 + "积分兑换测试券"模板
// 用法: node tools/clean-points-exchange.mjs     (默认 dry-run, 只报告)
//       node tools/clean-points-exchange.mjs --commit
import('pg').then(async ({ Client }) => {
  const c = new Client({ host: '127.0.0.1', port: 5432, user: 'postgres', password: 'admin', database: 'vendure' });
  await c.connect();
  const commit = process.argv.includes('--commit');

  // 目标集
  const emailPattern = ["exchange-%@example.com", "poor-%@example.com"];
  const tplNamePattern = "%积分兑换测试券%";

  const custIdRes = await c.query(
    `SELECT id, "userId" FROM customer WHERE "emailAddress" LIKE ANY($1::text[])`,
    [emailPattern],
  );
  const custIds = custIdRes.rows.map(r => r.id);
  const usrIds = [...new Set(custIdRes.rows.map(r => Number(r.userId)).filter(Boolean))];
  const tplRes = await c.query(`SELECT id FROM coupon_template WHERE name LIKE $1`, [tplNamePattern]);
  const tplIds = tplRes.rows.map(r => r.id);

  const q = (sql, args) => c.query(sql, args);

  // 依赖顺序清理（每步打印影响行数）
  const steps = [];
  if (custIds.length) {
    steps.push([
      `member_points_history_channels_channel`,
      `"memberPointsHistoryId" IN (SELECT id FROM member_points_history WHERE "customerId" = ANY($1))`,
      [custIds],
      'member_points_history 关联渠道(join)',
    ]);
    steps.push([`member_points_history`, `"customerId" = ANY($1)`, [custIds], '积分明细 member_points_history']);
  }
  if (tplIds.length) {
    steps.push([`coupon_template_channels_channel`, `"couponTemplateId" = ANY($1)`, [tplIds], '券模板关联渠道(join)']);
    steps.push([`customer_coupon`, `"templateId" = ANY($1) OR "customerId" = ANY($2)`, [tplIds, custIds], 'CustomerCoupon 兑出券']);
    steps.push([`coupon_template`, `id = ANY($1)`, [tplIds], '券模板 coupon_template']);
  }
  if (custIds.length) {
    // 顾客可能产生的其它子表（测试用户通常为空，做兜底）
    for (const t of [
      'customer_channels_channel', 'customer_groups_customer_group', 'address',
      'history_entry', 'checkin_record', 'balance_transaction', 'customer_balance',
      'distributor', 'employee_customer', 'invoice', 'message_delivery', 'order',
      'recharge_order', 'review', 'subscribe_message_log', 'task_record', 'coupon_code',
      'after_sales_request',
    ]) {
      steps.push([t, `"customerId" = ANY($1)`, [custIds], `子表 ${t}`]);
    }
    steps.push([`customer`, `id = ANY($1)`, [custIds], '顾客 customer']);
  }
  if (usrIds.length) {
    steps.push([`session`, `"userId" = ANY($1)`, [usrIds], '会话 session']);
    steps.push([`user_roles_role`, `"userId" = ANY($1)`, [usrIds], '角色 join']);
    steps.push([`authentication_method`, `"userId" = ANY($1)`, [usrIds], '认证方式']);
    steps.push([`api_key`, `"userId" = ANY($1)`, [usrIds], 'api_key']);
  }
  if (usrIds.length) {
    steps.push([`"user"`, `id = ANY($1)`, [usrIds], '登录账号 user']);
  }

  if (!commit) {
    console.log(`# DRY-RUN（加 --commit 执行删除）`);
  }
  console.log(`命中: 顾客=${custIds.length} user=${usrIds.length} 券模板=${tplIds.length}`);
  let total = 0;
  await c.query('BEGIN');
  for (const [table, cond, args, label] of steps) {
    const tname = table.replace(/"/g, '');
    const cls = await q(`SELECT to_regclass('public.'||$1) AS t`, [tname]);
    if (!cls.rows[0].t) { /* 表可能不存在，跳过 */ continue; }
    const r = await q(`DELETE FROM "${tname}" WHERE ${cond} RETURNING 1`, args);
    total += r.rowCount;
    console.log(`  ${commit ? 'DEL' : 'would-del'} ${label}: ${r.rowCount}`);
  }
  await c.query(commit ? 'COMMIT' : 'ROLLBACK');
  console.log(`合计受影响行: ${total}（commit=${commit}）`);
  await c.end();
}).catch(e => { console.error(e); process.exit(1); });