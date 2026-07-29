// 临时脚本：重置 cs1@zhao.test 密码
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
  if (body.errors) throw new Error(JSON.stringify(body.errors));
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
  if (!data.__authToken) throw new Error('Login failed');
  return data.__authToken;
}

async function main() {
  const token = await login('superadmin@china.test', 'superadmin');
  console.log('superadmin login ok');

  // 查询 customer-service 角色 id
  const roles = await gql(
    `query { roles(options: { filter: { code: { eq: "customer-service" } } }) { items { id code } } }`,
    {},
    token,
  );
  const csRoleId = roles.roles.items[0]?.id;
  if (!csRoleId) throw new Error('customer-service role not found');
  console.log('customer-service role id:', csRoleId);

  const admins = await gql(
    `query { administrators(options: { filter: { emailAddress: { eq: "cs1@zhao.test" } } }) { items { id emailAddress } } }`,
    {},
    token,
  );
  console.log('found:', JSON.stringify(admins.administrators.items));

  if (admins.administrators.items.length === 0) {
    console.log('cs1 not found, creating...');
    const created = await gql(
      `mutation($input: CreateAdministratorInput!) {
        createAdministrator(input: $input) { id emailAddress }
      }`,
      {
        input: {
          firstName: 'CS',
          lastName: 'Staff',
          emailAddress: 'cs1@zhao.test',
          password: 'a963963',
          roleIds: [csRoleId],
        },
      },
      token,
    );
    console.log('created:', JSON.stringify(created));
  } else {
    const adminId = admins.administrators.items[0].id;
    console.log('cs1 found, id=' + adminId + ', resetting password...');
    const updated = await gql(
      `mutation($id: ID!, $pwd: String!) {
        updateAdministrator(input: { id: $id, password: $pwd }) { id emailAddress }
      }`,
      { id: adminId, pwd: 'a963963' },
      token,
    );
    console.log('password reset:', JSON.stringify(updated));
  }
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
