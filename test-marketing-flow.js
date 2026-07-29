const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';

const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
const MARKETING_STAFF = { username: 'marketing1@zhao.test', password: 'a963963' };

let stepCounter = 0;
const results = [];

function log(msg) { console.log(`[Step ${++stepCounter}] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); results.push({ ok: true, msg }); }
function fail(msg, err) {
    console.error(`  ✗ ${msg}`);
    if (err) console.error('    ', err?.message ?? err);
    results.push({ ok: false, msg, err: err?.message ?? String(err) });
}

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
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { message }
            }
        }`,
        { username, password },
    );
    if (!data.__authToken) throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== 运营 P2 营销聚合模块 E2E 验收 ===\n');

    const now = new Date();
    const startAt = new Date(now.getTime() - 3600000).toISOString();
    const endAt = new Date(now.getTime() + 86400000).toISOString();
    const productId = 1;
    const variantId = 1;

    // 1. 超管登录
    log('超管登录');
    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    ok('admin token acquired');

    // 2. 验证权限同步
    log('验证 operations-staff 角色权限');
    const rolesData = await gql(
        `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { code permissions } } }`,
        {},
        adminToken,
    );
    const opsRole = rolesData.roles.items[0];
    if (!opsRole) { fail('operations-staff 角色不存在'); throw new Error('role missing'); }
    const requiredPerms = ['ManageFlashSale', 'ManageGroupBuy', 'ManageCoupon'];
    const missing = requiredPerms.filter(p => !opsRole.permissions.includes(p));
    if (missing.length > 0) { fail(`缺少权限: ${missing.join(', ')}`); throw new Error('perm missing'); }
    ok(`权限完整: ${requiredPerms.join(', ')}`);

    // 3. 营销总览
    log('查询营销总览');
    const overview = await gql(
        `query { marketingOverview { flashSale { active upcoming ended } groupBuy { active upcoming ended } coupon { active upcoming ended } } }`,
        {},
        adminToken,
    );
    ok(`FlashSale: active=${overview.marketingOverview.flashSale.active}`);
    ok(`GroupBuy: active=${overview.marketingOverview.groupBuy.active}`);
    ok(`Coupon: active=${overview.marketingOverview.coupon.active}`);

    // 4. 闪购 CRUD
    log('闪购 CRUD - 创建');
    let flashSaleId;
    try {
        const created = await gql(
            `mutation CreateFlashSale($input: CreateFlashSaleInput!) {
                createFlashSale(input: $input) { id name status }
            }`,
            { input: { name: 'E2E测试闪购', startAt, endAt, flashPrice: 9900, totalStock: 100, limitPerUser: 1, productId, variantId } },
            adminToken,
        );
        flashSaleId = created.createFlashSale.id;
        ok(`闪购创建: id=${flashSaleId}, status=${created.createFlashSale.status}`);
    } catch (e) { fail('闪购创建失败', e); throw e; }

    log('闪购 CRUD - 查询');
    const fsDetail = await gql(
        `query MarketingFlashSaleActivity($id: ID!) { marketingFlashSaleActivity(id: $id) { id name flashPrice totalStock status } }`,
        { id: flashSaleId },
        adminToken,
    );
    ok(`闪购查询: name=${fsDetail.marketingFlashSaleActivity.name}`);

    log('闪购 CRUD - 更新');
    const fsUpdated = await gql(
        `mutation UpdateFlashSale($input: UpdateFlashSaleInput!) {
            updateFlashSale(input: $input) { id name limitPerUser }
        }`,
        { input: { id: flashSaleId, name: 'E2E测试闪购-改', limitPerUser: 3 } },
        adminToken,
    );
    ok(`闪购更新: name=${fsUpdated.updateFlashSale.name}, limitPerUser=${fsUpdated.updateFlashSale.limitPerUser}`);

    // 5. 拼团 CRUD
    log('拼团 CRUD - 创建');
    let groupBuyId;
    try {
        const created = await gql(
            `mutation CreateGroupBuy($input: CreateGroupBuyInput!) {
                createGroupBuy(input: $input) { id name status }
            }`,
            { input: { name: 'E2E测试拼团', description: '测试', targetCount: 3, startAt, endAt, groupPrice: 8800, leaderDiscount: 500, leaderRewardType: 'discount', autoConfirm: true, productId, variantId, rewardRules: [{ excessCount: 1, rewardType: 'discount', rewardValue: 100 }] } },
            adminToken,
        );
        groupBuyId = created.createGroupBuy.id;
        ok(`拼团创建: id=${groupBuyId}`);
    } catch (e) { fail('拼团创建失败', e); throw e; }

    log('拼团 CRUD - 查询');
    const gbDetail = await gql(
        `query MarketingGroupBuyActivity($id: ID!) { marketingGroupBuyActivity(id: $id) { id name rewardRules targetCount } }`,
        { id: groupBuyId },
        adminToken,
    );
    ok(`拼团查询: name=${gbDetail.marketingGroupBuyActivity.name}, rewardRules存在=${!!gbDetail.marketingGroupBuyActivity.rewardRules}`);

    log('拼团 CRUD - 更新');
    const gbUpdated = await gql(
        `mutation UpdateGroupBuy($input: UpdateGroupBuyInput!) {
            updateGroupBuy(input: $input) { id name targetCount }
        }`,
        { input: { id: groupBuyId, name: 'E2E测试拼团-改', targetCount: 5 } },
        adminToken,
    );
    ok(`拼团更新: name=${gbUpdated.updateGroupBuy.name}, targetCount=${gbUpdated.updateGroupBuy.targetCount}`);

    // 6. 优惠券 CRUD（注意：mutation 名带 marketing 前缀，input 类型为 MarketingCreateCouponInput）
    log('优惠券 CRUD - 创建');
    let couponId;
    try {
        const created = await gql(
            `mutation MarketingCreateCoupon($input: MarketingCreateCouponInput!) {
                marketingCreateCoupon(input: $input) { id name }
            }`,
            { input: { name: 'E2E测试券', description: '测试', couponType: 'fixed', discountValue: 1000, minSpend: 5000, startAt, endAt, totalQuantity: 100, limitPerUser: 1, applicableProductIds: [productId] } },
            adminToken,
        );
        couponId = created.marketingCreateCoupon.id;
        ok(`优惠券创建: id=${couponId}`);
    } catch (e) { fail('优惠券创建失败', e); throw e; }

    log('优惠券 CRUD - 查询');
    const cpDetail = await gql(
        `query MarketingCoupon($id: ID!) { marketingCoupon(id: $id) { id name couponType discountValue applicableProductIds } }`,
        { id: couponId },
        adminToken,
    );
    ok(`优惠券查询: name=${cpDetail.marketingCoupon.name}, type=${cpDetail.marketingCoupon.couponType}`);

    log('优惠券 CRUD - 更新');
    const cpUpdated = await gql(
        `mutation MarketingUpdateCoupon($id: ID!, $input: MarketingUpdateCouponInput!) {
            marketingUpdateCoupon(id: $id, input: $input) { id name }
        }`,
        { id: couponId, input: { name: 'E2E测试券-改' } },
        adminToken,
    );
    ok(`优惠券更新: name=${cpUpdated.marketingUpdateCoupon.name}`);

    // 7. 优惠券渠道启停
    log('优惠券渠道启停');
    try {
        const enabled = await gql(
            `mutation MarketingEnableCouponForChannel($id: ID!) { marketingEnableCouponForChannel(id: $id) { id enabledInCurrentChannel } }`,
            { id: couponId },
            adminToken,
        );
        ok(`启用渠道: enabledInCurrentChannel=${enabled.marketingEnableCouponForChannel.enabledInCurrentChannel}`);
        const disabled = await gql(
            `mutation MarketingDisableCouponForChannel($id: ID!) { marketingDisableCouponForChannel(id: $id) { id enabledInCurrentChannel } }`,
            { id: couponId },
            adminToken,
        );
        ok(`停用渠道: enabledInCurrentChannel=${disabled.marketingDisableCouponForChannel.enabledInCurrentChannel}`);
    } catch (e) { fail('渠道启停失败', e); }

    // 8. 权限隔离 - 用 marketing1 测试
    log('权限隔离测试');
    const staffToken = await login(MARKETING_STAFF.username, MARKETING_STAFF.password);
    ok('marketing1 登录成功');

    // marketing1 有 ManageFlashSale，应该能创建
    try {
        const fsByStaff = await gql(
            `mutation CreateFlashSale($input: CreateFlashSaleInput!) { createFlashSale(input: $input) { id } }`,
            { input: { name: 'staff创建闪购', startAt, endAt, flashPrice: 5000, totalStock: 50, limitPerUser: 1, productId, variantId } },
            staffToken,
        );
        ok(`marketing1 可创建闪购（有 ManageFlashSale）: id=${fsByStaff.createFlashSale.id}`);
        // 清理
        await gql(`mutation DeleteFlashSale($id: ID!) { deleteFlashSale(id: $id) }`, { id: fsByStaff.createFlashSale.id }, adminToken);
    } catch (e) {
        fail('marketing1 创建闪购失败（不应失败）', e);
    }

    // 9. 数据清理
    log('数据清理');
    try {
        await gql(`mutation DeleteFlashSale($id: ID!) { deleteFlashSale(id: $id) }`, { id: flashSaleId }, adminToken);
        ok('闪购已删除');
    } catch (e) { fail('闪购删除失败', e); }
    try {
        await gql(`mutation DeleteGroupBuy($id: ID!) { deleteGroupBuy(id: $id) }`, { id: groupBuyId }, adminToken);
        ok('拼团已删除');
    } catch (e) { fail('拼团删除失败', e); }
    try {
        await gql(`mutation MarketingDeleteCoupon($id: ID!) { marketingDeleteCoupon(id: $id) }`, { id: couponId }, adminToken);
        ok('优惠券已删除');
    } catch (e) { fail('优惠券删除失败', e); }

    // 结果汇总
    console.log('\n=== Results: ' + results.filter(r => r.ok).length + ' passed, ' + results.filter(r => !r.ok).length + ' failed ===');
    if (results.some(r => !r.ok)) process.exit(1);
}

main().catch(e => {
    console.error('验收失败:', e.message);
    process.exit(1);
});
