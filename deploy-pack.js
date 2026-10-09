const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const ROOT = __dirname;
const PROD = path.join(ROOT, "vendure-prod");
const PKGS = path.join(PROD, "packages");
const DIST = path.join(PROD, "dist");
// 与 packages/dev-server/dev-config.ts 实际 import/注册的 @vendure/* 包全量对齐（宁多勿漏）
const PLUGINS = [
  // 基础设施
  "core","common","admin-ui-plugin","asset-server-plugin","dashboard",
  "email-plugin","cjk-plugin","graphiql-plugin","harden-plugin","telemetry-plugin",
  "job-queue-plugin","order-timeout-plugin",
  // 支付 / 认证 / 存储
  "alipay-plugin","wechatpay-plugin","oss-plugin",
  "phone-auth-plugin","wechat-auth-plugin","douyin-auth-plugin",
  // 业务插件
  "invoice-plugin","invoice-pdf-plugin","logistics-plugin","logistics-api-plugin",
  "delivery-plugin","delivery-gateway-plugin","campus-delivery-plugin","pickup-plugin",
  "group-buy-plugin","flash-sale-plugin","distribution-plugin","eco-plugin",
  "product-survey-plugin","redis-stock-plugin","recharge-card-plugin","after-sales-plugin",
  "member-level-plugin","vcash-pos-plugin","vcash-offline-plugin","checkin-plugin",
  "feedback-plugin","lottery-plugin","shopping-circle-plugin","review-plugin",
  "favorite-plugin","wechat-subscribe-message-plugin","coupon-plugin",
  "campus-jianghu-plugin","sales-plugin","marketplace-plugin","customer-service-plugin",
  "inventory-plugin","message-plugin","notification-plugin","operations-plugin",
  "pre-sale-plugin","payment-schedule-plugin","installment-plugin","rental-plugin",
  "live-streaming-plugin","shop-plugin","shop-template-plugin","tcm-clinic-plugin",
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
// 注意：tsc 不允许 --project 与源文件混用（TS5042），改为生成临时 tsconfig（extends dev-server 配置以保留 paths 映射）
console.log("=== Compile entry points ===");
const deployTsconfig = {
  extends: "./packages/dev-server/tsconfig.json",
  compilerOptions: {
    declaration: false,
    sourceMap: false,
    module: "commonjs",
    moduleResolution: "node",
    target: "es2017",
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    emitDecoratorMetadata: true,
    experimentalDecorators: true,
    outDir: path.relative(ROOT, DIST).split(path.sep).join("/"),
  },
  files: [
    "packages/dev-server/index.ts",
    "packages/dev-server/index-worker.ts",
    "packages/dev-server/migration.ts",
  ],
};
const tsconfigPackPath = path.join(ROOT, "tsconfig.deploy-pack.json");
fs.writeFileSync(tsconfigPackPath, JSON.stringify(deployTsconfig, null, 2));
execSync(`npx tsc --project "${tsconfigPackPath}"`, { stdio: "inherit", cwd: ROOT });
fs.rmSync(tsconfigPackPath, { force: true });
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
