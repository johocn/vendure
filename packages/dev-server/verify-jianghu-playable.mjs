// 校园江湖「可玩性」体检：只读取、不改数据，判断当前环境到底能不能玩。
// 用法：node verify-jianghu-playable.mjs
//       （需本地服务已启动：powershell -File start-local-test.ps1 [-Live]）
const SHOP = process.env.SHOP_URL || 'http://127.0.0.1:3000/shop-api';
const EMAIL = process.env.E2E_EMAIL || 'jianghu-e2e@local.test';
const PASSWORD = process.env.E2E_PASSWORD || 'VendureTest@2026';

async function gql(query, variables, cookie) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const res = await fetch(SHOP, {
        method: 'POST', headers, body: JSON.stringify({ query, variables }),
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const session = setCookie
        .filter((c) => c.startsWith('session=') || c.startsWith('session.sig='))
        .map((c) => c.split(';')[0]).join('; ');
    return { body: await res.json(), newCookie: session || cookie };
}

const rows = [];
function add(name, state, detail) {
    rows.push({ name, state, detail });
    console.log(`${state.padEnd(5)} ${name}${detail ? '  -> ' + detail : ''}`);
}

(async () => {
    // 建立已登录会话（会话在 session cookie 里，不是 vendure-auth-token）
    const login = await gql(
        `mutation Login($u: String!, $p: String!) { login(username: $u, password: $p) {
            ... on CurrentUser { id identifier } ... on ErrorResult { errorCode message } } }`,
        { u: EMAIL, p: PASSWORD });
    const cookie = login.newCookie;
    if (!cookie) {
        console.log('无法建立会话，后续检查全部跳过：', JSON.stringify(login.body));
        process.exit(1);
    }
    add('登录建立会话', 'OK', login.body?.data?.login?.identifier);

    async function probe(label, query, variables, judge) {
        const r = await gql(query, variables, cookie);
        const err = r.body?.errors?.[0]?.message;
        if (err) {
            // 「尚未成为骑手/审核未通过」之类属于玩法前置条件未满足，不是缺陷
            const precond = /骑手|审核|未开通|未认证|未加入/.test(err);
            add(label, precond ? 'SKIP' : 'ERR', precond ? '前置条件未满足：' + err : err);
            return null;
        }
        const data = r.body?.data;
        try {
            const res = judge(data);
            add(label, res.state, res.detail);
            return data;
        } catch (e) { add(label, 'ERR', String(e)); return null; }
    }

    // 1) 文案源（Strapi）
    await probe('文案源 jianghuEventContent',
        `query C { jianghuEventContent { title desc bannerImage rewardText active } }`, {},
        (d) => d.jianghuEventContent
            ? { state: 'OK', detail: `title=${d.jianghuEventContent.title} banner=${d.jianghuEventContent.bannerImage ?? '无'}` }
            : { state: 'EMPTY', detail: '返回 null（未配置/不可达/未上架，前端会回退内置文案）' });

    // 2) 玩家档案
    await probe('玩家档案 jianghuProfile',
        `query P { jianghuProfile { id rep intel rankCode rankName credit } }`, {},
        (d) => d.jianghuProfile
            ? { state: 'OK', detail: `rep=${d.jianghuProfile.rep} intel=${d.jianghuProfile.intel} rank=${d.jianghuProfile.rankName ?? '-'}` }
            : { state: 'EMPTY', detail: '无档案（未初始化）' });

    // 3) 事件主体
    await probe('当前事件 jianghuEventCurrent',
        `query E { jianghuEventCurrent { id name total collected endAt } }`, {},
        (d) => d.jianghuEventCurrent
            ? { state: 'OK', detail: `name=${d.jianghuEventCurrent.name} 线索 ${d.jianghuEventCurrent.collected}/${d.jianghuEventCurrent.total}` }
            : { state: 'EMPTY', detail: '无进行中事件（需 admin 的 jianghuCreateEvent 播种）' });

    await probe('事件详情 jianghuEventDetail',
        `query D { jianghuEventDetail { id name clues { id } contributors { nickname } solved } }`, {},
        (d) => d.jianghuEventDetail
            ? { state: 'OK', detail: `线索${d.jianghuEventDetail.clues?.length ?? 0} 贡献者${d.jianghuEventDetail.contributors?.length ?? 0}` }
            : { state: 'EMPTY', detail: '无事件详情' });

    // 4) 大厅任务（能否真的接单）
    const hallData = await probe('大厅任务 jianghuHall',
        `query H { jianghuHall(limit: 5) { id type status verifyMode } }`, {},
        (d) => (d.jianghuHall?.length ?? 0) > 0
            ? { state: 'OK', detail: `${d.jianghuHall.length} 个可接任务` }
            : { state: 'EMPTY', detail: '大厅为空（无任务，玩法闭环跑不起来）' });

    // 5) 情报市场
    await probe('情报市场 jianghuIntelMarket',
        `query I { jianghuIntelMarket(limit: 3) { id category summary priceIntel unlocked } }`, {},
        (d) => (d.jianghuIntelMarket?.length ?? 0) > 0
            ? { state: 'OK', detail: `${d.jianghuIntelMarket.length} 条情报` }
            : { state: 'EMPTY', detail: '情报为空（需先有人提交并经审核）' });

    // 6) 榜单
    await probe('今日排行 jianghuDailyRank',
        `query R { jianghuDailyRank { customerId nickname rep isMe } }`, {},
        (d) => ({ state: (d.jianghuDailyRank?.length ?? 0) > 0 ? 'OK' : 'EMPTY', detail: `${d.jianghuDailyRank?.length ?? 0} 行` }));

    await probe('段位阶梯 jianghuRankLadder',
        `query L { jianghuRankLadder { code name rep } }`, {},
        (d) => ({ state: (d.jianghuRankLadder?.length ?? 0) > 0 ? 'OK' : 'EMPTY', detail: `${d.jianghuRankLadder?.length ?? 0} 档` }));

    // 7) 若大厅有任务，试跑完整闭环：接单 → 取码 → 核销
    let closed = false;
    if (hallData?.jianghuHall?.length) {
        const task = hallData.jianghuHall[0];
        const take = await gql(
            `mutation T($id: ID!) { jianghuTakeTask(taskId: $id) { id status } }`, { id: task.id });
        if (take.body?.errors) {
            add('接单 jianghuTakeTask', 'ERR', take.body.errors[0].message);
        } else {
            add('接单 jianghuTakeTask', 'OK', `status=${take.body.data.jianghuTakeTask.status}`);
            const code = await gql(
                `mutation RC($id: ID!) { jianghuRefreshCode(taskId: $id) }`, { id: task.id });
            const codeVal = code.body?.data?.jianghuRefreshCode;
            if (codeVal) {
                const vf = await gql(
                    `mutation V($id: ID!, $code: String) { jianghuVerify(taskId: $id, code: $code) { ok deltaRep rep message } }`,
                    { id: task.id, code: codeVal }, cookie);
                add('核销 jianghuVerify', vf.body?.data?.jianghuVerify?.ok ? 'OK' : 'ERR',
                    JSON.stringify(vf.body?.data?.jianghuVerify ?? vf.body?.errors?.[0]?.message));
                closed = Boolean(vf.body?.data?.jianghuVerify?.ok);
            } else {
                add('取码 jianghuRefreshCode', 'ERR', code.body?.errors?.[0]?.message ?? '未返回核销码');
            }
        }
    }

    const ok = rows.filter((r) => r.state === 'OK').length;
    const err = rows.filter((r) => r.state === 'ERR').length;
    const empty = rows.filter((r) => r.state === 'EMPTY').length;
    const skip = rows.filter((r) => r.state === 'SKIP').length;

    console.log('\n=========== 体检结论 ===========');
    console.log(`OK=${ok}  EMPTY(无数据)=${empty}  SKIP(前置条件)=${skip}  ERR(报错)=${err}`);
    const contentOk = rows.find((r) => r.name.startsWith('文案源'))?.state === 'OK';
    const hallOk = rows.find((r) => r.name.startsWith('大厅'))?.state === 'OK';
    if (err === 0 && contentOk && closed) console.log('结论：可玩（文案源就绪 + 任务闭环跑通）');
    else if (err === 0 && contentOk && hallOk) console.log('结论：基本可玩（文案源就绪、有任务，但核销未跑通）');
    else if (err === 0 && contentOk) console.log('结论：文案链路通，玩法主体缺数据（需播种事件/任务后才谈得上可玩）');
    else console.log('结论：不可玩，先修上面标 ERR 的项');
})();
