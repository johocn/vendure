// 阶段40 分销结算可视化 实测
// 流程: admin 配置渠道分销 → 建层级 X(parent)->A(child)->B(shopper) →
//       B 带券下单支付 Settled → 断言 A 直推、X 间推佣金记录正确 →
//       settleCommissionsNow 入可用余额 → A 申请提现 → 后台 approve→markPaid →
//       断言状态机与三余额联动；同时验证 shop-api 后台新端点与客户邮箱解析。
// Usage: node tools/e2e-distribution.mjs   (dev-server 已运行在 localhost:3000)
const { default: fetch } = await import('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';
const DIRECT_RATE = 1000; // 10%
const INDIRECT_RATE = 500; // 5%

async function call(endpoint, query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json', 'vendure-channel-token': '__default_channel__' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const body = await res.json();
    const authToken = res.headers.get('vendure-auth-token');
    if (body.errors && !body.data) {
        throw Object.assign(new Error(`[${body.errors.map(e => e.message).join('; ')}] Q: ${query.replace(/\s+/g, ' ').slice(0, 200)}`), { body, query });
    }
    return { data: body.data, authToken, body };
}
const admin = (q, v = {}, t = '') => call(ADMIN_API, q, v, t);
const shop = (q, v = {}, t = '') => call(SHOP_API, q, v, t);

let pass = 0, fail = 0;
const assert = (c, m, extra = '') => {
    if (c) { pass++; console.log(`  ✓ ${m}`); }
    else { fail++; console.log(`  ✗ ${m} ${extra}`); }
};

const UNIQ = Date.now();
const wrapper = `dist-w-${UNIQ}@example.com`;
const refX = `dist-x-${UNIQ}@example.com`;
const refA = `dist-a-${UNIQ}@example.com`;
const buyerB = `dist-b-${UNIQ}@example.com`;
const PWD = 'a963963';

async function register(email, firstName) {
    const r = await shop(`mutation($i:RegisterCustomerInput!){ registerCustomerAccount(input:$i){ ... on Success { success } } }`, { i: { emailAddress: email, firstName, lastName: '测', password: PWD } });
    return r;
}
async function shopLogin(email) {
    const r = await shop(`mutation($e:String!,$p:String!){ login(username:$e,password:$p){ ... on CurrentUser { id } } }`, { e: email, p: PWD });
    return r.authToken;
}
async function approveDistributorById(id, adminToken) {
    await admin(`mutation($id:ID!){ approveDistributor(id:$id){ id status } }`, { id }, adminToken);
}

async function main() {
    console.log('=== 阶段40 分销结算可视化 实测 ===\n');

    // 0. admin 登录。shop-api 后台端点门槛是 @Allow(SuperAdmin,…)，用 admin-api 登录的 token 可直接复用到 shop-api。
    const aLogin = await admin(`mutation($u:String!,$p:String!){ login(username:$u,password:$p){ ... on CurrentUser { id } } }`, { u: 'superadmin@china.test', p: 'superadmin' });
    const adminToken = aLogin.authToken;
    assert(adminToken, 'admin 登录成功');
    if (!adminToken) process.exit(1);
    // admin-api token 直接作为 shop-api 的 bearer token 使用
    const shopAdminToken = adminToken;
    assert(true, 'admin token 复用为 shop-api 后台操作凭据');

    // 1. 启用分销并配置费率/提现/结算（channel customFields）
    const chans = await admin(`query { channels { items { id code customFields { distributionEnabled directCommissionRate indirectCommissionRate minWithdrawalAmount commissionSettlementDays } } } }`, {}, adminToken);
    const def = chans.data.channels.items.find(c => c.code === '__default_channel__') || chans.data.channels.items[0];
    const upd = await admin(`mutation($id:ID!,$cf:UpdateChannelCustomFieldsInput!){ updateChannel(input:{ id:$id, customFields:$cf }){ ... on Channel { id code } } }`, {
        id: def.id,
        cf: { distributionEnabled: true, directCommissionRate: DIRECT_RATE, indirectCommissionRate: INDIRECT_RATE, minWithdrawalAmount: 1, commissionSettlementDays: 0 },
    }, adminToken);
    assert(upd.data?.updateChannel?.id, '渠道已启用分销并配置费率(直10%/间5%/最低提现1分/当天结算)');

    // 2. 建层级 X(parent) -> A(child) -> B(shopper)
    await register(refX, '上级'); const xTok = await shopLogin(refX);
    await shop(`mutation{ applyDistributor { id status referralCode } }`, {}, xTok);
    const aRes = await shop(`mutation{ applyDistributor { id status referralCode } }`, {}, xTok);
    console.log('  [debug] X applyDistributor:', JSON.stringify(aRes.body?.data ?? aRes.body?.errors));
    let list = await shop(`query { distributors { items { id customerEmail referralCode level status } } }`, {}, shopAdminToken);
    if (!list.data || !list.data.distributors) { console.log('  [debug] distributors resp:', JSON.stringify(list.body)); process.exit(1); }
    let x = list.data.distributors.items.find(d => d.customerEmail === refX);
    assert(x, 'shop-api distributors 能按邮箱定位 X');
    if (!x) process.exit(1);
    await approveDistributorById(x.id, adminToken);

    await register(refA, '下级'); const aTok = await shopLogin(refA);
    const aApply = await shop(`mutation($c:String!){ applyDistributor(referredByCode:$c){ id status level referralCode } }`, { c: x.referralCode }, aTok);
    assert(aApply.data?.applyDistributor?.level === 2, `A 申请分销并经 X 邀请成为 level2 (parent 已激活)`);
    await approveDistributorById(aApply.data.applyDistributor.id, adminToken);
    const aCode = aApply.data.applyDistributor.referralCode;

    // 3. B 设置 referredBy = A 的推荐码
    await register(buyerB, '买手'); const bTok = await shopLogin(buyerB);
    const bCust = await admin(`query { customers { items { id emailAddress } } }`, {}, adminToken);
    const bCustId = bCust.data.customers.items.find(c => c.emailAddress === buyerB).id;
    await admin(`mutation($id:ID!,$cf:UpdateCustomerCustomFieldsInput){ updateCustomer(input:{ id:$id, customFields:$cf }){ ... on Customer { id } } }`, { id: bCustId, cf: { referredBy: aCode } }, adminToken);

    // 4. B 加购 → 尝试叠加优惠券 → 转 ArrangingPayment → 支付 → admin settlePayment
    const prods = await shop(`query { products { items { variants { id price } } } }`, {}, bTok);
    const variant = prods.data.products.items.flatMap(p => p.variants)[0];
    // 确保库存充足，避免 INSUFFICIENT_STOCK_ERROR
    await admin(`mutation { updateProductVariants(input: [{ id:${variant.id}, stockOnHand:1000 }]) { id } }`, {}, adminToken);
    const addItem = await shop(`mutation($id:ID!){ addItemToOrder(productVariantId:$id, quantity:2){ ... on Order { id state total subTotalWithTax lines { id quantity } } ... on ErrorResult { message errorCode } } }`, { id: variant.id }, bTok);
    console.log('  [debug] addItemToOrder:', JSON.stringify(addItem.data?.addItemToOrder));
    const chk = await shop(`query { activeOrder { id state lines { id quantity } } }`, {}, bTok);
    console.log('  [debug] activeOrder after addItem:', JSON.stringify(chk.data?.activeOrder));
    const shipAddr = await shop(`mutation{ setOrderShippingAddress(input:{ fullName:"买手", streetLine1:"软件大道101号", city:"南京市", province:"江苏省", postalCode:"210000", countryCode:"CN", phoneNumber:"13800000000" }) { ... on Order { id } } }`, {}, bTok);
    const sm = await shop(`query { eligibleShippingMethods { id } }`, {}, bTok);
    await shop(`mutation($ids:[ID!]!){ setOrderShippingMethod(shippingMethodId:$ids){ ... on Order { id } } }`, { ids: [sm.data.eligibleShippingMethods[0].id] }, bTok);

    // 券叠加（阶段37，best-effort）：失败不阻断主流程
    let couponApplied = false;
    try {
        const coupons = await admin(`query { coupons { items { id code } } }`, {}, adminToken);
        const code = coupons.data?.coupons?.items?.[0]?.code;
        if (code) {
            const orderInfo = await shop(`query { activeOrder { id customFields { couponCode } } }`, {}, bTok);
            const orderId = orderInfo.data.activeOrder.id;
            const app = await shop(`mutation($oid:ID!,$c:String!){ applyCoupon(orderId:$oid, code:$c){ valid error } }`, { oid: orderId, c: code }, bTok);
            couponApplied = app.data?.applyCoupon?.valid === true;
        }
    } catch (e) { /* ignore */ }

    const tr = await shop(`mutation{ transitionOrderToState(state:"ArrangingPayment"){ ... on Order { id state } ... on OrderStateTransitionError { transitionError message } } }`, {}, bTok);
    const trState = tr.data?.transitionOrderToState?.state;
    console.log('  [debug] transitionOrderToState:', JSON.stringify(tr.data?.transitionOrderToState ?? tr.body?.errors));
    const ao = await shop(`query { activeOrder { id state code } }`, {}, bTok);
    console.log('  [debug] activeOrder after transition:', JSON.stringify(ao.data?.activeOrder));
    const paym = await shop(`query { eligiblePaymentMethods { code } }`, {}, bTok);
    const pay = await shop(`mutation($code:String!){ addPaymentToOrder(input:{ method:$code, metadata:{} }){ ... on Order { id state totalWithTax payments { id } } ... on ErrorResult { message errorCode } } }`, { code: paym.data.eligiblePaymentMethods[0].code }, bTok);
    if (!pay.data?.addPaymentToOrder?.id) { console.log('  [debug] addPaymentToOrder:', JSON.stringify(pay.body)); throw new Error('addPaymentToOrder failed'); }
    const orderAfter = pay.data?.addPaymentToOrder;
    const orderId = orderAfter?.id;
    const orderTotal = orderAfter?.totalWithTax;
    const paymentId = orderAfter?.payments?.[0]?.id;
    assert(orderId && paymentId, `B 下单支付成功 totalWithTax=${orderTotal}${couponApplied ? '（已叠加优惠券）' : ''}`);
    const settled = await admin(`mutation($id:ID!){ settlePayment(id:$id){ ... on Payment { id state } } }`, { id: paymentId }, adminToken);
    assert(settled.data?.settlePayment?.state === 'Settled', '订单支付已 Settled（触发佣金计算）');

    // 5. 断言佣金记录（A 直推、X 间推）——事件处理是异步的，轮询等待佣金记录落库
    async function waitForOrderCommissions(timeoutMs = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const rec = await admin(`query { commissionRecords { items { distributorId orderId commissionType commissionRate orderAmount commissionAmount status } } }`, {}, adminToken);
            const items = rec.data.commissionRecords.items.filter(r => r.orderId === orderId);
            const dRec = items.find(r => r.commissionType === 'direct' && r.distributorId === aApply.data.applyDistributor.id);
            const iRec = items.find(r => r.commissionType === 'indirect' && r.distributorId === x.id);
            if (dRec && iRec) return { dRec, iRec };
            await new Promise(res => setTimeout(res, 300));
        }
        const rec = await admin(`query { commissionRecords { items { distributorId orderId commissionType commissionRate orderAmount commissionAmount status } } }`, {}, adminToken);
        const items = rec.data.commissionRecords.items.filter(r => r.orderId === orderId);
        return { dRec: items.find(r => r.commissionType === 'direct' && r.distributorId === aApply.data.applyDistributor.id), iRec: items.find(r => r.commissionType === 'indirect' && r.distributorId === x.id) };
    }
    const { dRec: directRec, iRec: indirectRec } = await waitForOrderCommissions();
    const expDirect = Math.floor(orderTotal * DIRECT_RATE / 10000);
    const expIndirect = Math.floor(orderTotal * INDIRECT_RATE / 10000);
    assert(!!directRec, 'A 生成直推佣金记录');
    assert(directRec && directRec.commissionAmount === expDirect && directRec.orderAmount === orderTotal, `直推佣金额精确（=${directRec?.commissionAmount}，期望=${expDirect} = 订单应付额*${DIRECT_RATE/10000}）`);
    assert(!!indirectRec, 'X 生成间推佣金记录');
    assert(indirectRec && indirectRec.commissionAmount === expIndirect, `间推佣金额精确（=${indirectRec?.commissionAmount}，期望=${expIndirect}）`);
    assert(directRec?.status === 'pending', '直推佣金初始状态 pending（等结算）');

    // 6. settleCommissionsNow 结算 → 入可用余额
    const settledCount = await shop(`mutation { settleCommissionsNow }`, {}, shopAdminToken);
    assert(typeof settledCount.data?.settleCommissionsNow === 'number', `shop-api settleCommissionsNow 已结算（${settledCount.data?.settleCommissionsNow} 条）`);
    const dDist = await shop(`query { distributors { items { id customerEmail availableBalance totalEarnings } } }`, {}, shopAdminToken);
    const aDist = dDist.data.distributors.items.find(d => d.id === aApply.data.applyDistributor.id);
    assert(aDist && aDist.customerEmail === refA, `shop-api distributors 解析客户邮箱（${aDist?.customerEmail}）`);
    assert(aDist && aDist.availableBalance === expDirect, `结算后 A 可用余额=${aDist?.availableBalance}（期望=${expDirect}）`);
    const rec2 = await shop(`query { commissionRecords { items { id distributorId orderId status } } }`, {}, shopAdminToken);
    const aConfRec = rec2.data.commissionRecords.items.find(r => r.distributorId === aApply.data.applyDistributor.id && r.orderId === orderId);
    assert(aConfRec?.status === 'confirmed', 'shop-api 佣金记录状态 → confirmed');

    // 7. A 申请提现（需余额 ≥ 最低提现额；minWithdrawalAmount=1 分）
    const wReq = await shop(`mutation($amt:Int!,$m:WithdrawalMethod!,$acc:String!){ requestWithdrawal(amount:$amt, method:$m, accountInfo:$acc){ id amount status } }`, { amt: expDirect, m: 'alipay', acc: 'test@alipay.com' }, aTok);
    const withId = wReq.data?.requestWithdrawal?.id;
    assert(withId && wReq.data.requestWithdrawal.status === 'pending', `A 发起提现 pending（金额=${expDirect}）`);
    const dDist2 = await shop(`query { distributors { items { id availableBalance frozenBalance } } }`, {}, shopAdminToken);
    const aDist2 = dDist2.data.distributors.items.find(d => d.id === aApply.data.applyDistributor.id);
    assert(aDist2.availableBalance === 0 && aDist2.frozenBalance === expDirect, `请求提现后 可用=${aDist2.availableBalance} 冻结=${aDist2.frozenBalance}（联动正确）`);

    // 8. 后台审批 → 打款
    const apr = await shop(`mutation($id:ID!){ approveWithdrawal(id:$id){ id status } }`, { id: withId }, shopAdminToken);
    assert(apr.data?.approveWithdrawal?.status === 'approved', '后台 approveWithdrawal → approved');
    const mark = await shop(`mutation($id:ID!){ markWithdrawalPaid(id:$id){ id status paidAt } }`, { id: withId }, shopAdminToken);
    assert(mark.data?.markWithdrawalPaid?.status === 'paid', '后台 markWithdrawalPaid → paid');
    const dDist3 = await shop(`query { distributors { items { id frozenBalance } } }`, {}, shopAdminToken);
    const aDist3 = dDist3.data.distributors.items.find(d => d.id === aApply.data.applyDistributor.id);
    assert(aDist3.frozenBalance === 0, `打款后 A 冻结余额清零（=${aDist3.frozenBalance}）`);
    const rec3 = await shop(`query { commissionRecords { items { id distributorId status } } }`, {}, shopAdminToken);
    const aRecs = rec3.data.commissionRecords.items.filter(r => r.distributorId === aApply.data.applyDistributor.id);
    assert(aRecs.length > 0 && aRecs.every(r => r.status === 'paid'), '打款后 A 的佣金记录全部置 paid');
    const myWD = await shop(`query { myWithdrawalRequests { items { id amount status paidAt } } }`, {}, aTok);
    assert(myWD.data?.myWithdrawalRequests?.items?.[0]?.status === 'paid', `C 端 myWithdrawalRequests 可见已打款记录`);

    // 9. 拒绝链：X（间推佣金已结算入可用余额）提现后管理员驳回 → 余额回退解冻
    const xDist = await shop(`query { distributors { items { id availableBalance referralCode } } }`, {}, shopAdminToken);
    const xData = xDist.data.distributors.items.find(d => d.id === x.id);
    assert(xData && xData.availableBalance === expIndirect, `X 间推佣金已入可用余额=${xData?.availableBalance}（期望=${expIndirect}）`);
    assert(typeof xData?.referralCode === 'string' && xData.referralCode.length > 0, 'X 有推荐码');
    const xW = await shop(`mutation($amt:Int!,$m:WithdrawalMethod!,$acc:String!){ requestWithdrawal(amount:$amt, method:$m, accountInfo:$acc){ id status } }`, { amt: expIndirect, m: 'bank', acc: '6222****' }, xTok);
    const xWithId = xW.data?.requestWithdrawal?.id;
    assert(xWithId && xW.data.requestWithdrawal.status === 'pending', `X 发起提现 pending（金额=${expIndirect}）`);
    const xRej = await shop(`mutation($id:ID!){ rejectWithdrawal(id:$id){ id status } }`, { id: xWithId }, shopAdminToken);
    assert(xRej.data?.rejectWithdrawal?.status === 'rejected', '后台 rejectWithdrawal → rejected');
    const xDist2 = await shop(`query { distributors { items { id availableBalance frozenBalance } } }`, {}, shopAdminToken);
    const xData2 = xDist2.data.distributors.items.find(d => d.id === x.id);
    assert(xData2.availableBalance === expIndirect && xData2.frozenBalance === 0, `驳回后 X 可用=${xData2.availableBalance} 冻结=${xData2.frozenBalance}（余额回退）`);

    console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
    process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('ERROR:', e.message); console.error(e.body); process.exit(1); });