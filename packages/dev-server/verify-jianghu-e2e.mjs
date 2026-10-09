// 端到端验证：Vendure -> Strapi 文案源链路
// 覆盖 3 件事：① 未登录应被拒 ② 注册+登录拿到会话 token ③ 带会话应返回 mock 文案
// 前置：node strapi-mock.mjs（7788）与 npm run dev:server（JIANGHU_STRAPI_URL=http://127.0.0.1:7788）
// 用法：node verify-jianghu-e2e.mjs
const SHOP = process.env.SHOP_URL || 'http://127.0.0.1:3000/shop-api';
const EMAIL = process.env.E2E_EMAIL || 'jianghu-e2e@local.test';
const PASSWORD = process.env.E2E_PASSWORD || 'VendureTest@2026';

const CONTENT_QUERY = `query jianghuEventContent {
    jianghuEventContent { title desc bannerImage rewardText active }
}`;

// 注意：本项目的已认证会话走 Set-Cookie 的 session / session.sig，
// 响应头里的 vendure-auth-token 只是匿名会话 token，带上它仍会被判未登录。
async function gql(query, variables, cookie) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const res = await fetch(SHOP, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const session = setCookie
        .filter((c) => c.startsWith('session=') || c.startsWith('session.sig='))
        .map((c) => c.split(';')[0])
        .join('; ');
    return { body: await res.json(), newCookie: session || cookie };
}

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

(async () => {
    // ① 未登录
    const anon = await gql(CONTENT_QUERY);
    const anonForbidden = Array.isArray(anon.body.errors) &&
        anon.body.errors.some((e) => (e.extensions?.code || '') === 'FORBIDDEN');
    check('未登录访问 jianghuEventContent 应被拒绝', anonForbidden,
        JSON.stringify(anon.body.errors?.map((e) => e.extensions?.code) || anon.body.data));

    // ② 注册（已存在则忽略）
    const reg = await gql(
        `mutation Register($input: RegisterCustomerInput!) {
            registerCustomerAccount(input: $input) {
                ... on Success { success }
                ... on ErrorResult { errorCode message }
            }
        }`,
        {
            input: {
                emailAddress: EMAIL,
                password: PASSWORD,
                firstName: '江湖',
                lastName: '测试',
            },
        },
    );
    const regOk = reg.body?.data?.registerCustomerAccount?.success === true;
    const regErr = reg.body?.data?.registerCustomerAccount?.errorCode ||
        reg.body?.errors?.[0]?.message;
    if (!regOk) console.log(`INFO  注册返回（已存在可忽略）: ${regErr}`);

    // ③ 登录建立已认证会话（session cookie）
    const login = await gql(
        `mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { id identifier }
                ... on ErrorResult { errorCode message }
            }
        }`,
        { username: EMAIL, password: PASSWORD },
    );
    const cookie = login.newCookie;
    const loginErr = login.body?.data?.login?.errorCode || login.body?.errors?.[0]?.message;
    check('注册成功后应能登录并建立会话', Boolean(cookie), loginErr || `cookie=${!!cookie}`);
    if (!cookie) process.exit(1);

    // ④ 带会话拉文案
    const auth = await gql(CONTENT_QUERY, undefined, cookie);
    const c = auth.body?.data?.jianghuEventContent;
    const gqlErr = auth.body?.errors?.[0]?.message;
    check('已登录应返回 Strapi 文案（mock）', Boolean(c), gqlErr || JSON.stringify(c));
    if (c) {
        // 默认校验本地 mock 的文案；联调线上时可用 EXPECTED_TITLE 指定后台实际录入的标题
        const expected = process.env.EXPECTED_TITLE || '测试·拾光传信者';
        check('文案字段解析正确', c.title === expected && c.active === true,
            `title=${c.title} active=${c.active} banner=${c.bannerImage}`);
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n=========== ${results.length - failed.length}/${results.length} PASSED ===========`);
    process.exit(failed.length ? 1 : 0);
})();
