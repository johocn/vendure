# Vendure 生产部署安装手册

本方案针对服务器内存不足、无法在服务器上执行构建的场景。**所有构建产物已在本地预编译并提交到 Git 仓库**，服务器只需拉取代码、安装运行时依赖、配置环境变量后即可直接启动，无需执行任何 build 命令。

## 一、环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | `^20.19.0` 或 `>=22.12.0` | 必须满足，使用 `node -v` 验证 |
| PostgreSQL | `>=12` | 主数据库 |
| npm | `>=10` | 随 Node.js 安装 |
| Git | 任意版本 | 拉取代码 |

服务器内存建议 **>= 1GB**（运行时无需构建，内存占用远低于开发模式）。

## 二、快速部署

```bash
# 1. 克隆仓库
git clone <仓库地址> vendure
cd vendure

# 2. 安装运行时依赖（跳过 devDependencies，节省磁盘和内存）
npm install --omit=dev

# 3. 配置环境变量
cp packages/dev-server/.env.example packages/dev-server/.env
# 编辑 .env，填入生产环境配置（参考下一节）

# 4. 准备数据库（PostgreSQL 中创建库）
psql -U postgres -c "CREATE DATABASE vendure OWNER postgres;"

# 5. 启动服务
cd packages/dev-server
node prod-start.js
```

启动成功后控制台会输出 `Vendure server listening on port 3000`。

## 三、环境变量配置

在 `packages/dev-server/.env` 中配置（生产环境必须把 `DEV_BYPASS_*` 全部设为 `false`）：

```env
# === 数据库（必填）===
DB=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<你的数据库密码>
DB_NAME=vendure

# === API 端口 ===
API_PORT=3000

# === 短信 / 手机号登录 ===
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=

# === 微信登录 ===
WECHAT_AUTH_APP_ID=
WECHAT_AUTH_APP_SECRET=
WECHAT_AUTH_MINI_APP_ID=
WECHAT_AUTH_MINI_APP_SECRET=

# === 抖音登录 ===
DOUYIN_AUTH_APP_ID=
DOUYIN_AUTH_APP_SECRET=

# === Redis（可选，用于库存插件）===
REDIS_URL=

# === 快递 100 物流查询（可选）===
KUAIDI100_CUSTOMER=
KUAIDI100_KEY=

# === 生产环境必须关闭调试旁路 ===
DEV_BYPASS_SMS=false
DEV_BYPASS_WECHAT=false
DEV_BYPASS_ALIPAY=false
DEV_BYPASS_DOUYIN=false
```

**说明**：
- `DEV_BYPASS_*=true` 仅用于本地开发，会跳过真实第三方调用返回测试数据。**生产环境必须全部设为 `false`**。
- 租户级配置（支付密钥、地图密钥、SSO Provider 等）通过 Dashboard 的「租户配置中心」页面按 Channel 配置，不写入 `.env`。
- `synchronize=true` 已开启，首次启动会自动建表，无需手动 migration。

## 四、访问地址

启动成功后：

| 入口 | 地址 | 说明 |
|------|------|------|
| Dashboard 管理后台 | `http://<服务器IP>:3000/dashboard` | 管理员登录后使用 |
| Admin GraphQL API | `http://<服务器IP>:3000/admin-api` | 管理端接口 |
| Shop GraphQL API | `http://<服务器IP>:3000/shop-api` | 商城端接口 |

默认管理员账号（首次启动自动创建）：
- 用户名：`superadmin`
- 密码：`superadmin`

**首次登录后请立即在 Dashboard → Profile 修改密码。**

## 五、产物目录说明

以下目录为本地预编译产物，**已提交到 Git，服务器禁止删除或重新构建**：

| 目录 | 内容 |
|------|------|
| `packages/core/dist` | Vendure 核心编译产物 |
| `packages/common/lib` | 公共类型库 |
| `packages/admin-ui-plugin/lib` | Admin UI 插件 |
| `packages/asset-server-plugin/lib` | 资产服务插件 |
| `packages/email-plugin/lib` | 邮件插件 |
| `packages/dashboard/dist` | Dashboard 框架 |
| `packages/telemetry-plugin/dist` | 遥测插件 |
| `packages/graphiql-plugin/dist` | GraphiQL 插件 |
| `packages/<各业务插件>/lib` | 22 个业务插件编译产物 |
| `packages/dev-server/dist` | dev-server 入口 + Dashboard 静态资源 |

## 六、本地重新构建产物

当源代码变更时，在**本地开发机**重新构建并提交：

```powershell
# Windows PowerShell（仓库根目录）
.\build-prod.ps1
```

脚本会按依赖顺序构建：
1. 9 个核心包（common, core, admin-ui-plugin, asset-server-plugin, email-plugin, dashboard, telemetry-plugin, graphiql-plugin）
2. 22 个业务插件
3. dev-server（`tsc -p tsconfig.prod.json` 编译入口 + `npx vite build` 构建 Dashboard 静态资源）

完成后提交：

```bash
git add -A
git commit -m "build: production artifacts"
git push
```

服务器侧执行 `git pull` 即可获取最新产物，无需重新 `npm install`（除非 `package.json` 依赖变更）。

## 七、常用运维命令

```bash
# 停止服务
# 前台运行：Ctrl+C
# 后台运行（推荐用 pm2）：
npm install -g pm2
pm2 start packages/dev-server/prod-start.js --name vendure
pm2 logs vendure
pm2 stop vendure
pm2 restart vendure

# 更新代码
git pull
pm2 restart vendure

# 查看实时日志
pm2 logs vendure --lines 100
```

## 八、常见问题

### Q1: 启动报错 `Cannot find module ... lib/index.js`
**原因**：产物目录缺失或被 `.gitignore` 误伤。
**解决**：在仓库根目录执行 `git status` 确认 `packages/*/lib` 和 `packages/dev-server/dist` 都已跟踪；若未跟踪，检查 `.gitignore` 是否有 `dist` 或 `lib` 行（应为注释状态）。

### Q2: 启动报错 `EFATAL: connect ECONNREFUSED 127.0.0.1:5432`
**原因**：PostgreSQL 未启动或 `.env` 中 `DB_HOST/DB_PORT` 配置错误。
**解决**：确认 PostgreSQL 服务运行中，`.env` 配置正确。

### Q3: Dashboard 显示「Build your dashboard or run in development mode」
**原因**：`packages/dev-server/dist` 中缺少 Dashboard 静态资源（index.html / assets/）。
**解决**：本地执行 `.\build-prod.ps1` 重新构建并 `git push`，服务器 `git pull` 后重启。

### Q4: 内存不足导致启动失败
**原因**：Node.js 默认堆内存不足。
**解决**：启动时指定堆内存：
```bash
node --max-old-space-size=1024 packages/dev-server/prod-start.js
```

### Q5: 第三方登录/支付不生效
**原因**：`.env` 中 `DEV_BYPASS_*=true` 未关闭，或租户配置中心未配置 Channel 级密钥。
**解决**：
1. 确认 `.env` 中所有 `DEV_BYPASS_*` 为 `false`
2. 登录 Dashboard → Settings → Channels → 选择 Channel → 滚动到「租户配置中心」配置支付/微信登录/SSO/地图密钥

## 九、架构备注

- **多租户**：每个 Channel 即一个租户，租户级配置（支付、登录、地图）存储在 Channel 的 customFields（`authConfig`/`payConfig`/`mapConfig`），敏感字段 AES-256-GCM 加密存储。
- **Dashboard 入口**：统一配置中心以 pageBlock 形式注入到 Channel 详情页（位于 custom-fields 区块下方），非左侧独立菜单。
- **数据库同步**：`synchronize=true` 已开启，schema 变更自动应用，无需手动 migration。生产环境如需关闭自动同步，可在 `packages/dev-server/dev-config.ts` 的 `getDbConfig()` 中改为 `false` 并改用 migration 工作流。
