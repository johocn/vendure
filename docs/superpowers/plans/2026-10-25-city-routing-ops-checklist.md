# 城市路由上线配置清单

> 功能：公众号文字订购按收货地址自动确定城市与可服务租户、下单前做配送范围校验、下单成功消息带预计送达。
> 回滚开关：环境变量 `ASSISTANT_CITY_ROUTING=off`（关闭守卫与切店，恢复原下单链路）。

## 1. 判定规则（当前版本）

| 项 | 规则 |
|---|---|
| 城市来源 | 收货地址经地图地理编码得到区划码（6 位），城市码 = 前 4 位 + `00`（如丰满区 220211 → 吉林市 220200） |
| 租户匹配 | 渠道 `servingCities` 含该城市码 → 候选；未配置 `servingCities` 的渠道 → 兜底候选（不限城市） |
| 租户排序 | 显式城市 →（P1：区县/半径）→ 起送价升序 → 预计送达升序 |
| 切店 | 排序第一的渠道不是当前渠道时，用原关键词在新渠道重搜并重建编号，提示用户重新回复编号 |
| 配送校验 | 地址城市码不在当前渠道 `servingCities` 内 → 回复「不在配送范围」+ 城市说明 + 客服/留言出口，**不建单** |
| 例外 | 渠道未配置 `servingCities` → 不做城市限制（放行）；地理编码失败 → fail closed，提示稍后重试 |

## 2. 渠道配置项（后台 → 渠道装修）

每个渠道逐项确认：

1. **服务城市 `servingCities`**：6 位城市码（如吉林市 `220200`）。至少填主力城市；跨城市经营就填多个。
2. **预计送达 `deliveryMinutes`**：填写后订单确认显示「约 X 分钟送达」；不填显示「门店会电话确认」。
3. **起送价 `minOrderAmount`**：单位分（`2000 = 20 元`），用于同精度租户排序；不填按 0 处理。

> 注意：`servingCities` 一旦配置，该渠道只接这些城市的地址，其他城市会收到超范围提示。线上历史渠道默认未配置 = 不限城市。

## 3. 上线检查

- [ ] 确认公众号主渠道（平台号）`servingCities` 已按实际服务城市配置
- [ ] 确认各租户渠道 `servingCities` 与门店实际服务城市一致
- [ ] 确认重点渠道 `deliveryMinutes`、`minOrderAmount` 已填写
- [ ] 冒烟 A/B/C 通过（见下）

> 当前线上状态（2026-10-25 冒烟后）：平台渠道与租户渠道 `servingCities` 均为空 = 不做城市限制（放行），城市路由不会切店；正式启用前必须按第 2 节配置。

## 4. 线上冒烟记录（2026-10-25，线上 `joho` / `/www/apps/vendure`，部署 `0685faab5` + `b601f22ff`）

测试方式：服务器内直接 `POST http://127.0.0.1:3020/wechat-assistant/handle`（`x-zhao-secret` 取自 `packages/dev-server/.env`），平台渠道 token `cnx87ezvmjx8nn3bth6c`。临时把平台渠道（ch1）`servingCities` 设为 `["220200"]`（吉林市）、租户渠道（ch7 `t1`，店铺名「新生」）设为 `["220100"]`（长春市）用于验证，**冒烟结束后已回滚为 null**。

| 用例 | 输入 | 实际结果 | 判定 |
|---|---|---|---|
| A 可配送（吉林市丰满区） | 「买袋面」→ 编号 → 手机号 → `吉林市丰满区…` | 订单创建成功，回复含订单号、商品、金额、预计送达（未配置 `deliveryMinutes` → 「门店会电话确认送达时间」）、支付链接 | PASS |
| B 超范围（北京） | 新 openid/手机号 → 「买袋面」→ 编号 → 手机号 → `北京市朝阳区建国路1号…` | 回复「很抱歉，您填写的地址…不在配送范围。本店目前不服务「北京市」地区的地址。当前店铺：优商铺」+ 客服/留言出口；**数据库无新订单** | PASS |
| C 切店（长春） | 新 openid/手机号 → 「买袋面」→ 编号 → 手机号 → `吉林省长春市南关区人民大街1号` | 回复「根据您的收货地址，已为你切换到「新生」…该店暂时没有「面」相关的商品，换个商品名再试试。」；会话 `channelId=7`；再回「1」提示无对应商品；**ch1 无新订单** | PASS |

冒烟中发现并已修复（`b601f22ff`）：

1. **切店后新店无对应商品**：原实现仅在重搜有命中时写回会话，无命中会保留旧店结果与会话渠道，用户继续回编号会落到旧店并在守卫处反复切店。现改为无论是否命中都切换会话渠道并覆盖结果，无命中回复「该店暂时没有「X」相关的商品，换个商品名再试试」。
2. **超范围文案城市名兜底**：直辖市地址（如北京）地图只回省份、城市为空，原文案会显示城市码「110100」，现先取省/市，取不到再从地址原文提取城市名（显示「北京市」，见 `9bbc18adf`）。

环境备注：

- 地理编码（高德）偶发 1s+ 延迟超时（聊天链路单次 1.2s 超时 + 10 分钟失败缓存），首次下单可能收到「配送校验暂时不可用，请稍后再试」，稍后重试即可。

### 4.1 遗留项处理与复验（部署 `682851b27` + `9bbc18adf`）

- **老顾客补绑定不建地址**（已修复）：`customer-binding.service.ts` 的「手机号已注册但未绑微信 → 补绑定」分支现与全新建档共用 `saveInitialAddress`，保存本次输入的默认地址。复验：既有顾客 161（手机号 13900000002、无地址）→ 新 openid + 北京地址 → 地址成功写入（default）、城市守卫拦截「本店目前不服务「北京市」地区的地址」、**无新订单**。
- **地理编码超时兜底**（已修复）：守卫在地理编码失败时用地址簿已存坐标逆地理取省市区短文本，再补取区划码；逆地理也失败才 fail closed（提示稍后再试）。
- **直辖市文案**（已修复）：高德部分北京地址省市返回空，原回退成城市码「110100」；现从地址原文取「xx市/自治州/地区/盟」，复验显示「北京市」。
- 复验后清理：测试地址（id 31）已删、顾客 161 的测试 openid 绑定已清除、`oQaCityRoute-%` 会话已删、临时 `servingCities` 已回滚为 null。

## 5. 紧急处置记录：关闭线上自动同步（2026-10-25）

**现象**：2026-10-25 23:18 重启后 `vendure` 进程崩溃循环，日志 `QueryFailedError: tables can have at most 1600 columns`（`RdbmsSchemaBuilder.updateExistColumns` → `changeColumn`）。

**原因**：线上 postgres 一直是 `synchronize: true`（`dev-config.ts` 的 `getDbConfig()`），`order` 表反复同步后累计 **1417 个已删列（max attnum 1578）**，本次 TypeORM 再加临时列即超过 Postgres 1600 列上限，启动失败。

**处置**：`dev-config.ts` 改为 `synchronize: process.env.DB_SYNC !== '0'`（默认行为不变），线上 `packages/dev-server/.env` 增加 `DB_SYNC=0` 后重启，`health=200`，`WechatShoppingAssistantPlugin initialized` 正常，搜索/下单链路回归通过（提交 `736b7c152`）。

**必须跟进**：

1. 线上现为「自动同步关闭」——**新增实体/字段/自定义字段必须写 migration**，不能再指望重启自动建列，否则运行期会报列不存在。
2. ~~`order` 表择机重建回收 attnum~~ —— **已于 2026-10-26 执行完成**，见 5.1。

### 5.1 `order` 表重建记录（2026-10-26，已执行）

**目标**：回收长期自动同步产生的 1417 个已删列（`order` 表 max attnum 1578，逼近 Postgres 1600 列上限）。

**备份**：`/home/admin/backups/vendure_pre_order_rebuild_20261026_083350.dump`（全库 `pg_dump -Fc`，4.4 MB，2642 TOC / 323 个表数据，容器内外 md5 一致）。

**演练**：先在临时库 `vendure_rebuild_dryrun`（还原同一备份）跑完整重建脚本，全部校验通过后再操作生产，演练库已删除。

**步骤**（单事务 `psql -v ON_ERROR_STOP=1`，停服窗口约 1 分钟）：

1. `pm2 stop vendure`（确认无残留连接）；
2. `ALTER TABLE "order" RENAME TO order_old`，5 个索引/PK 改名加 `_old` 释放规范名（索引名为 schema 级唯一）；
3. 按 `pg_dump --schema-only -t '"order"'` 的 DDL 建新表 `"order"`（161 列）+ `OWNER vendure`；
4. `ALTER SEQUENCE order_id_seq OWNED BY "order".id` —— 必须在删旧表**之前**，否则序列随旧表一起被删；
5. 建 PK + 4 个索引（规范名）；
6. 断言新旧表 live 列顺序一致后 `INSERT INTO "order" SELECT * FROM order_old`（391 行）；
7. 删 11 个指向旧表的子表外键 → `DROP TABLE order_old` → 按原定义（含 `ON UPDATE/DELETE CASCADE`）重建 11 个子表外键 + 本表 3 个外键；
8. 事务内断言（行数 391、max attnum ≤ 200、入向外键 12、索引 5、序列归属新表）→ `COMMIT` → `ANALYZE`。

**结果**：行数 391（未变）；`max attnum 1578 → 161`；`已删列 1417 → 0`；入向外键 12 条全部 `convalidated`；索引 5 个规范名；`order_id_seq.last_value=424`（实测 `nextval`=425 后已 `setval` 回 424）；表体积 376 kB → 264 kB；无 `order_old` 残留。

**回归**：`pm2 start vendure` → `health=200`，日志无异常（`WechatShoppingAssistantPlugin initialized`）；公众号助手搜索链路正常返回商品卡片；`order_line` / `payment` 对 `order` 无孤儿行。

**决定**：`DB_SYNC=0` **继续保持关闭**（表结构改动统一走 migration）。重建只回收历史 attnum；若恢复同步，每次启动仍会为 `order` 追加临时列并重新累积，故不恢复。
