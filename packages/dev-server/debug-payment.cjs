// 检查 paymentProfileId=1 的 Profile 级支付方式查询错误
const http = require('http');
const SHOP_API = 'http://localhost:3000/shop-api';
let sessionCookieStr = null;

function parseCookies(setCookie) {
    if (!setCookie) return null;
    const parts = [];
    for (const c of setCookie) {
        const m = c.match(/^([^=]+)=([^;]+)/);
        if (m && (m[1] === 'session' || m[1] === 'session.sig' || m[1] === 'vendure-auth-token')) {
            parts.push(`${m[1]}=${m[2]}`);
        }
    }
    return parts.length ? parts.join('; ') : null;
}

function gql(query, variables) {
    const body = JSON.stringify({ query, variables });
    const headers = { 'Content-Type': 'application/json' };
    if (sessionCookieStr) headers['Cookie'] = sessionCookieStr;
    return new Promise((resolve, reject) => {
        const req = http.request(SHOP_API, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const parsed = parseCookies(res.headers['set-cookie']);
                if (parsed) sessionCookieStr = parsed;
                try { resolve(JSON.parse(data)); }
                catch { resolve({ data: null, errors: [{ message: data }] }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    await gql(`mutation($u: String!, $p: String!) { login(username: $u, password: $p) { ... on CurrentUser { identifier } } }`, { u: 'e2e-test@test.com', p: 'test123456' });

    // 直接查询 eligiblePaymentMethodsByProfile，看完整响应（含 errors）
    const res = await gql(`
        query($pids: [ID!]!) {
            eligiblePaymentMethodsByProfile(profileIds: $pids) { id code name }
        }
    `, { pids: ['1'] });
    console.log('Response:', JSON.stringify(res, null, 2));

    // 也查询标准的 eligiblePaymentMethods 作为对比
    const res2 = await gql(`query { eligiblePaymentMethods { id code name isEligible } }`, {});
    console.log('\nStandard eligiblePaymentMethods:', JSON.stringify(res2.data?.eligiblePaymentMethods || res2.errors, null, 2));
}

main().catch(console.error);
