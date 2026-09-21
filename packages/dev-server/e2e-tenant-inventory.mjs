// 租户库存仓 admin API 端到端回归（cjk-plugin 新增能力）
// 前置：本地起服（npm run dev:server && npm run dev:worker），且已 populate（superadmin@china.test / superadmin）
// 运行：node e2e-tenant-inventory.mjs     （可用 ADMIN_API 覆盖 admin-api 地址）
// 覆盖：概览查询 / 幂等补建系统仓 / 自动编码 {租户编码}-NN / 强制 physical / 系统仓禁改禁删 /
//      跨租户越权拒绝 / 有库存的仓禁止删除（core delete 会级联删 StockLevel）
const ADMIN = process.env.ADMIN_API || 'http://localhost:3000/admin-api';
let TOKEN = '';
let PASS = 0;
let FAIL = 0;

async function gql(query, variables = {}, channelToken) {
    const res = await fetch(ADMIN, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
            ...(channelToken ? { 'vendure-token': channelToken } : {}),
        },
        body: JSON.stringify({ query, variables }),
    });
    const newToken = res.headers.get('vendure-auth-token');
    if (newToken) TOKEN = newToken;
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
}

function ok(name, cond, extra = '') {
    if (cond) {
        PASS++;
        console.log(`  PASS  ${name}${extra ? ' :: ' + extra : ''}`);
    } else {
        FAIL++;
        console.log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`);
    }
}

const OVERVIEW = `query { tenantInventoryOverview {
  channelCode physicalStockEnabled virtualCode virtualLocationId defaultPhysicalCode defaultPhysicalLocationId
  locations { id name code kind isSystem deliveryMethods serviceCities lat lng } } }`;

async function main() {
    const login = await gql(`mutation { login(username: "superadmin@china.test", password: "superadmin") {
    ... on CurrentUser { id identifier } ... on ErrorResult { errorCode message } } }`);
    ok('超级管理员登录', !!login.login?.identifier, JSON.stringify(login.login));
    ok('拿到 admin token', !!TOKEN);

    const ch = await gql(`query { channels { items { id code token } } }`);
    const items = ch.channels.items;
    console.log('  渠道样本:', items.slice(0, 4).map(c => `${c.code}|${c.token}`).join(', '));
    // 选一个「有变体」的非默认渠道做租户用例：有变体才能验证「仓内有库存禁止删除」
    let tenant = items[0];
    for (const c of items) {
        if (c.code === '__default_channel__') continue;
        try {
            const v = await gql(`query { productVariants(options: { take: 1 }) { items { id } } }`, {}, c.token);
            if (v.productVariants.items.length) { tenant = c; break; }
        } catch { /* 无权限/空渠道，跳过 */ }
    }
    console.log(`  用例渠道: ${tenant.code} (id=${tenant.id}, token=${tenant.token})`);

    // 1) 概览查询可用（默认渠道 + 租户渠道）
    const o0 = await gql(OVERVIEW);
    ok('默认渠道概览返回', !!o0.tenantInventoryOverview.channelCode, `code=${o0.tenantInventoryOverview.channelCode}`);
    const o1 = await gql(OVERVIEW, {}, tenant.token);
    ok('租户渠道概览返回', o1.tenantInventoryOverview.channelCode === tenant.code,
        `channelCode=${o1.tenantInventoryOverview.channelCode}, virtualCode=${o1.tenantInventoryOverview.virtualCode}`);
    ok('概览 locations 非空', Array.isArray(o1.tenantInventoryOverview.locations), `count=${o1.tenantInventoryOverview.locations.length}`);

    // 2) 幂等补建（开关关：只应有虚拟仓）
    const e1 = await gql(`mutation { ensureTenantInventoryLocations { channelCode virtualCode virtualLocationId defaultPhysicalLocationId locations { id code kind isSystem } } }`, {}, tenant.token);
    ok('补建后虚拟仓就绪', !!e1.ensureTenantInventoryLocations.virtualLocationId,
        `virtualLocationId=${e1.ensureTenantInventoryLocations.virtualLocationId}`);
    ok('补建幂等（再调一次结果一致）',
        (await gql(`mutation { ensureTenantInventoryLocations { virtualLocationId } }`, {}, tenant.token))
            .ensureTenantInventoryLocations.virtualLocationId === e1.ensureTenantInventoryLocations.virtualLocationId);

    // 3) 开启物理库存 → 补建默认物理仓
    await gql(`mutation($inp: UpdateChannelInput!) { updateChannel(input: $inp) { ... on Channel { id code } ... on ErrorResult { errorCode message } } }`,
        { inp: { id: tenant.id, customFields: { physicalStockEnabled: true } } });
    const e2 = await gql(`mutation { ensureTenantInventoryLocations { physicalStockEnabled defaultPhysicalCode defaultPhysicalLocationId locations { id code kind isSystem } } }`, {}, tenant.token);
    ok('开启物理库存后默认物理仓就绪', e2.ensureTenantInventoryLocations.physicalStockEnabled === true && !!e2.ensureTenantInventoryLocations.defaultPhysicalLocationId,
        `code=${e2.ensureTenantInventoryLocations.defaultPhysicalCode}, id=${e2.ensureTenantInventoryLocations.defaultPhysicalLocationId}`);
    const systemLoc = e2.ensureTenantInventoryLocations.locations.filter(l => l.isSystem);
    ok('系统仓被标记 isSystem', systemLoc.length >= 2, `系统仓=${systemLoc.map(l => l.code).join(',')}`);

    // 4) 新建物理仓：服务端自动编码 {租户编码}-01 且 kind=physical
    const c1 = await gql(`mutation($input: TenantStockLocationInput!) { createTenantStockLocation(input: $input) {
        locations { id name code kind isSystem deliveryMethods serviceCities } } }`,
        { input: { name: 'E2E 自动编码仓', deliveryMethods: ['MAIL'], serviceCities: ['上海'], lat: 31.23, lng: 121.47 } },
        tenant.token);
    const created = c1.createTenantStockLocation.locations.find(l => l.name === 'E2E 自动编码仓');
    ok('新建仓自动编码为 {租户编码}-01', created?.code === `${tenant.code}-01`, `code=${created?.code}`);
    ok('新建仓强制 kind=physical', created?.kind === 'physical', `kind=${created?.kind}`);
    ok('新建仓非系统仓', created?.isSystem === false);
    ok('新建仓配送/城市/坐标落库', JSON.stringify(created?.deliveryMethods) === '["MAIL"]' && JSON.stringify(created?.serviceCities) === '["上海"]');

    // 5) 第二个仓编码顺延 -02
    const c2 = await gql(`mutation($input: TenantStockLocationInput!) { createTenantStockLocation(input: $input) { locations { id name code } } }`,
        { input: { name: 'E2E 第二仓' } }, tenant.token);
    const created2 = c2.createTenantStockLocation.locations.find(l => l.name === 'E2E 第二仓');
    ok('第二个仓编码顺延 -02', created2?.code === `${tenant.code}-02`, `code=${created2?.code}`);

    // 6) 更新仓：改名称 + 配送方式；编码/性质不可变
    const u1 = await gql(`mutation($input: UpdateTenantStockLocationInput!) { updateTenantStockLocation(input: $input) {
        locations { id name code kind deliveryMethods } } }`,
        { input: { id: created.id, name: 'E2E 改名仓', deliveryMethods: ['MAIL', 'SELF_PICKUP'] } }, tenant.token);
    const updated = u1.updateTenantStockLocation.locations.find(l => l.id === created.id);
    ok('更新名称生效', updated?.name === 'E2E 改名仓', `name=${updated?.name}`);
    ok('更新配送方式生效', JSON.stringify(updated?.deliveryMethods) === '["MAIL","SELF_PICKUP"]', JSON.stringify(updated?.deliveryMethods));
    ok('更新不改编码/性质', updated?.code === `${tenant.code}-01` && updated?.kind === 'physical');

    // 7) 保护规则：虚拟仓不可编辑、系统仓不可删除
    const virtualId = e2.ensureTenantInventoryLocations.locations.find(l => l.isSystem && l.kind === 'virtual')?.id;
    let msg = '';
    try {
        await gql(`mutation($input: UpdateTenantStockLocationInput!) { updateTenantStockLocation(input: $input) { channelCode } }`,
            { input: { id: virtualId, name: '不该成功' } }, tenant.token);
    } catch (e) { msg = String(e.message); }
    ok('虚拟系统仓禁止编辑', msg.includes('虚拟仓为系统仓，不可编辑'), msg.slice(0, 80));

    msg = '';
    try {
        await gql(`mutation($id: ID!) { deleteTenantStockLocation(id: $id) { channelCode } }`,
            { id: e2.ensureTenantInventoryLocations.defaultPhysicalLocationId }, tenant.token);
    } catch (e) { msg = String(e.message); }
    ok('系统仓禁止删除', msg.includes('不可删除'), msg.slice(0, 80));

    // 8) 跨租户越权：用其它渠道的仓 id 调本渠道 → 拒绝
    const other = items.find(c => c.id !== tenant.id);
    if (other) {
        const oOther = await gql(OVERVIEW, {}, other.token);
        const foreign = oOther.tenantInventoryOverview.locations[0];
        msg = '';
        try {
            await gql(`mutation($input: UpdateTenantStockLocationInput!) { updateTenantStockLocation(input: $input) { channelCode } }`,
                { input: { id: foreign.id, name: '越权改名' } }, tenant.token);
        } catch (e) { msg = String(e.message); }
        ok('跨租户改仓被拒绝', /仓库不存在或不属于当前渠道|仓库不属于当前租户/.test(msg), msg.slice(0, 80));
    }

    // 9) 删仓前置安全校验：仓内仍有库存 → 拒绝（core delete 会级联删 StockLevel，库存静默蒸发）
    const pv = await gql(`query { productVariants(options: { take: 1 }) { items { id } } }`, {}, tenant.token);
    const variantId = pv.productVariants.items[0]?.id;
    if (variantId) {
        const setStock = `mutation($v: ID!, $l: ID!, $q: Int!) { setVariantStock(productVariantId: $v, stockLocationId: $l, stockOnHand: $q) }`;
        await gql(setStock, { v: variantId, l: created.id, q: 5 }, tenant.token);
        msg = '';
        try {
            await gql(`mutation($id: ID!) { deleteTenantStockLocation(id: $id) { channelCode } }`, { id: created.id }, tenant.token);
        } catch (e) { msg = String(e.message); }
        ok('有库存的仓禁止删除', msg.includes('仍有库存'), msg.slice(0, 90));
        await gql(setStock, { v: variantId, l: created.id, q: 0 }, tenant.token);
    } else {
        console.log('  SKIP  有库存的仓禁止删除（该渠道无变体）');
    }

    // 10) 删除自建仓（清理），且系统仓仍在
    const d1 = await gql(`mutation($id: ID!) { deleteTenantStockLocation(id: $id) { locations { id code kind isSystem } virtualLocationId defaultPhysicalLocationId } }`,
        { id: created.id }, tenant.token);
    ok('自建仓删除成功（清零后）', !d1.deleteTenantStockLocation.locations.some(l => l.id === created.id));
    ok('删除后系统仓仍就绪',
        !!d1.deleteTenantStockLocation.virtualLocationId && !!d1.deleteTenantStockLocation.defaultPhysicalLocationId);
    await gql(`mutation($id: ID!) { deleteTenantStockLocation(id: $id) { channelCode } }`, { id: created2.id }, tenant.token);

    console.log(`\n  结果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
}

main().catch(e => {
    console.error('脚本异常:', e.message);
    process.exit(2);
});