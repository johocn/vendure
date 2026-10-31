# 校园外卖履约系统全面审计与修复方案

- 审计日期：2026-10-31
- 范围：`packages/campus-delivery-plugin`（履约、调度、飞书、通知、配置、迁移、资金链路），以及其依赖的 `message-plugin`、Vendure 订单/支付核心
- 生产前提：TypeORM `synchronize=false`（DB_SYNC=0）、PostgreSQL、pm2 多实例可能
- 方法：静态代码审计 + 关键路径逐行核对；每条结论均有代码位置证据；未做线上压测与真实回调演练
- 结论：发现 3 个 P0、9 个 P1、9 个 P2。P0 中「新订单卡片全群广播」当前每天都在发生（跨店信息泄露）；「外部运单对账不落库」只在平台回调丢失时触发，但触发后会造成重复配送

## 严重度定义

| 级别 | 定义 |
|---|---|
| P0 | 直接造成资金损失、重复配送、跨店数据泄露，或核心履约链路永久卡死 |
| P1 | 特定条件下功能失效、状态卡死、权限过宽或配置保存失败 |
| P2 | 体验、运维可观测性、安全加固类问题 |

---

## 一、发现清单

### P0

#### F1 外部运单轮询对账命中 delivered 后不落库
- 证据：`dispatch-job.service.ts:813-833`。对账命中 `delivered` 时只改内存 `cf.thirdPartyState/cf.hallStatus`，DB 只写了 `thirdPartySyncAt`；`third-party-delivery.service.ts:326-337` 的 `syncStatus()` 本身也只读不写。
- 触发：平台 `delivered` 回调丢失——这恰好是对账存在的唯一场景。
- 影响：订单在 DB 里永远停在 `third_party`，不会入厅接力；到 `3×externalFallbackMinutes` 后按「未送达」取消并回落 → **运单实际已送达却被重新派送，产生二次配送与餐损**。
- 修复：对账命中 `delivered` 时复用 `onDeliveryStatus()`（`third-party-delivery.service.ts:362`）做条件落库与入厅，禁止只改内存；补一条「回调丢失 + 对账命中 delivered」的单测。

#### F2 新订单卡片广播到所有已映射群
- 证据：`feishu/feishu-card.service.ts:163-176` 遍历 `settings.chats` 全量发送；`feishu/feishu-notify.service.ts:40-49` 的 `shop_new_order` 直接调用。对比 `feishu.client.ts:234-249` 的文本广播已支持 `channel` 定向，卡片路径没有使用。
- 触发：任意店铺产生新订单。
- 影响：A 店群能看到 B 店订单卡片（完整单号、楼栋/分区、金额、商品），且卡片后续刷新、按钮都跟着跨店。**当前线上持续发生**。
- 修复：`broadcastOrderCard(code)` 先解析订单渠道，只发「该渠道群 + platform 群」；无命中时退回 webhook。卡片 message_id 按「订单-群」维度保存，刷新时也只刷对应群。

#### F3 卡片「状态/查看」按钮不校验店铺归属
- 证据：`feishu/feishu.command.service.ts:342-346` 直接 `statusText(code)`；`feishu-card.service.ts:101-107` 按 code 全局查单、无渠道过滤。对比同一 switch 内的写操作 `accept/cooking/reassign/...` 都经过 `requireOrder()`（`:934-958`，按 `chat.channel` 校验订单渠道）。
- 触发：在任意群点击「状态/查看」卡片按钮，或引用任意单号。
- 影响：跨店读取订单详情、异常备注（叠加 F2 后任意群都有他店卡片）。
- 修复：`status/view/exception` 统一走 `requireOrder()`；platform 群允许跨店查询但必须显式指定店铺（见 F10）。

### P1

#### F4 外部运单取消失败后静默重试，无告警、无终态
- 证据：`dispatch-job.service.ts:724-732`。取消未确认时写 `campusCause=external_cancel_failed` 后 `continue`，只打 error 日志。
- 触发：网关持续失败，或运单已送达导致取消失败。
- 影响：订单永久停留 `third_party`，每分钟重试；运营侧无飞书告警、无「异常单」入口，只能靠日志发现。
- 修复：失败计数（建议存 customFields），连续 3 轮失败推飞书 exception 并进入运营异常队列；提供人工「确认取消/强制完结」按钮。

#### F5 R3 商家确认超时兜底被开关包裹
- 证据：`dispatch-job.service.ts:317-323` 整个兜底块包在 `if (cfg.merchantConfirmEnabled)` 内；而 R3 也可能因开关在入厅时打开而停在 `pending_merchant`（`hall.service.ts:203-205`）。
- 触发：订单在 `pending_merchant/accepted` 期间，运营关闭「商家确认」开关。
- 影响：存量单失去超时出口，永久卡住，不退款、不入厅。
- 修复：兜底判定只看 `hallStatus`，开关只控制「新单是否进入确认流程」，不控制存量单兜底。

#### F6 R2 回落 `pending_dispatch` 的计时锚错位，重推窗口失效
- 证据：`dispatch-job.service.ts:644` 取 `assignedAt ?? thirdPartyDispatchAt ?? hallEnteredAt`；R2 回落只写 `thirdPartyDispatchAt`（`:737-743`）；而 `assignedAt` 在出餐时已写入（`merchant-admin.service.ts:2044`）。
- 触发：R2 外部推送超时 → 回落 `pending_dispatch` 准备重推。
- 影响：下一轮仍用更早的 `assignedAt` 判定，立刻再次超时转 `open`（传信者直送），「换一家外部运力重推」窗口形同虚设。
- 修复：回落时把 `assignedAt` 置空，或计时统一取 `max(assignedAt, thirdPartyDispatchAt)`；补 R2 回落后的下一轮用例。

#### F7 骑手已取货（in_progress）无任何自动出口
- 证据：`dispatch-job.service.ts:241` 只处理 `deliveryStatus==='assigned'`；`dispatch-admin.service.ts:187-197` 对 `in_progress` 只生成 SLA 告警，不改变状态。
- 触发：骑手取货后失联、不送达、不报异常。
- 影响：订单永久占用该骑手与单量，只能人工处置。
- 修复：`in_progress` 超 `inProgressSlaMinutes` 先告警；超 2×SLA 自动标 `exception` 并进入运营异常队列（不建议自动回厅，餐已在骑手手上）。

#### F8 卡片退款/发券按钮只要求「操作员」
- 证据：`feishu/feishu.command.service.ts:302-314`；`refund_all/refund_diff/coupon` 在 `:383-398` 执行。文本指令中「拒单/开关店」要求 owner（`:93-106`），资金动作反而只要 operator。
- 影响：普通店员可一键全额退款/发补偿券。
- 修复：三个资金动作要求 `owners`；审计记录动作名（见 F18）。

#### F9 订单告警推送未带渠道定向
- 证据：`feishu.client.ts:234-249` 未传 `channel` 时向全部群广播；调用方 `dispatch-job.service.ts:225/247/262/454/533/655/681/750` 等多处、`hall.service.ts:136`、`rider-task.service.ts:363`、`dispatch-admin.service.ts:530` 均未传 target。
- 影响：跨店泄露单号、异常描述、运营处置内容。
- 修复：订单级告警一律传 `{ channel: cfg.channelId 对应 token }`；平台级汇总类才允许全群。

#### F10 platform 群用 `order.channels[0]` 作为 ctx
- 证据：`feishu/feishu.command.service.ts:951-953`。
- 影响：多渠道订单会用第一个渠道的配置/通知/权限执行操作，可能写错店。
- 修复：platform 群要求指令里带店铺标识；订单多渠道且无法唯一匹配时拒绝并提示。

#### F11 新环境/灾备缺列（迁移不可复现）
- 证据：`campus-fulfillment-config.entity.ts:24/45/46/49`（`freeShippingThreshold`、`timeoutCompensationEnabled`、`timeoutGraceMinutes`、`timeoutCompensationCouponTemplateId`）在 `src/migrations` 无 `ADD COLUMN`，`p6-default-compensation-and-credit-recovery.ts:27` 只有 UPDATE；`custom-fields.ts:74-78`（`waimaiTags/waimaiMonthlySales/waimaiLogo/waimaiPromoText/waimaiBusinessHours`）全仓无补列 SQL。
- 影响：当前生产已有这些列（否则服务不可能健康），但**新环境、灾备重建、误删恢复时 `findOne` 选全列会直接报 `column does not exist`**，配置读取与运费计算全挂。
- 修复：新增幂等迁移补配置 4 列与 Channel 5 个自定义字段列；CI 增加「实体列 vs 迁移列」差集检查。

#### F12 `storeNotice` 允许 500 字但列宽 255
- 证据：`campus-fulfillment-config.entity.ts:21`（`varchar` 默认 255）、`create-campus-tables.ts:42`（`varchar(255)`）；`campus-config.service.ts:233` 校验上限 500，`waimai-store.service.ts:508` 无长度校验。
- 影响：公告 256–500 字保存时 PG 报 `value too long`，配置保存失败。
- 修复：列扩到 `varchar(500)` 或 `text`；两个入口共用同一长度常量。

### P2

#### F13 预约单 `scheduledFor` 为空/脏数据 → 永不释放
- 证据：`dispatch-job.service.ts:284-287` 仅在 `scheduledFor` 有效时放量，无空值兜底与告警。
- 修复：无效值转 `open` 并推飞书告警。

#### F14 `open` 兜底依赖 `hallEnteredAt`
- 证据：`dispatch-job.service.ts:392、:416` 要求 `hallEnteredAt` 存在；历史/外部写入的空值单永不强派、永不自动退款。
- 修复：回退 `createdAt`。

#### F15 交接码可被骑手自助读取，且无过期/限错
- 证据：`rider-task.service.ts:275-280` 把交接码返回给本单骑手；`hall.service.ts:272` 写入 `handoverCodeAt` 但无过期校验；`merchant-admin.service.ts:7297` 输出到商家端；`hall.service.ts:285` 明文日志。
- 说明：这是为避免「骑手取不到码卡在 grabbed」而做的产品取舍，但当前防丢餐校验基本失效。
- 修复（需产品确认）：加 10 分钟 TTL、5 次错误锁定、日志脱敏；若坚持对骑手可见，则明确只作为「交接凭证展示」，不承担防作弊职责。

#### F16 `FEISHU_CHAT_MAP` 中 `channel:'*'` 隐式升级平台权限
- 证据：`feishu/feishu.config.ts:53-56`。
- 影响：配置写错一个字符即获得全店写权限。
- 修复：只允许 `scope:'platform'` 表示平台群；`channel:'*'` 忽略并告警。

#### F17 卡片回调无限流
- 证据：`feishu/feishu.command.service.ts:286-318` 无频率限制（文本指令有）。
- 修复：复用文本指令的限流器。

#### F18 退款成功审计记为 `cmd=status`
- 证据：`feishu/feishu.command.service.ts:391`。
- 修复：记录真实动作 `refund_all/refund_diff/coupon`。

#### F19 `chat.service` 接受任意 `orderCode` 建会话并推送目标群
- 证据：`chat.service.ts:98-125`。
- 修复：建会话前校验订单归属与群成员关系。

#### F20 异常去重 `externalExceptionAlerted` 为进程内 Set
- 证据：`dispatch-job.service.ts:53-54、675-689`。
- 影响：pm2 多实例时同一异常每实例各推一次；订单取消后 key 无回收路径，进程内缓慢增长。
- 修复：改为 DB/Redis 幂等键并带 TTL。

#### F21（待确认）`hallAll` 聚合全部渠道，`grab` 不校验渠道
- 证据：`hall-grab.service.ts:140-161` 聚合所有营业渠道的 open 单；`:36-76` 抢单只校验 `hallStatus=open`。
- 若「渠道 = 同一校区的不同店铺」，这是设计预期；若「渠道 = 不同学校/租户」，则存在跨校区抢单。请确认渠道语义后再决定是否修复。

---

## 二、已验证无高置信缺陷的区域

- 退款链路：订单级退款锁（`refund-lock.ts`）、只选 `Settled/Authorized` 且有余额的支付单、失败退款置 `Failed` 并排除出已退总额（`refund-payment.ts:15-85`），未发现重复退款路径。
- 状态并发：入厅、回厅、兜底写均走 `transitionFrom` 条件更新（`hall.service.ts:306-331`），未见无条件覆盖取消态。
- 多实例：调度扫描与自动接单均使用 `pg_try_advisory_lock`；`PeriodicFallback` 有重入保护与关闭清理。
- 飞书写操作：`accept/cooking/reassign/handled/refund_*` 均经 `requireOrder` 校验店铺归属；`feishu.event.service.ts` 写回调校验 verifyToken，伪造写回调不可行。
- 顾客/骑手接口：改址、售后、骑手评价、催办、位置、送达、交接码、钱包/提现、发票、续付均有归属校验。

---

## 三、修复方案与实施顺序

### 第 1 批（P0，建议立即做）
1. F1：对账命中 delivered → 调 `onDeliveryStatus` 落库并入厅；补单测。
2. F2：卡片按渠道定向广播；`codeToMessage` 改为「单号 + chatId」维度。
3. F3：`status/view/exception` 走 `requireOrder`。
- 验收：回调丢失演练（手工跳过回调，仅靠对账）订单能正常入厅；B 店群收不到 A 店新单卡片；跨店点击状态按钮被拒绝。
- 不改表结构，无需迁移。

### 第 2 批（P1 状态机，1 次集中修改）
F4、F5、F6、F7、F13、F14 集中在 `dispatch-job.service.ts`：
- 去掉 F5 的开关门槛；
- F6 回落时清 `assignedAt`；
- F4 失败计数 + 告警 + 运营异常队列；
- F7 `in_progress` 超时升级；
- F13/F14 空锚兜底。
- 验收：`dispatch-job.service.spec.ts` 新增 4 条用例（R3 关开关、R2 回落锚点、取消连续失败、scheduledFor 为空）。

### 第 3 批（P1 安全与数据）
- F8：资金按钮要求 owners；
- F9：订单级告警统一 `channel` 定向（逐调用点补 target）；
- F10：平台群显式指定店铺；
- F11：新增 p32 幂等迁移（配置 4 列）+ p33（Channel 5 列），部署前执行；
- F12：`storeNotice` 扩列至 500。
- 验收：飞书指令权限用例、告警定向用例、迁移列差集脚本通过。

### 第 4 批（P2 加固）
F15（需产品决策）、F16、F17、F18、F19、F20；F21 待确认渠道语义。

### 部署注意
- F11/F12 需要 SQL 迁移：先执行 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `ALTER COLUMN TYPE`，再重启（生产 `DB_SYNC=0`，迁移不会自动补列）。
- 飞书相关改动建议先在测试群验证：卡片定向、按钮权限、跨店拒绝。

---

## 四、建议的防回归措施

1. 列一致性检查：脚本对比全部实体 `@Column` 与 migrations 的 `ADD COLUMN`，CI 失败即阻断。
2. 回调丢失演练：每月在测试环境跑一次「关闭回调，仅靠 5 分钟对账」的端到端用例。
3. 权限矩阵测试：卡片按钮 × 角色（operator/owner/无权限）× 群范围（本店/他店/platform），表驱动用例。
4. 告警渠道断言：所有订单级 `pushEvent` 调用必须带 target，单测断言。
