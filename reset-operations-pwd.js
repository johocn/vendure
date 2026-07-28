// e:\code\vendure\reset-operations-pwd.js
// Sets up test account: ops1@zhao.test / a963963 with operations-staff role
// Usage: node reset-operations-pwd.js
//
// Implementation note: Uses admin GraphQL API (consistent with reset-cs-pwd.js
// and test-sales-flow.js). Avoids direct DB access to be cross-database
// compatible (dev-config default is MariaDB; PostgreSQL is also supported).
// Vendure's User entity table name is `user` (reserved keyword in PostgreSQL)
// and `user_record` is NOT a valid table name. Role.permissions is stored as
// simple-array (comma-separated string), not JSON.

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

async function login(username, password) {
  const data = await gql(
    `mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        ... on CurrentUser { identifier id }
        ... on InvalidCredentialsError { message }
      }
    }`,
    { username, password },
  );
  if (!data.__authToken) {
    throw new Error('Login failed: ' + (data.login?.message ?? 'no token returned'));
  }
  return data.__authToken;
}

async function main() {
  console.log('=== Operations test account setup ===\n');

  // 1. superadmin login
  const adminToken = await login('superadmin@china.test', 'superadmin');
  console.log('superadmin login ok');

  // 2. Verify operations-staff role exists (RoleSync should have created it)
  const rolesData = await gql(
    `query { roles(options: { filter: { code: { eq: "operations-staff" } } }) { items { id code permissions } } }`,
    {},
    adminToken,
  );
  const opsRole = rolesData.roles.items[0];
  if (!opsRole) {
    console.error('operations-staff role not found. Start the server first to trigger RoleSync.');
    process.exit(1);
  }
  console.log(`operations-staff role found: id=${opsRole.id}`);
  console.log(`  permissions: ${opsRole.permissions.join(', ')}`);

  // 3. Create ops1 administrator (skip if exists)
  try {
    await gql(
      `mutation {
        createAdministrator(input: {
          firstName: "Ops"
          lastName: "Staff"
          emailAddress: "ops1@zhao.test"
          password: "a963963"
          roleCodes: ["operations-staff"]
        }) { id }
      }`,
      {},
      adminToken,
    );
    console.log('Created administrator ops1@zhao.test');
  } catch (e) {
    console.log('Administrator ops1@zhao.test already exists, skipping creation');
  }

  console.log('\nDone. Login: ops1@zhao.test / a963963');
}

main().catch(e => {
  console.error(e?.message ?? e);
  process.exit(1);
});
