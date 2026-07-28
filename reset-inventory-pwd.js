// e:\code\vendure\reset-inventory-pwd.js
// 创建/重置 inv1@zhao.test 测试账号 (inventory-staff 角色)
// 运行: node reset-inventory-pwd.js
// 鉴权方式：参考 reset-cs-pwd.js，从 response header `vendure-auth-token` 取 Bearer token

const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';

// 统一 GraphQL 请求函数
async function gql(query, variables = {}, token = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    const headerToken = res.headers.get('vendure-auth-token');
    if (headerToken) body.data.__authToken = headerToken;
    return body.data;
}

// 登录函数：从 response header 取 Bearer token
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
    if (!data.__authToken) throw new Error('Login failed');
    return data.__authToken;
}

async function main() {
    // 1. 超管登录
    const token = await login('superadmin@china.test', 'superadmin');
    console.log('✓ superadmin login ok');

    // 2. 查询 inventory-staff 角色 ID
    const rolesRes = await gql(
        `query { roles(options: { filter: { code: { eq: "inventory-staff" } } }) { items { id code } } }`,
        {},
        token,
    );
    const inventoryRoleId = rolesRes.roles.items[0]?.id;
    if (!inventoryRoleId) throw new Error('inventory-staff role not found');
    console.log(`✓ inventory-staff role id: ${inventoryRoleId}`);

    // 3. 查询 inv1@zhao.test 是否已存在
    const adminsRes = await gql(
        `query { administrators(options: { filter: { emailAddress: { eq: "inv1@zhao.test" } } }) { items { id emailAddress } } }`,
        {},
        token,
    );
    const existing = adminsRes.administrators.items[0];

    if (!existing) {
        // 创建
        const created = await gql(
            `mutation($input: CreateAdministratorInput!) {
                createAdministrator(input: $input) { id emailAddress }
            }`,
            {
                input: {
                    firstName: 'Inventory',
                    lastName: 'Staff',
                    emailAddress: 'inv1@zhao.test',
                    password: 'a963963',
                    roleIds: [inventoryRoleId],
                },
            },
            token,
        );
        console.log(`✓ Administrator created: ${created.createAdministrator.emailAddress}`);
    } else {
        // 更新密码 + 角色绑定
        await gql(
            `mutation($id: ID!, $pwd: String!) {
                updateAdministrator(input: { id: $id, password: $pwd }) { id emailAddress }
            }`,
            { id: existing.id, pwd: 'a963963' },
            token,
        );
        await gql(
            `mutation($id: ID!, $roleIds: [ID!]!) {
                updateAdministrator(input: { id: $id, roleIds: $roleIds }) { id emailAddress }
            }`,
            { id: existing.id, roleIds: [inventoryRoleId] },
            token,
        );
        console.log(`✓ Administrator updated: ${existing.emailAddress} (password reset + role bound)`);
    }
}

main().catch(e => {
    console.error('ERROR:', e.message);
    process.exit(1);
});
