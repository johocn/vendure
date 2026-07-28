// e:\code\vendure\test-inventory-flow.js
// 库存模块 e2e 验收脚本 (8 组测试)
// 运行: node test-inventory-flow.js
// 鉴权方式：参考 test-cs-flow.js，从 response header `vendure-auth-token` 取 Bearer token
// 数据验证：使用 pg 客户端直连 PostgreSQL 验证 stockOnHand 变化

const fetch = require('node-fetch');
const { Client } = require('pg');

const ADMIN_API = 'http://localhost:3000/admin-api';

// PostgreSQL 连接配置 (来自 dev-server/.env)
const pgClient = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: 'admin',
    database: 'vendure',
});

// ===== 工具函数 =====

// 统一 GraphQL 请求函数（参考 test-cs-flow.js）
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

// 登录函数：从 response header 取 Bearer token
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

// 简单断言
function assert(condition, message) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// 通过 pg 直查 stockOnHand
async function getStockOnHand(variantId, locationId) {
    const res = await pgClient.query(
        `SELECT "stockOnHand" FROM stock_level WHERE "productVariantId" = $1 AND "stockLocationId" = $2`,
        [variantId, locationId],
    );
    if (res.rows.length === 0) return 0;
    return res.rows[0].stockOnHand;
}

// 通过 pg 设置 stockOnHand（用于恢复）
async function setStockOnHand(variantId, locationId, value) {
    const res = await pgClient.query(
        `SELECT id FROM stock_level WHERE "productVariantId" = $1 AND "stockLocationId" = $2`,
        [variantId, locationId],
    );
    if (res.rows.length === 0) {
        // 行不存在 — 如果 value > 0 则插入，否则跳过
        if (value > 0) {
            await pgClient.query(
                `INSERT INTO stock_level ("stockOnHand", "stockAllocated", "productVariantId", "stockLocationId", "createdAt", "updatedAt") VALUES ($1, 0, $2, $3, NOW(), NOW())`,
                [value, variantId, locationId],
            );
        }
    } else {
        await pgClient.query(
            `UPDATE stock_level SET "stockOnHand" = $1, "updatedAt" = NOW() WHERE "productVariantId" = $2 AND "stockLocationId" = $3`,
            [value, variantId, locationId],
        );
    }
}

// ===== 测试结果收集 =====
const testResults = [];

function recordResult(groupNum, description, passed, error = null) {
    testResults.push({ group: groupNum, description, passed, error });
    if (passed) {
        console.log(`✓ [${groupNum}] ${description}`);
    } else {
        console.log(`✗ [${groupNum}] ${description}`);
        console.log(`    ERROR: ${error?.message || error}`);
    }
}

// ===== 主测试流程 =====

async function main() {
    console.log('=== 库存模块 e2e 验收开始 ===\n');

    await pgClient.connect();
    console.log('✓ PostgreSQL 连接成功\n');

    // 1. 登录所有账号
    console.log('[Setup] 登录账号...');
    const superadminToken = await login('superadmin@china.test', 'superadmin');
    console.log('  ✓ superadmin 登录成功');
    const invToken = await login('inv1@zhao.test', 'a963963');
    console.log('  ✓ inv1@zhao.test 登录成功');
    const salesToken = await login('sales1@zhao.test', 'a963963');
    console.log('  ✓ sales1@zhao.test 登录成功\n');

    // 2. 准备测试数据
    console.log('[Setup] 准备测试数据...');
    // 查询现有 stock locations
    const locData = await gql(
        `query { stockLocations { items { id name } totalItems } }`,
        {}, superadminToken,
    );
    const loc1Id = locData.stockLocations.items[0].id;
    console.log(`  ✓ 主仓库: id=${loc1Id} name=${locData.stockLocations.items[0].name}`);

    // 创建第二个仓库（StockMove 测试需要 source ≠ target）
    let loc2Id;
    try {
        const createLoc = await gql(
            `mutation($input: CreateStockLocationInput!) {
                createStockLocation(input: $input) { id name }
            }`,
            { input: { name: 'Test Secondary Location', description: 'e2e test' } },
            superadminToken,
        );
        loc2Id = createLoc.createStockLocation.id;
        console.log(`  ✓ 创建第二仓库: id=${loc2Id}`);
    } catch (e) {
        // 已存在则查询
        const existing = await gql(
            `query { stockLocations { items { id name } } }`,
            {}, superadminToken,
        );
        loc2Id = existing.stockLocations.items[1]?.id;
        if (!loc2Id) throw new Error('无法创建或获取第二仓库');
        console.log(`  ✓ 使用已存在第二仓库: id=${loc2Id}`);
    }

    // 选取测试 variant — 从 stock_level 表取第一个有库存的
    const variantRes = await pgClient.query(
        `SELECT "productVariantId", "stockOnHand" FROM stock_level WHERE "stockLocationId" = $1 AND "stockOnHand" > 100 ORDER BY "productVariantId" LIMIT 1`,
        [loc1Id],
    );
    const testVariantId = String(variantRes.rows[0].productVariantId);
    console.log(`  ✓ 测试 variant: id=${testVariantId} 当前库存=${variantRes.rows[0].stockOnHand}`);

    // 3. 备份 stockOnHand
    const backupLoc1 = await getStockOnHand(testVariantId, loc1Id);
    const backupLoc2 = await getStockOnHand(testVariantId, loc2Id);
    console.log(`  ✓ 备份库存: loc1=${backupLoc1}, loc2=${backupLoc2}\n`);

    // ===== [1] 角色权限同步验证 =====
    try {
        const roleData = await gql(
            `query { roles(options: { filter: { code: { eq: "inventory-staff" } } }) { items { code permissions } } }`,
            {}, superadminToken,
        );
        const perms = roleData.roles.items[0]?.permissions || [];
        const expected = ['Authenticated', 'ViewStock', 'ManageStockIn', 'ManageStockOut', 'ManageStockMove', 'ManageStocktake'];
        const missing = expected.filter(p => !perms.includes(p));
        assert(missing.length === 0, `缺少权限: ${missing.join(', ')}`);
        recordResult(1, `inventory-staff 角色包含全部 6 个权限 (${perms.join(', ')})`, true);
    } catch (e) {
        recordResult(1, 'inventory-staff 角色权限同步验证', false, e);
    }

    // ===== [2] 库存查询 =====
    try {
        const levels = await gql(
            `query { stockLevels(page: 1, pageSize: 5) { items { id stockOnHand stockAllocated stockLocationId stockLocation { id name } } totalItems } }`,
            {}, invToken,
        );
        assert(levels.stockLevels.totalItems >= 0, 'stockLevels 应返回数据');

        // stockLocations 是核心查询需要 ReadSettings 权限，inventory-staff 没有，用 superadmin 验证
        const locations = await gql(
            `query { stockLocations { items { id name } totalItems } }`,
            {}, superadminToken,
        );
        assert(locations.stockLocations.items.length > 0, 'stockLocations 应返回至少 1 个仓库');
        recordResult(2, `库存查询正常 (stockLevels=${levels.stockLevels.totalItems}条, stockLocations=${locations.stockLocations.totalItems}个)`, true);
    } catch (e) {
        recordResult(2, '库存查询', false, e);
    }

    // ===== [3] StockIn 流程 =====
    try {
        // Create
        const created = await gql(
            `mutation($input: CreateStockInOrderInput!) {
                createStockInOrder(input: $input) { id code state }
            }`,
            { input: { type: 'initial', targetLocationId: loc1Id, lines: [{ productVariantId: testVariantId, quantity: 10 }] } },
            invToken,
        );
        assert(created.createStockInOrder.state === 'Pending', `应为 Pending, 实际: ${created.createStockInOrder.state}`);
        const stockInId = created.createStockInOrder.id;

        const before = await getStockOnHand(testVariantId, loc1Id);

        // Complete
        await gql(`mutation($id: ID!) { completeStockInOrder(id: $id) { id state } }`, { id: stockInId }, invToken);
        const after = await getStockOnHand(testVariantId, loc1Id);
        assert(after === before + 10, `库存应 +10: before=${before}, after=${after}`);

        // Second complete should fail (state machine)
        try {
            await gql(`mutation($id: ID!) { completeStockInOrder(id: $id) { id } }`, { id: stockInId }, invToken);
            throw new Error('应失败但成功了');
        } catch (e) {
            assert(e.message.includes('Invalid state') || e.message.includes('Invalid transition'), `应报状态错误, 实际: ${e.message}`);
        }
        recordResult(3, `StockIn 流程: create → complete (stock +10) → 二次 complete 失败 [${created.createStockInOrder.code}]`, true);
    } catch (e) {
        recordResult(3, 'StockIn 流程', false, e);
    }

    // ===== [4] StockOut 流程 =====
    try {
        // Create + complete with insufficient stock
        const tooMuch = await gql(
            `mutation($input: CreateStockOutOrderInput!) {
                createStockOutOrder(input: $input) { id code }
            }`,
            { input: { type: 'scrap', sourceLocationId: loc1Id, lines: [{ productVariantId: testVariantId, quantity: 99999 }] } },
            invToken,
        );
        try {
            await gql(`mutation($id: ID!) { completeStockOutOrder(id: $id) { id } }`, { id: tooMuch.createStockOutOrder.id }, invToken);
            throw new Error('应失败但成功了');
        } catch (e) {
            assert(e.message.includes('Insufficient stock'), `应报库存不足, 实际: ${e.message}`);
        }
        // Cancel the failed order
        await gql(`mutation($id: ID!) { cancelStockOutOrder(id: $id) { id state } }`, { id: tooMuch.createStockOutOrder.id }, invToken);

        // Create + complete with sufficient stock
        const ok = await gql(
            `mutation($input: CreateStockOutOrderInput!) {
                createStockOutOrder(input: $input) { id code }
            }`,
            { input: { type: 'scrap', sourceLocationId: loc1Id, lines: [{ productVariantId: testVariantId, quantity: 5 }] } },
            invToken,
        );
        const before = await getStockOnHand(testVariantId, loc1Id);
        await gql(`mutation($id: ID!) { completeStockOutOrder(id: $id) { id state } }`, { id: ok.createStockOutOrder.id }, invToken);
        const after = await getStockOnHand(testVariantId, loc1Id);
        assert(after === before - 5, `库存应 -5: before=${before}, after=${after}`);
        recordResult(4, `StockOut 流程: 库存不足失败 → 库存充足完成 (stock -5) [${ok.createStockOutOrder.code}]`, true);
    } catch (e) {
        recordResult(4, 'StockOut 流程', false, e);
    }

    // ===== [5] StockMove 流程 =====
    try {
        const move = await gql(
            `mutation($input: CreateStockMoveOrderInput!) {
                createStockMoveOrder(input: $input) { id code state }
            }`,
            { input: { sourceLocationId: loc1Id, targetLocationId: loc2Id, lines: [{ productVariantId: testVariantId, quantity: 3 }] } },
            invToken,
        );
        const moveId = move.createStockMoveOrder.id;

        // Illegal transition: Pending → Received should fail
        try {
            await gql(`mutation($id: ID!) { receiveStockMoveOrder(id: $id) { id } }`, { id: moveId }, invToken);
            throw new Error('应失败但成功了');
        } catch (e) {
            assert(e.message.includes('Invalid state') || e.message.includes('Invalid transition'), `应报状态错误, 实际: ${e.message}`);
        }

        // ship → receive → complete
        await gql(`mutation($id: ID!) { shipStockMoveOrder(id: $id) { id state } }`, { id: moveId }, invToken);
        await gql(`mutation($id: ID!) { receiveStockMoveOrder(id: $id) { id state } }`, { id: moveId }, invToken);
        await gql(`mutation($id: ID!) { completeStockMoveOrder(id: $id) { id state } }`, { id: moveId }, invToken);
        recordResult(5, `StockMove 流程: create → ship → receive → complete + 非法转换检查 [${move.createStockMoveOrder.code}]`, true);
    } catch (e) {
        recordResult(5, 'StockMove 流程', false, e);
    }

    // ===== [6] StockMove 回滚 =====
    try {
        const move2 = await gql(
            `mutation($input: CreateStockMoveOrderInput!) {
                createStockMoveOrder(input: $input) { id code }
            }`,
            { input: { sourceLocationId: loc1Id, targetLocationId: loc2Id, lines: [{ productVariantId: testVariantId, quantity: 2 }] } },
            invToken,
        );
        const before = await getStockOnHand(testVariantId, loc1Id);
        await gql(`mutation($id: ID!) { shipStockMoveOrder(id: $id) { id state } }`, { id: move2.createStockMoveOrder.id }, invToken);
        const afterShip = await getStockOnHand(testVariantId, loc1Id);
        assert(afterShip === before - 2, `发货后库存应 -2: before=${before}, afterShip=${afterShip}`);

        await gql(`mutation($id: ID!) { cancelStockMoveOrder(id: $id) { id state } }`, { id: move2.createStockMoveOrder.id }, invToken);
        const afterCancel = await getStockOnHand(testVariantId, loc1Id);
        assert(afterCancel === before, `取消后库存应恢复: before=${before}, afterCancel=${afterCancel}`);
        recordResult(6, `StockMove 回滚: ship (-2) → cancel (+2 恢复) [${move2.createStockMoveOrder.code}]`, true);
    } catch (e) {
        recordResult(6, 'StockMove 回滚', false, e);
    }

    // ===== [7] Stocktake 流程 =====
    try {
        const stocktake = await gql(
            `mutation($input: CreateStocktakeOrderInput!) {
                createStocktakeOrder(input: $input) { id code lines { id systemQuantity } }
            }`,
            { input: { locationId: loc1Id, productVariantIds: [testVariantId] } },
            invToken,
        );
        const stocktakeId = stocktake.createStocktakeOrder.id;
        const lineId = stocktake.createStocktakeOrder.lines[0].id;

        await gql(`mutation($id: ID!) { startCountingStocktake(id: $id) { id state lines { systemQuantity } } }`, { id: stocktakeId }, invToken);

        // Submit count — countedQuantity 等于当前系统库存 +1（产生 +1 差异）
        const currentStock = await getStockOnHand(testVariantId, loc1Id);
        const countedQty = currentStock + 1;
        await gql(
            `mutation($id: ID!, $counts: [StocktakeCountInput!]!) {
                submitStocktakeCount(id: $id, counts: $counts) { id state lines { difference } }
            }`,
            { id: stocktakeId, counts: [{ lineId, countedQuantity: countedQty }] },
            invToken,
        );

        // Reconcile line
        await gql(`mutation($orderId: ID!, $lineId: ID!) { reconcileStocktakeLine(orderId: $orderId, lineId: $lineId) { id } }`, { orderId: stocktakeId, lineId }, invToken);

        // Complete
        await gql(`mutation($id: ID!) { completeStocktakeOrder(id: $id) { id state } }`, { id: stocktakeId }, invToken);
        const afterComplete = await getStockOnHand(testVariantId, loc1Id);
        assert(afterComplete === countedQty, `盘点后库存应等于盘点数 ${countedQty}, 实际: ${afterComplete}`);
        recordResult(7, `Stocktake 流程: create → startCounting → submitCount → reconcileLine → complete [${stocktake.createStocktakeOrder.code}]`, true);
    } catch (e) {
        recordResult(7, 'Stocktake 流程', false, e);
    }

    // ===== [8] 权限隔离 =====
    try {
        // inventory-staff 不能调用 salesCreateOrder
        let invBlocked = false;
        try {
            await gql(
                `mutation { salesCreateOrder(input: { lines: [{ productVariantId: "1", quantity: 1 }], shippingAddress: { streetLine1: "test" }, shippingMethodId: "1", salesChannel: store }) { id } }`,
                {}, invToken,
            );
        } catch (e) {
            invBlocked = true;
        }
        assert(invBlocked, 'inventory-staff 不应能调用 salesCreateOrder');

        // sales-staff 不能调用 createStockInOrder
        let salesBlocked = false;
        try {
            await gql(
                `mutation($input: CreateStockInOrderInput!) { createStockInOrder(input: $input) { id } }`,
                { input: { targetLocationId: loc1Id, lines: [{ productVariantId: testVariantId, quantity: 1 }] } },
                salesToken,
            );
        } catch (e) {
            salesBlocked = true;
        }
        assert(salesBlocked, 'sales-staff 不应能调用 createStockInOrder');
        recordResult(8, '权限隔离: inventory-staff 被挡在 sales 之外, sales-staff 被挡在 inventory 之外', true);
    } catch (e) {
        recordResult(8, '权限隔离', false, e);
    }

    // ===== 清理：恢复 stockOnHand =====
    console.log('\n[Cleanup] 恢复库存...');
    try {
        await setStockOnHand(testVariantId, loc1Id, backupLoc1);
        await setStockOnHand(testVariantId, loc2Id, backupLoc2);
        console.log(`  ✓ 库存已恢复: loc1=${backupLoc1}, loc2=${backupLoc2}`);
    } catch (e) {
        console.log(`  ✗ 恢复库存失败: ${e.message}`);
    }

    await pgClient.end();

    // ===== 输出汇总 =====
    console.log('\n=== 测试结果汇总 ===');
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;
    testResults.forEach(r => {
        const status = r.passed ? '✓' : '✗';
        console.log(`  ${status} [${r.group}] ${r.description}`);
    });
    console.log(`\n总计: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('\n=== All inventory e2e tests passed ===');
        process.exit(0);
    } else {
        console.log('\n=== Some inventory e2e tests FAILED ===');
        process.exit(1);
    }
}

main().catch(e => {
    console.error('验收脚本异常:', e.message);
    process.exit(1);
});
