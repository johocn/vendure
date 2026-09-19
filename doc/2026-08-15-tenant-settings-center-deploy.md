# 租户设置中心 — 服务器手动部署步骤

> 适用：2G 内存服务器（1Panel + Docker + PostgreSQL + PM2 + OpenResty），将「租户设置中心」功能部署到 `e.joho.cn`。
> 本特性随 Vendure dev-server 一起部署（后端 = cjk-plugin，前端 = dashboard），**未新增任何依赖**，走「更新部署」路径即可。
> 完整首次环境部署见 `basic/docs/deployment/2g-vendure-deployment-guide.md`；本文只讲本特性增量部署 + PostgreSQL 与 dev-server 启动。

---

## 一、本特性部署产物

| 变更范围 | 产物路径 | 说明 |
|---------|---------|------|
| 后端 cjk-plugin | `packages/cjk-plugin/lib/` | 新增 3 个配置服务、resolver、渠道自定义字段 |
| 前端 dashboard | `packages/dev-server/dist/` | 新增 `/tenant-settings` 路由与 8 个 Tab |
| 数据库 | — | `synchronize: true` 启动时自动为 `channel` 表加 `basicConfig`/`serviceNotifyConfig`/`multiLanguageConfig` 字段 |

> 无新增 package.json 依赖，服务器**无需重跑 pnpm install**，只需拉代码 + 重启。

---

## 二、启动 PostgreSQL（如已停止）

PostgreSQL 由 1Panel/Docker 托管。若此前为省内存被停止，先恢复：

```bash
# 1. 找到 PostgreSQL 容器名（1Panel 管理的容器）
docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -iE 'postgres|pgsql|pg-'

# 2. 启动（<POSTGRES_CONTAINER> 用上一步查到的名字，如 1Panel-postgres-xxx）
docker start <POSTGRES_CONTAINER>

# 3. 确认监听 5432
sleep 3
docker exec <POSTGRES_CONTAINER> pg_isready -U vendure_user -d vendure_prod
# 预期: 127.0.0.1:5432 - accepting connections
```

**验证 Vendure 数据库连接配置**（`/www/apps/vendure/packages/dev-server/.env`）：

```env
DB=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=vendure_user
DB_PASSWORD=<数据库密码>
DB_NAME=vendure_prod
API_PORT=3020
```

> 若同时恢复被停的 pgAdmin：`docker start 1Panel-pgadmin4-iJRA`（可选，非必需）。

---

## 三、本地构建（Windows 开发机）

在 `e:\code\vendure` 执行生产构建脚本（会依次编译 cjk-plugin → dev-server tsc → dashboard vite）：

```powershell
cd e:\code\vendure
.\build-prod.ps1
```

> 脚本内已设置 `VITE_ADMIN_API_HOST=auto`，dashboard 运行时会用同源 `e.joho.cn` 反代地址连 admin-api。
> 若只改后端不改前端，可仅 `cd packages/cjk-plugin; npm run build`；若只改前端，仅 dashboard 那步。

**确认产物已更新**：
- `packages/cjk-plugin/lib/` 时间戳为最新
- `packages/dev-server/dist/` 含 `_tenant-settings*.js` 与新路由 chunk

**提交并推送**（dist/lib 必须入库）：

```powershell
cd e:\code\vendure
git add -A
git commit --no-verify -m "build: tenant settings center artifacts"
git push
```

---

## 四、服务器部署（拉代码 + 重启 dev-server）

```bash
cd /www/apps/vendure

# 1. 处理 package-lock.json 冲突（如有）
git checkout -- package-lock.json 2>/dev/null || true

# 2. 拉取代码（含 dist/lib 产物）
git pull

# 3. 无新依赖，跳过 pnpm install；若不确定依赖有没变，可重跑一次（见 guide 第八节）
#    NODE_OPTIONS="--max-old-space-size=1024" pnpm install --prod --no-optional --ignore-scripts --prefer-offline

# 4. 重启 dev-server（--update-env 必须，否则不加载新环境变量）
pm2 restart vendure --update-env
```

> **若本次改动涉及 `dev-config.ts`**（如本次若有自定义字段/middleware 变更需要新配置生效），必须 `pm2 delete vendure` 后重新 `pm2 start`（restart 不加载新配置）：
> ```bash
> pm2 delete vendure
> pm2 start /www/apps/vendure/packages/dev-server/ecosystem.config.cjs
> pm2 save
> ```

**启动/重启 dev-server 的完整流程**（首次或配置重建时）：

```bash
# 0) 确保日志目录
mkdir -p /home/admin/logs

# 1) 确认 ecosystem 配置存在（此前已创建，见 guide 第十步）
ls -l /www/apps/vendure/packages/dev-server/ecosystem.config.cjs

# 2) 启动
pm2 start /www/apps/vendure/packages/dev-server/ecosystem.config.cjs

# 3) 验证
sleep 10
pm2 status                      # stdout: online
pm2 logs vendure --lines 15     # 无 [ERROR]，可见 "Using postgres connection"
curl http://127.0.0.1:3020/health   # 预期: {"status":"ok"}

# 4) 持久化 + 开机自启
pm2 save
```

---

## 五、验证本特性

1. **数据库自动加字段**：首次启动日志确认无 schema 报错；用 pgAdmin/psql 查看 `channel` 表存在 `customFieldsBasicConfig`、`customFieldsServiceNotifyConfig`、`customFieldsMultiLanguageConfig` 列。
2. **前端入口**：浏览器打开 `https://e.joho.cn/`（dashboard），登录后左侧 **Settings → Tenant Settings** 出现新菜单；点击进入 8 个 Tab。
3. **后端接口**：确保 `https://e.joho.cn/admin-api` 不再 400（无 query 的 GET 返回 200 信封，见 dev-config middleware）。
4. **保存回写**：在「基本设置/多语言」等 Tab 修改并保存，`channel` 表对应 `customFields*` 列值更新；刷新页面数据保持。

---

## 六、回滚

```bash
cd /www/apps/vendure
git log --oneline -5                      # 找到上一个稳定提交
git checkout <上一个提交> -- packages/cjk-plugin packages/dev-server   # 只回退业务产物
pm2 restart vendure --update-env
```

---

## 七、常见问题

| 现象 | 处理 |
|------|------|
| 启动报 `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL 未启动，按第二节恢复 |
| 启动报 `password authentication failed` | 检查 `.env` 的 `DB_USERNAME`/`DB_PASSWORD` |
| `channel` 表缺自定义字段 | `synchronize: true` 首次启动自动补；确认 dev-server 是新产物 |
| dashboard 白屏 / admin-api 400 刷屏 | 确认 `dist/` 为本地最新构建，且 dev-config middleware 已生效 |
| 重启后配置不生效 | `pm2 restart vendure --update-env`；仍不生效则 `pm2 delete` + `pm2 start` |