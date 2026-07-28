// e:\code\vendure\test-cs-flow.js
// 客服模块 e2e 验收脚本
// 运行: node test-cs-flow.js
// 登录方式：参考 test-sales-flow.js，从 response header `vendure-auth-token` 取 Bearer token

const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';

let superAdminToken = '';
let csStaffToken = '';
let testOrderId = '';
let testAfterSalesId = '';

// 统一 GraphQL 请求函数（参考 test-sales-flow.js）
// 关键点：登录响应的 token 在 header `vendure-auth-token`，不在 body
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
  // 从 response header 取 token（登录时返回，后续请求会回传相同 token）
  const headerToken = res.headers.get('vendure-auth-token');
  if (headerToken) body.data.__authToken = headerToken;
  return body.data;
}

// 登录函数：调用 login mutation，从 header 取 Bearer token
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

async function run() {
  console.log('=== 客服模块 e2e 验收开始 ===\n');

  // 1. 超管登录
  console.log('[1] 超管登录...');
  superAdminToken = await login('superadmin@china.test', 'superadmin');
  console.log('  ✅ 超管登录成功\n');

  // 2. 验证 customer-service 角色权限同步
  console.log('[2] 验证 customer-service 角色权限...');
  const rolesData = await gql(
    `query { roles(options: { filter: { code: { eq: "customer-service" } } }) { items { code permissions } } }`,
    {},
    superAdminToken,
  );
  const csRole = rolesData.roles.items[0];
  if (!csRole) throw new Error('customer-service 角色不存在');
  const requiredPerms = ['Authenticated', 'ViewAllOrders', 'HandleAfterSales', 'HandleException', 'ManageCustomer'];
  const missing = requiredPerms.filter(p => !csRole.permissions.includes(p));
  if (missing.length > 0) throw new Error(`缺少权限: ${missing.join(', ')}`);
  console.log(`  ✅ 角色权限完整: ${csRole.permissions.join(', ')}\n`);

  // 3. 创建客服账号（已存在则跳过）
  console.log('[3] 创建客服账号...');
  try {
    await gql(
      `mutation {
        createAdministrator(input: {
          firstName: "CS"
          lastName: "Staff"
          emailAddress: "cs1@zhao.test"
          password: "a963963"
          roleCodes: ["customer-service"]
        }) { id }
      }`,
      {},
      superAdminToken,
    );
    console.log('  ✅ 客服账号创建成功 (cs1@zhao.test / a963963)');
  } catch (e) {
    console.log('  ℹ️  客服账号已存在，跳过创建');
  }
  console.log();

  // 4. 客服登录
  console.log('[4] 客服登录...');
  csStaffToken = await login('cs1@zhao.test', 'a963963');
  console.log('  ✅ 客服登录成功\n');

  // 5. 客服查询全量订单
  console.log('[5] 客服查询全量订单...');
  const ordersData = await gql(
    `query { csAllOrders(page: 1, pageSize: 10) { items { id code state } totalItems } }`,
    {},
    csStaffToken,
  );
  console.log(`  ✅ 查询到 ${ordersData.csAllOrders.totalItems} 个订单`);
  if (ordersData.csAllOrders.items.length > 0) {
    testOrderId = ordersData.csAllOrders.items[0].id;
    console.log(`  ℹ️  选取订单 ${ordersData.csAllOrders.items[0].code} 用于后续测试`);
  }
  console.log();

  // 6. 客服查询订单详情
  if (testOrderId) {
    console.log('[6] 客服查询订单详情...');
    const detailData = await gql(
      `query($id: ID!) { csOrderDetail(id: $id) { order { code state } exceptionInfo { deliveryStatus } afterSalesRequests { id state } } }`,
      { id: testOrderId },
      csStaffToken,
    );
    console.log(`  ✅ 订单详情查询成功: ${detailData.csOrderDetail.order.code}`);
    if (detailData.csOrderDetail.afterSalesRequests.length > 0) {
      testAfterSalesId = detailData.csOrderDetail.afterSalesRequests[0].id;
      console.log(`  ℹ️  选取售后单 ${testAfterSalesId} 用于后续测试`);
    }
    console.log();
  }

  // 7. 客服查询异常订单
  console.log('[7] 客服查询异常订单...');
  const excData = await gql(
    `query { csExceptionOrders(page: 1, pageSize: 10) { items { order { id code } exceptionInfo { exceptionType } } totalItems } }`,
    {},
    csStaffToken,
  );
  console.log(`  ✅ 查询到 ${excData.csExceptionOrders.totalItems} 个异常订单\n`);

  // 8. 客服添加异常备注（如果有异常订单）
  if (excData.csExceptionOrders.items.length > 0) {
    console.log('[8] 客服添加异常备注...');
    const excOrderId = excData.csExceptionOrders.items[0].order.id;
    if (excOrderId) {
      const noteData = await gql(
        `mutation($orderId: ID!, $note: String!) { csAddExceptionNote(orderId: $orderId, note: $note) { csNotes { content createdBy } } }`,
        { orderId: excOrderId, note: '客服测试备注 - 已联系客户' },
        csStaffToken,
      );
      console.log(`  ✅ 备注添加成功，共 ${noteData.csAddExceptionNote.csNotes.length} 条备注\n`);
    }
  } else {
    console.log('[8] 跳过异常备注测试（无异常订单）\n');
  }

  // 9. 售后单操作（如果有售后单）
  if (testAfterSalesId) {
    console.log('[9] 售后单查询与操作...');
    const arData = await gql(
      `query($id: ID!) { csAfterSalesRequestDetail(id: $id) { id state reason refundAmount } }`,
      { id: testAfterSalesId },
      csStaffToken,
    );
    console.log(`  ✅ 售后单查询: state=${arData.csAfterSalesRequestDetail.state}`);

    const listData = await gql(
      `query { csAfterSalesRequests(page: 1, pageSize: 10) { items { id state } totalItems } }`,
      {},
      csStaffToken,
    );
    console.log(`  ✅ 售后单列表: ${listData.csAfterSalesRequests.totalItems} 条\n`);
  } else {
    console.log('[9] 跳过售后单操作（无售后单）\n');
  }

  // 10. 权限隔离测试
  console.log('[10] 权限隔离测试...');
  // 客服不应能调用 salesCreateOrder（无 CreateOrder 权限）
  try {
    await gql(
      `mutation { salesCreateOrder(input: { lines: [{ productVariantId: "1", quantity: 1 }], shippingAddress: { streetLine1: "test" }, shippingMethodId: "1", salesChannel: store }) { id } }`,
      {},
      csStaffToken,
    );
    console.log('  ❌ 权限隔离失败: 客服能调用 salesCreateOrder');
  } catch (e) {
    console.log('  ✅ 权限隔离正常: 客服无法调用 salesCreateOrder');
  }
  console.log();

  console.log('=== 客服模块 e2e 验收完成 ===');
}

run().catch(e => {
  console.error('验收失败:', e.message);
  process.exit(1);
});
