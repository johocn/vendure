// 临时脚本：创建 ops1@zhao.test 账户（用 roleIds 而非 roleCodes）
const fetch = require('node-fetch');
const ADMIN_API = 'http://localhost:3000/admin-api';

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
    console.error('GraphQL errors:', JSON.stringify(body.errors, null, 2));
    throw new Error(body.errors.map(e => e.message).join('; '));
  }
  const headerToken = res.headers.get('vendure-auth-token');
  if (headerToken) body.data.__authToken = headerToken;
  return body.data;
}

async function main() {
  // 1. superadmin login
  const loginData = await gql(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        ... on CurrentUser { identifier id }
        ... on InvalidCredentialsError { message }
      }
    }`,
    { username: 'superadmin@china.test', password: 'superadmin' },
  );
  const token = loginData.__authToken;
  console.log('superadmin login:', token ? 'OK' : 'FAIL');

  // 2. Find operations-staff role ID
  const rolesData = await gql(
    `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { id code } } }`,
    {},
    token,
  );
  const opsRoleId = rolesData.roles.items[0]?.id;
  console.log('operations-staff role id:', opsRoleId);
  if (!opsRoleId) throw new Error('operations-staff role not found');

  // 3. Create ops1 administrator with roleIds
  console.log('\nCreating ops1@zhao.test...');
  try {
    const createData = await gql(
      `mutation CreateAdmin($input: CreateAdministratorInput!) {
        createAdministrator(input: $input) { id emailAddress }
      }`,
      {
        input: {
          firstName: 'Ops',
          lastName: 'Staff',
          emailAddress: 'ops1@zhao.test',
          password: 'a963963',
          roleIds: [opsRoleId],
        },
      },
      token,
    );
    console.log('Created:', createData.createAdministrator.emailAddress, 'id:', createData.createAdministrator.id);
  } catch (e) {
    console.error('Create failed:', e.message);
  }
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
