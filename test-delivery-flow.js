// e:\code\vendure\test-delivery-flow.js
// 端到端验收脚本：验证送货员权限、自动派单、送货全流程与权限控制
// 使用 Node 20+ 内置 fetch。运行：node test-delivery-flow.js

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
// 送货员账号（如不存在将自动创建）
const DELIVERY_STAFF = {
    identifier: 'delivery1',
    emailAddress: 'delivery1@zhao.test',
    password: 'a963963',
    firstName: '张',
    lastName: '送货',
};
const DELIVERY_STAFF_2 = {
    identifier: 'delivery2',
    emailAddress: 'delivery2@zhao.test',
    password: 'a963963',
    firstName: '李',
    lastName: '送货二',
};

let stepCounter = 0;
const results = [];

function log(msg) {
    console.log(`[Step ${++stepCounter}] ${msg}`);
}

function ok(msg) {
    console.log(`  ✓ ${msg}`);
    results.push({ ok: true, msg });
}

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
        err.status = res.status;
        err.resHeaders = res.headers;
        throw err;
    }
    // Vendure 将 token 放在 response header 'vendure-auth-token' 中
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

async function loginShopCustomer({ username, password }) {
    // Shop API login：token 在 'vendure-auth-token' header
    const res = await fetch(SHOP_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `
                mutation Login($username: String!, $password: String!) {
                    login(username: $username, password: $password) {
                        ... on CurrentUser { identifier }
                        ... on InvalidCredentialsError { errorCode message }
                    }
                }`,
            variables: { username, password },
        }),
    });
    const body = await res.json();
    if (body.errors) throw new Error(body.errors.map(e => e.message).join('; '));
    const token = res.headers.get('vendure-auth-token');
    if (!token) throw new Error('Shop login failed: ' + (body.data?.login?.message ?? 'no token'));
    return token;
}

async function main() {
    console.log('=== Delivery Plugin 端到端验收 ===\n');

    // ---- 1. 超管登录 ----
    log('超管登录');
    const adminToken = await loginAdmin(SUPER_ADMIN);
    ok(`admin token 已获取`);

    // ---- 2. 验证 delivery-staff 角色权限已包含 Authenticated ----
    log('验证 delivery-staff 角色权限');
    const rolesData = await gql(ADMIN_API, `
        query Roles($options: RoleListOptions) {
            roles(options: $options) {
                items { id code description permissions }
            }
        }`, { options: { filter: { code: { eq: 'delivery-staff' } } } }, adminToken);
    const dsRole = rolesData.roles.items[0];
    if (!dsRole) {
        fail('delivery-staff 角色未找到');
        throw new Error('delivery-staff role missing');
    }
    ok(`角色: ${dsRole.code} (id=${dsRole.id})`);
    ok(`权限列表: ${dsRole.permissions.join(', ')}`);
    if (!dsRole.permissions.includes('Authenticated')) {
        fail('delivery-staff 角色缺少 Authenticated 权限');
        throw new Error('Authenticated permission missing');
    }
    ok('包含 Authenticated 基础权限 ✓');

    // ---- 3. 创建送货员账号（如不存在）----
    log('创建/复用送货员账号 delivery1');
    const adminList = await gql(ADMIN_API, `
        query Admins($options: AdministratorListOptions) {
            administrators(options: $options) {
                items { id emailAddress firstName lastName user { id identifier } }
            }
        }`, { options: { filter: { emailAddress: { eq: DELIVERY_STAFF.emailAddress } } } }, adminToken);
    let delivery1 = adminList.administrators.items[0];
    if (!delivery1) {
        try {
            const created = await gql(ADMIN_API, `
                mutation CreateAdmin($input: CreateAdministratorInput!) {
                    createAdministrator(input: $input) {
                        id emailAddress firstName lastName user { id identifier }
                    }
                }`, {
                input: {
                    emailAddress: DELIVERY_STAFF.emailAddress,
                    firstName: DELIVERY_STAFF.firstName,
                    lastName: DELIVERY_STAFF.lastName,
                    password: DELIVERY_STAFF.password,
                    roleIds: [dsRole.id],
                    customFields: {},
                },
            }, adminToken);
            delivery1 = created.createAdministrator;
            ok(`已创建 delivery1: id=${delivery1.id}, userId=${delivery1.user.id}`);
        } catch (e) {
            fail('创建 delivery1 失败', e);
            throw e;
        }
    } else {
        ok(`已存在 delivery1: id=${delivery1.id}, userId=${delivery1.user.id}`);
        // 确保绑定 delivery-staff 角色
        try {
            await gql(ADMIN_API, `
                mutation UpdateAdmin($input: UpdateAdministratorInput!) {
                    updateAdministrator(input: $input) { id }
                }`, {
                input: { id: delivery1.id, roleIds: [dsRole.id] },
            }, adminToken);
            ok('已确保 delivery1 绑定 delivery-staff 角色');
        } catch (e) {
            fail('绑定角色失败', e);
        }
    }

    // ---- 4. 送货员登录验证 myPermissions API 可访问 ----
    log('送货员 delivery1 登录并调用 myPermissions');
    const staffToken = await loginAdmin({ username: DELIVERY_STAFF.emailAddress, password: DELIVERY_STAFF.password });
    if (!staffToken) {
        fail('delivery1 登录失败');
        throw new Error('staff login failed');
    }
    ok('delivery1 登录成功，token 已获取');

    const myPerms = await gql(ADMIN_API, `
        query { myPermissions { roles permissions visibleModules { code name enabled entryPath icon sort } } }`,
        {}, staffToken);
    ok(`roles: ${myPerms.myPermissions.roles.join(', ')}`);
    ok(`permissions (${myPerms.myPermissions.permissions.length}): ${myPerms.myPermissions.permissions.join(', ')}`);
    ok(`visibleModules: ${myPerms.myPermissions.visibleModules.map(m => m.code).join(', ')}`);

    // ---- 5. 调用 myDeliveries 验证（应为空或已有数据）----
    log('调用 myDeliveries 查询送货任务');
    const myDeliveries = await gql(ADMIN_API, `
        query MyDeliveries($status: String) { myDeliveries(status: $status) { id code state customFields { deliveryStatus deliveryStaffId } } }`,
        { status: null }, staffToken);
    ok(`myDeliveries 当前数量: ${myDeliveries.myDeliveries.length}`);

    // ---- 6. 创建测试订单触发自动派单 ----
    log('登录客户并通过 Shop API 创建测试订单');
    let customerToken = null;
    try {
        customerToken = await loginShopCustomer({ username: 'zhangsan@test.cn', password: 'test' });
        ok('客户 zhangsan 登录成功');
    } catch (e) {
        ok(`客户登录失败，将使用游客订单: ${e.message}`);
    }

    // 先查询商品
    const products = await gql(SHOP_API, `
        query { products(options: { take: 1 }) { items { id name slug variants { id name priceWithTax } } } }`, {});
    const product = products.products.items[0];
    if (!product) {
        fail('没有可用商品，跳过订单测试');
        return summarize();
    }
    const variant = product.variants[0];
    ok(`选定商品: ${product.name}, variant=${variant.id}, 价格=${variant.priceWithTax}`);

    // addItemToOrder（使用 customer token）
    const addItem = await gql(SHOP_API, `
        mutation AddItem($productVariantId: ID!, $quantity: Int!) {
            addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
                ... on Order { id code state totalWithTax customer { id emailAddress } }
                ... on ErrorResult { errorCode message }
            }
        }`, { productVariantId: variant.id, quantity: 1 }, customerToken);
    if (addItem.addItemToOrder?.errorCode) {
        fail('addItemToOrder 失败', new Error(addItem.addItemToOrder.message));
        throw addItem.addItemToOrder;
    }
    const order = addItem.addItemToOrder;
    ok(`订单已创建: code=${order.code}, id=${order.id}, state=${order.state}, total=${order.totalWithTax}`);
    ok(`customer: ${order.customer?.emailAddress ?? '(none)'}`);

    // 设置配送地址
    const addAddr = await gql(SHOP_API, `
        mutation SetAddress($input: CreateAddressInput!) {
            setOrderShippingAddress(input: $input) {
                ... on Order { id }
            }
        }`, {
        input: {
            fullName: '测试客户',
            streetLine1: '测试街道 1 号',
            city: '北京',
            province: '北京',
            postalCode: '100000',
            countryCode: 'CN',
            phoneNumber: '13800000000',
        },
    }, customerToken);
    ok('配送地址已设置');

    // 设置配送方式：先尝试 shop-api，若无可选则用 admin-api 查询所有 ShippingMethod 并设置
    const shippingMethods = await gql(SHOP_API, `
        query { eligibleShippingMethods { id name priceWithTax } }`, {}, customerToken);
    let firstMethod = shippingMethods.eligibleShippingMethods?.[0];
    if (firstMethod) {
        await gql(SHOP_API, `
            mutation SetShipping($id: [ID!]!) {
                setOrderShippingMethod(shippingMethodId: $id) {
                    ... on Order { id }
                }
            }`, { id: [firstMethod.id] }, customerToken);
        ok(`配送方式(shop): ${firstMethod.name}`);
    } else {
        // 用 admin-api 查询所有 ShippingMethod
        const adminShipping = await gql(ADMIN_API, `
            query { shippingMethods { items { id name code } } }`, {}, adminToken);
        const sm = adminShipping.shippingMethods.items[0];
        if (sm) {
            // 用 admin-api 修改订单的 shippingLine
            try {
                await gql(ADMIN_API, `
                    mutation SetShippingLine($id: ID!, $smId: ID!) {
                        setOrderShippingMethod(orderId: $id, shippingMethodId: $smId) {
                            ... on Order { id shippingLines { shippingMethod { id name } } }
                        }
                    }`, { id: order.id, smId: sm.id }, adminToken);
                ok(`配送方式(admin): ${sm.name}`);
                firstMethod = { id: sm.id, name: sm.name };
            } catch (e) {
                ok(`admin setOrderShippingMethod 失败: ${e.message}`);
            }
        } else {
            ok('系统中无任何 ShippingMethod，将用 admin-api 直接推进状态');
        }
    }

    // 通过 admin-api 推进订单状态到 PaymentSettled 触发自动派单
    // 流程：AddingItems → ArrangingPayment → (addManualPayment) → PaymentAuthorized → PaymentSettled
    log('通过 admin-api 推进订单状态到 PaymentSettled');
    let paid = null;
    try {
        // 1. AddingItems → ArrangingPayment
        const t1 = await gql(ADMIN_API, `
            mutation T($id: ID!, $state: String!) {
                transitionOrderToState(id: $id, state: $state) {
                    ... on Order { id state }
                    ... on OrderStateTransitionError { errorCode message transitionError }
                }
            }`, { id: order.id, state: 'ArrangingPayment' }, adminToken);
        if (t1.transitionOrderToState?.errorCode) {
            fail(`ArrangingPayment 转换失败: ${t1.transitionOrderToState.transitionError ?? t1.transitionOrderToState.message}`);
        } else {
            ok(`state → ArrangingPayment`);
        }

        // 2. 查询订单总额，添加手动支付覆盖
        const orderForPay = await gql(ADMIN_API, `
            query O($id: ID!) { order(id: $id) { id total } }`, { id: order.id }, adminToken);
        const total = orderForPay.order.total;
        ok(`订单总额: ${total}`);

        // 3. 添加手动支付（会自动将订单推进到 PaymentSettled）
        try {
            const payRes = await gql(ADMIN_API, `
                mutation ManualPay($input: ManualPaymentInput!) {
                    addManualPaymentToOrder(input: $input) {
                        ... on Order { id state customFields { deliveryStatus deliveryStaffId } }
                    }
                }`, {
                input: {
                    orderId: order.id,
                    method: 'manual-payment',
                    metadata: {},
                    transactionId: `test-${Date.now()}`,
                },
            }, adminToken);
            paid = payRes.addManualPaymentToOrder;
            ok(`手动支付已添加，state=${paid.state}`);
        } catch (e) {
            fail(`addManualPayment 失败`, e);
        }

        // 4. 如果还不是 PaymentSettled，尝试 transition
        if (paid && paid.state !== 'PaymentSettled') {
            const states = ['PaymentAuthorized', 'PaymentSettled'];
            let currentState = paid.state;
            for (const target of states) {
                const t = await gql(ADMIN_API, `
                    mutation T($id: ID!, $state: String!) {
                        transitionOrderToState(id: $id, state: $state) {
                            ... on Order { id state customFields { deliveryStatus deliveryStaffId } }
                            ... on OrderStateTransitionError { errorCode message transitionError }
                        }
                    }`, { id: order.id, state: target }, adminToken);
                const r = t.transitionOrderToState;
                if (r?.errorCode) {
                    ok(`transition ${currentState}→${target}: ${r.transitionError ?? r.message}`);
                    break;
                }
                currentState = r.state;
                ok(`state → ${currentState}`);
                paid = r;
            }
        }
    } catch (e) {
        fail('admin transition 失败', e);
    }

    if (paid) {
        ok(`customFields.deliveryStatus=${paid.customFields?.deliveryStatus ?? '(null)'}, deliveryStaffId=${paid.customFields?.deliveryStaffId ?? '(null)'}`);
        if (paid.customFields?.deliveryStaffId) {
            ok(`✅ 自动派单成功！订单 ${paid.id} 已派给 userId=${paid.customFields.deliveryStaffId}`);
            if (String(paid.customFields.deliveryStaffId) === String(delivery1.user.id)) {
                ok('派单对象正确：delivery1');
            } else {
                ok(`派给其他送货员 userId=${paid.customFields.deliveryStaffId}（可能存在多个送货员）`);
            }
        } else {
            // 派单事件可能是异步的，稍等后重查
            ok('派单字段未立即填充，等待 1 秒后重查...');
            await new Promise(r => setTimeout(r, 1000));
            const reloaded = await gql(ADMIN_API, `
                query O($id: ID!) { order(id: $id) { id state customFields { deliveryStatus deliveryStaffId } } }`,
                { id: order.id }, adminToken);
            const cf = reloaded.order?.customFields;
            if (cf?.deliveryStaffId) {
                ok(`✅ 重查后自动派单成功！userId=${cf.deliveryStaffId}, status=${cf.deliveryStatus}`);
                paid.customFields = cf;
            } else {
                fail('自动派单未触发：deliveryStaffId 为空');
            }
        }
    }

    // ---- 7. 验证送货全流程 ----
    log('验证送货全流程：startDelivery → markDelivered');
    if (paid && paid.customFields?.deliveryStaffId && paid.id) {
        const orderId = paid.id;

        // 如果派给了非 delivery1，用 superadmin 改派给 delivery1
        if (String(paid.customFields.deliveryStaffId) !== String(delivery1.user.id)) {
            ok(`订单派给 userId=${paid.customFields.deliveryStaffId}，改派给 delivery1(userId=${delivery1.user.id})`);
            try {
                const reassign = await gql(ADMIN_API, `
                    mutation Reassign($orderId: ID!, $newStaffId: ID!) {
                        reassignDelivery(orderId: $orderId, newStaffId: $newStaffId) {
                            id customFields { deliveryStatus deliveryStaffId }
                        }
                    }`, { orderId, newStaffId: String(delivery1.user.id) }, adminToken);
                ok(`改派成功：deliveryStaffId=${reassign.reassignDelivery.customFields.deliveryStaffId}`);
                paid.customFields = reassign.reassignDelivery.customFields;
            } catch (e) {
                fail(`改派失败: ${e.message}`);
            }
        }

        // myDeliveries 应包含此订单
        const myList = await gql(ADMIN_API, `
            query { myDeliveries { id code state customFields { deliveryStatus deliveryStaffId } } }`,
            {}, staffToken);
        const found = myList.myDeliveries.find(o => String(o.id) === String(orderId));
        if (found) {
            ok(`myDeliveries 包含此订单，deliveryStatus=${found.customFields.deliveryStatus}`);
        } else {
            fail('myDeliveries 未包含此订单');
        }

        // startDelivery
        try {
            const startRes = await gql(ADMIN_API, `
                mutation Start($id: ID!) {
                    startDelivery(orderId: $id) {
                        id state customFields { deliveryStatus }
                    }
                }`, { id: orderId }, staffToken);
            ok(`startDelivery 成功: deliveryStatus=${startRes.startDelivery.customFields.deliveryStatus}`);
        } catch (e) {
            fail(`startDelivery 失败: ${e.message}`);
        }

        // markDelivered
        try {
            const markRes = await gql(ADMIN_API, `
                mutation Mark($id: ID!, $photos: [String!]!, $note: String) {
                    markDelivered(orderId: $id, photos: $photos, note: $note) {
                        id state customFields { deliveryStatus deliveredAt deliveryNote }
                    }
                }`, {
                id: orderId,
                photos: ['https://example.com/photo1.jpg'],
                note: '已送达，客户签收',
            }, staffToken);
            ok(`markDelivered 成功: deliveryStatus=${markRes.markDelivered.customFields.deliveryStatus}`);
        } catch (e) {
            fail(`markDelivered 失败: ${e.message}`);
        }

        // ---- 8. 权限控制：未登录用户不能访问 myDeliveries ----
        log('权限控制：未登录访问 myDeliveries 应失败');
        try {
            await gql(ADMIN_API, `query { myDeliveries { id } }`, {});
            fail('未登录竟成功访问 myDeliveries');
        } catch (e) {
            ok(`已拒绝未登录访问: ${e.message.substring(0, 80)}`);
        }
    } else {
        fail('跳过送货全流程测试（未派单）');
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
    return results;
}

main().catch(err => {
    console.error('\n=== 测试脚本异常 ===');
    console.error(err);
    process.exitCode = 1;
});
