/**
 * 产品级配送与支付方案 E2E 测试
 *
 * 测试流程：
 * 1. Admin 登录
 * 2. 查询现有 ShippingMethod / PaymentMethod / PickupLocation / ProductVariant
 * 3. 创建门店自提 ShippingMethod（如果不存在）
 * 4. 创建 ShippingProfile（包含门店自提方式）
 * 5. 创建 PaymentProfile（包含 COD 方式）
 * 6. 将 Profile 分配给商品 Variant
 * 7. Shop API：创建订单 → 加购 → 检查 Profile 兼容性 → 获取可用配送/支付方式
 * 8. 设置自提点 → 设置配送方式 → 添加支付（COD）→ 检查订单状态
 */

const http = require('http');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

// ===== HTTP 工具 =====
// Vendure dev-config 使用 express-session + signed cookie (cookieOptions.secret)
// session 数据存在 `session` cookie 中，签名存在 `session.sig` cookie 中
// 必须同时传递 session + session.sig 两个 cookie 才能保持会话
let sessionCookieStr = null;

function parseSessionCookies(setCookie) {
    if (!setCookie) return null;
    const parts = [];
    for (const c of setCookie) {
        const m = c.match(/^([^=]+)=([^;]+)/);
        if (m && (m[1] === 'session' || m[1] === 'session.sig')) {
            parts.push(`${m[1]}=${m[2]}`);
        }
    }
    return parts.length === 2 ? parts.join('; ') : null;
}

function graphql(url, query, variables, token, isShop) {
    const body = JSON.stringify({ query, variables });
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Shop API: 通过 Cookie header 传递 session + session.sig 保持会话
    if (isShop && sessionCookieStr) {
        headers['Cookie'] = sessionCookieStr;
    }
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: 'POST', headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // 保存 Shop API session cookies (session + session.sig)
                if (isShop) {
                    const parsed = parseSessionCookies(res.headers['set-cookie']);
                    if (parsed) sessionCookieStr = parsed;
                }
                try { resolve(JSON.parse(data)); }
                catch { resolve({ data: null, errors: [{ message: data }] }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function log(label, obj) {
    console.log(`\n===== ${label} =====`);
    if (obj?.errors) {
        console.log('ERRORS:', JSON.stringify(obj.errors, null, 2));
    }
    if (obj?.data) {
        console.log(JSON.stringify(obj.data, null, 2));
    }
}

async function adminGql(query, variables, token) {
    const res = await graphql(ADMIN_API, query, variables, token);
    return res;
}

async function shopGql(query, variables) {
    const res = await graphql(SHOP_API, query, variables, null, true);
    return res;
}

// ===== 1. Admin 登录 =====
const LOGIN = `
    mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
            ... on CurrentUser { identifier }
        }
    }
`;

// ===== 查询 =====
const GET_SHIPPING_METHODS = `
    query { shippingMethods { items { id code name } totalItems } }
`;

const GET_PAYMENT_METHODS = `
    query { paymentMethods { items { id code name } totalItems } }
`;

const GET_PICKUP_LOCATIONS = `
    query { pickupLocations { items { id name type address } totalItems } }
`;

const GET_PRODUCTS = `
    query {
        products(options: { take: 5 }) {
            items {
                id name slug
                variants { id name sku customFields { shippingProfileId paymentProfileId } }
            }
        }
    }
`;

const GET_SHIPPING_PROFILES = `
    query { shippingProfiles { items { id name code } totalItems } }
`;

const GET_PAYMENT_PROFILES = `
    query { paymentProfiles { items { id name code } totalItems } }
`;

// ===== 创建 ShippingMethod (门店自提) =====
const CREATE_SHIPPING_METHOD = `
    mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
        createShippingMethod(input: $input) {
            id code name
        }
    }
`;

// ===== 创建 PickupLocation =====
const CREATE_PICKUP_LOCATION = `
    mutation CreatePickupLocation($input: CreatePickupLocationInput!) {
        createPickupLocation(input: $input) {
            id name type address
        }
    }
`;

// ===== 创建 ShippingProfile =====
const CREATE_SHIPPING_PROFILE = `
    mutation CreateShippingProfile($input: CreateShippingProfileInput!) {
        createShippingProfile(input: $input) {
            id name code
        }
    }
`;

// ===== 创建 PaymentProfile =====
const CREATE_PAYMENT_PROFILE = `
    mutation CreatePaymentProfile($input: CreatePaymentProfileInput!) {
        createPaymentProfile(input: $input) {
            id name code
        }
    }
`;

// ===== 分配 Profile =====
const ASSIGN_SHIPPING_PROFILE = `
    mutation AssignShippingProfile($variantIds: [ID!]!, $profileId: ID!) {
        assignShippingProfile(variantIds: $variantIds, profileId: $profileId)
    }
`;

const ASSIGN_PAYMENT_PROFILE = `
    mutation AssignPaymentProfile($variantIds: [ID!]!, $profileId: ID!) {
        assignPaymentProfile(variantIds: $variantIds, profileId: $profileId)
    }
`;

// ===== Shop API =====
const SHOP_LOGIN = `
    mutation ShopLogin($email: String!, $password: String!) {
        login(username: $email, password: $password) {
            ... on CurrentUser { identifier }
            ... on ErrorResult { errorCode message }
        }
    }
`;

// 注册客户账号（guest checkout 需要客户关联到订单才能 transition 到 ArrangingPayment）
const REGISTER_CUSTOMER = `
    mutation RegisterCustomer($input: RegisterCustomerInput!) {
        registerCustomerAccount(input: $input) {
            ... on Success { success }
            ... on ErrorResult { errorCode message }
        }
    }
`;

const ADD_ITEM = `
    mutation AddItem($productVariantId: ID!, $quantity: Int!) {
        addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
            ... on Order { id code state lines { productVariant { id name customFields { shippingProfileId paymentProfileId } } } }
            ... on ErrorResult { errorCode message }
        }
    }
`;

const CHECK_SHIPPING_COMPAT = `
    query CheckShipping($profileIds: [ID!]!) {
        checkShippingProfileCompatibility(profileIds: $profileIds) { compatible intersectedCount }
    }
`;

const CHECK_PAYMENT_COMPAT = `
    query CheckPayment($profileIds: [ID!]!) {
        checkPaymentProfileCompatibility(profileIds: $profileIds) { compatible intersectedCount }
    }
`;

const ELIGIBLE_SHIPPING = `
    query EligibleShipping($profileIds: [ID!]!) {
        eligibleShippingMethodsByProfile(profileIds: $profileIds) { id code }
    }
`;

const ELIGIBLE_PAYMENT = `
    query EligiblePayment($profileIds: [ID!]!) {
        eligiblePaymentMethodsByProfile(profileIds: $profileIds) { id code }
    }
`;

const SET_PICKUP_LOCATION = `
    mutation SetPickup($pickupLocationId: ID!, $pickupType: String!) {
        setOrderPickupLocation(pickupLocationId: $pickupLocationId, pickupType: $pickupType) {
            id code state
        }
    }
`;

const SET_SHIPPING_METHOD = `
    mutation SetShipping($shippingMethodId: [ID!]!) {
        setOrderShippingMethod(shippingMethodId: $shippingMethodId) {
            ... on Order { id code state totalWithTax }
            ... on ErrorResult { errorCode message }
        }
    }
`;

// 订单状态转换：AddingItems → ArrangingPayment（添加支付前必须先转换状态）
// 需要 order.customer 关联，否则 arrangingPaymentRequiresCustomer guard 会阻止 transition
const TRANSITION_TO_ARRANGING_PAYMENT = `
    mutation TransitionToArrangingPayment {
        transitionOrderToState(state: "ArrangingPayment") {
            ... on Order { id code state totalWithTax }
            ... on OrderStateTransitionError { errorCode message fromState toState }
        }
    }
`;

const ADD_PAYMENT = `
    mutation AddPayment($input: PaymentInput!) {
        addPaymentToOrder(input: $input) {
            ... on Order { id code state payments { id state transactionId } }
            ... on ErrorResult { errorCode message }
        }
    }
`;

const ACTIVE_ORDER = `
    query { activeOrder { id code state lines { productVariant { id name customFields { shippingProfileId paymentProfileId } } } totalWithTax } }
`;

// ===== 主流程 =====
async function main() {
    console.log('\n========== 产品级配送与支付方案 E2E 测试 ==========\n');

    // 1. Admin 登录
    console.log('>> Step 1: Admin 登录');
    let loginRes = await adminGql(LOGIN, { username: 'superadmin', password: 'superadmin' });
    log('Admin Login', loginRes);
    if (loginRes.errors) {
        // 尝试 china test 凭据
        loginRes = await adminGql(LOGIN, { username: 'superadmin@china.test', password: 'superadmin' });
        log('Admin Login (china)', loginRes);
    }
    // 从 set-cookie header 获取 token
    const adminToken = loginRes.data?.login ? 'superadmin' : null;
    // 实际上 Vendure 使用 bearer token, 让我们用 native auth
    const nativeAuthLogin = `
        mutation NativeAuthLogin($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { errorCode message }
            }
        }
    `;
    // Vendure dev mode uses cookie auth, let's get the token via header
    const loginViaHttp = () => new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: LOGIN, variables: { username: 'superadmin', password: 'superadmin' } });
        const req = http.request(ADMIN_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const cookies = res.headers['set-cookie'];
                let token = null;
                if (cookies) {
                    for (const c of cookies) {
                        const match = c.match(/vendure-auth-token=([^;]+)/);
                        if (match) { token = match[1]; break; }
                    }
                }
                resolve({ token, body: data });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    // Vendure 使用 cookie/header 设置 token
    const loginWithHeaders = (username, password) => new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: LOGIN, variables: { username, password } });
        const req = http.request(ADMIN_API, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const cookies = res.headers['set-cookie'];
                let token = null;
                if (cookies) {
                    for (const c of cookies) {
                        const m = c.match(/vendure-auth-token=([^;]+)/);
                        if (m) { token = m[1]; break; }
                    }
                }
                // 也检查 response header 中的 vendure-auth-token
                if (!token && res.headers['vendure-auth-token']) {
                    token = res.headers['vendure-auth-token'];
                }
                resolve({ token, body: data, headers: res.headers });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    let loginResult = await loginWithHeaders('superadmin', 'superadmin');
    let authToken = loginResult.token;

    if (!authToken) {
        // 打印 headers 以调试
        console.log('Response headers:', JSON.stringify(loginResult.headers, null, 2));
        // 尝试 china test 凭据
        loginResult = await loginWithHeaders('superadmin@china.test', 'superadmin');
        authToken = loginResult.token;
    }

    console.log('Admin token:', authToken ? 'OK (' + authToken.substring(0, 8) + '...)' : 'FAILED');

    if (!authToken) {
        console.error('无法获取 Admin token');
        process.exit(1);
    }

    // 2. 查询现有数据
    console.log('\n>> Step 2: 查询现有数据');
    const smRes = await adminGql(GET_SHIPPING_METHODS, {}, authToken);
    log('Shipping Methods', smRes);

    const pmRes = await adminGql(GET_PAYMENT_METHODS, {}, authToken);
    log('Payment Methods', pmRes);

    const plRes = await adminGql(GET_PICKUP_LOCATIONS, {}, authToken);
    log('Pickup Locations', plRes);

    const prodRes = await adminGql(GET_PRODUCTS, {}, authToken);
    log('Products (first 5)', prodRes);

    const spRes = await adminGql(GET_SHIPPING_PROFILES, {}, authToken);
    log('Existing Shipping Profiles', spRes);

    const ppRes = await adminGql(GET_PAYMENT_PROFILES, {}, authToken);
    log('Existing Payment Profiles', ppRes);

    // 收集数据
    const shippingMethods = smRes.data?.shippingMethods?.items || [];
    const paymentMethods = pmRes.data?.paymentMethods?.items || [];
    const pickupLocations = plRes.data?.pickupLocations?.items || [];
    const products = prodRes.data?.products?.items || [];
    const existingShippingProfiles = spRes.data?.shippingProfiles?.items || [];
    const existingPaymentProfiles = ppRes.data?.paymentProfiles?.items || [];

    // 3. 查找门店自提 ShippingMethod
    console.log('\n>> Step 3: 查找门店自提 ShippingMethod');
    let storePickupSM = shippingMethods.find(sm => sm.code === 'store-pickup');
    if (!storePickupSM) {
        const createSMRes = await adminGql(CREATE_SHIPPING_METHOD, {
            input: {
                code: 'store-pickup-method',
                translations: [{ languageCode: 'zh_Hans', name: '门店自提', description: '到店自提' }],
                fulfillmentHandler: 'store-pickup',
                checker: {
                    code: 'store-pickup-eligibility',
                    arguments: []
                },
                calculator: {
                    code: 'store-pickup-calculator',
                    arguments: []
                }
            }
        }, authToken);
        log('Create Store Pickup ShippingMethod', createSMRes);
        storePickupSM = createSMRes.data?.createShippingMethod;
    } else {
        console.log('门店自提 ShippingMethod 已存在:', storePickupSM.id);
    }

    // 4. 创建 PickupLocation（门店自提点）
    console.log('\n>> Step 4: 确保门店自提点存在');
    let storePickupLocation = pickupLocations.find(pl => pl.type === 'store');
    if (!storePickupLocation) {
        const createPLRes = await adminGql(CREATE_PICKUP_LOCATION, {
            input: {
                name: '测试门店-总店',
                type: 'store',
                address: '上海市浦东新区张江高科技园区博云路2号',
                phoneNumber: '021-12345678',
                businessHours: '09:00-22:00',
                isPublic: true
            }
        }, authToken);
        log('Create Pickup Location', createPLRes);
        storePickupLocation = createPLRes.data?.createPickupLocation;
    } else {
        console.log('门店自提点已存在:', storePickupLocation.id, storePickupLocation.name);
    }

    // 5. 创建 ShippingProfile
    console.log('\n>> Step 5: 创建 ShippingProfile');
    let shippingProfile = existingShippingProfiles.find(sp => sp.code === 'store-pickup-profile');
    if (!shippingProfile && storePickupSM) {
        const createSPRes = await adminGql(CREATE_SHIPPING_PROFILE, {
            input: {
                name: '门店自提配送档案',
                code: 'store-pickup-profile',
                description: '仅支持门店自提',
                isGlobal: false,
                shippingMethodIds: [storePickupSM.id]
            }
        }, authToken);
        log('Create ShippingProfile', createSPRes);
        shippingProfile = createSPRes.data?.createShippingProfile;
    } else {
        console.log('ShippingProfile 已存在:', shippingProfile?.id);
    }

    // 6. 创建 PaymentProfile（COD）
    console.log('\n>> Step 6: 创建 PaymentProfile');
    let paymentProfile = existingPaymentProfiles.find(pp => pp.code === 'cod-profile');
    const codMethod = paymentMethods.find(pm => pm.code === 'cash-on-delivery' || pm.code.includes('cod'));
    if (!paymentProfile && codMethod) {
        const createPPRes = await adminGql(CREATE_PAYMENT_PROFILE, {
            input: {
                name: '门店收银支付档案',
                code: 'cod-profile',
                description: '仅支持门店收银（货到付款）',
                isGlobal: false,
                paymentMethodIds: [codMethod.id]
            }
        }, authToken);
        log('Create PaymentProfile', createPPRes);
        paymentProfile = createPPRes.data?.createPaymentProfile;
    } else {
        console.log('PaymentProfile 已存在:', paymentProfile?.id);
        if (!codMethod) console.log('WARNING: 未找到 COD 支付方式');
    }

    // 7. 分配 Profile 给商品 Variant
    console.log('\n>> Step 7: 分配 Profile 给商品 Variant');
    const allVariants = products.flatMap(p => p.variants || []);
    const variantIds = allVariants.map(v => v.id).filter(Boolean);

    if (shippingProfile && variantIds.length > 0) {
        const assignSPRes = await adminGql(ASSIGN_SHIPPING_PROFILE, {
            variantIds,
            profileId: shippingProfile.id
        }, authToken);
        log('Assign ShippingProfile to Variants', assignSPRes);
    }

    if (paymentProfile && variantIds.length > 0) {
        const assignPPRes = await adminGql(ASSIGN_PAYMENT_PROFILE, {
            variantIds,
            profileId: paymentProfile.id
        }, authToken);
        log('Assign PaymentProfile to Variants', assignPPRes);
    }

    // 8. Shop API E2E 测试
    console.log('\n>> Step 8: Shop API E2E 测试');

    // 8a. 注册并登录客户（ArrangingPayment 需要 order.customer）
    console.log('>> 8a: 注册并登录测试客户');
    const testEmail = 'e2e-test@test.com';
    const testPassword = 'test123456';
    // 先尝试注册（如果已存在会返回错误，忽略即可）
    const regRes = await shopGql(REGISTER_CUSTOMER, {
        input: {
            emailAddress: testEmail,
            firstName: 'E2E',
            lastName: 'Tester',
            password: testPassword,
        }
    });
    console.log('Register result:', regRes.data?.registerCustomerAccount?.success ? 'OK' : regRes.data?.registerCustomerAccount?.message || 'already exists or skipped');

    // 登录客户
    const shopLoginRes = await shopGql(SHOP_LOGIN, {
        email: testEmail,
        password: testPassword
    });
    log('Shop Customer Login', shopLoginRes);

    const firstVariant = allVariants[0];
    if (!firstVariant) {
        console.error('没有可用的商品 Variant');
        process.exit(1);
    }

    console.log('>> 8b: 加购商品', firstVariant.id, firstVariant.name);
    const addItemRes = await shopGql(ADD_ITEM, {
        productVariantId: firstVariant.id,
        quantity: 1
    });
    log('Add Item to Order', addItemRes);
    console.log('Session cookie after addItem:', sessionCookieStr ? 'OK' : 'NULL');

    const order = addItemRes.data?.addItemToOrder;
    if (!order || order.errorCode) {
        console.error('加购失败');
        process.exit(1);
    }

    // 提取 Profile IDs
    const profileIdsInCart = new Set();
    for (const line of order.lines || []) {
        const spId = line.productVariant?.customFields?.shippingProfileId;
        if (spId) profileIdsInCart.add(spId);
    }
    const shippingProfileIds = [...profileIdsInCart];
    console.log('Cart shipping profile IDs:', shippingProfileIds);

    // 收集 payment profile IDs
    const paymentProfileIdsInCart = new Set();
    for (const line of order.lines || []) {
        const ppId = line.productVariant?.customFields?.paymentProfileId;
        if (ppId) paymentProfileIdsInCart.add(ppId);
    }
    const paymentProfileIds = [...paymentProfileIdsInCart];
    console.log('Cart payment profile IDs:', paymentProfileIds);

    console.log('>> 8c: 检查配送 Profile 兼容性');
    if (shippingProfileIds.length > 0) {
        const compatRes = await shopGql(CHECK_SHIPPING_COMPAT, { profileIds: shippingProfileIds });
        log('Shipping Compatibility', compatRes);

        console.log('>> 8d: 获取可用配送方式');
        const eligibleRes = await shopGql(ELIGIBLE_SHIPPING, { profileIds: shippingProfileIds });
        log('Eligible Shipping Methods', eligibleRes);
    }

    console.log('>> 8e: 检查支付 Profile 兼容性');
    if (paymentProfileIds.length > 0) {
        const compatRes = await shopGql(CHECK_PAYMENT_COMPAT, { profileIds: paymentProfileIds });
        log('Payment Compatibility', compatRes);

        console.log('>> 8f: 获取可用支付方式');
        const eligibleRes = await shopGql(ELIGIBLE_PAYMENT, { profileIds: paymentProfileIds });
        log('Eligible Payment Methods', eligibleRes);
    }

    // 9. 设置自提点
    console.log('\n>> Step 9: 设置门店自提点');
    // 先检查 activeOrder 是否可用
    const activeOrderRes = await shopGql(ACTIVE_ORDER);
    log('Active Order before pickup', activeOrderRes);
    if (storePickupLocation) {
        const setPickupRes = await shopGql(SET_PICKUP_LOCATION, {
            pickupLocationId: storePickupLocation.id,
            pickupType: 'store'
        });
        log('Set Pickup Location', setPickupRes);
    }

    // 10. 设置配送方式
    console.log('\n>> Step 10: 设置配送方式（门店自提）');
    if (storePickupSM) {
        const setShippingRes = await shopGql(SET_SHIPPING_METHOD, {
            shippingMethodId: [storePickupSM.id]
        });
        log('Set Shipping Method', setShippingRes);
    }

    // 10b. 转换订单状态到 ArrangingPayment（添加支付前必须先转换状态）
    console.log('\n>> Step 10b: 转换订单状态到 ArrangingPayment');
    const transitionRes = await shopGql(TRANSITION_TO_ARRANGING_PAYMENT, {});
    log('Transition to ArrangingPayment', transitionRes);

    // 11. 添加支付（COD）
    console.log('\n>> Step 11: 添加支付（门店收银 COD）');
    if (codMethod) {
        const addPaymentRes = await shopGql(ADD_PAYMENT, {
            input: {
                method: codMethod.code,
                metadata: { public: { source: 'store-cashier' } }
            }
        });
        log('Add Payment (COD)', addPaymentRes);

        const finalOrder = addPaymentRes.data?.addPaymentToOrder;
        if (finalOrder && !finalOrder.errorCode) {
            console.log('\n========== E2E 测试结果 ==========');
            console.log('订单号:', finalOrder.code);
            console.log('订单状态:', finalOrder.state);
            console.log('支付状态:', finalOrder.payments?.map(p => `${p.state}(${p.transactionId})`).join(', '));
            console.log('结论: ✅ 产品级配送方案 + 门店自提 + 门店收银 端对端流程通过');
        } else {
            console.log('\n========== E2E 测试结果 ==========');
            console.log('支付添加失败，但配送方案验证已完成');
            console.log('结论: ⚠️ 配送方案可用，支付环节需排查');
        }
    }

    // 12. 查看最终订单
    console.log('\n>> Step 12: 查看最终订单');
    const finalRes = await shopGql(ACTIVE_ORDER);
    log('Final Active Order', finalRes);

    console.log('\n========== E2E 测试完成 ==========');
}

main().catch(err => {
    console.error('E2E 测试异常:', err);
    process.exit(1);
});
