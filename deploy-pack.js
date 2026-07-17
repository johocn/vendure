const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const ROOT = __dirname;
const PROD = path.join(ROOT, "vendure-prod");
const PKGS = path.join(PROD, "packages");
const DIST = path.join(PROD, "dist");
const PLUGINS = [
  "core","common","admin-ui-plugin","asset-server-plugin",
  "email-plugin","cjk-plugin","alipay-plugin","wechatpay-plugin",
  "oss-plugin","phone-auth-plugin","wechat-auth-plugin",
  "order-timeout-plugin","invoice-plugin","logistics-plugin",
  "group-buy-plugin","flash-sale-plugin","distribution-plugin",
  "redis-stock-plugin","logistics-api-plugin","invoice-pdf-plugin",
  "recharge-card-plugin","after-sales-plugin","job-queue-plugin",
  "graphiql-plugin","harden-plugin","telemetry-plugin","dashboard",
];
function copy(src, dst) {
  if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true, force: true });
}
// Clean and create dirs
if (fs.existsSync(PROD)) fs.rmSync(PROD, { recursive: true, force: true });
fs.mkdirSync(PKGS, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
// Step 1: Copy compiled packages
console.log("=== Copy compiled packages ===");
for (const pkg of PLUGINS) {
  const src = path.join(ROOT, "packages", pkg);
  const dst = path.join(PKGS, pkg);
  if (!fs.existsSync(src)) { console.log("  SKIP: " + pkg); continue; }
  copy(path.join(src, "lib"), path.join(dst, "lib"));
  copy(path.join(src, "dist"), path.join(dst, "dist"));
  copy(path.join(src, "templates"), path.join(dst, "templates"));
  copy(path.join(src, "package.json"), path.join(dst, "package.json"));
  copy(path.join(src, "index.js"), path.join(dst, "index.js"));
  console.log("  OK: " + pkg);
}
// Step 2: Compile entry points
console.log("=== Compile entry points ===");
const tscCmd = "npx tsc --project packages/dev-server/tsconfig.json"
  + " --outDir " + DIST
  + " --declaration false --sourceMap false --module commonjs"
  + " --target es2017 --skipLibCheck --esModuleInterop"
  + " --resolveJsonModule --emitDecoratorMetadata --experimentalDecorators"
  + " packages/dev-server/index.ts packages/dev-server/index-worker.ts"
  + " packages/dev-server/migration.ts";
execSync(tscCmd, { stdio: "inherit", cwd: ROOT });
// Step 3: Create config files
console.log("=== Create config ===");
fs.writeFileSync(path.join(PROD, "package.json"), JSON.stringify({
  name: "vendure-production", version: "1.0.0", private: true,
  scripts: {
    start: "node dist/index.js",
    "start:worker": "node dist/index-worker.js",
  },
  workspaces: ["packages/*"],
  dependencies: { dotenv: "^16.0.0", pg: "^8.13.1" },
}, null, 2));
fs.writeFileSync(path.join(PROD, ".env"), [
  "DB=postgres", "DB_HOST=127.0.0.1", "DB_PORT=5432",
  "DB_USERNAME=vendure", "DB_PASSWORD=password", "DB_NAME=vendure_prod",
  "API_PORT=3000", "COOKIE_SECRET=change-me",
].join("\n") + "\n");
console.log("=== Done ===");
console.log("Package at: " + PROD);
console.log("Run: tar -czf vendure-prod.tar.gz vendure-prod/");
