// 阶段37 积分兑换商城 实测
// 流程: 注册shop顾客 → admin加积分 → admin建 pointsPrice 券 → 顾客查积分商城 → 兑换 → 校验
//       积分扣减 + SPEND流水 + 券进账(EXCHANGE) ; 另测积分不足报错
// Usage: node tools/e2e-points-exchange.mjs
const { default: fetch } = await import('node-fetch');
const { execSync } = await import('node:child_process');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';
const EMAIL = `exchange-${Date.now()}@example.com`;
const PWD = 'a963963';

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

async function main() {
    // 预清理上次残留测试数据（幂等，幂等脚本入口）
    try { execSync('node tools/clean-points-exchange.mjs --commit', { stdio: 'inherit', cwd: process.cwd() }); }
    catch (_) { /* 清理失败不阻断主流程 */ }

    console.log('=== 阶段37 积分兑换商城 实测 ===\n');
    // 1. 后台登录
    const login = await adminGql(`mutation Login($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { u: 'superadmin@china.test', p: 'superadmin' });
    const adminToken = login.authToken;
    assert(adminToken, '后台 superadmin 登录成功');
    if (!adminToken) { process.exit(1); }

    // 2. shop 注册顾客 + 登录
    await shopGql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: EMAIL, firstName: '兑换', lastName: '测试', password: PWD } });
    const slogin = await shopGql(`mutation($e:String!,$p:String!){ login(username:$e,password:$p){ ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`, { e: EMAIL, p: PWD });
    const shopToken = slogin.authToken;
    assert(shopToken, `shop 顾客 ${EMAIL} 登录成功`);

    // 3. admin 查到该顾客 id
    const memQuery = await adminGql(`query { members { items { customerId emailAddress points } totalItems } }`, {}, adminToken);
    const member = memQuery.data?.members?.items?.find(m => m.emailAddress === EMAIL);
    assert(member, 'admin 能按邮箱查到该会员');
    if (!member) process.exit(1);
    const customerId = member.customerId;

    // 4. admin 给顾客加 10000 积分
    const seed = await adminGql(`mutation($cid:ID!,$amt:Int!,$rk:String!){ adjustPoints(customerId:$cid, amount:$amt, remark:$rk){ customerId points } }`, { cid: customerId, amt: 10000, rk: 'exchange-e2e-seed' }, adminToken);
    const seedPoints = seed.data?.adjustPoints?.points;
    assert(seedPoints === 10000, `加 10000 积分成功（当前余额=${seedPoints}）`);

    // 5. admin 建 pointsPrice=300 的券
    const tpl = await adminGql(`mutation($i:CreateCouponTemplateInput!){ createCouponTemplate(input:$i){ id name pointsPrice enabled totalCount } }`, { i: { name: '积分兑换测试券', type: 'FIXED', discountValue: 500, minSpend: 0, totalCount: 50, pointsPrice: 300, perUserLimit: 2, enabled: true } }, adminToken);
    const tplId = tpl.data?.createCouponTemplate?.id;
    assert(tplId, `建 pointsPrice=300 券成功（${tplId}）`);

    // 6. 顾客查积分商城，应看到该券
    const mall = await shopGql(`query { pointsMallTemplates { id name pointsPrice int: pointsPrice } }`, {}, shopToken);
    const mallHit = mall.data?.pointsMallTemplates?.find(t => t.id === tplId);
    assert(mallHit?.pointsPrice === 300, '积分商城列表能查到该券(pointsPrice=300)');

    // 7. 兑换前余额
    const before = await shopGql(`query { myMemberInfo { points } }`, {}, shopToken);
    const beforePts = before.data?.myMemberInfo?.points;
    assert(beforePts === 10000, `兑换前积分=${beforePts}`);

    // 8. 兑换
    const ex = await shopGql(`mutation($tid:ID!){ exchangeCouponWithPoints(templateId:$tid){ coupon { id code status issuedBy } spentPoints } }`, { tid: tplId }, shopToken);
    const exData = ex.data?.exchangeCouponWithPoints;
    assert(exData?.spentPoints === 300, `兑换成功：spentPoints=${exData?.spentPoints}`);
    assert(exData?.coupon?.issuedBy === 'EXCHANGE', `券来源 issuedBy=EXCHANGE（实际=${exData?.coupon?.issuedBy}）`);
    assert(exData?.coupon?.status === 'UNUSED', `券状态=UNUSED（实际=${exData?.coupon?.status}）`);

    // 9. 兑换后余额扣减
    const after = await shopGql(`query { myMemberInfo { points } }`, {}, shopToken);
    const afterPts = after.data?.myMemberInfo?.points;
    assert(afterPts === 10000 - 300, `兑换后积分扣减 9700（实际=${afterPts}）`);

    // 10. 我的券进账
    const mine = await shopGql(`query($s:CouponStatus){ myCoupons(status:$s){ code status issuedBy } }`, { s: 'UNUSED' }, shopToken);
    const got = mine.data?.myCoupons?.some(c => c.issuedBy === 'EXCHANGE');
    assert(got, '我的券列表含 EXCHANGE 券');

    // 11. SPEND 流水
    const hist = await shopGql(`query { myPointsHistory { items { type amount remark balanceAfter } totalItems } }`, {}, shopToken);
    const spend = hist.data?.myPointsHistory?.items?.find(it => it.type === 'spend' && it.remark?.includes('积分兑换测试券'));
    assert(!!spend && spend.amount === -300 && spend.balanceAfter === 9700, `SPEND 流水正确（amount=${spend?.amount}, balanceAfter=${spend?.balanceAfter}）`);

    // 12. 积分不足报错
    const poorEmail = `poor-${Date.now()}@example.com`;
    await shopGql(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: poorEmail, firstName: '穷', lastName: '测试', password: PWD } });
    const plogin = await shopGql(`mutation($e:String!,$p:String!){ login(username:$e,password:$p){ ... on CurrentUser { id } } }`, { e: poorEmail, p: PWD });
    const poorToken = plogin.authToken;
    const poorM = await adminGql(`query { members { items { customerId emailAddress } } }`, {}, adminToken);
    const poorCustId = poorM.data.members.items.find(m => m.emailAddress === poorEmail).customerId;
    await adminGql(`mutation($cid:ID!,$amt:Int!,$rk:String!){ adjustPoints(customerId:$cid, amount:$amt, remark:$rk){ points } }`, { cid: poorCustId, amt: 100, rk: 'poor-seed' }, adminToken);
    try {
        await shopGql(`mutation($tid:ID!){ exchangeCouponWithPoints(templateId:$tid){ coupon { id } spentPoints } }`, { tid: tplId }, poorToken);
        assert(false, '积分不足应抛错');
    } catch (e) {
        assert(/Insufficient|积分|insufficient/i.test(e.message), `积分不足正确拦截（${e.message}）`);
    }

    // 13. 兑换后该顾客券数未增加（回滚校验：积分不足时不发券）
    const poorMine = await shopGql(`query { myCoupons { id } }`, {}, poorToken);
    assert((poorMine.data?.myCoupons?.length ?? 0) === 0, '积分不足失败时不发券（无回滚脏数据）');

    console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
    // 收尾清理本次实测数据
    try { execSync('node tools/clean-points-exchange.mjs --commit', { stdio: 'inherit', cwd: process.cwd() }); }
    catch (_) { console.log('(收尾清理未完全成功，可手动运行 tools/clean-points-exchange.mjs --commit)'); }
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.body); process.exit(1); });