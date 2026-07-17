# 中国本地化方案审计报告 + 补全路线图

> 生成时间：2026-07-17
> 业务定位：多租户 SaaS 平台（每个 channel = 独立商家）
> 审计范围：8 个现有插件 + 4 个待新建模块

## 一、审计结果总览

### P0 闭环插件（4 个）

| 插件 | 完成度 | 致命阻塞 |
|---|---|---|
| after-sales-plugin | 55% | 退款失败不回滚状态 + 售后申请零业务校验 + findOne 越权 |
| order-timeout-plugin | 25% | setTimeout 内存调度，进程重启即丢全部任务 + 仅覆盖 1/4 场景 |
| logistics-plugin | 15% | 无物流跟踪/快递字典/批量发货/电子面单 |
| invoice-plugin | 10% | 仅 Order customFields，全功能缺失（无 entity/service/resolver） |

### P1 营销插件（4 个）

| 插件 | 完成度 | 致命阻塞 |
|---|---|---|
| distribution-plugin | 55% | accountInfo 明文 + Job setTimeout 不健全 + shop schema 与 resolver 不匹配 |
| recharge-card-plugin | 40% | PIN 明文 + 无余额流水 + 非原子扣减（资金红线） |
| flash-sale-plugin | 45% | 秒杀价不应用（无 PromotionAction）+ incrementSoldCount 无调用方 + DB 超卖 |
| group-buy-plugin | 50% | 拼团价不应用 + 退款未触发 + shop schema 与 resolver 不匹配 |

### P1 待新建模块（4 个，无现有代码）

| 模块 | 对标 |
|---|---|
| 会员等级+积分 | 淘宝/京东会员体系（LV1-LV5 + 成长值 + 积分商城） |
| 评价系统 | 淘宝评价（图文/视频 + 回复 + 标签 + 好评率） |
| 微信订阅消息 | 订单状态变更推送（付款/发货/签收/退款） |
| 优惠券运营层 | 领取中心 + 新人券 + 品类券 + 券码核销 |

## 二、跨插件共通问题（统一改造）

1. **setTimeout/setInterval → Vendure JobQueue 周期任务**：distribution/flash-sale/group-buy/order-timeout 四个插件都受影响，进程重启即丢任务
2. **plugin.ts 顶层 require('graphql-tag') → ESM import**：flash-sale/group-buy/recharge-card 三个插件
3. **update() 方法缺字段白名单**：flash-sale/group-buy 可被篡改 soldCount/status/currentCount
4. **PromotionAction 配套缺失**：flash-sale/group-buy 仅有 PromotionCondition 无 PromotionAction，秒杀价/拼团价不生效
5. **资金类操作缺事务**：after-sales processRefund / recharge-card redeemCard/deductBalance / group-buy joinGroupBuy 均无事务包裹
6. **敏感信息明文存储**：recharge-card PIN / distribution accountInfo

## 三、补全路线图（按资金安全 + 交易闭环优先）

### 第一波：资金安全 + 交易闭环 P0（3 个）

| 序号 | 插件 | 核心修复 | 工作量 |
|---|---|---|---|
| 1 | order-timeout-plugin | setTimeout→JobQueue delay + 持久化 entity + 补偿 cron + 3 类新场景（待发货/待收货/待评价） | 中 |
| 2 | after-sales-plugin | processRefund 事务化 + createRequest 业务校验 + findOne 越权修复 | 中 |
| 3 | recharge-card-plugin | PIN bcrypt + BalanceTransaction 流水 + 事务化 + createRefund 账户修复 | 大 |

### 第二波：交易闭环 P0 续（2 个）

| 序号 | 插件 | 核心补全 | 工作量 |
|---|---|---|---|
| 4 | logistics-plugin | Carrier 字典 + LogisticsTrack entity + 物流跟踪 Provider + 批量发货 + 电子面单 | 大 |
| 5 | invoice-plugin | Invoice entity + InvoiceProvider 接口 + 开票/红冲 + PDF 下载 | 大 |

### 第三波：营销 P1 修复（3 个）

| 序号 | 插件 | 核心修复 | 工作量 |
|---|---|---|---|
| 6 | distribution-plugin | accountInfo 加密 + Job 周期化 + shop schema 修复 + 3 级关系校验 + 退款佣金冲销 | 中 |
| 7 | flash-sale-plugin | PromotionAction + OrderPlacedEvent 监听 + 原子 SQL + 字段白名单 | 中 |
| 8 | group-buy-plugin | PromotionAction + 退款触发 + schema 修复 + 事务化 + 时间窗校验 | 中 |

### 第四波：P1 新建模块（4 个）

| 序号 | 模块 | 核心功能 | 工作量 |
|---|---|---|---|
| 9 | 会员等级+积分 | MemberLevel entity + 成长值 + 积分获取/消耗 + 等级权益 | 大 |
| 10 | 评价系统 | Review entity + 图文/视频 + 回复 + 标签 + 好评率 | 中 |
| 11 | 微信订阅消息 | 订阅消息模板 + 状态变更监听 + 发送队列 | 中 |
| 12 | 优惠券运营层 | Coupon entity + 领取中心 + 新人券 + 核销 + Vendure Promotion 桥接 | 大 |

## 四、执行原则

1. **每日聚焦 1-3 个核心任务**（按用户规则）
2. **每个插件补全后跑单元测试 + 构建**（验证不破坏现有功能）
3. **资金类操作必须事务化**（after-sales 退款 / recharge-card 扣减 / distribution 佣金）
4. **敏感信息必须加密**（PIN bcrypt / accountInfo AES-GCM）
5. **Job 必须持久化**（Vendure JobQueue + delay 参数，禁用 setTimeout）
6. **PromotionCondition 必须配套 PromotionAction**（否则价格不生效）
7. **Subagent-Driven 执行**（每个插件独立 subagent，inter-task review）
