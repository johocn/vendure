# Vendure 生产部署方案 — 阿里云低内存环境

## 1. 调研结论

### 1.1 项目结构概要

| 项目 | 值 |
|------|-----|
| 框架 | Vendure 3.6.4 (NestJS + TypeORM + GraphQL) |
| 包管理 | npm workspaces (packages/*) + Lerna |
| 运行时 | 开发使用 ts-node 直接运行 TypeScript |
| 包数量 | 34 个 workspace 包 |

### 1.2 关键发现

**编译输出尺寸（本地已构建状态）：**
- @vendure/core/dist/ — 5.74 MB
- @vendure/common/lib/ — 0.48 MB
- 其余插件 0.01~0.15 MB 不等
- 全部已编译输出合计：约 15 MB

**Node_modules 问题：**
- node_modules 约 1621 个目录，约 1.4 GB
- 主要占用：TypeScript (21.8 MB)、Lerna (15.9 MB)、ts-node (1 MB)
- 大量 devDependencies 在生产环境完全不需要

**当前 dev-server 启动方式（不可用于生产）：**
```
node -r ts-node/register -r dotenv/config index.ts
```
需要 ts-node 运行时编译 TypeScript，1-2GB 内存服务器上会 OOM。

### 1.3 编译模式

每个插件通过 tsc -p tsconfig.build.json 编译：
- 输出目录：lib/（大多数插件）或 dist/（core、admin-ui）
- package.json 的 "main" 字段指向编译输出
- TypeScript 源码在 src/ 目录，生产不需要

### 1.4 生产所需外部服务

| 服务 | 必需 | 说明 |
|------|------|------|
| PostgreSQL | 是 | 主数据库，环境变量配置 |
| Redis | 否 | 可选，仅 redis-stock-plugin 需要 |

---

## 2. 部署方案总览

### 策略：预编译 + 创建工作区归档包

整个部署分为六个步骤：

```
[本地开发机]                       [阿里云服务器]
     |                               |
     Step 1: npm run build (编译全部)  |
     Step 2: 创建 vendure-prod/ 目录  |
     Step 3: tar -czf 打包           |
            |                        |
            +---- scp/rsync -------->|
                                     Step 4: 解压 tar -xzf
                                     Step 5: npm install --production
                                     Step 6: PM2 启动
```

### 核心思路

1. **本地完成所有 TypeScript 编译** — 需要 TypeScript 编译器，本地内存充足
2. **只打包编译后的 JS + package.json** — 不包含任何 .ts 源码
3. **服务器不运行 tsc 或 ts-node** — 解决低内存问题
4. **利用 npm workspaces 符号链接** — 保持包引用关系正确

---

## 3. 详细操作步骤

### Step 1：本地全量编译

```bash
cd e:/code/vendure
npm install         # 安装所有依赖（包括 devDependencies，编译需要 TypeScript）
npm run build       # 等价于 lerna run build，编译所有包
```

验证编译成功：
```bash
dir packages\core\dist\index.js        # core 编译输出 ~5.7 MB
dir packages\common\lib\index.js       # common 编译输出 ~0.5 MB
dir packages\wechat-auth-plugin\lib\   # 插件编译输出
```

### Step 2：创建生产目录结构

```bash
mkdir vendure-prod
mkdir vendure-prod\dist
mkdir vendure-prod\packages
```

#### 2.1 拷贝编译输出（核心步骤）

需要拷贝的包（共 27 个，与 dev-config.ts 中的插件对应）：

```
core, common, admin-ui-plugin, asset-server-plugin, email-plugin,
cjk-plugin, alipay-plugin, wechatpay-plugin, oss-plugin,
phone-auth-plugin, wechat-auth-plugin, order-timeout-plugin,
invoice-plugin, logistics-plugin, group-buy-plugin, flash-sale-plugin,
distribution-plugin, redis-stock-plugin, logistics-api-plugin,
invoice-pdf-plugin, recharge-card-plugin, after-sales-plugin,
job-queue-plugin, graphiql-plugin, harden-plugin, telemetry-plugin, dashboard
```

对每个包，拷贝以下内容：
- **lib/ 或 dist/** — 编译后的 JS 输出（最核心）
- **templates/** — email-plugin 的邮件模板（必须包含）
- **package.json** — 保留 main/types/name/version 等字段
- **index.js / index.d.ts** — 如果包根目录有编译文件

#### 2.2 编译生产入口文件

dev-server 的 index.ts 和 dev-config.ts 不能在生产环境用 ts-node 运行，必须预编译：

```bash
npx tsc --project packages/dev-server/tsconfig.json --outDir vendure-prod/dist --declaration false --sourceMap false --module commonjs --target es2017 --skipLibCheck --esModuleInterop --resolveJsonModule --emitDecoratorMetadata --experimentalDecorators --moduleResolution node packages/dev-server/index.ts packages/dev-server/index-worker.ts packages/dev-server/migration.ts
```

验证：
```bash
dir vendure-prod\dist\index.js
```

#### 2.3 创建 root package.json

在 vendure-prod/package.json 中写入以下内容：

```json
{
  "name": "vendure-production",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node dist/index.js",
    "start:worker": "node dist/index-worker.js"
  },
  "workspaces": ["packages/*"],
  "dependencies": {
    "dotenv": "^16.0.0",
    "pg": "^8.13.1"
  }
}
```

**工作原理：** npm workspaces 会自动将所有 packages/* 下的包符号链接到
node_modules/@vendure/*。当 dist/index.js 中 import/require 一个 workspace 包时，
Node.js 会通过符号链接找到编译后的 JS 输出。

#### 2.4 创建环境变量文件

vendure-prod/.env：
```env
DB=postgres
DB_HOST=your-rds-host.aliyuncs.com
DB_PORT=5432
DB_USERNAME=vendure
DB_PASSWORD=your_password
DB_NAME=vendure_prod
API_PORT=3000
COOKIE_SECRET=change-me
DEV_BYPASS_SMS=true
DEV_BYPASS_WECHAT=true
```

### Step 3：打包压缩

```bash
cd e:/code/vendure
tar -czf vendure-prod.tar.gz vendure-prod/
```

### Step 4：上传到阿里云

```bash
scp vendure-prod.tar.gz root@your-server-ip:/opt/
```

### Step 5：服务器安装依赖

```bash
ssh root@your-server-ip

# 解压
cd /opt
tar -xzf vendure-prod.tar.gz
cd vendure-prod

# 只安装生产依赖（关键！不会安装 TypeScript/ts-node/Lerna）
npm install --production --legacy-peer-deps --no-audit --no-fund

# 验证模块加载
node -e "console.log(require.resolve('@vendure/core'))"
```

### Step 6：使用 PM2 启动

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << "EOF"
module.exports = {
  apps: [
    {
      name: "vendure-server",
      script: "dist/index.js",
      cwd: "/opt/vendure-prod",
      env: { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=1024" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
    },
    {
      name: "vendure-worker",
      script: "dist/index-worker.js",
      cwd: "/opt/vendure-prod",
      env: { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=512" },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
    },
  ],
};
EOF

# 创建日志目录并启动
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 4. 文件清单与尺寸估算

| 内容 | 估算尺寸 |
|------|----------|
| 所有包编译输出 (lib/ + dist/) | ~15 MB |
| 预编译入口点 (dist/index.js) | ~2 MB |
| 配置文件 (package.json + .env) | < 0.01 MB |
| **归档前原始内容合计** | **~17 MB** |
| **gzip 压缩后** | **~4-6 MB** |
| 服务器 npm install --production 后 | ~150-200 MB |

---

## 5. 内存优化建议

### 5.1 Node.js 内存限制
```env
NODE_OPTIONS=--max-old-space-size=1024   # 主进程限制 1GB
NODE_OPTIONS=--max-old-space-size=512    # Worker 限制 512MB
```

### 5.2 Server/Worker 分离策略
- **1GB 内存服务器：** 只启动 server 进程（含内嵌 DefaultJobQueuePlugin），不启动独立 worker
- **2GB 内存服务器：** server + worker 各一个进程
- 可通过修改 ecosystem.config.js 注释掉 worker 配置

### 5.3 禁用不需要的插件
编译前在 dev-config.ts 中注释掉以下插件：
- GraphiqlPlugin — 开发环境 GraphQL IDE，生产应禁用
- TelemetryPlugin — 遥测数据收集
- 不使用的支付插件（如未对接支付宝/微信支付可禁用）

### 5.4 数据库连接池优化
```ts
// 在 dev-config.ts 的 dbConnectionOptions 中添加
dbConnectionOptions: {
  type: "postgres",
  extra: {
    max: 10,                    // 默认 20，减少到 10 节省内存
    idleTimeoutMillis: 30000,
  },
}
```

---

## 6. 部署后验证清单

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| 进程状态 | pm2 status | 均为 online |
| API 可用 | curl localhost:3000/health | 健康检查通过 |
| GraphQL | curl -X POST .../admin-api | 返回 GraphQL 响应 |
| 内存占用 | pm2 monit | Server < 900MB, Worker < 500MB |
| 日志 | pm2 logs --lines 50 | 无 ERROR 异常 |

---

## 7. 常见问题与解决方案

### 7.1 Workspace 版本不匹配
npm workspaces 要求版本一致。本地包版本与 root 引用版本需匹配。

### 7.2 Migration 文件为 .ts
dev-config.ts 中 migrations 指向 migrations/*.ts。
生产需改为 migrations/*.js。

### 7.3 子包 node_modules 残留
打包前删除子包 node_modules，依赖会 hoist 到根。

### 7.4 模块解析
tsconfig 使用 NodeNext，import 含 .js 后缀。tsc 已处理。

---

## 8. 应急回退方案

```bash
pm2 stop vendure-server vendure-worker
cd /opt
mv vendure-prod vendure-prod.bak.$(date +%Y%m%d)
tar -xzf vendure-production-backup.tar.gz -C /opt/
cd /opt/vendure-prod
npm install --production --legacy-peer-deps
pm2 restart ecosystem.config.js
```

---

> **文档版本：** v1.0
> **项目版本：** Vendure 3.6.4
> **目标环境：** 阿里云 ECS (1-2GB 内存) + RDS PostgreSQL

---

## 9. 一键自动化打包脚本

创建 deploy-pack.js（放在 e:/code/vendure/ 根目录），脚本内容见下：

主要功能：
1. 清空并创建 vendure-prod/ 目录
2. 拷贝 27 个包的编译输出（lib/ 或 dist/)
3. 用 tsc 编译入口文件到 vendure-prod/dist/
4. 生成根 package.json 和 .env 文件

### 使用方法

```bash
cd e:/code/vendure
npm run build              # 先编译所有包
node deploy-pack.js        # 运行打包脚本
tar -czf vendure-prod.tar.gz vendure-prod/   # 压缩
```
