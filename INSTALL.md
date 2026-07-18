# Vendure 生产部署安装手册

本方案针对服务器内存不足、无法在服务器上执行构建的场景。**所有构建产物已在本地预编译并提交到 Git 仓库**，服务器只需拉取代码、安装运行时依赖、配置环境变量后即可直接启动，无需执行任何 build 命令。

## 一、环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | `^20.19.0` 或 `>=22.12.0` | 使用 `node -v` 验证 |
| PostgreSQL | `>=12` | 主数据库 |
| npm | `>=10` | 随 Node.js 安装 |
| Git | 任意版本 | 拉取代码 |
| pm2 | 最新版 | 进程守护（推荐） |

服务器内存建议 **>= 2GB**（1GB 也可运行，但需严格限制 Node 堆内存）。

## 二、快速部署（完整流程）

### 步骤 1：克隆仓库

```bash
git clone <仓库地址> vendure
cd vendure
```

### 步骤 2：安装运行时依赖

**2GB 内存服务器推荐**（限制堆内存 + 跳过可选依赖和编译脚本）：

```bash
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev --no-optional --ignore-scripts
```

**关键参数说明**：
- `--max-old-space-size=512`：限制 npm 自身堆内存 512MB，避免 OOM
- `--omit=dev`：跳过 devDependencies
- `--no-optional`：跳过 optionalDependencies（含 sharp 平台二进制，后续单独补装）
- `--ignore-scripts`：跳过 postinstall 脚本（避免触发 better-sqlite3 等原生模块编译）

**4GB+ 内存服务器**可简化：

```bash
npm install --omit=dev
```

### 步骤 3：补装 sharp 平台二进制（必须）

步骤 2 用 `--no-optional` 跳过了 sharp 的 linux-x64 二进制，asset-server-plugin 依赖 sharp 做图像处理，必须补装：

```bash
npm install --os=linux --cpu=x64 @img/sharp-linux-x64
node -e "require('sharp'); console.log('sharp OK')"
```

> 如果验证输出 `sharp OK` 即可。该包为预编译二进制，无需编译，2GB 服务器可安全安装。

### 步骤 4：配置环境变量

```bash
cp packages/dev-server/.env.example packages/dev-server/.env
vi packages/dev-server/.env
```

**必填项**：
- `DB_PASSWORD`：PostgreSQL 密码
- 确认 `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_NAME` 正确
- 确认所有 `DEV_BYPASS_*` 为 `false`（生产环境必须关闭调试旁路）

### 步骤 5：准备数据库

```bash
psql -U postgres -c "CREATE DATABASE vendure OWNER postgres;"
```

### 步骤 6：验证关键产物存在

```bash
ls node_modules/@vendure/core/dist/index.js
ls packages/dev-server/dist/index.js
ls packages/dev-server/dist/index.html
ls packages/dev-server/dist/test-plugins/floor-builder/index.js
```

如果任何文件缺失，说明 Git 拉取不完整，执行 `git pull` 重新拉取。

### 步骤 7：启动服务

**前台启动（验证用）**：

```bash
cd packages/dev-server
NODE_OPTIONS="--max-old-space-size=768" node prod-start.js
```

**后台守护启动（生产推荐用 pm2）**：

```bash
# 安装 pm2（如未安装）
npm install -g pm2

# 彻底清理可能残留的旧进程（重要）
pm2 delete vendure 2>/dev/null
pm2 kill
pm2 clear

# 启动（注意：script 用绝对路径，--cwd 指向 packages/dev-server）
pm2 start /www/apps/vendure/packages/dev-server/prod-start.js \
  --name vendure \
  --cwd /www/apps/vendure/packages/dev-server \
  --max-memory-restart 1G \
  --node-args="--max-old-space-size=768"

# 查看日志
pm2 logs vendure --lines 80

# 保存进程列表 + 开机自启
pm2 save
pm2 startup
```

启动成功后日志会输出：

```
Vendure server (v3.6.4) now running on port 3020
Shop API:       http://localhost:3020/shop-api
Admin API:      http://localhost:3020/admin-api
Dashboard UI:   http://localhost:3020/dashboard
Admin UI:       http://localhost:3020/admin
```

> 端口号取决于 `.env` 中的 `API_PORT` 配置。

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
API_PORT=3020

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

启动成功后（替换 `<服务器IP>` 和 `<端口>`）：

| 入口 | 地址 | 说明 |
|------|------|------|
| Dashboard 管理后台 | `http://<服务器IP>:<端口>/dashboard` | 管理员登录后使用 |
| Admin UI | `http://<服务器IP>:<端口>/admin` | 传统 Admin 后台 |
| Admin GraphQL API | `http://<服务器IP>:<端口>/admin-api` | 管理端接口 |
| Shop GraphQL API | `http://<服务器IP>:<端口>/shop-api` | 商城端接口 |
| GraphiQL Admin | `http://<服务器IP>:<端口>/graphiql/admin` | GraphQL 调试工具 |
| Asset Server | `http://<服务器IP>:<端口>/assets` | 静态资源服务 |

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
| `packages/dev-server/dist` | dev-server 入口 + Dashboard 静态资源 + test-plugins |

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
# 查看日志
pm2 logs vendure --lines 100

# 重启
pm2 restart vendure

# 停止
pm2 stop vendure

# 更新代码
cd /www/apps/vendure
git pull
pm2 restart vendure

# 查看进程状态
pm2 status
pm2 describe vendure
```

## 八、常见问题

### Q1: `npm install` 报 `ENOENT: directory not empty, rename ... @eslint/eslintrc`

**原因**：之前安装残留了嵌套 `packages/*/node_modules`，导致 npm rename 失败。

**解决**：彻底清理所有层级的 node_modules 后重装：

```bash
find . -name "node_modules" -type d -prune -exec rm -rf {} +
rm -f package-lock.json packages/*/package-lock.json
npm cache clean --force
NODE_OPTIONS="--max-old-space-size=512" npm install --omit=dev --no-optional --ignore-scripts
```

### Q2: `npm install` 报 `gyp ERR! configure error` / `better-sqlite3` 编译失败

**原因**：未加 `--ignore-scripts`，触发了 better-sqlite3 的 postinstall 编译，而服务器 Python 版本过低（需 Python 3.8+）或不支持 `:=` 语法。

**解决**：
1. 安装时必须加 `--ignore-scripts`（见步骤 2）
2. 生产环境用 PostgreSQL，不需要 better-sqlite3，编译失败可忽略
3. 如已误触发编译失败，按 Q1 清理后重装

### Q3: 启动报错 `Could not load the "sharp" module using the linux-x64 runtime`

**原因**：安装时用 `--no-optional` 跳过了 sharp 的平台特定二进制 `@img/sharp-linux-x64`。

**解决**：单独补装（见步骤 3）：

```bash
npm install --os=linux --cpu=x64 @img/sharp-linux-x64
node -e "require('sharp'); console.log('sharp OK')"
```

### Q4: 启动报错 `Cannot find module '/www/apps/vendure'`

**原因**：pm2 之前注册的进程入口指向了目录而非 `prod-start.js` 文件。

**解决**：彻底清理 pm2 并用正确参数重新注册：

```bash
pm2 delete vendure 2>/dev/null
pm2 kill
pm2 clear

pm2 start /www/apps/vendure/packages/dev-server/prod-start.js \
  --name vendure \
  --cwd /www/apps/vendure/packages/dev-server \
  --max-memory-restart 1G \
  --node-args="--max-old-space-size=768"
```

**关键**：
- script 参数用**绝对路径**（如 `/www/apps/vendure/packages/dev-server/prod-start.js`）
- `--cwd` 指向 `packages/dev-server`（让 dotenv 找到 `.env`，让 `require('./dist/index')` 能解析）

### Q5: 启动报错 `Cannot find module './test-plugins/floor-builder'`

**原因**：dev-config.ts 静态引用了 3 个开发演示插件（ReviewsPlugin, FloorBuilderPlugin, NavModifierPlugin），其源码有复杂 Angular UI 依赖，不适合 tsc prod 编译。

**解决**：产物已包含 `dist/test-plugins/` 目录（从源码 `test-plugins/*.js` 复制）。如仍报错，确认 Git 拉取完整：

```bash
ls packages/dev-server/dist/test-plugins/floor-builder/index.js
```

如果文件不存在，执行 `git pull` 重新拉取。

> 生产模式下 `IS_PROD=true`，这 3 个插件会通过 `devOnlyPlugins = []` 被跳过，不会实际加载，但静态 import 仍需文件存在以通过 require 解析。

### Q6: 启动报错 `ENOENT: no such file or directory, scandir '.../email-plugin/templates/partials'`

**原因**：`__dirname` 在 prod 模式下是 `packages/dev-server/dist`，相对路径 `../email-plugin/templates` 解析成错误的 `packages/dev-server/email-plugin/templates`。

**解决**：已在 dev-config.ts 中引入 `devServerDir` 变量统一解析路径（无论 dev/prod 都指向 `packages/dev-server`）。如仍报错，确认代码为最新版本：

```bash
git pull
pm2 restart vendure
```

### Q7: 启动报错 `Cannot find module ... lib/index.js`

**原因**：产物目录缺失或被 `.gitignore` 误伤。

**解决**：在仓库根目录执行 `git status` 确认 `packages/*/lib` 和 `packages/dev-server/dist` 都已跟踪；若未跟踪，检查 `.gitignore` 是否有 `dist` 或 `lib` 行（应为注释状态）。

### Q8: Dashboard 显示「Build your dashboard or run in development mode」

**原因**：`packages/dev-server/dist` 中缺少 Dashboard 静态资源（index.html / assets/）。

**解决**：本地执行 `.\build-prod.ps1` 重新构建并 `git push`，服务器 `git pull` 后重启。

### Q9: 启动报错 `EFATAL: connect ECONNREFUSED 127.0.0.1:5432`

**原因**：PostgreSQL 未启动或 `.env` 中 `DB_HOST/DB_PORT` 配置错误。

**解决**：确认 PostgreSQL 服务运行中，`.env` 配置正确。

### Q10: 内存不足导致启动失败

**原因**：Node.js 默认堆内存不足。

**解决**：启动时指定堆内存（2GB 服务器推荐 768MB）：

```bash
NODE_OPTIONS="--max-old-space-size=768" node packages/dev-server/prod-start.js
```

pm2 方式通过 `--node-args` 传递：

```bash
pm2 start prod-start.js --node-args="--max-old-space-size=768"
```

### Q11: 第三方登录/支付不生效

**原因**：`.env` 中 `DEV_BYPASS_*=true` 未关闭，或租户配置中心未配置 Channel 级密钥。

**解决**：
1. 确认 `.env` 中所有 `DEV_BYPASS_*` 为 `false`
2. 登录 Dashboard → Settings → Channels → 选择 Channel → 滚动到「租户配置中心」配置支付/微信登录/SSO/地图密钥

## 九、架构备注

- **多租户**：每个 Channel 即一个租户，租户级配置（支付、登录、地图）存储在 Channel 的 customFields（`authConfig`/`payConfig`/`mapConfig`），敏感字段 AES-256-GCM 加密存储。
- **Dashboard 入口**：统一配置中心以 pageBlock 形式注入到 Channel 详情页（位于 custom-fields 区块下方），非左侧独立菜单。
- **数据库同步**：`synchronize=true` 已开启，schema 变更自动应用，无需手动 migration。生产环境如需关闭自动同步，可在 `packages/dev-server/dev-config.ts` 的 `getDbConfig()` 中改为 `false` 并改用 migration 工作流。
- **开发演示插件**：dev-config.ts 引用的 ReviewsPlugin、FloorBuilderPlugin、NavModifierPlugin 仅用于本地开发演示，生产模式自动跳过加载（通过 `IS_PROD` 标志 + `devOnlyPlugins` 数组实现）。
- **路径解析**：dev-config.ts 中所有资源路径（migrations、import-assets、assets、email 模板、sqlite、dashboard appDir）统一使用 `devServerDir` 变量，兼容 dev 模式（`__dirname = packages/dev-server`）和 prod 模式（`__dirname = packages/dev-server/dist`）。
