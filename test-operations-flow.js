// e:\code\vendure\test-operations-flow.js
// E2E tests for operations module (10 groups)
// Usage: node test-operations-flow.js
//
// Implementation note: Uses admin GraphQL API exclusively (no direct DB access)
// to be cross-database compatible. dev-config default is MariaDB; PostgreSQL
// also supported. Login token is returned in response header `vendure-auth-token`.
//
// Prerequisites:
//   1. dev-server running (npm run dev in packages/dev-server)
//   2. Run reset-operations-pwd.js to create ops1@zhao.test account
//   3. (Optional) Run test-sales-flow.js to create sales1@zhao.test for [10]
//      permission isolation test. If sales1 doesn't exist, [10] is skipped.

const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SHOP_API = 'http://localhost:3000/shop-api';

const OPS_EMAIL = 'ops1@zhao.test';
const OPS_PWD = 'a963963';
const SALES_EMAIL = 'sales1@zhao.test';
const SALES_PWD = 'a963963';

let opsToken = '';
let salesToken = '';
let superAdminToken = '';
let createdItemIds = [];

async function gql(endpoint, query, variables = {}, token = '') {
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

async function adminGql(query, variables = {}, token = opsToken) {
    return gql(ADMIN_API, query, variables, token);
}

async function shopGql(query, variables = {}, token = '') {
    return gql(SHOP_API, query, variables, token);
}

async function login(email, pwd) {
    const data = await adminGql(
        `mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier id }
                ... on InvalidCredentialsError { message }
            }
        }`,
        { username: email, password: pwd },
        '',
    );
    if (!data.__authToken) {
        throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    }
    return data.__authToken;
}

let pass = 0, fail = 0;
function assert(cond, msg) {
    if (cond) { pass++; console.log(`  ✓ ${msg}`); }
    else { fail++; console.log(`  ✗ ${msg}`); }
}

async function main() {
    console.log('=== Operations Module E2E Tests ===\n');

    // Login
    console.log('Logging in...');
    opsToken = await login(OPS_EMAIL, OPS_PWD);
    console.log('ops1 login OK');
    try {
        superAdminToken = await login('superadmin@china.test', 'superadmin');
    } catch (e) { console.log('superadmin login skipped'); }
    try {
        salesToken = await login(SALES_EMAIL, SALES_PWD);
        console.log('sales1 login OK');
    } catch (e) { console.log('sales1 login skipped (account may not exist; [10] will be skipped)'); }

    // [1] Role permissions sync (via admin API, not pg)
    console.log('\n[1] Role permissions sync');
    if (superAdminToken) {
        const rolesData = await adminGql(
            `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { code permissions } } }`,
            {},
            superAdminToken,
        );
        const opsRole = rolesData.roles.items[0];
        const perms = opsRole?.permissions ?? [];
        assert(perms.includes('ViewDashboard'), 'operations-staff has ViewDashboard');
        assert(perms.includes('ManageBanner'), 'operations-staff has ManageBanner');
        assert(perms.includes('ManageRecommendation'), 'operations-staff has ManageRecommendation');
        assert(perms.includes('ManageNotice'), 'operations-staff has ManageNotice');
        assert(perms.includes('ManageFloor'), 'operations-staff has ManageFloor');

        const mgrData = await adminGql(
            `query { roles(options: { filter: { code: { eq: "manager" } } }) { items { code permissions } } }`,
            {},
            superAdminToken,
        );
        const mgrPerms = mgrData.roles.items[0]?.permissions ?? [];
        assert(mgrPerms.includes('ManageBanner'), 'manager has ManageBanner');
        assert(mgrPerms.includes('ManageFloor'), 'manager has ManageFloor');
    } else {
        console.log('  (skipped: superadmin login failed)');
    }

    // [2] Dashboard queries
    console.log('\n[2] Dashboard queries');
    const overview = await adminGql(`query { dashboardOverview(range: "today") { sales { orderCount gmv } delivery { pending } } }`);
    assert(overview.dashboardOverview !== null, 'dashboardOverview returns data');

    const trend = await adminGql(`query { salesTrend(days: 7) { date orderCount gmv } }`);
    assert(Array.isArray(trend.salesTrend), 'salesTrend(7) returns array');

    const top = await adminGql(`query { categoryTop(days: 7) { categoryId categoryName gmv } }`);
    assert(Array.isArray(top.categoryTop), 'categoryTop(7) returns array');

    // [3] CMS create (4 types)
    console.log('\n[3] CMS create (4 types)');
    const types = [
        { type: 'Banner', code: 'test_banner_1', name: '测试Banner', data: { imageUrl: 'http://example.com/b.png', linkUrl: '', linkType: 'link' } },
        { type: 'Recommendation', code: 'test_rec_1', name: '测试推荐', data: { itemType: 'product', itemId: '1', imageUrl: 'http://example.com/r.png' } },
        { type: 'Notice', code: 'test_notice_1', name: '测试公告', data: { content: '测试内容', popup: false } },
        { type: 'Floor', code: 'test_floor_1', name: '测试楼层', data: { title: '热销', layout: 'grid', items: [] } },
    ];
    for (const t of types) {
        const created = await adminGql(
            `mutation Create($input: CreateContentItemInput!) { createContentItem(input: $input) { id type code name enabled sort position } }`,
            { input: { ...t, position: 'home', sort: 0 } }
        );
        assert(created.createContentItem.id, `Created ${t.type}`);
        createdItemIds.push(created.createContentItem.id);
    }

    // [4] Unique constraint
    console.log('\n[4] Unique constraint');
    try {
        await adminGql(
            `mutation Create($input: CreateContentItemInput!) { createContentItem(input: $input) { id } }`,
            { input: { type: 'Banner', code: 'test_banner_1', name: 'dup', position: 'home', data: { imageUrl: 'x' } } }
        );
        assert(false, 'Duplicate code should fail');
    } catch (e) {
        assert(e.message.includes('already exists'), 'Duplicate code throws UserInputError');
    }

    // [5] Data validation
    console.log('\n[5] Data validation');
    try {
        await adminGql(
            `mutation Create($input: CreateContentItemInput!) { createContentItem(input: $input) { id } }`,
            { input: { type: 'Banner', code: 'test_invalid', name: 'invalid', position: 'home', data: { linkUrl: 'x' } } }
        );
        assert(false, 'Banner without imageUrl should fail');
    } catch (e) {
        assert(e.message.includes('imageUrl'), 'Banner missing imageUrl throws error');
    }

    // [6] Update
    console.log('\n[6] Update');
    const firstId = createdItemIds[0];
    const updated = await adminGql(
        `mutation Update($id: ID!, $input: UpdateContentItemInput!) { updateContentItem(id: $id, input: $input) { id name sort } }`,
        { id: firstId, input: { name: '更新后的Banner', sort: 99 } }
    );
    assert(updated.updateContentItem.name === '更新后的Banner', 'Name updated');
    assert(updated.updateContentItem.sort === 99, 'Sort updated');

    // [7] Soft delete
    console.log('\n[7] Soft delete');
    const deleteId = createdItemIds[1];
    const delRes = await adminGql(`mutation Del($id: ID!) { deleteContentItem(id: $id) }`, { id: deleteId });
    assert(delRes.deleteContentItem === true, 'deleteContentItem returns true');

    // Verify not in list
    const listRes = await adminGql(`query { contentItems(type: "Recommendation") { items { id } } }`);
    assert(!listRes.contentItems.items.find(i => i.id === deleteId), 'Soft-deleted item not in list');

    // Verify same code can be re-created
    try {
        const recreated = await adminGql(
            `mutation Create($input: CreateContentItemInput!) { createContentItem(input: $input) { id } }`,
            { input: { type: 'Recommendation', code: 'test_rec_1', name: '重建', position: 'home', data: { itemType: 'product', itemId: '1' } } }
        );
        assert(recreated.createContentItem.id, 'Same code re-created after soft delete');
        createdItemIds.push(recreated.createContentItem.id);
    } catch (e) {
        assert(false, `Re-create should succeed: ${e.message}`);
    }

    // [8] Auto online/offline (synchronous via triggerContentLifecycle mutation)
    console.log('\n[8] Auto online/offline (via triggerContentLifecycle)');
    // Create item with startAt in the past, enabled=true. publishedAt is null after creation.
    const autoItem = await adminGql(
        `mutation Create($input: CreateContentItemInput!) {
            createContentItem(input: $input) { id publishedAt }
        }`,
        {
            input: {
                type: 'Banner',
                code: 'test_auto_publish',
                name: 'AutoPublish',
                position: 'home',
                sort: 0,
                startAt: new Date(Date.now() - 60_000).toISOString(),
                data: { imageUrl: 'x' },
            },
        },
    );
    const autoId = autoItem.createContentItem.id;
    createdItemIds.push(autoId);
    assert(autoItem.createContentItem.publishedAt === null, 'Newly created item has publishedAt=null');

    // Manually trigger lifecycle check (avoids waiting 60s for ScheduledTask)
    const triggerRes = await adminGql(`mutation { triggerContentLifecycle { published unpublished } }`);
    assert(triggerRes.triggerContentLifecycle.published >= 1, 'triggerContentLifecycle published >= 1');

    // Verify the item is now published
    const checkItem = await adminGql(
        `query($id: ID!) { contentItem(id: $id) { id publishedAt } }`,
        { id: autoId },
    );
    assert(checkItem.contentItem.publishedAt !== null, 'Auto-published item has publishedAt set');

    // [9] shop-api publishedContent
    console.log('\n[9] shop-api publishedContent');
    const pubRes = await shopGql(`query { publishedContent(type: "Banner") { id code name } }`);
    assert(Array.isArray(pubRes.publishedContent), 'publishedContent returns array');

    // [10] Permission isolation (sales1@zhao.test should NOT have ops perms)
    console.log('\n[10] Permission isolation');
    if (salesToken) {
        // sales-staff should not have ViewDashboard permission
        // Note: gql() throws on body.errors (which Vendure returns for ForbiddenError)
        try {
            await adminGql(
                `query { dashboardOverview(range: "today") { sales { orderCount } } }`,
                {},
                salesToken,
            );
            assert(false, 'sales-staff should not access dashboard');
        } catch (e) {
            assert(
                e.message.includes('authorized') ||
                e.message.includes('forbidden') ||
                e.message.includes('permission') ||
                e.message.includes('Forbidden'),
                'sales-staff cannot access dashboard (throws auth error)',
            );
        }

        // sales-staff should not be able to create Banner
        try {
            await adminGql(
                `mutation Create($input: CreateContentItemInput!) { createContentItem(input: $input) { id } }`,
                { input: { type: 'Banner', code: 'perm_test', name: 'x', position: 'home', data: { imageUrl: 'x' } } },
                salesToken,
            );
            assert(false, 'sales-staff should not create Banner');
        } catch (e) {
            assert(
                e.message.includes('authorized') ||
                e.message.includes('forbidden') ||
                e.message.includes('permission') ||
                e.message.includes('Forbidden'),
                'sales-staff create Banner throws auth error',
            );
        }
    } else {
        console.log('  (skipped: sales1@zhao.test account not available; run test-sales-flow.js first)');
    }

    // Cleanup (soft-delete all created items)
    console.log('\n[Cleanup] Deleting test items...');
    for (const id of createdItemIds) {
        try {
            await adminGql(`mutation Del($id: ID!) { deleteContentItem(id: $id) }`, { id });
        } catch (e) { /* ignore */ }
    }

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal:', e?.message ?? e);
    process.exit(1);
});
