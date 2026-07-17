# 生产构建脚本 - 本地执行，产物提交到 git，服务器直接运行无需构建
# 用法：在仓库根目录执行 .\build-prod.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSCommandPath
Set-Location $root

Write-Host "=== Vendure 生产构建 ===" -ForegroundColor Cyan

# 1. 构建核心包（按依赖顺序）
$corePkgs = @(
    "common",
    "core",
    "admin-ui-plugin",
    "asset-server-plugin",
    "email-plugin",
    "ui-devkit",
    "dashboard",
    "telemetry-plugin",
    "graphiql-plugin"
)
foreach ($pkg in $corePkgs) {
    Write-Host "`n--- 构建 $pkg ---" -ForegroundColor Yellow
    Push-Location "packages/$pkg"
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "$pkg build failed" }
    Pop-Location
}

# 2. 构建业务插件
$bizPkgs = @(
    "cjk-plugin",
    "alipay-plugin",
    "wechatpay-plugin",
    "oss-plugin",
    "phone-auth-plugin",
    "wechat-auth-plugin",
    "douyin-auth-plugin",
    "order-timeout-plugin",
    "invoice-plugin",
    "logistics-plugin",
    "group-buy-plugin",
    "flash-sale-plugin",
    "distribution-plugin",
    "redis-stock-plugin",
    "logistics-api-plugin",
    "invoice-pdf-plugin",
    "recharge-card-plugin",
    "after-sales-plugin",
    "member-level-plugin",
    "review-plugin",
    "wechat-subscribe-message-plugin",
    "coupon-plugin"
)
foreach ($pkg in $bizPkgs) {
    Write-Host "`n--- 构建 $pkg ---" -ForegroundColor Yellow
    Push-Location "packages/$pkg"
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "$pkg build failed" }
    Pop-Location
}

# 3. 构建 dev-server
# 3a. TypeScript 编译（index.ts -> dist/index.js，生产入口）
Write-Host "`n--- 构建 dev-server (tsc) ---" -ForegroundColor Yellow
Push-Location "packages/dev-server"
tsc -p tsconfig.prod.json
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "dev-server tsc failed" }

# 3b. Dashboard 静态资源构建（vite build -> dist/）
Write-Host "`n--- 构建 dev-server (vite dashboard) ---" -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "dev-server vite build failed" }
Pop-Location

Write-Host "`n=== 构建完成 ===" -ForegroundColor Green
Write-Host "产物已生成，请提交到 git：" -ForegroundColor Cyan
Write-Host "  git add -A"
Write-Host "  git commit -m 'build: production artifacts'"
Write-Host "  git push"
Write-Host "`n服务器部署参考 INSTALL.md" -ForegroundColor Cyan
