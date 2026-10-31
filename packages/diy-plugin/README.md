# @vendure/diy-plugin

DIY 定制（手串 / 饰品）插件：模板与素材、方案报价（`runDiyCalc`）、下单与库存联动。

## 运维脚本

`scripts/` 下均为「独立进程直连数据库」的运维工具，需在仓库根目录执行，连接参数取自环境变量或
`packages/dev-server/.env`：

| 脚本 | 用途 |
| --- | --- |
| `scripts/populate-beads.ts` | 按 mock 数据灌入珠子素材（幂等） |
| `scripts/quote-demo-plans.ts` | 对指定 DiyPlan 复算 BOM，落 `quoted` 并公开（幂等，只做 find/save，不删数据） |

运行示例：

```bash
# 报价并公开指定方案（可传多个 planId）
pnpm exec ts-node --transpile-only -P packages/diy-plugin/tsconfig.json \
  packages/diy-plugin/scripts/quote-demo-plans.ts 1 2 3
```

依赖环境变量：`DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME`（未设置时使用本地 dev 默认值）。
