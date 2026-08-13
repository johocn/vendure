// 创建自由大路自提点 + 专属 ShippingProfile（仅门店自提 + 仅自由大路）+ 分配给农夫山泉
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

const log = (label, res) => console.log(`\n[${label}]`, JSON.stringify(res, null, 2));

async function main() {
    // 1. 登录
    await gql(`mutation { login(username: "superadmin", password: "superadmin") { ... on CurrentUser { identifier } } }`, {});
    console.log('Admin login:', sessionCookieStr ? 'OK' : 'FAILED');

    // 2. 查询现有 store 类型自提点（避免重复创建）
    const existLocRes = await gql(`
        query { pickupLocations(options: { filter: { type: { eq: "store" } } }) { items { id name address type } } }
    `, {});
    log('Existing store pickup locations', existLocRes.data?.pickupLocations?.items || []);
    const existing = existLocRes.data?.pickupLocations?.items || [];
    const existZiyou = existing.find(l => l.name.includes('自由大路'));
    let ziyouLocationId;

    if (existZiyou) {
        ziyouLocationId = existZiyou.id;
        console.log(`\n自由大路自提点已存在: id=${ziyouLocationId}`);
    } else {
        // 3. 创建自由大路自提点
        const createLocRes = await gql(`
            mutation($input: CreatePickupLocationInput!) {
                createPickupLocation(input: $input) { id name address type }
            }
        `, {
            input: {
                name: '自由大路门店',
                type: 'store',
                address: '吉林省长春市朝阳区自由大路100号',
                phoneNumber: '0431-88888888',
                businessHours: '08:00-22:00',
                province: '吉林省',
                city: '长春市',
                district: '朝阳区',
                street: '自由大路100号',
                isPublic: true,
                coordinates: { lat: 43.88, lng: 125.32 },
            },
        });
        log('Create 自由大路 pickup location', createLocRes);
        if (createLocRes.errors) { console.error('创建自提点失败'); return; }
        ziyouLocationId = createLocRes.data.createPickupLocation.id;
    }

    // 4. 查询门店自提 ShippingMethod（code=store-pickup）
    const smRes = await gql(`
        query { shippingMethods(options: { filter: { code: { eq: "store-pickup" } } }) { items { id code name } } }
    `, {});
    const storePickupMethod = smRes.data?.shippingMethods?.items?.[0];
    log('store-pickup ShippingMethod', storePickupMethod);
    if (!storePickupMethod) { console.error('未找到 store-pickup 配送方式'); return; }

    // 5. 查询现有 ShippingProfile（避免重复）
    const existSpRes = await gql(`
        query { shippingProfiles { items { id name code } } }
    `, {});
    const existSp = existSpRes.data?.shippingProfiles?.items || [];
    const existZiyouProfile = existSp.find(p => p.code === 'ziyou-store-pickup-only');
    let profileId;

    if (existZiyouProfile) {
        profileId = existZiyouProfile.id;
        console.log(`\n自由大路专属 Profile 已存在: id=${profileId}`);
        // 更新关联（确保关联了门店自提方式 + 自由大路自提点）
        const updRes = await gql(`
            mutation($input: UpdateShippingProfileInput!) {
                updateShippingProfile(input: $input) { id name pickupLocations { id name } shippingMethods { id code } }
            }
        `, {
            input: {
                id: profileId,
                shippingMethodIds: [storePickupMethod.id],
                pickupLocationIds: [ziyouLocationId],
            },
        });
        log('Update 自由大路 Profile', updRes);
    } else {
        // 6. 创建专属 ShippingProfile
        const createSpRes = await gql(`
            mutation($input: CreateShippingProfileInput!) {
                createShippingProfile(input: $input) { id name code pickupLocations { id name } shippingMethods { id code } }
            }
        `, {
            input: {
                name: '自由大路门店自提专属',
                code: 'ziyou-store-pickup-only',
                description: '仅门店自提 + 仅自由大路门店（农夫山泉天然水专用）',
                isGlobal: false,
                shippingMethodIds: [storePickupMethod.id],
                pickupLocationIds: [ziyouLocationId],
            },
        });
        log('Create 自由大路 Profile', createSpRes);
        if (createSpRes.errors) { console.error('创建 Profile 失败'); return; }
        profileId = createSpRes.data.createShippingProfile.id;
    }

    // 7. 查询农夫山泉天然水 variant
    const prodRes = await gql(`
        query {
            products(options: { filter: { name: { contains: "农夫山泉" } } }) {
                items { id name slug variants { id name sku } }
            }
        }
    `, {});
    log('Products matching 农夫山泉', prodRes.data?.products?.items || []);
    const products = prodRes.data?.products?.items || [];
    let nongfuVariantId;
    // 匹配"农夫山泉天然水"产品（排除"整箱"），取其第一个 variant
    const nongfuProduct = products.find(p => p.name.includes('天然水'));
    if (nongfuProduct && nongfuProduct.variants?.length) {
        nongfuVariantId = nongfuProduct.variants[0].id;
    }
    if (!nongfuVariantId) {
        console.error('\n未找到农夫山泉天然水商品');
        return;
    }
    console.log(`\n农夫山泉天然水 variant id=${nongfuVariantId}`);

    // 8. 分配 Profile 给农夫山泉
    const assignRes = await gql(`
        mutation($variantIds: [ID!]!, $profileId: ID!) {
            assignShippingProfile(variantIds: $variantIds, profileId: $profileId)
        }
    `, { variantIds: [nongfuVariantId], profileId });
    log('Assign Profile to 农夫山泉', assignRes);

    // 9. 验证：查询 Profile 详情
    const verifyRes = await gql(`
        query($id: ID!) {
            shippingProfile(id: $id) {
                id name code description
                shippingMethods { id code name }
                pickupLocations { id name address type }
            }
        }
    `, { id: profileId });
    log('✅ Final Profile Verification', verifyRes.data?.shippingProfile);

    console.log('\n========== 配置完成 ==========');
    console.log(`自由大路自提点 ID: ${ziyouLocationId}`);
    console.log(`专属 ShippingProfile ID: ${profileId}`);
    console.log(`农夫山泉天然水 Variant ID: ${nongfuVariantId}`);
    console.log('约束: 仅门店自提 + 仅自由大路门店');
}

main().catch(console.error);
