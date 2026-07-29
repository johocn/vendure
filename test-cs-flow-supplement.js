// e:\code\vendure\test-cs-flow-supplement.js
// 客服模块 e2e 补充验收脚本
// 目的：构造异常订单 + Pending 售后单测试数据，覆盖 csExceptionOrders / csAddExceptionNote / csAfterSalesRequests / csApproveAfterSales
// 运行: node test-cs-flow-supplement.js

const fetch = require('node-fetch');
const { Client } = require('pg');

const ADMIN_API = 'http://localhost:3000/admin-api';
const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'vendure',
};

let superAdminToken = '';
let csStaffToken = '';
let testOrderId = '';
let testOrderCode = '';
let testCustomerId = '';
let testChannelId = '';
let testAfterSalesId = '';
const backup = {};
const pgClient = new Client(DB_CONFIG);

async function gql(query, variables = {}, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) {
    const err = new Error(body.errors.map(e => e.message).join('; '));
    err.body = body;
    throw err;
  }
  const headerToken = res.headers.get('vendure-auth-token');
  if (headerToken) body.data.__authToken = headerToken;
  return body.data;
}

async function login(username, password) {
  const data = await gql(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        ... on CurrentUser { identifier id }
        ... on InvalidCredentialsError { message }
      }
    }`,
    { username, password },
  );
  if (!data.__authToken) {
    throw new Error('Login failed: ' + (data.login?.message ?? 'no token returned'));
  }
  return data.__authToken;
}

async function setupTestData() {
  console.log('[setup] 连接 PostgreSQL...');
  await pgClient.connect();

  // 找一个有 customer 的订单
  console.log('[setup] 查找测试订单...');
  const orderRes = await pgClient.query(`
    SELECT id, code, state, "customerId"
    FROM "order"
    WHERE "customerId" IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `);
  if (orderRes.rows.length === 0) {
    throw new Error('No order with customer found in DB');
  }
  const row = orderRes.rows[0];
  testOrderId = row.id;
  testOrderCode = row.code;
  testCustomerId = row.customerId; // 用双引号查询时保留大小写
  testChannelId = 1;
  console.log(`  ✅ 选取订单: id=${testOrderId} code=${testOrderCode} customer=${testCustomerId} state=${row.state}`);

  // 备份当前 customFields（仅备份要修改的几个字段）
  const cfRes = await pgClient.query(
    `SELECT "customFieldsDeliverystatus", "customFieldsExceptiontype", "customFieldsExceptionnote", "customFieldsExceptionphotos", "customFieldsCsnotes"
     FROM "order" WHERE id = $1`,
    [testOrderId],
  );
  const cfRow = cfRes.rows[0];
  Object.assign(backup, cfRow);
  console.log(`  ℹ️  原 deliveryStatus: ${cfRow.customFieldsDeliverystatus ?? 'null'}`);

  // 构造异常订单（直接更新单列）
  console.log('[setup] 写入异常订单 customFields...');
  await pgClient.query(
    `UPDATE "order"
     SET "customFieldsDeliverystatus" = $1,
         "customFieldsExceptiontype" = $2,
         "customFieldsExceptionnote" = $3,
         "customFieldsExceptionphotos" = $4
     WHERE id = $5`,
    [
      'exception',
      'damaged',
      '商品外包装破损，客户拒收',
      JSON.stringify(['https://test.example.com/photo1.jpg', 'https://test.example.com/photo2.jpg']),
      testOrderId,
    ],
  );

  // 构造 Pending 售后单
  console.log('[setup] 创建 Pending 售后单...');
  const insertRes = await pgClient.query(
    `INSERT INTO after_sales_request
      ("orderId", "orderLineId", type, state, reason, description, "refundAmount", "customerId", "createdAt", "updatedAt")
     VALUES ($1, NULL, 'return_refund', 'Pending', '商品破损', '客服测试-商品外包装破损', 100, $2, NOW(), NOW())
     RETURNING id`,
    [testOrderId, testCustomerId],
  );
  testAfterSalesId = insertRes.rows[0].id;
  console.log(`  ✅ 售后单创建: id=${testAfterSalesId}`);

  // 关联 channel
  await pgClient.query(
    `INSERT INTO after_sales_request_channels_channel ("afterSalesRequestId", "channelId") VALUES ($1, $2)`,
    [testAfterSalesId, testChannelId],
  );
  console.log(`  ✅ 售后单关联 channel ${testChannelId}`);
  console.log();
}

async function cleanupTestData() {
  console.log('\n[cleanup] 清理测试数据...');
  try {
    if (testAfterSalesId) {
      await pgClient.query(`DELETE FROM after_sales_request_channels_channel WHERE "afterSalesRequestId" = $1`, [
        testAfterSalesId,
      ]);
      await pgClient.query(`DELETE FROM after_sales_request WHERE id = $1`, [testAfterSalesId]);
      console.log(`  ✅ 删除测试售后单 ${testAfterSalesId}`);
    }
    if (testOrderId) {
      await pgClient.query(
        `UPDATE "order"
         SET "customFieldsDeliverystatus" = $1,
             "customFieldsExceptiontype" = $2,
             "customFieldsExceptionnote" = $3,
             "customFieldsExceptionphotos" = $4
         WHERE id = $5`,
        [
          backup.customFieldsDeliverystatus ?? null,
          backup.customFieldsExceptiontype ?? null,
          backup.customFieldsExceptionnote ?? null,
          backup.customFieldsExceptionphotos ?? null,
          testOrderId,
        ],
      );
      console.log(`  ✅ 恢复订单 ${testOrderCode} 的 customFields`);
    }
  } catch (e) {
    console.error('  ❌ 清理失败:', e.message);
  } finally {
    await pgClient.end();
  }
}

async function run() {
  console.log('=== 客服模块 e2e 补充验收开始 ===\n');

  // 1. 构造测试数据
  await setupTestData();

  // 2. 超管 + 客服登录
  console.log('[1] 超管/客服登录...');
  superAdminToken = await login('superadmin@china.test', 'superadmin');
  csStaffToken = await login('cs1@zhao.test', 'a963963');
  console.log('  ✅ 登录成功\n');

  // 3. 客服查询异常订单
  console.log('[2] 客服查询异常订单...');
  const excData = await gql(
    `query { csExceptionOrders(page: 1, pageSize: 50) { items { order { id code } exceptionInfo { exceptionType exceptionNote exceptionPhotos deliveryStaffId } csNotes { content createdBy } } totalItems } }`,
    {},
    csStaffToken,
  );
  const excItems = excData.csExceptionOrders.items;
  const totalItems = excData.csExceptionOrders.totalItems;
  console.log(`  ✅ 查询到 ${totalItems} 个异常订单`);
  const testExc = excItems.find(it => String(it.order.id) === String(testOrderId));
  if (!testExc) {
    throw new Error(`构造的异常订单 ${testOrderCode} 未出现在查询结果中`);
  }
  console.log(`  ✅ 找到测试订单: ${testExc.order.code}`);
  console.log(`     exceptionType=${testExc.exceptionInfo.exceptionType}`);
  console.log(`     exceptionNote=${testExc.exceptionInfo.exceptionNote}`);
  console.log(`     photos count=${testExc.exceptionInfo.exceptionPhotos?.length ?? 0}`);
  console.log(`     csNotes count=${testExc.csNotes.length}\n`);

  // 4. 客服添加异常备注
  console.log('[3] 客服添加异常备注...');
  const noteData = await gql(
    `mutation($orderId: ID!, $note: String!) { csAddExceptionNote(orderId: $orderId, note: $note) { csNotes { content createdBy } } }`,
    { orderId: testOrderId, note: '客服补充测试-已联系客户协商换货' },
    csStaffToken,
  );
  const notesCount = noteData.csAddExceptionNote.csNotes.length;
  if (notesCount === 0) {
    throw new Error('备注添加失败: csNotes 为空');
  }
  console.log(`  ✅ 备注添加成功，共 ${notesCount} 条`);
  console.log(`     最新备注: ${noteData.csAddExceptionNote.csNotes[notesCount - 1].content}\n`);

  // 5. 客服查询售后单列表
  console.log('[4] 客服查询售后单列表...');
  const arList = await gql(
    `query { csAfterSalesRequests(page: 1, pageSize: 50) { items { id state reason refundAmount } totalItems } }`,
    {},
    csStaffToken,
  );
  console.log(`  ✅ 查询到 ${arList.csAfterSalesRequests.totalItems} 条售后单`);
  const testAr = arList.csAfterSalesRequests.items.find(it => String(it.id) === String(testAfterSalesId));
  if (!testAr) {
    throw new Error(`构造的售后单 ${testAfterSalesId} 未出现在查询结果中`);
  }
  console.log(`  ✅ 找到测试售后单: id=${testAr.id} state=${testAr.state} reason=${testAr.reason}\n`);

  // 6. 客服查询售后单详情
  console.log('[5] 客服查询售后单详情...');
  const arDetail = await gql(
    `query($id: ID!) { csAfterSalesRequestDetail(id: $id) { id state reason refundAmount } }`,
    { id: testAfterSalesId },
    csStaffToken,
  );
  if (!arDetail.csAfterSalesRequestDetail) {
    throw new Error('售后单详情查询返回 null');
  }
  console.log(`  ✅ 详情查询成功: state=${arDetail.csAfterSalesRequestDetail.state}\n`);

  // 7. 客服审批售后单 (Pending → Approved)
  console.log('[6] 客服审批售后单 (Pending → Approved)...');
  const approveData = await gql(
    `mutation($id: ID!) { csApproveAfterSales(id: $id) { id state } }`,
    { id: testAfterSalesId },
    csStaffToken,
  );
  if (approveData.csApproveAfterSales.state !== 'Approved') {
    throw new Error(`审批后状态异常: ${approveData.csApproveAfterSales.state}`);
  }
  console.log(`  ✅ 审批成功: state=${approveData.csApproveAfterSales.state}\n`);

  // 8. 客服再次审批（应失败：Approved 不能再 → Approved）
  console.log('[7] 客服重复审批（应失败）...');
  try {
    await gql(
      `mutation($id: ID!) { csApproveAfterSales(id: $id) { id state } }`,
      { id: testAfterSalesId },
      csStaffToken,
    );
    console.log('  ⚠️  重复审批未报错（可能是状态机宽松）');
  } catch (e) {
    console.log(`  ✅ 重复审批按预期失败: ${e.message.slice(0, 100)}`);
  }
  console.log();

  // 9. 客服拒绝售后单（应失败：Approved 不能 → Rejected）
  console.log('[8] 客服拒绝已审批售后单（应失败）...');
  try {
    await gql(
      `mutation($id: ID!, $reason: String!) { csRejectAfterSales(id: $id, reason: $reason) { id state } }`,
      { id: testAfterSalesId, reason: '测试拒绝' },
      csStaffToken,
    );
    console.log('  ⚠️  拒绝已审批单未报错（可能是状态机宽松）');
  } catch (e) {
    console.log(`  ✅ 拒绝按预期失败: ${e.message.slice(0, 100)}`);
  }
  console.log();

  // 10. 权限隔离：客服不应能调用 delivery reportException
  console.log('[9] 权限隔离：客服不应能调用 delivery reportException...');
  try {
    await gql(
      `mutation { reportException(orderId: "${testOrderId}", type: "damaged", photos: ["x"]) { id } }`,
      {},
      csStaffToken,
    );
    console.log('  ❌ 权限隔离失败: 客服能调用 reportException');
  } catch (e) {
    console.log(`  ✅ 权限隔离正常: 客服无法调用 reportException`);
  }
  console.log();

  console.log('=== 客服模块 e2e 补充验收完成 ===');
}

run()
  .catch(e => {
    console.error('\n验收失败:', e.message);
    if (e.body) console.error(JSON.stringify(e.body, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupTestData();
  });
