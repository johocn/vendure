# 租户支付设置设计文档

> **日期**：2026-07-15
> **范围**：凭证隔离 + Dashboard UI（不含抖音支付插件）

---

## 1. 整体架构

### 影响范围

```
e:\code\vendure\packages\cjk-plugin\
├── src/tenant/tenant-channel-custom-fields.ts  ← 追加 payConfig struct 字段
├── src/payment/payment-config.types.ts          ← 新增：支付凭证类型定义
├── src/payment/payment-config.ts                ← 新增：读取/解密/脱敏/合并工具函数
├── src/payment/payment-admin.resolver.ts        ← 新增：admin 查询/更新 mutation
├── src/plugin.ts                                ← 追加 adminApiExtensions schema + resolver 注册
└── dashboard/payment-config-widget.tsx           ← 新增：Dashboard UI widget

e:\code\vendure\packages\alipay-plugin\src\
└── alipay-handler.ts                             ← createPayment 读取 per-channel 凭证覆盖

e:\code\vendure\packages\wechatpay-plugin\
├── package.json                                  ← peerDependencies 追加 @vendure/cjk-plugin
└── src/wechatpay-handler.ts                      ← createPayment 读取 per-channel 凭证覆盖
```

### 核心机制

1. **凭证存储**：Channel.customFields.payConfig struct 字段（加密 JSON 字符串），与 authConfig 结构一致
2. **凭证覆盖流程**：管理员在 Dashboard 填写凭证 → admin mutation 加密写入 → Payment handler 在 createPayment 时调用 `getPaymentOverride(ctx, method)` 读取解密凭证 → 有覆盖用覆盖值，无则回退 PaymentMethod.args
3. **加密**：复用 crypto.ts 的 AES-256-GCM 加密
4. **脱敏**：查询返回时密钥字段替换为 `***`，写回时 `***` 表示保留原值

### 模块职责

| 模块 | 职责 | 边界 |
|---|---|---|
| **payConfig struct** | Channel customFields 存储 | alipayJson + wechatpayJson 两个 text 字段 |
| **payment-config.ts** | struct↔domain 转换、加密/解密、脱敏、合并 | 纯函数，无副作用 |
| **PaymentAdminResolver** | admin GraphQL 查询/更新 | 仅 admin API，不暴露到 shop |
| **PaymentConfigWidget** | Dashboard 配置表单 | 两面板独立保存，密文 `***` |
| **handler 改造** | createPayment 读取覆盖凭证 | 仅变量赋值层，不改 handler args 定义 |

### 关键约束

1. **不改变 handler args 定义**：PaymentMethod.args 仍可在 Admin UI 填全局默认值，per-channel 覆盖是增量
2. **支付凭证覆盖不影响支付主流程**：任何读取失败都静默降级到 PaymentMethod.args
3. **加密失败不静默**：写入时加密失败必须报错
4. **仅改 createPayment**：settlePayment、createRefund 等暂不改造（YAGNI）
5. **回调 controller 不改**：回调路由问题作为独立后续项目
6. **wechatpay-plugin 需追加 peerDependencies**：当前未声明 `@vendure/cjk-plugin`

---

## 2. 凭证数据模型

### payConfig struct 字段

追加到 `tenant-channel-custom-fields.ts`：

```typescript
{
  payConfig: {
    type: 'struct',
    fields: [
      { name: 'alipayJson', type: 'text', defaultValue: '' },
      { name: 'wechatpayJson', type: 'text', defaultValue: '' },
    ]
  }
}
```

复用 authConfig 的 struct 模式（text 类型存 JSON 字符串）。不按方法拆分字段，整体存一个 JSON（凭证字段多且各方法不同）。

### 支付凭证类型（payment-config.types.ts）

```typescript
export type PaymentMethod = 'alipay' | 'wechatpay';

export interface AlipayCredentials {
  appId: string;
  privateKey: string;
  tradeType?: 'QR' | 'WAP' | 'APP' | 'MINI';
}

export interface WechatpayCredentials {
  appId: string;
  mchId: string;
  publicKey: string;
  privateKey: string;
  apiKey: string;
  serialNo: string;
  tradeType?: 'JSAPI' | 'NATIVE' | 'APP' | 'H5';
}

export interface PayConfig {
  alipay?: AlipayCredentials;
  wechatpay?: WechatpayCredentials;
}

export interface PayConfigStruct {
  alipayJson: string;
  wechatpayJson: string;
}

// 脱敏类型（Admin 查询返回）
export interface AlipayCredentialsMasked {
  appId: string;
  hasPrivateKey: boolean;
  tradeType?: string;
}

export interface WechatpayCredentialsMasked {
  appId: string;
  mchId: string;
  hasPublicKey: boolean;
  hasPrivateKey: boolean;
  hasApiKey: boolean;
  serialNo: string;
  tradeType?: string;
}

export interface PayConfigMasked {
  alipay?: AlipayCredentialsMasked;
  wechatpay?: WechatpayCredentialsMasked;
}
```

### 脱敏规则

| 字段 | 展示值 | 写回语义 |
|---|---|---|
| alipay.appId | 原值 | 直接更新 |
| alipay.privateKey | `***`（hasPrivateKey: true） | 若传 `***` 保留原值 |
| wechatpay.appId/mchId/serialNo | 原值 | 直接更新 |
| wechatpay.publicKey/privateKey/apiKey | `***`（hasXxx: true） | 若传 `***` 保留原值 |

---

## 3. 凭证读写工具与 Admin Resolver

### payment-config.ts 工具函数

```typescript
// 读取并解密 Channel 的 payConfig struct → PayConfig domain 对象
export function readChannelPayConfig(ctx: RequestContext): PayConfig | null

// 获取指定支付方法的凭证覆盖（解密后的 domain 对象）
export function getPaymentOverride(ctx: RequestContext, method: PaymentMethod): AlipayCredentials | WechatpayCredentials | null

// 脱敏（用于 Admin 查询返回）
export function maskPayConfig(config: PayConfig): PayConfigMasked

// 合并新旧配置（处理 *** 保留语义）+ 序列化为 struct
export function mergeAndSerializePayConfig(oldConfig: PayConfig, newConfig: PayConfig): PayConfigStruct
```

关键点：
- `readChannelPayConfig` 同步函数（与 `readChannelAuthConfig` 一致），从 `ctx.channel.customFields.payConfig` 读取
- 解密失败时返回 null（不阻断支付流程）
- `getPaymentOverride` 是 handler 调用的入口，返回解密后的凭证对象

### Admin Resolver（payment-admin.resolver.ts）

```graphql
type PayConfigResult {
  alipay: AlipayCredentialsMasked
  wechatpay: WechatpayCredentialsMasked
}

input AlipayCredentialsInput {
  appId: String!
  privateKey: String      # *** 表示保留原值
  tradeType: String
}

input WechatpayCredentialsInput {
  appId: String!
  mchId: String!
  publicKey: String       # *** 表示保留原值
  privateKey: String      # *** 表示保留原值
  apiKey: String          # *** 表示保留原值
  serialNo: String!
  tradeType: String
}

input PayConfigInput {
  alipay: AlipayCredentialsInput
  wechatpay: WechatpayCredentialsInput
}

extend type Query {
  channelPayConfig: PayConfigResult
}

extend type Mutation {
  updateChannelPayConfig(input: PayConfigInput!): PayConfigResult!
}
```

- 查询：`channelPayConfig` → 读取 → 解密 → 脱敏 → 返回
- 更新：`updateChannelPayConfig` → 读取旧值 → 合并（处理 `***`）→ 加密 → 写回 Channel.customFields.payConfig

### 注册方式

与 auth-admin.resolver.ts 一致：
- **仅**放在 `adminApiExtensions.resolvers` 中
- **不**放入 plugin `providers` 数组（避免 NestJS 自动发现导致 schema 错误）

---

## 4. Payment Handler 改造

### 改造原则

在 handler 的 `createPayment` 中，先尝试读取 per-channel 覆盖凭证，有则用覆盖值，无则回退到 `PaymentMethod.args` 原值。不改变 handler 的 args 定义（保持向后兼容）。

### alipay-handler.ts 改造

```typescript
// 现有：直接用 args.appId, args.privateKey
// 改为：先读 per-channel 覆盖
const override = getPaymentOverride(ctx, 'alipay') as AlipayCredentials | null;
const appId = override?.appId || args.appId;
const privateKey = override?.privateKey || args.privateKey;
```

改动范围：仅 `createPayment` 方法内 2 行变量赋值，其余逻辑不变。

### wechatpay-handler.ts 改造

```typescript
const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
const appId = override?.appId || args.appId;
const mchId = override?.mchId || args.mchId;
const publicKey = override?.publicKey || args.publicKey;
const privateKey = override?.privateKey || args.privateKey;
const apiKey = override?.apiKey || args.apiKey;
const serialNo = override?.serialNo || args.serialNo;
const tradeType = override?.tradeType || args.tradeType;
```

改动范围：仅 `createPayment` 方法内 7 行变量赋值。

### 回退逻辑

- `getPaymentOverride` 返回 null（未配置或解密失败）→ 完全使用 `PaymentMethod.args` 原值
- `getPaymentOverride` 返回部分字段（如只有 appId）→ null/undefined 字段回退到 args 原值
- handler 中 `getPaymentOverride` 调用包裹 try/catch，异常时 log warn 并回退

### 不改动的部分

- handler 的 `args` 定义不变（Admin UI 仍可填全局默认值）
- `settlePayment`、`createRefund` 等方法暂不改造（YAGNI）
- 回调 controller 不改（回调路由问题作为独立后续项目）

### 依赖关系

- alipay-plugin：peerDependencies 已声明 `@vendure/cjk-plugin` ✅
- wechatpay-plugin：peerDependencies **未声明** → 需追加 `@vendure/cjk-plugin: ^0.0.1`

---

## 5. Dashboard 支付配置 UI

### Widget 组件

文件：`cjk-plugin/dashboard/payment-config-widget.tsx`

参照现有 auth-config-widget.tsx 的模式：

```tsx
export class PaymentConfigWidget implements DashboardWidget {
    getConfig(): DashboardWidgetConfig {
        return {
            id: 'payment-config',
            title: '支付设置',
            target: 'channel-detail',
            location: 'channel-detail.tabs',
        };
    }
    render(ctx: WidgetContext) {
        return <PaymentConfigForm channelId={ctx.channelId} />;
    }
}
```

### 表单结构

两个折叠面板：**支付宝** 和 **微信支付**，各自独立保存。

**支付宝面板**：

| 字段 | 类型 | 说明 |
|---|---|---|
| AppId | text input | 直填 |
| Private Key | textarea | 密文，显示 `***`，编辑时清空待输入 |
| Trade Type | select | QR / WAP / APP / MINI |

**微信支付面板**：

| 字段 | 类型 | 说明 |
|---|---|---|
| AppId | text input | 直填 |
| Merchant ID | text input | 直填 |
| Public Key | textarea | 密文 `***` |
| Private Key | textarea | 密文 `***` |
| API Key | textarea | 密文 `***` |
| Serial No | text input | 直填 |
| Trade Type | select | JSAPI / NATIVE / APP / H5 |

### 数据流

```
Widget 加载 → channelPayConfig 查询 → 脱敏数据填充表单
                                                      ↓
用户编辑 → 点击保存 → updateChannelPayConfig mutation
                          ↓
              密文字段为 *** → 后端保留原值
              明文字段 → 后端加密覆盖
                          ↓
              返回新的脱敏数据 → 表单刷新
```

### 交互细节

- **密文字段**：加载时显示 `***`，点击编辑时清空为空输入框，用户输入新值或留空（留空则传 `***` 保留原值）
- **独立保存**：支付宝和微信支付各自有保存按钮，不混合提交
- **未配置状态**：面板显示"未配置"提示，提供"添加配置"按钮
- **删除配置**：每个面板有"清除配置"按钮，调用 updateChannelPayConfig 传空对象

### cjk-plugin plugin.ts 注册

```typescript
dashboardWidgets: [
    // 现有 widget...
    new PaymentConfigWidget(),
],
```

---

## 6. 错误处理与测试

### 错误处理策略

| 场景 | 处理方式 | 用户感知 |
|---|---|---|
| 读取 payConfig 解密失败 | 返回 null，回退 PaymentMethod.args | 支付正常（用全局凭证） |
| 读取 payConfig JSON 解析失败 | 返回 null，回退 | 支付正常 |
| 更新时加密失败 | 抛 Error，mutation 返回错误 | "保存失败，请重试" |
| 更新时 channel 未找到 | 抛 NotFoundError | "渠道不存在" |
| handler 读取覆盖凭证失败 | catch → 用 args 原值 | 支付正常（静默降级） |
| handler 覆盖凭证部分缺失 | 逐字段回退到 args | 支付正常 |
| Dashboard 查询未配置 | 返回 null 字段 | 显示"未配置" |
| Dashboard 保存网络失败 | toast 提示 | "保存失败" |

### 关键原则

1. **支付凭证覆盖不影响支付主流程**：任何读取失败都静默降级到 PaymentMethod.args
2. **加密失败不静默**：写入时加密失败必须报错（不能存明文）
3. **handler 中 try/catch**：`getPaymentOverride` 调用包裹 try/catch，异常时 log warn 并回退

### 测试策略

#### 后端单元测试

**payment-config.ts**：

```typescript
describe('payment-config', () => {
  it('readChannelPayConfig: 空配置返回 null')
  it('readChannelPayConfig: 解密成功返回 PayConfig')
  it('readChannelPayConfig: 解密失败返回 null（不抛错）')
  it('getPaymentOverride: 指定方法返回对应凭证')
  it('getPaymentOverride: 方法未配置返回 null')
  it('maskPayConfig: 密钥字段替换为 ***')
  it('maskPayConfig: 非密钥字段保留原值')
  it('mergeAndSerializePayConfig: *** 保留原值')
  it('mergeAndSerializePayConfig: 明文覆盖原值')
  it('mergeAndSerializePayConfig: 新增方法时保留其他方法')
  it('mergeAndSerializePayConfig: 空对象清除方法配置')
})
```

**payment-admin.resolver**：

```typescript
describe('PaymentAdminResolver', () => {
  it('channelPayConfig: 未配置返回 null')
  it('channelPayConfig: 已配置返回脱敏数据')
  it('updateChannelPayConfig: 新建配置')
  it('updateChannelPayConfig: *** 保留原值')
  it('updateChannelPayConfig: 清除配置')
})
```

#### handler 回退测试

```typescript
describe('alipay handler createPayment', () => {
  it('有覆盖凭证: 使用覆盖 appId 和 privateKey')
  it('无覆盖凭证: 回退到 args.appId 和 args.privateKey')
  it('覆盖凭证部分缺失: 逐字段回退')
  it('getPaymentOverride 抛异常: 静默回退到 args')
})
```

#### 手动测试

```
测试用例 1：多租户凭证隔离
  1. Channel A 配置支付宝 appId=APP_A, privateKey=KEY_A
  2. Channel B 配置支付宝 appId=APP_B, privateKey=KEY_B
  3. 在 Channel A 下单 → 验证支付宝请求使用 APP_A
  4. 在 Channel B 下单 → 验证支付宝请求使用 APP_B

测试用例 2：回退兼容
  1. Channel C 不配置 payConfig
  2. PaymentMethod.args 中 appId=GLOBAL, privateKey=GLOBAL_KEY
  3. 在 Channel C 下单 → 验证使用 GLOBAL 凭证

测试用例 3：Dashboard 保存
  1. 打开 Channel 详情页 → 支付设置 tab
  2. 填写支付宝凭证 → 保存
  3. 刷新页面 → 验证 appId 保留，privateKey 显示 ***
  4. 不改 privateKey 再保存 → 验证原值保留
```

---

## 7. 已知限制与后续项目

1. **回调路由未改**：alipay/wechatpay controller 仍用 `getDefaultChannel()`，多渠道回调可能落错 channel。作为独立后续项目。
2. **抖音支付插件未建**：本次不含 douyin-pay-plugin。后续可参照 wechatpay-plugin 双层结构新建。
3. **settlePayment/createRefund 未改**：仅 createPayment 读取覆盖凭证。若退款也需要 per-channel 凭证，后续扩展。
4. **Dashboard widget struct 渲染**：payConfig struct 字段由 `StructFormInput` 直接渲染，widget 组件可能需要覆盖渲染（同 authConfig widget 的已知风险）。
