/**
 * 第二阶段回归验证：5 项「待后端支持」缺陷（F-VS-06/07/08/09、F-WA-08）
 *
 * 运行前提：dev-server 已在本地 3000 端口启动（postgres）。
 *   cd packages/dev-server && npm run dev:server
 * 运行：node verify-audit-fixes.cjs
 *
 * 覆盖：
 *   T1 F-VS-09 shop-api uploadCustomerAsset（multipart 上传 + MIME 拒绝）
 *   T2 F-VS-06 createRechargeOrder 面额上下限
 *   T3 F-VS-07 requestWithdrawal 原子条件扣减（并发仅一笔成功）
 *   T4 F-WA-08 admin-api adjustOrderPrice（上限/状态/总额非负 + 正常改价）
 *   T5 F-VS-08 resolveCustomerOpenid 模块级三级回落接线
 */
const { Client } = require('pg');

const API = process.env.API_BASE || 'http://localhost:3000';
const SHOP = API + '/shop-api';
const ADMIN = API + '/admin-api';
const CHANNEL_TOKEN = process.env.CHANNEL_TOKEN || 'default-token';
// 凭据一律走环境变量（本脚本只针对本地 dev-server；线上凭据禁止硬编码）
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'superadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superadmin';
const CUSTOMER_EMAIL = process.env.AUDIT_CUSTOMER_EMAIL || 'audit-verify@example.com';
const CUSTOMER_PASSWORD = process.env.AUDIT_CUSTOMER_PASSWORD || 'Audit#2026';
const DB = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_NAME || 'vendure',
};

const results = [];
function record(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function gqlRequest(endpoint, { query, variables, cookie, token, isShop }) {
    const headers = { 'Content-Type': 'application/json' };
    if (isShop) headers['vendure-token'] = CHANNEL_TOKEN;
    if (cookie) headers['Cookie'] = cookie;
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const sessionParts = setCookies
        .map(c => c.split(';')[0])
        .filter(p => p.startsWith('session=') || p.startsWith('session.sig='));
    const body = await res.json().catch(() => ({}));
    return {
        body,
        authToken: res.headers.get('vendure-auth-token') || '',
        cookie: sessionParts.length ? sessionParts.join('; ') : '',
    };
}

/** 会话：自动维护 cookie 与 vendure-auth-token */
function makeSession(endpoint, isShop) {
    const state = { cookie: '', token: '' };
    return {
        state,
        async gql(query, variables) {
            const r = await gqlRequest(endpoint, {
                query, variables, cookie: state.cookie, token: state.token, isShop,
            });
            if (r.cookie) state.cookie = r.cookie;
            if (r.authToken) state.token = r.authToken;
            return r.body;
        },
    };
}

function errText(body) {
    return (body?.errors || []).map(e => e.message).join(' | ');
}

// 1x1 透明 PNG
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
);

async function uploadMultipart(session, filename, mime, buffer) {
    const fd = new FormData();
    fd.append('operations', JSON.stringify({
        query: `mutation UploadCustomerAsset($file: Upload!) {
            uploadCustomerAsset(file: $file) { id source preview mimeType width height }
        }`,
        variables: { file: null },
    }));
    fd.append('map', JSON.stringify({ '0': ['variables.file'] }));
    fd.append('0', new Blob([buffer], { type: mime }), filename);
    const headers = { 'vendure-token': CHANNEL_TOKEN };
    if (session.state.token) headers['Authorization'] = 'Bearer ' + session.state.token;
    if (session.state.cookie) headers['Cookie'] = session.state.cookie;
    const res = await fetch(SHOP, { method: 'POST', headers, body: fd });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const tok = res.headers.get('vendure-auth-token');
    if (tok) session.state.token = tok;
    const parts = setCookies.map(c => c.split(';')[0]).filter(p => p.startsWith('session='));
    if (parts.length) session.state.cookie = parts.join('; ');
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { errors: [{ message: 'non-json: ' + text.slice(0, 200) }] };
    }
}

const ADMIN_ORDER_FIELDS = 'id code state totalWithTax';

async function main() {
    // ---------- 0. 后端 schema 检查：4 组新增 customFields 列 ----------
    const pg = new Client(DB);
    await pg.connect();
    const colRows = await pg.query(
        `select table_name, column_name from information_schema.columns
         where column_name in ('customFieldsRechargeminamount','customFieldsRechargemaxamount',
                               'customFieldsOrderadjustmaxratebp','customFieldsOrderadjustmaxamount')
         order by column_name`,
    );
    record(
        'F-VS-06/F-WA-08 渠道 customFields 列已建',
        colRows.rows.length === 4,
        colRows.rows.map(r => `${r.table_name}.${r.column_name}`).join(', ') || '缺列',
    );

    // ---------- 1. 登录 ----------
    const admin = makeSession(ADMIN, false);
    const adminLogin = await admin.gql(
        `mutation { login(username: "${ADMIN_USERNAME}", password: "${ADMIN_PASSWORD}") { ... on CurrentUser { id identifier } ... on ErrorResult { message } } }`,
    );
    const adminOk = !!adminLogin.data?.login?.identifier;
    record('admin-api 登录', adminOk, adminOk ? adminLogin.data.login.identifier : errText(adminLogin));
    if (!adminOk) return finish();

    const shop = makeSession(SHOP, true);
    // 用「注册 + 原生登录」拿客户会话（dev 配置 requireVerification:false，注册后即可登录）
    const email = CUSTOMER_EMAIL;
    const password = CUSTOMER_PASSWORD;
    await shop.gql(
        `mutation { registerCustomerAccount(input: { emailAddress: "${email}", firstName: "Audit", lastName: "Verify", password: "${password}" }) { ... on Success { success } ... on ErrorResult { message } } }`,
    );
    const shopLogin = await shop.gql(
        `mutation { login(username: "${email}", password: "${password}") { ... on CurrentUser { id identifier } ... on ErrorResult { message } } }`,
    );
    const profile = await shop.gql(`query { activeCustomer { id } }`);
    const customerId = profile.data?.activeCustomer?.id;
    record(
        'shop-api 客户登录',
        !!shopLogin.data?.login?.identifier && !!customerId,
        customerId ? `${shopLogin.data.login.identifier} (customer ${customerId})` : JSON.stringify(shopLogin),
    );
    if (!customerId) return finish();

    // ---------- T1 F-VS-09 上传 ----------
    const upOk = await uploadMultipart(shop, 'audit-pass.png', 'image/png', PNG);
    const asset = upOk.data?.uploadCustomerAsset;
    record(
        'F-VS-09 上传图片成功（返回绝对 URL）',
        !!asset?.source && /^https?:\/\//.test(asset.source),
        asset ? `${asset.id} ${asset.source} ${asset.width}x${asset.height}` : errText(upOk),
    );

    const upBad = await uploadMultipart(shop, 'audit-reject.txt', 'text/plain', Buffer.from('not an image'));
    const rejectMsg = errText(upBad) || JSON.stringify(upBad.data?.uploadCustomerAsset);
    record('F-VS-09 非图片 MIME 被拒绝', !!errText(upBad) && !upBad.data?.uploadCustomerAsset, rejectMsg);

    // ---------- T2 F-VS-06 充值面额 ----------
    const rechargeQuery = `mutation C($amount: Int!) { createRechargeOrder(amount: $amount) { id amount status } }`;
    const rLow = await shop.gql(rechargeQuery, { amount: 50 });
    record('F-VS-06 低于下限被拒', !!errText(rLow), errText(rLow) || JSON.stringify(rLow.data));

    const rHigh = await shop.gql(rechargeQuery, { amount: 99999999 });
    record('F-VS-06 高于上限被拒', !!errText(rHigh), errText(rHigh) || JSON.stringify(rHigh.data));

    const rOk = await shop.gql(rechargeQuery, { amount: 10000 });
    record(
        'F-VS-06 区间内下单成功',
        !!rOk.data?.createRechargeOrder?.id,
        rOk.data?.createRechargeOrder ? JSON.stringify(rOk.data.createRechargeOrder) : errText(rOk),
    );

    // ---------- T3 F-VS-07 并发提现 ----------
    const applyRes = await shop.gql(
        `mutation { applyDistributor { id status availableBalance frozenBalance } }`,
    );
    const distributorId = applyRes.data?.applyDistributor?.id;
    record('F-VS-07 分销商就绪', !!distributorId, distributorId || errText(applyRes));

    if (distributorId) {
        const distTable = (await pg.query(
            `select table_name from information_schema.tables where table_name in ('distributor')`,
        )).rows[0]?.table_name;
        const cols = (await pg.query(
            `select column_name from information_schema.columns where table_name = $1`,
            [distTable],
        )).rows.map(r => r.column_name);
        const availCol = cols.find(c => c.toLowerCase() === 'availablebalance');
        const frozenCol = cols.find(c => c.toLowerCase() === 'frozenbalance');
        // 夹具：余额设为 20000 分（= 2 笔 10000 分提现）
        await pg.query(
            `update "${distTable}" set "${availCol}" = 20000, "${frozenCol}" = 0 where id = $1`,
            [distributorId],
        );

        const wdQuery = `mutation W($amount: Int!, $method: WithdrawalMethod!, $accountInfo: String!) {
            requestWithdrawal(amount: $amount, method: $method, accountInfo: $accountInfo) { id amount status }
        }`;
        const wdVars = { amount: 10000, method: 'bank', accountInfo: '测试账户 6222****' };

        const badZero = await shop.gql(wdQuery, { ...wdVars, amount: 0 });
        record('F-VS-07 金额为 0 被拒', !!errText(badZero), errText(badZero));

        const badMin = await shop.gql(wdQuery, { ...wdVars, amount: 5000 });
        record('F-VS-07 低于渠道起提额被拒', !!errText(badMin), errText(badMin));

        // 并发 5 笔，余额只够 2 笔
        const concurrent = await Promise.all(
            Array.from({ length: 5 }, () => shop.gql(wdQuery, wdVars)),
        );
        const okCount = concurrent.filter(r => r.data?.requestWithdrawal?.id).length;
        const insufficient = concurrent.filter(r => /Insufficient/i.test(errText(r))).length;
        const balanceAfter = (await pg.query(
            `select "${availCol}" as avail, "${frozenCol}" as frozen from "${distTable}" where id = $1`,
            [distributorId],
        )).rows[0];
        const pendingCount = Number((await pg.query(
            `select count(*)::int as c from "${(await pg.query(`select table_name from information_schema.tables where table_name like 'withdrawal%'`)).rows[0]?.table_name}" where "distributorId" = $1`,
            [distributorId],
        )).rows[0].c);

        record(
            'F-VS-07 并发提现只放行余额可覆盖的笔数',
            okCount === 2 && balanceAfter.avail === 0 && Number(balanceAfter.frozen) === 20000,
            `成功 ${okCount}/5，余额不足 ${insufficient} 笔；余额 ${balanceAfter.avail}，冻结 ${balanceAfter.frozen}，累计提现单 ${pendingCount}`,
        );

        // ---------- T3b 提现审核状态机守卫：重复 reject 不得二次回补余额 ----------
        const wdTable = (await pg.query(
            `select table_name from information_schema.tables where table_name like 'withdrawal%'`,
        )).rows[0]?.table_name;
        const targetId = (await pg.query(
            `select id from "${wdTable}" where "distributorId" = $1 and status = 'pending' order by id asc limit 1`,
            [distributorId],
        )).rows[0]?.id;
        const readBalance = async () => (await pg.query(
            `select "${availCol}" as avail, "${frozenCol}" as frozen from "${distTable}" where id = $1`,
            [distributorId],
        )).rows[0];

        if (!targetId) {
            record('提现审核 找到待审提现单', false, '并发提现未产生 pending 单据');
        } else {
            const rejQuery = `mutation R($id: ID!) { rejectWithdrawal(id: $id) { id status amount } }`;

            const first = await admin.gql(rejQuery, { id: targetId });
            const afterFirst = await readBalance();
            record(
                '提现审核 首次 reject 成功且余额回补一次',
                first.data?.rejectWithdrawal?.status === 'rejected' &&
                    Number(afterFirst.avail) === 10000 && Number(afterFirst.frozen) === 10000,
                `${first.data?.rejectWithdrawal?.status ?? errText(first)}；余额 ${afterFirst.avail}，冻结 ${afterFirst.frozen}（期望 10000/10000）`,
            );

            for (let i = 0; i < 3; i++) {
                await admin.gql(rejQuery, { id: targetId });
            }
            const again = await admin.gql(rejQuery, { id: targetId });
            const afterAgain = await readBalance();
            record(
                '提现审核 重复 reject 被拒且余额不再变动',
                !!errText(again) &&
                    Number(afterAgain.avail) === Number(afterFirst.avail) &&
                    Number(afterAgain.frozen) === Number(afterFirst.frozen),
                `${errText(again) || '未报错'}；余额 ${afterAgain.avail}，冻结 ${afterAgain.frozen}`,
            );

            const paidAfterReject = await admin.gql(
                `mutation P($id: ID!) { markWithdrawalPaid(id: $id) { id status } }`,
                { id: targetId },
            );
            record(
                '提现审核 已驳回单据不能再标记打款',
                !!errText(paidAfterReject),
                errText(paidAfterReject) || JSON.stringify(paidAfterReject.data),
            );

            const doubleApprove = await admin.gql(
                `mutation A($id: ID!) { approveWithdrawal(id: $id) { id status } }`,
                { id: targetId },
            );
            record(
                '提现审核 已驳回单据不能再通过',
                !!errText(doubleApprove),
                errText(doubleApprove) || JSON.stringify(doubleApprove.data),
            );
        }
    }

    // ---------- T4 F-WA-08 后台改价 ----------
    const ordersRes = await admin.gql(
        `query { orders(options: { take: 50, sort: { id: DESC } }) { items { ${ADMIN_ORDER_FIELDS} } } }`,
    );
    const adjustable = (ordersRes.data?.orders?.items || []).find(o =>
        ['Modifying', 'AddingItems', 'ArrangingPayment'].includes(o.state),
    );
    record(
        'F-WA-08 找到可改价订单',
        !!adjustable,
        adjustable ? `${adjustable.code} state=${adjustable.state} total=${adjustable.totalWithTax}` : '无（可先在前台创建订单）',
    );

    if (adjustable) {
        const adjQuery = `mutation A($input: AdjustOrderPriceInput!) { adjustOrderPrice(input: $input) { id totalWithTax } }`;

        const zero = await admin.gql(adjQuery, { input: { orderId: adjustable.id, amount: 0 } });
        record('F-WA-08 差额为 0 被拒', !!errText(zero), errText(zero));

        const tooBig = await admin.gql(adjQuery, {
            input: { orderId: adjustable.id, amount: 99999999, note: 'audit-over-limit' },
        });
        record('F-WA-08 超出渠道上限被拒', !!errText(tooBig), errText(tooBig));

        const ok = await admin.gql(adjQuery, {
            input: { orderId: adjustable.id, amount: 100, note: 'audit-verify' },
        });
        const newTotal = ok.data?.adjustOrderPrice?.totalWithTax;
        record(
            'F-WA-08 正常改价 +1.00 元生效',
            newTotal === adjustable.totalWithTax + 100,
            `原 ${adjustable.totalWithTax} → 新 ${newTotal ?? errText(ok)}`,
        );

        const neg = await admin.gql(adjQuery, {
            input: { orderId: adjustable.id, amount: -100, note: 'audit-revert' },
        });
        record(
            'F-WA-08 降价（负差额）可回退',
            neg.data?.adjustOrderPrice?.totalWithTax === adjustable.totalWithTax,
            `回退后 ${neg.data?.adjustOrderPrice?.totalWithTax ?? errText(neg)}（期望 ${adjustable.totalWithTax}）`,
        );

        const negativeTotal = await admin.gql(adjQuery, {
            input: { orderId: adjustable.id, amount: -(adjustable.totalWithTax + 100000), note: 'audit-negative' },
        });
        record('F-WA-08 改价致总额为负被拒', !!errText(negativeTotal), errText(negativeTotal));
    }

    // ---------- T5 F-VS-08 openid 回落 ----------
    try {
        const wp = require('@vendure/wechatpay-plugin');
        const wired = typeof wp.resolveCustomerOpenid === 'function' && typeof wp.setWechatpayServiceRef === 'function';
        const noRef = await wp.resolveCustomerOpenid({}, '1');
        wp.setWechatpayServiceRef({ resolveCustomerOpenid: async (_ctx, id, opts) => `profile-openid:${id}:${opts?.preferMini}` });
        const resolved = await wp.resolveCustomerOpenid({}, '7', { preferMini: true });
        wp.setWechatpayServiceRef({ resolveCustomerOpenid: async () => { throw new Error('boom'); } });
        const swallowed = await wp.resolveCustomerOpenid({}, '7');
        wp.setWechatpayServiceRef(null);
        record(
            'F-VS-08 openid 推导接线（未注册→undefined / 已注册→委派 / 异常→吞掉不阻断）',
            wired && noRef === undefined && resolved === 'profile-openid:7:true' && swallowed === undefined,
            `wired=${wired}, noRef=${noRef}, resolved=${resolved}, swallowed=${swallowed}`,
        );
    } catch (e) {
        record('F-VS-08 openid 推导接线', false, e.message);
    }

    // 客户档案 openid 字段可读写（推导的数据来源）
    const cfRes = await admin.gql(
        `query { customers(options: { take: 1, filter: { id: { eq: "${customerId}" } } }) { items { id customFields { wechatOpenid wechatMiniOpenid } } } }`,
    );
    const cfOk = !!cfRes.data?.customers?.items?.[0];
    record(
        'F-VS-08 客户档案携带 wechatOpenid/wechatMiniOpenid 字段',
        cfOk,
        cfOk ? JSON.stringify(cfRes.data.customers.items[0].customFields) : errText(cfRes),
    );

    await pg.end();
    finish();
}

function finish() {
    const failed = results.filter(r => !r.ok);
    console.log('\n================ 汇总 ================');
    console.log(`通过 ${results.length - failed.length}/${results.length}`);
    if (failed.length) {
        console.log('失败项：');
        failed.forEach(f => console.log(`  - ${f.name}: ${f.detail}`));
    }
    process.exit(failed.length ? 1 : 0);
}

main().catch(e => {
    console.error('脚本异常:', e);
    process.exit(1);
});
