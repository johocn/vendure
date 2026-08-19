# dbtool — Vendure 数据库运维本地 CLI 设计文档

- 日期：2026-08-16
- 状态：已确认设计方案，待实现
- 适用项目：d:\zhao\vendure

## 1. 背景与目标

### 1.1 背景
在 Vendure 生产环境日常运维中，频繁需要执行以下操作：
- 新增/修改数据库字段（业务表加列、Vendure customFields 声明）
- 插入测试数据（商品/SKU/支付档案/配送档案/订单等，含批量）
- 给商品 SKU 批量打标签（paymentProfileId / shippingProfileId 等自定义字段）
- 查看/诊断数据（快速查询某表内容，代替手动 psql）

当前操作痛点：
- 每次需手动"写 SQL → 本地 scp 上传 → 服务器 docker exec psql"多步流程
- PowerShell 多层嵌套引号（ssh → docker exec → sh -c → sed）极易被剥离破坏，已在部署中多次踩坑
- 无法批量、幂等地执行种子数据

### 1.2 目标
提供一个**本地一键 Node CLI 工具** `dbtool`，将上述四类操作封装为简单命令，自动走 `ssh qing` + `docker exec psql` 完成，彻底规避 PowerShell 引号陷阱，提升运维效率。

## 2. 已确认的关键决策

| 决策项 | 结论 |
|---|---|
| 技术栈 | 本地 Node CLI（末经编译的 .mjs 脚本，依赖项目已有 node 环境） |
| 工具形态 | 本地一键脚本，单个命令完成推送+执行 |
| SKU 命名规则 | 全拼英文、英文单词、语义清晰、利于搜索；前缀规则见下 |
| SKU 前缀规则 | `cake-*` → 蛋糕货到付款档案；`vegetable-*` → 蔬果微信支付档案 |
| 覆盖操作 | 插入测试数据 / SKU 打标签 / 加字段（DB列 + Vendure customFields）/ 查看诊断 |
| 连接目标 | 服务器 `qing`，Docker 容器 `1Panel-postgresql-pIe0`，库 `vendure` |

### 2.1 SKU 前缀规则（最终确认）
- 蛋糕类 SKU：以 **`cake-`** 开头（如 `cake-strawberry-6inch`）
- 蔬果类 SKU：以 **`vegetable-`** 开头（如 `vegetable-tomato`）
- 自动匹配基于前缀，`assign-profile` 命令据此批量打标签

## 3. 命令一览

```
node tools/dbtool.mjs <命令> [参数]
```

| 命令 | 作用 | 示例 |
|---|---|---|
| `run <sql文件>` | 执行任意 SQL 文件（自动上传服务器执行） | `node tools/dbtool.mjs run seeds/蛋糕蔬果测试数据.sql` |
| `query "<SQL>"` | 直接查询并打印结果 | `node tools/dbtool.mjs query "SELECT * FROM payment_profile"` |
| `seed [目录]` | 批量执行种子数据，幂等（按 `dbtool_seed_log` 去重） | `node tools/dbtool.mjs seed tools/seeds/` |
| `assign-profile` | 按 `cake-`/`vegetable-` 前缀自动给 SKU 打支付档案标签 | `node tools/dbtool.mjs assign-profile` |
| `list-tables` | 查看核心表结构/数据量 | `node tools/dbtool.mjs list-tables` |
| `backup <表>` | 导出指定表为 SQL 备份 | `node tools/dbtool.mjs backup payment_profile` |
| `add-field <表> --col <列> --type <类型>` | 业务表加列 + 生成 Vendure customFields 待改清单 | `node tools/dbtool.mjs add-field product_variant --col customX --type string` |

## 4. 架构与组件

### 4.1 目录结构
```
d:\zhao\vendure\tools\
├── dbtool.mjs          # CLI 入口（命令分发 + 参数解析）
├── dbtool.config.mjs   # 连接配置（服务器/容器/库/SSH）
├── lib/
│   ├── ssh.mjs         # ssh / scp / docker exec 封装
│   └── db.mjs          # psql 执行、幂等 seed、备份、字段相关
└── seeds/              # 测试数据脚本（按需新增，幂等）
```

### 4.2 组件职责
- **dbtool.mjs**：解析 argv，分发到对应命令处理函数，统一错误处理与退出码。
- **dbtool.config.mjs**：导出连接配置对象 `{ host, user, container, db, sshCmd }`，改一处即可变更目标。
- **lib/ssh.mjs**：封装 `ssh qing "..."`、`scp 本地 远程`、`docker cp`、`docker exec ... psql`。所有远程命令通过**临时文件**传递，绝不内联拼接 SQL。
- **lib/db.mjs**：提供 `runSqlFile(file)`、`runQuery(sql)`、`runSeedDir(dir)`、`backupTable(table)`、`addColumn(...)`、`listTables()` 等核心函数。

## 5. 核心机制设计

### 5.1 连接与执行流程（规避 PowerShell 引号）
所有 SQL 一律走下列标准管道，**从不用内联 SQL 传参**：

```
本地写临时 SQL 文件
  → scp 到服务器 /tmp/dbtool_<随机>.sql
  → docker cp 进容器 /tmp/dbtool_<随机>.sql
  → docker exec -i 容器 psql -U vendure -d vendure -f /tmp/dbtool_<随机>.sql
  → 回传结果，本地清理临时文件
```

- `run` / `seed` / `add-field` / `backup` 均复用此管道。
- `query` 命令：把用户输入的 SQL 写入临时文件后走同一管道（不直接拼进 ssh 命令），保证特殊字符安全。

### 5.2 幂等 Seed
- 建表 `dbtool_seed_log(script_name text primary key, run_at timestamptz)`。
- `seed <目录>` 扫描目录下 `*.sql`，按文件名排序；对每个脚本：
  - 已记录 → 跳过并提示"已执行，跳过"
  - 未记录 → 执行 SQL，成功后插入 `dbtool_seed_log`；失败则中止并保留日志待重试。
- 保证重复执行不产生重复数据。

### 5.3 assign-profile 自动匹配
- 扫描 `product_variant` 表：`SELECT id, sku FROM product_variant WHERE sku IS NOT NULL`。
- 规则：
  - `sku LIKE 'cake-%'` → 设置 `"customFieldsPaymentprofileid"` = 蛋糕档案 id（`cake-cod-profile`）
  - `sku LIKE 'vegetable-%'` → 设置 `"customFieldsPaymentprofileid"` = 蔬果档案 id（`veg-wechatpay-profile`）
- 档案 id 从 `payment_profile` 表按 code 动态查询，避免硬编码。
- 支持 `--dry-run` 参数：仅打印将影响的 SKU 数量，不实际 UPDATE。
- 支持 `--csv <文件>` 扩展：对前缀规则覆盖不到的 SKU，用 CSV（`sku,paymentProfileCode`）精确指定。

### 5.4 加字段双轨
- **纯 DB 加列**：`add-field <表> --col <列> --type <类型>` → 生成 `ALTER TABLE <表> ADD COLUMN IF NOT EXISTS <col> <type>` 并执行。
- **Vendure customFields**：`add-field` 在 DB 加列后，额外输出一份**待改代码清单**，提示用户：
  - 在 `dev-config.ts` 或对应插件配置声明该自定义字段（含类型、label、translatable 等）
  - 修改后**本地构建 dist**（遵守"本地构建、服务器 git pull + pm2 restart"部署铁律）
  - 提交 dist 到 git → 服务器 `git pull` → `pm2 restart vendure`
- 工具不代改代码，只输出清单与命令，避免误改。

### 5.5 查看/诊断
- `list-tables`：列出核心表（payment_method、payment_profile、product_variant、product、payment_profile_payment_methods_payment_method 等）的结构与行数。
- `query "<SQL>"`：任意查询，结果以表格形式打印。

### 5.6 备份
- `backup <表>`：`pg_dump` 指定表（仅数据 + 结构）导出为 SQL 文件到本地 `tools/backups/<表>_<日期>.sql`，供回滚/对比。

## 6. 错误处理
- 所有远程命令失败时，打印 stderr 并返回非零退出码。
- ssh / docker 不可达时给出明确错误提示。
- seed 失败时保留幂等日志，允许修复 SQL 后重跑该脚本。
- psql 执行 SQL 报错时，回传具体错误行号与信息。

## 7. 测试
- `--dry-run` 模式验证匹配规则（assign-profile）与 SQL 生成（add-field），不影响真实数据。
- 在本地对 SQL 文件做语法检查（`psql --variable ON_ERROR_STOP`）后再推送。
- 端到端验证：针对当前已创建的 `payment_profile` / `payment_method` 做一次 `list-tables` 与 `query`，确认可读。

## 8. 上线步骤（部署铁律遵守）
1. 在 `d:\zhao\vendure\tools/` 编写源码。
2. 本地 `node tools/dbtool.mjs list-tables` 验证可连通。
3. 工具本身为本地脚本，**不涉及服务器构建**；仅当 `add-field` 涉及 Vendure customFields 时，才走"本地构建 dist → 提交 → 服务器 git pull → pm2 restart"标准流程。

## 9. 验证清单
- [ ] `list-tables` 能列出 payment_profile / payment_method 等表结构
- [ ] `query "SELECT id, code FROM payment_profile"` 返回已创建的 3 个档案
- [ ] `seed tools/seeds/` 幂等（二次执行跳过）
- [ ] `assign-profile --dry-run` 正确匹配 cake-/vegetable- 前缀
- [ ] `backup payment_profile` 生成本地 SQL 备份
- [ ] `add-field --dry-run` 正确生成 ALTER TABLE 语句