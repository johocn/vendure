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
├── src/payment/payment-config.ts                ← 新增：读取/解析工具函数（无加密）
├── src/plugin.ts                                ← 无需改动（Dashboard 自动处理 struct 读写）
├── dashboard/payment-config-widget.tsx           ← 新增：Dashboard 表单组件
└── dashboard/channel-detail-forms.tsx           ← 追加 payConfig 字段注册

e:\code\vendure\packages\alipay-plugin\src\
└── alipay-handler.ts                             ← createPayment 读取 per-channel 凭证覆盖

e:\code\vendure\packages\wechatpay-plugin\
├── package.json                                  ← peerDependencies 追加 @vendure/cjk-plugin
└── src/wechatpay-handler.ts                      ← createPayment 读取 per-channel 凭证覆盖
```

### 核心机制

1. **凭证存储**：Channel.customFields.payConfig struct 字段，存储**明文 JSON 字符串**（与 authConfig 模式一致）
2. **凭证覆盖流程**：管理员在 Dashboard 填写凭证 → Dashboard 框架通过 `updateChannel` mutation 自动写入 struct → Payment handler 在 createPayment 时调用 `getPaymentOverride(ctx, method)` 读取解析凭证 → 有覆盖用覆盖值，无则回退 PaymentMethod.args
3. **无加密**：struct 字段存明文 JSON（与 authConfig 一致），安全性依赖数据库访问控制
4. **无独立 resolver**：Dashboard 框架通过 `DashboardDetailFormExtensionDefinition` 自动处理 struct 字段的读写，不需要独立的 `channelPayConfig` 查询和 `updateChannelPayConfig` mutation

### 模块职责

| 模块 | 职责 | 边界 |
|---|---|---|
| **payConfig struct** | Channel customFields 存储 | alipayJson + wechatpayJson 两个 text 字段 |
| **payment-config.ts** | struct→domain 解析 | 纯函数，JSON.parse，无加密 |
| **PaymentConfigWidget** | Dashboard 表单组件 | 通过 `props.value`/`props.onChange` 与框架交互 |
| **channel-detail-forms.tsx** | 注册表单扩展 | `extendDetailDocument` 追加 payConfig 字段 |
| **handler 改造** | createPayment 读取覆盖凭证 | 仅变量赋值层，不改 handler args 定义 |

### 关键约束

1. **不改变 handler args 定义**：PaymentMethod.args 仍可在 Admin UI 填全局默认值，per-channel 覆盖是增量
2. **支付凭证覆盖不影响支付主流程**：任何读取失败都静默降级到 PaymentMethod.args
3. **仅改 createPayment**：settlePayment、createRefund 等暂不改造（YAGNI）
4. **回调 controller 不改**：回调路由问题作为独立后续项目
5. **wechatpay-plugin 需追加 peerDependencies**：当前未声明 `@vendure/cjk-plugin`
6. **明文存储**：与 authConfig struct 字段一致，安全性依赖数据库访问控制。UI 上密钥字段用 password 类型输入框避免 shoulder surfing

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

复用 authConfig 的 struct 模式（text 类型存 JSON 字符串）。

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
  alipayJson: string;      // 明文 JSON 字符串
  wechatpayJson: string;   // 明文 JSON 字符串
}
```

---

## 3. 凭证读取工具函数

### payment-config.ts

```typescript
// 读取 Channel 的 payConfig struct → PayConfig domain 对象
// 同步函数，从 ctx.channel.customFields.payConfig 读取
export function readChannelPayConfig(ctx: RequestContext): PayConfig | null

// 获取指定支付方法的凭证覆盖（domain 对象）
// handler 调用的入口，返回解密后的凭证对象
export function getPaymentOverride(ctx: RequestContext, method: PaymentMethod): AlipayCredentials | WechatpayCredentials | null
```

**实现**：

```typescript
export function readChannelPayConfig(ctx: RequestContext): PayConfig | null {
    const raw = (ctx.channel as any)?.customFields?.payConfig as PayConfigStruct | undefined;
    if (!raw) return null;
    
    const result: PayConfig = {};
    
    if (raw.alipayJson) {
        try {
            result.alipay = JSON.parse(raw.alipayJson);
        } catch {}
    }
    
    if (raw.wechatpayJson) {
        try {
            result.wechatpay = JSON.parse(raw.wechatpayJson);
        } catch {}
    }
    
    return Object.keys(result).length > 0 ? result : null;
}

export function getPaymentOverride(
    ctx: RequestContext,
    method: PaymentMethod
): AlipayCredentials | WechatpayCredentials | null {
    try {
        const config = readChannelPayConfig(ctx);
        if (!config) return null;
        return config[method] || null;
    } catch {
        return null;  // 静默降级
    }
}
```

**关键点**：
- 纯 JSON.parse，无加密/解密
- 解析失败返回 null（不阻断支付流程）
- `getPaymentOverride` 包裹 try/catch，异常时返回 null

---

## 4. Payment Handler 改造

### 改造原则

在 handler 的 `createPayment` 中，先尝试读取 per-channel 覆盖凭证，有则用覆盖值，无则回退到 `PaymentMethod.args` 原值。不改变 handler 的 args 定义（保持向后兼容）。

### alipay-handler.ts 改造

```typescript
// 在 createPayment 方法中，替换直接使用 args 的变量：
const override = getPaymentOverride(ctx, 'alipay') as AlipayCredentials | null;
const appId = override?.appId || args.appId;
const privateKey = override?.privateKey || args.privateKey;
```

改动范围：仅 `createPayment` 方法内 2 行变量赋值，其余逻辑不变。需 import `getPaymentOverride` from `@vendure/cjk-plugin`。

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

改动范围：仅 `createPayment` 方法内 7 行变量赋值。需 import `getPaymentOverride` from `@vendure/cjk-plugin`。

### 回退逻辑

- `getPaymentOverride` 返回 null（未配置或解析失败）→ 完全使用 `PaymentMethod.args` 原值
- `getPaymentOverride` 返回部分字段（如只有 appId）→ null/undefined 字段回退到 args 原值
- `getPaymentOverride` 内部已 try/catch，异常时返回 null，handler 不需要额外 try/catch

### 不改动的部分

- handler 的 `args` 定义不变（Admin UI 仍可填全局默认值）
- `settlePayment`、`createRefund` 等方法暂不改造（YAGNI）
- 回调 controller 不改（回调路由问题作为独立后续项目）

### 依赖关系

- alipay-plugin：peerDependencies 已声明 `@vendure/cjk-plugin` ✅
- wechatpay-plugin：peerDependencies **未声明** → 需追加 `@vendure/cjk-plugin: ^0.0.1`

### 导出

cjk-plugin 的 `src/index.ts` 需追加导出：
```typescript
export * from './payment/payment-config';
export * from './payment/payment-config.types';
```

---

## 5. Dashboard 支付配置 UI

### 接入方式

与 auth-config-widget 一致，通过 `DashboardDetailFormExtensionDefinition` 注册为 struct 字段的表单组件，**不是**独立 widget。

### channel-detail-forms.tsx 追加

```typescript
import { PaymentConfigInput } from './payment-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    // 现有 authConfig...
    {
        pageId: 'channel-detail',
        extendDetailDocument: `
            query ExtendChannelPayConfig {
                channel {
                    customFields {
                        payConfig {
                            alipayJson
                            wechatpayJson
                        }
                    }
                }
            }
        `,
        inputs: [
            {
                blockId: 'custom-fields',
                field: 'payConfig',
                component: PaymentConfigInput,
            },
        ],
    },
];
```

### 表单组件（payment-config-widget.tsx）

```typescript
interface PayConfigStruct {
    alipayJson?: string;
    wechatpayJson?: string;
}

export const PaymentConfigInput: DashboardFormComponent = props => {
    const { value, onChange, disabled } = props;
    
    // 内部编辑状态（domain 形状）
    const [alipay, setAlipay] = useState<AlipayCredentials>(
        safeParse(value?.alipayJson, {})
    );
    const [wechatpay, setWechatpay] = useState<WechatpayCredentials>(
        safeParse(value?.wechatpayJson, {})
    );
    
    // 回写为 struct 形状
    const emit = (nextAlipay, nextWechatpay) => {
        setAlipay(nextAlipay);
        setWechatpay(nextWechatpay);
        onChange({
            alipayJson: JSON.stringify(nextAlipay),
            wechatpayJson: JSON.stringify(nextWechatpay),
        });
    };
    
    // 渲染两个折叠面板...
};
```

### 表单结构

两个折叠面板：**支付宝** 和 **微信支付**。

**支付宝面板**：

| 字段 | 类型 | 说明 |
|---|---|---|
| AppId | text input | 直填 |
| Private Key | textarea (password) | 密钥内容，输入框默认隐藏内容 |
| Trade Type | select | QR / WAP / APP / MINI |

**微信支付面板**：

| 字段 | 类型 | 说明 |
|---|---|---|
| AppId | text input | 直填 |
| Merchant ID | text input | 直填 |
| Public Key | textarea (password) | 密钥内容 |
| Private Key | textarea (password) | 密钥内容 |
| API Key | textarea (password) | 密钥内容 |
| Serial No | text input | 直填 |
| Trade Type | select | JSAPI / NATIVE / APP / H5 |

### 数据流

```
Dashboard 加载 channel 详情页
  ↓
extendDetailDocument 查询 payConfig struct
  ↓
PaymentConfigInput 接收 props.value（struct 形状，明文 JSON 字符串）
  ↓
组件内部 JSON.parse → domain 对象 → 渲染表单
  ↓
用户编辑 → onChange → JSON.stringify → struct 形状
  ↓
Dashboard 框架通过 updateChannel mutation 自动提交
```

### 交互细节

- **密钥字段**：使用 `<textarea>` + CSS 隐藏（`-webkit-text-security: disc`）或 `<input type="password">` 避免 shoulder surfing
- **独立面板**：支付宝和微信支付在同一个表单组件中，通过折叠面板分隔
- **未配置状态**：面板显示"未配置"提示，提供"添加配置"按钮
- **清除配置**：清空所有字段后保存即清除配置

---

## 6. 错误处理与测试

### 错误处理策略

| 场景 | 处理方式 | 用户感知 |
|---|---|---|
| 读取 payConfig JSON 解析失败 | 返回 null，回退 PaymentMethod.args | 支付正常（用全局凭证） |
| handler 读取覆盖凭证失败 | getPaymentOverride 内部 try/catch → 返回 null → 用 args 原值 | 支付正常（静默降级） |
| handler 覆盖凭证部分缺失 | 逐字段回退到 args | 支付正常 |
| Dashboard 查询未配置 | props.value 为空对象 | 显示"未配置" |
| Dashboard 保存失败 | Dashboard 框架 toast 提示 | "保存失败" |

### 关键原则

1. **支付凭证覆盖不影响支付主流程**：任何读取失败都静默降级到 PaymentMethod.args
2. **handler 中无需额外 try/catch**：`getPaymentOverride` 内部已处理异常

### 测试策略

#### 后端单元测试

**payment-config.ts**：

```typescript
describe('payment-config', () => {
  it('readChannelPayConfig: 空配置返回 null')
  it('readChannelPayConfig: 解析成功返回 PayConfig')
  it('readChannelPayConfig: JSON 解析失败返回 null（不抛错）')
  it('getPaymentOverride: 指定方法返回对应凭证')
  it('getPaymentOverride: 方法未配置返回 null')
  it('getPaymentOverride: 异常时返回 null（不抛错）')
})
```

#### handler 回退测试

```typescript
describe('alipay handler createPayment', () => {
  it('有覆盖凭证: 使用覆盖 appId 和 privateKey')
  it('无覆盖凭证: 回退到 args.appId 和 args.privateKey')
  it('覆盖凭证部分缺失: 逐字段回退')
  it('getPaymentOverride 异常: 静默回退到 args')
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
  1. 打开 Channel 详情页 → customFields 区域
  2. 填写支付宝凭证 → 保存
  3. 刷新页面 → 验证字段值保留
  4. 清空字段 → 保存 → 验证配置已清除
```

---

## 7. 安全考量

### 当前方案

- payConfig struct 字段存储**明文 JSON**（包含 privateKey、apiKey 等敏感凭证）
- 与 authConfig struct 字段一致（overridesJson 也包含 appSecret 等敏感信息）
- 安全性依赖数据库访问控制

### 风险

- 数据库泄露时支付凭证明文可读
- 与 authConfig 面临同样的风险

### 缓解措施

1. **UI 层**：密钥字段使用 password 类型输入框，避免 shoulder surfing
2. **数据库层**：限制生产数据库访问权限，审计访问日志
3. **后续加密**（可选）：若需加密，需改用独立 resolver 路径（Dashboard struct 字段模式不支持前端加密/解密）

---

## 8. 已知限制与后续项目

1. **回调路由未改**：alipay/wechatpay controller 仍用 `getDefaultChannel()`，多渠道回调可能落错 channel。作为独立后续项目。
2. **抖音支付插件未建**：本次不含 douyin-pay-plugin。后续可参照 wechatpay-plugin 双层结构新建。
3. **settlePayment/createRefund 未改**：仅 createPayment 读取覆盖凭证。若退款也需要 per-channel 凭证，后续扩展。
4. **明文存储**：与 authConfig 一致，若后续需要加密需重构为独立 resolver 路径。
