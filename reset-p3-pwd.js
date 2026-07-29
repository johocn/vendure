const fetch = require('node-fetch');

const ADMIN_API = 'http://localhost:3000/admin-api';
const SUPER_ADMIN = { username: 'superadmin@china.test', password: 'superadmin' };

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
    if (!data.__authToken) throw new Error('Login failed: ' + (data.login?.message ?? 'no token'));
    return data.__authToken;
}

async function main() {
    console.log('=== P3 测试账号初始化 ===\n');
    console.log('[1] 超管登录...');
    const adminToken = await login(SUPER_ADMIN.username, SUPER_ADMIN.password);
    console.log('  ✓ superadmin login ok\n');

    console.log('[2] 查询 operations-staff 角色...');
    const rolesData = await gql(
        `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { id code permissions } } }`,
        {},
        adminToken,
    );
    const opsRoleId = rolesData.roles.items[0]?.id;
    if (!opsRoleId) throw new Error('operations-staff 角色不存在');
    const perms = rolesData.roles.items[0].permissions;
    const hasMember = perms.includes('ManageMember');
    const hasMessage = perms.includes('ManageMessage');
    console.log(`  ✓ operations-staff: ManageMember=${hasMember}, ManageMessage=${hasMessage}\n`);

    if (!hasMember || !hasMessage) {
        console.log('  ⚠ 权限未同步，请重启 dev-server 触发 RoleSyncService\n');
    }

    console.log('=== 完成 ===');
    console.log('测试账号: marketing1@zhao.test / a963963');
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
