// 查询最近订单状态，验证门店自提 + COD 流程结果
const http = require('http');

const ADMIN_API = 'http://localhost:3000/admin-api';

let sessionCookieStr = null;

function parseSessionCookies(setCookie) {
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
        const req = http.request(ADMIN_API, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                const parsed = parseSessionCookies(res.headers['set-cookie']);
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
    // 1. 登录
    const loginRes = await gql(`mutation { login(username: "superadmin", password: "superadmin") { ... on CurrentUser { identifier } } }`, {});
    console.log('Admin login:', loginRes.data?.login?.identifier ? 'OK' : 'FAILED');
    console.log('Session cookie:', sessionCookieStr ? 'OK' : 'NULL');
    if (!sessionCookieStr) {
        console.error('无法获取 Admin session');
        return;
    }

    // 2. 查询最近 10 个订单
    const res = await gql(`
        query {
            orders(options: { sort: { id: DESC }, take: 10 }) {
                items {
                    id code state createdAt totalWithTax
                    customer { emailAddress }
                    shippingLines { shippingMethod { code name } }
                    payments { id state method transactionId }
                    customFields {
                        pickupType
                        selectedPickupLocationId { id name address }
                    }
                }
                totalItems
            }
        }
    `, {});

    if (res.errors) {
        console.log('ERRORS:', JSON.stringify(res.errors, null, 2));
        return;
    }

    const orders = res.data?.orders?.items || [];
    console.log('\n========== 最近订单状态 ==========');
    console.log('订单总数:', res.data?.orders?.totalItems);
    console.log('');

    for (const o of orders) {
        console.log(`订单 ${o.code} (id=${o.id})`);
        console.log(`  状态: ${o.state}`);
        console.log(`  客户: ${o.customer?.emailAddress || '匿名'}`);
        console.log(`  金额: ${o.totalWithTax}`);
        console.log(`  创建: ${o.createdAt}`);
        const sm = o.shippingLines?.[0]?.shippingMethod;
        console.log(`  配送: ${sm ? sm.code + ' (' + sm.name + ')' : '未设置'}`);
        const pay = o.payments?.[0];
        console.log(`  支付: ${pay ? pay.state + ' / ' + pay.method + ' (txn=' + pay.transactionId + ')' : '无'}`);
        const loc = o.customFields?.selectedPickupLocationId;
        console.log(`  自提: type=${o.customFields?.pickupType || '-'}, location=${loc ? loc.name + ' (' + loc.address + ')' : '-'}`);
        const isTarget = o.state === 'PaymentAuthorized'
            && (sm?.code === 'store-pickup' || sm?.code === 'store-pickup-method')
            && pay?.method === 'cash-on-delivery';
        console.log(`  ${isTarget ? '✅ 门店自提 + COD + PaymentAuthorized 验证通过' : ''}`);
        console.log('');
    }
}

main().catch(console.error);
