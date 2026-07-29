// e:\code\vendure\test-sales-flow.js
// 端到端验收：销售员开单、改价、查询、报表
const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
const SALES_STAFF = {
    emailAddress: 'sales1@zhao.test',
    password: 'a963963',
    firstName: '王',
    lastName: '销售',
};

let stepCounter = 0;
const results = [];

function log(msg) { console.log(`[Step ${++stepCounter}] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); results.push({ ok: true, msg }); }
function fail(msg, err) {
    console.error(`  ✗ ${msg}`);
    if (err) console.error('    ', err?.message ?? err);
    results.push({ ok: false, msg, err: err?.message ?? String(err) });
}

async function gql(endpoint, query, variables, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(endpoint, {
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

async function loginAdmin({ username, password }) {
    const data = await gql(ADMIN_API, `
        mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { errorCode message }
            }
        }`, { username, password });
    if (!data.__authToken) throw new Error('Admin login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== Sales Plugin 端到端验收 ===\n');

    // 1. 超管登录
    log('超管登录');
    const adminToken = await loginAdmin(SUPER_ADMIN);
    ok('admin token 已获取');

    // 2. 验证 sales-staff 角色权限
    log('验证 sales-staff 角色权限');
    const rolesData = await gql(ADMIN_API, `
        query Roles($options: RoleListOptions) {
            roles(options: $options) { items { id code description permissions } }
        }`, { options: { filter: { code: { eq: 'sales-staff' } } } }, adminToken);
    const salesRole = rolesData.roles.items[0];
    if (!salesRole) { fail('sales-staff 角色未找到'); throw new Error('role missing'); }
    ok(`角色: ${salesRole.code} (id=${salesRole.id})`);
    ok(`权限: ${salesRole.permissions.join(', ')}`);
    if (!salesRole.permissions.includes('Authenticated')) { fail('缺少 Authenticated'); throw new Error('perm missing'); }
    if (!salesRole.permissions.includes('CreateOrder')) { fail('缺少 CreateOrder'); throw new Error('perm missing'); }

    // 3. 创建销售员账号
    log('创建/复用销售员账号 sales1');
    const adminList = await gql(ADMIN_API, `
        query Admins($options: AdministratorListOptions) {
            administrators(options: $options) { items { id emailAddress user { id identifier } } }
        }`, { options: { filter: { emailAddress: { eq: SALES_STAFF.emailAddress } } } }, adminToken);
    let sales1 = adminList.administrators.items[0];
    if (!sales1) {
        try {
            const created = await gql(ADMIN_API, `
                mutation CreateAdmin($input: CreateAdministratorInput!) {
                    createAdministrator(input: $input) {
                        ... on Administrator { id emailAddress user { id identifier } }
                    }
                }`, {
                input: {
                    emailAddress: SALES_STAFF.emailAddress,
                    firstName: SALES_STAFF.firstName,
                    lastName: SALES_STAFF.lastName,
                    password: SALES_STAFF.password,
                    roleIds: [salesRole.id],
                    customFields: {},
                },
            }, adminToken);
            sales1 = created.createAdministrator;
            ok(`已创建 sales1: id=${sales1.id}, userId=${sales1.user.id}`);
        } catch (e) { fail('创建 sales1 失败', e); throw e; }
    } else {
        ok(`已存在 sales1: id=${sales1.id}, userId=${sales1.user.id}`);
    }

    // 4. 销售员登录
    log('销售员 sales1 登录');
    const staffToken = await loginAdmin({ username: SALES_STAFF.emailAddress, password: SALES_STAFF.password });
    ok('sales1 登录成功');

    // 5. 验证 myPermissions 可访问
    log('调用 myPermissions 验证权限');
    const myPerms = await gql(ADMIN_API, `
        query { myPermissions { roles permissions visibleModules { code name enabled } } }`, {}, staffToken);
    ok(`roles: ${myPerms.myPermissions.roles.join(', ')}`);
    ok(`permissions: ${myPerms.myPermissions.permissions.join(', ')}`);
    const salesModule = myPerms.myPermissions.visibleModules.find(m => m.code === 'sales');
    if (salesModule && salesModule.enabled) {
        ok('sales 模块已启用');
    } else {
        fail('sales 模块未启用或不可见');
    }

    // 6. 查询商品
    log('查询商品用于开单');
    const products = await gql(SHOP_API, `
        query { products(options: { take: 1 }) { items { id name variants { id name priceWithTax } } } }`, {});
    const product = products.products.items[0];
    if (!product) { fail('没有可用商品'); return summarize(); }
    const variant = product.variants[0];
    ok(`选定商品: ${product.name}, variant=${variant.id}, 原价=${variant.priceWithTax}`);

    // 7. 查询 ShippingMethod
    log('查询 ShippingMethod');
    const shippingMethods = await gql(ADMIN_API, `
        query { shippingMethods { items { id name code } } }`, {}, adminToken);
    const sm = shippingMethods.shippingMethods.items[0];
    if (!sm) { fail('无可用 ShippingMethod'); return summarize(); }
    ok(`ShippingMethod: ${sm.name} (id=${sm.id})`);

    // 8. 调用 salesCreateOrder 创建订单（含改价）
    log('调用 salesCreateOrder 创建订单');
    const overwrittenPrice = variant.priceWithTax + 100; // 加价 100 分
    const uniquePhone = '139' + String(Date.now()).slice(-8); // 唯一手机号避免邮箱冲突
    let order = null;
    try {
        const createRes = await gql(ADMIN_API, `
            mutation CreateOrder($input: SalesCreateOrderInput!) {
                salesCreateOrder(input: $input) {
                    id code state totalWithTax
                    customFields { salesStaffId salesChannel salesNote }
                    lines { id quantity unitPriceWithTax customFields { overwrittenPrice modifiedBy } }
                }
            }`, {
            input: {
                newCustomer: {
                    firstName: '测试',
                    lastName: '客户',
                    phoneNumber: uniquePhone,
                    customerType: 'individual',
                },
                lines: [{
                    productVariantId: String(variant.id),
                    quantity: 2,
                    overwrittenPrice: overwrittenPrice,
                }],
                shippingAddress: {
                    fullName: '测试客户',
                    streetLine1: '测试街道 1 号',
                    city: '北京',
                    province: '北京',
                    postalCode: '100000',
                    countryCode: 'CN',
                    phoneNumber: uniquePhone,
                },
                shippingMethodId: String(sm.id),
                salesChannel: 'store',
                note: 'e2e 测试订单',
            },
        }, staffToken);
        order = createRes.salesCreateOrder;
        ok(`订单已创建: code=${order.code}, state=${order.state}, total=${order.totalWithTax}`);
        ok(`salesStaffId=${order.customFields.salesStaffId}, channel=${order.customFields.salesChannel}`);
        if (order.lines[0].customFields.overwrittenPrice === overwrittenPrice) {
            ok(`改价生效: overwrittenPrice=${order.lines[0].customFields.overwrittenPrice}`);
        } else {
            fail(`改价未生效: 期望 ${overwrittenPrice}, 实际 ${order.lines[0].customFields.overwrittenPrice}`);
        }
        if (order.lines[0].unitPriceWithTax === overwrittenPrice) {
            ok(`unitPriceWithTax 与改价一致`);
        } else {
            fail(`unitPriceWithTax 不一致: 期望 ${overwrittenPrice}, 实际 ${order.lines[0].unitPriceWithTax}`);
        }
    } catch (e) {
        fail('salesCreateOrder 失败', e);
        return summarize();
    }

    // 9. 调用 mySales 查询
    log('调用 mySales 查询');
    const mySales = await gql(ADMIN_API, `
        query MySales { mySales { id code state totalWithTax customFields { salesChannel } customer { id emailAddress } } }`,
        {}, staffToken);
    const found = mySales.mySales.find(o => String(o.id) === String(order.id));
    if (found) {
        ok(`mySales 包含此订单, channel=${found.customFields.salesChannel}`);
    } else {
        fail('mySales 未包含此订单');
    }

    // 10. 验证 manager 可见 allSales
    log('验证 manager 调 allSales 可见');
    const allSales = await gql(ADMIN_API, `
        query AllSales { allSales { id code customFields { salesStaffId } } }`, {}, adminToken);
    const foundInAll = allSales.allSales.find(o => String(o.id) === String(order.id));
    if (foundInAll) {
        ok(`allSales 包含此订单, salesStaffId=${foundInAll.customFields.salesStaffId}`);
    } else {
        fail('allSales 未包含此订单');
    }

    // 11. 调用 mySalesReport
    log('调用 mySalesReport 业绩报表');
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const report = await gql(ADMIN_API, `
        query Report($start: String!, $end: String!) {
            mySalesReport(start: $start, end: $end) {
                totalOrders totalRevenue uniqueCustomers avgOrderValue
                topProducts { productVariantId name quantitySold revenue }
                dailyBreakdown { date orderCount revenue }
            }
        }`, {
        start: start.toISOString(),
        end: now.toISOString(),
    }, staffToken);
    ok(`报表: totalOrders=${report.mySalesReport.totalOrders}, revenue=${report.mySalesReport.totalRevenue}`);
    ok(`uniqueCustomers=${report.mySalesReport.uniqueCustomers}, avgOrderValue=${report.mySalesReport.avgOrderValue}`);

    // 12. 取消订单
    log('取消订单（AddingItems 状态）');
    try {
        const cancelRes = await gql(ADMIN_API, `
            mutation Cancel($id: ID!) {
                cancelSalesOrder(orderId: $id, reason: "e2e 测试取消") { id state }
            }`, { id: String(order.id) }, staffToken);
        ok(`订单已取消: state=${cancelRes.cancelSalesOrder.state}`);
    } catch (e) {
        fail('取消订单失败', e);
    }

    // 13. 权限控制：未登录访问 mySales 应失败
    log('权限控制：未登录访问 mySales 应失败');
    try {
        await gql(ADMIN_API, `query { mySales { id } }`, {});
        fail('未登录竟成功访问 mySales');
    } catch (e) {
        ok(`已拒绝未登录访问`);
    }

    return summarize();
}

function summarize() {
    console.log('\n=== 验收汇总 ===');
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`通过: ${passed}, 失败: ${failed}`);
    if (failed > 0) {
        console.log('\n失败项:');
        results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.msg}`));
        process.exitCode = 1;
    } else {
        console.log('\n✅ 全部验收通过');
    }
}

main().catch(err => {
    console.error('\n=== 测试脚本异常 ===');
    console.error(err);
    process.exitCode = 1;
});
