// 阶段39 会员等级权益结算落地 实测
// 流程: admin登录 → 幂等 saveTiers 配置档位折扣率 → 幂等 createPromotion(tier_discount) →
//       gold顾客(成长值6000=level3) 加购 → 断言结算含等级折扣; 普通顾客(成长值0) → 断言无等级折扣
// Usage: node tools/e2e-tier-settlement.mjs   (dev-server 已运行在 localhost:3000)
const { default: fetch } = await import('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

async function call(endpoint, query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    const authToken = res.headers.get('vendure-auth-token');
    if (body.errors && !body.data) {
        throw Object.assign(new Error(body.errors.map(e => e.message).join('; ')), { body });
    }
    return { data: body.data, authToken, body };
}
const adminGql = (q, v = {}, t = '') => call(ADMIN_API, q, v, t);
const shopGql = (q, v = {}, t = '') => call(SHOP_API, q, v, t);

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };

// 档位折扣率（千分比：100=9折/10%优惠；金卡95折=50）
function tierItems() {
    return [
        '{ tierLevel: 1, threshold: 0, name: "普通会员", pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 }',
        '{ tierLevel: 2, threshold: 1000, name: "银卡会员", pointsMultiplier: 1000, redeemDiscountRate: 1000, redeemCapRatio: 500, specialDiscountRate: 0 }',
        '{ tierLevel: 3, threshold: 5000, name: "金卡会员", pointsMultiplier: 1200, redeemDiscountRate: 1500, redeemCapRatio: 600, specialDiscountRate: 50 }',
        '{ tierLevel: 4, threshold: 20000, name: "白金会员", pointsMultiplier: 1500, redeemDiscountRate: 2000, redeemCapRatio: 800, specialDiscountRate: 100 }',
        '{ tierLevel: 5, threshold: 100000, name: "钻石会员", pointsMultiplier: 2000, redeemDiscountRate: 3000, redeemCapRatio: 1000, specialDiscountRate: 150 }',
    ].join(' ');
}

async function main() {
    console.log('=== 阶段39 会员等级权益结算落地 实测 ===\n');

    // 1. admin 登录
    const login = await adminGql(`mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { u: 'superadmin@china.test', p: 'superadmin' });
    const adminToken = login.authToken;
    assert(adminToken, 'admin superadmin 登录成功');
    if (!adminToken) process.exit(1);

    // 2. 幂等配置档位折扣率（saveTiers upsert）
    const tiers = await adminGql(`mutation { saveTiers(input: [${tierItems()}]) { id tierLevel specialDiscountRate } }`, {}, adminToken);
    const goldTier = tiers.data?.saveTiers?.find((t) => t.tierLevel === 3);
    assert(goldTier?.specialDiscountRate === 50, `档位折扣率已配置：金卡 specialDiscountRate=${goldTier?.specialDiscountRate}（期望50=95折）`);

    // 3. 幂等创建「金卡及以上专属95折」Promotion（tier_eligible minLevel=3 + tier_discount）
    const promos = await adminGql(`query { promotions { items { id name } } }`, {}, adminToken);
    let tierPromo = promos.data?.promotions?.items?.find(p => p.name === '金卡及以上专属95折');
    if (!tierPromo) {
        const created = await adminGql(`mutation { createPromotion(input: {
            enabled: true
            translations: [{ languageCode: zh_Hans, name: "金卡及以上专属95折", description: "会员等级专属折扣（阶段39）" }]
            conditions: [{ code: "tier_eligible", arguments: [{ name: "minLevel", value: "3" }] }]
            actions: [{ code: "tier_discount", arguments: [] }]
        }) { ... on Promotion { id name } ... on ErrorResult { message } } }`, {}, adminToken);
        tierPromo = created.data?.createPromotion;
        assert(tierPromo?.id, `等级折扣 Promotion 已创建（${tierPromo?.name ?? '失败'}）`);
    } else {
        assert(true, `等级折扣 Promotion 已存在（${tierPromo.name}）`);
    }
    if (!tierPromo?.id) process.exit(1);

    // 4. 取一个商品 variant
    const prods = await shopGql(`query { products { items { variants { id sku price } } } }`);
    const variant = prods.data?.products?.items?.flatMap(p => p.variants)[0];
    assert(variant, '能取到商品 variant');
    if (!variant) process.exit(1);

    // ---------- 场景A：金卡顾客（level3，成长值6000）应享专属折扣 ----------
    console.log('\n[场景A] 金卡顾客(level3) 结算应享专属折扣');
    const goldEmail = `tier-gold-${Date.now()}@example.com`;
    const PWD = 'a963963';
    await shopGql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: goldEmail, firstName: '金卡', lastName: '测试', password: PWD } });
    const gLogin = await shopGql(`mutation($e:String!,$p:String!){ login(username:$e,password:$p){ ... on CurrentUser { id } } }`, { e: goldEmail, p: PWD });
    const goldToken = gLogin.authToken;
    assert(goldToken, `gold 顾客登录成功`);
    const gM = await adminGql(`query { members { items { customerId emailAddress } } }`, {}, adminToken);
    const goldCustId = gM.data.members.items.find(m => m.emailAddress === goldEmail).customerId;
    await adminGql(`mutation($cid:ID!,$amt:Int!,$src:String!){ adjustMemberGrowth(customerId:$cid, amount:$amt, source:$src){ level levelName growthValue specialDiscountRate } }`, { cid: goldCustId, amt: 6000, src: 'tier-e2e' }, adminToken);
    const gTier = await shopGql(`query { myTier { level levelName } }`, {}, goldToken);
    assert(gTier.data?.myTier?.level === 3, `gold 档位=level3 金卡会员（实际=${gTier.data?.myTier?.levelName}）`);

    const gAdd = await shopGql(`mutation($id:ID!){ addItemToOrder(productVariantId:$id, quantity:2){ ... on Order { id subTotalWithTax totalWithTax } ... on ErrorResult { errorCode message } } }`, { id: variant.id }, goldToken);
    const gOrder = gAdd.data?.addItemToOrder;
    assert(gOrder?.subTotalWithTax > 0, `加购成功 subTotalWithTax=${gOrder?.subTotalWithTax}`);
    const gDetail = await shopGql(`query { activeOrder { subTotalWithTax totalWithTax discounts { amountWithTax description } } }`, {}, goldToken);
    const gDisc = gDetail.data?.activeOrder?.discounts ?? [];
    const tierDisc = gDisc.find(d => d.amountWithTax < 0 && d.description === '金卡及以上专属95折');
    assert(!!tierDisc, `金卡结算含等级折扣（来源=${tierDisc?.description}，amountWithTax=${tierDisc?.amountWithTax}）`);
    assert(tierDisc && tierDisc.amountWithTax < 0, `金卡等级折扣为负值（已生效）`);

    // ---------- 场景B：普通顾客（level1，成长值0）不应享专属折扣 ----------
    console.log('\n[场景B] 普通顾客(level1) 结算不应享等级折扣');
    const normalEmail = `tier-normal-${Date.now()}@example.com`;
    await shopGql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: normalEmail, firstName: '普通', lastName: '测试', password: PWD } });
    const nLogin = await shopGql(`mutation($e:String!,$p:String!){ login(username:$e,password:$p){ ... on CurrentUser { id } } }`, { e: normalEmail, p: PWD });
    const normalToken = nLogin.authToken;
    assert(normalToken, `normal 顾客登录成功`);
    const nAdd = await shopGql(`mutation($id:ID!){ addItemToOrder(productVariantId:$id, quantity:2){ ... on Order { id subTotalWithTax totalWithTax } ... on ErrorResult { errorCode message } } }`, { id: variant.id }, normalToken);
    const nOrder = nAdd.data?.addItemToOrder;
    assert(nOrder?.subTotalWithTax > 0, `加购成功 subTotalWithTax=${nOrder?.subTotalWithTax}`);
    const nDetail = await shopGql(`query { activeOrder { subTotalWithTax totalWithTax discounts { amountWithTax description } } }`, {}, normalToken);
    const nDiscs = nDetail.data?.activeOrder?.discounts ?? [];
    const normalDiscount = nDiscs.find(d => d.amountWithTax < 0);
    assert(!normalDiscount, '普通会员无等级折扣（未误伤低等级新客）');

    // 收尾：取消测试订单
    await shopGql(`mutation { removeAllOrderLines { ... on Order { id } } }`, {}, goldToken).catch(() => {});
    await shopGql(`mutation { removeAllOrderLines { ... on Order { id } } }`, {}, normalToken).catch(() => {});

    console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.body); process.exit(1); });