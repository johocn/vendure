const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };
const MARKETING_STAFF = {
    emailAddress: 'marketing1@zhao.test',
    password: 'a963963',
    firstName: '运营',
    lastName: '营销',
};

async function gql(query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(ADMIN_API, {
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

async function login(username, password) {
    const data = await gql(
        `mutation Login($username: String!, $password: String!) {
            login(username: $username, password: $password) {
                ... on CurrentUser { identifier }
                ... on InvalidCredentialsError { message }
            }
        }`,
        { username, password },
    );
    if (!data.__authToken) {
        throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    }
    return data.__authToken;
}

async function main() {
    console.log('=== 营销模块测试账号初始化 ===\n');

    console.log('[1] 超管登录...');
    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    console.log('  ✓ superadmin login ok\n');

    console.log('[2] 查询 operations-staff 角色...');
    const rolesData = await gql(
        `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { id code } } }`,
        {},
        adminToken,
    );
    const opsRoleId = rolesData.roles.items[0]?.id;
    if (!opsRoleId) throw new Error('operations-staff 角色不存在');
    console.log(`  ✓ operations-staff role id: ${opsRoleId}\n`);

    console.log('[3] 检查 marketing1 账号...');
    const adminList = await gql(
        `query { administrators(options: { filter: { emailAddress: { eq: "${MARKETING_STAFF.emailAddress}" } } }) { items { id emailAddress } } }`,
        {},
        adminToken,
    );
    let marketing1 = adminList.administrators.items[0];

    if (!marketing1) {
        console.log('  创建 marketing1 账号...');
        const created = await gql(
            `mutation CreateAdmin($input: CreateAdministratorInput!) {
                createAdministrator(input: $input) {
                    ... on Administrator { id emailAddress }
                }
            }`,
            {
                input: {
                    emailAddress: MARKETING_STAFF.emailAddress,
                    firstName: MARKETING_STAFF.firstName,
                    lastName: MARKETING_STAFF.lastName,
                    password: MARKETING_STAFF.password,
                    roleIds: [opsRoleId],
                    customFields: {},
                },
            },
            adminToken,
        );
        marketing1 = created.createAdministrator;
        console.log(`  ✓ Administrator created: ${marketing1.emailAddress}\n`);
    } else {
        console.log(`  ✓ marketing1 already exists: ${marketing1.emailAddress}\n`);
    }

    console.log('[4] 验证 marketing1 登录...');
    const staffToken = await login(MARKETING_STAFF.emailAddress, MARKETING_STAFF.password);
    console.log('  ✓ marketing1 login verified, token acquired\n');

    console.log('=== 完成 ===');
    console.log(`测试账号: ${MARKETING_STAFF.emailAddress} / ${MARKETING_STAFF.password}`);
}

main().catch(e => {
    console.error('失败:', e.message);
    process.exit(1);
});
