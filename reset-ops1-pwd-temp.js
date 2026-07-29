// 临时脚本：重置 ops1@zhao.test 密码为 a963963
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
    const err = new Error(body.errors.map(e => e.message).join('; '));
    err.body = body;
    throw err;
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

  // 2. Find ops1 administrator
  const adminsData = await gql(
    `query Admins($options: AdministratorListOptions) {
      administrators(options: $options) { items { id emailAddress firstName lastName } }
    }`,
    { options: { filter: { emailAddress: { eq: 'ops1@zhao.test' } } } },
    token,
  );
  const ops1 = adminsData.administrators.items[0];
  console.log('Found ops1:', ops1 ? ops1.id : 'NOT FOUND');
  if (!ops1) {
    const all = await gql(`query { administrators { items { id emailAddress } } }`, {}, token);
    console.log('Available admins:', JSON.stringify(all.administrators.items, null, 2));
    return;
  }

  // 3. Update ops1 password
  const updateData = await gql(
    `mutation UpdateAdmin($id: ID!, $input: UpdateAdministratorInput!) {
      updateAdministrator(id: $id, input: $input) { id emailAddress }
    }`,
    { id: ops1.id, input: { password: 'a963963' } },
    token,
  );
  console.log('Password updated:', updateData.updateAdministrator.emailAddress);
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
