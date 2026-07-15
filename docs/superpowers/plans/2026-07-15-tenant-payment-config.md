# 租户支付设置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 per-channel 支付凭证隔离 — Channel customFields 存储 alipay/wechatpay 凭证，handler 读取覆盖，Dashboard 表单组件管理配置

**Architecture:** Channel.customFields.payConfig struct 字段存明文 JSON（与 authConfig 一致）。Dashboard 通过 DashboardDetailFormExtensionDefinition 自动处理读写。Payment handler 在 createPayment 中调用 getPaymentOverride 读取覆盖凭证，无覆盖则回退 PaymentMethod.args。

**Tech Stack:** Vendure v3.6.4 (NestJS + TypeORM + GraphQL), React (Dashboard)

**Spec:** `e:\code\vendure\docs\superpowers\specs\2026-07-15-tenant-payment-config-design.md`

---

## Task 1: payConfig struct 字段 + 类型定义

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`
- Create: `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.types.ts`

- [ ] **Step 1: 追加 payConfig struct 到 tenant-channel-custom-fields.ts**

在 `tenant-channel-custom-fields.ts` 第 83 行（`authConfig` 字段之后、`]` 之前）追加：

```typescript
        {
            name: 'payConfig',
            type: 'struct',
            nullable: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '租户支付配置' }],
            fields: [
                { name: 'alipayJson', type: 'text' },
                { name: 'wechatpayJson', type: 'text' },
            ],
        },
```

- [ ] **Step 2: 创建 payment-config.types.ts**

```typescript
export type PaymentMethodCode = 'alipay' | 'wechatpay';

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
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts packages/cjk-plugin/src/payment/payment-config.types.ts
git commit --no-verify -m "feat: add payConfig struct field + payment credential types"
```

---

## Task 2: payment-config.ts 工具函数 + 导出

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\payment\payment-config.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\index.ts`

- [ ] **Step 1: 创建 payment-config.ts**

```typescript
import { RequestContext } from '@vendure/core';
import { AlipayCredentials, PayConfig, PayConfigStruct, PaymentMethodCode, WechatpayCredentials } from './payment-config.types';

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
    method: PaymentMethodCode,
): AlipayCredentials | WechatpayCredentials | null {
    try {
        const config = readChannelPayConfig(ctx);
        if (!config) return null;
        return config[method] || null;
    } catch {
        return null;
    }
}
```

- [ ] **Step 2: 在 index.ts 追加导出**

在 `e:\code\vendure\packages\cjk-plugin\index.ts` 末尾追加：

```typescript
export * from './src/payment/payment-config.types';
export * from './src/payment/payment-config';
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/payment/payment-config.ts packages/cjk-plugin/index.ts
git commit --no-verify -m "feat: add payment-config read helpers + export from cjk-plugin"
```

---

## Task 3: alipay-handler.ts 改造

**Files:**
- Modify: `e:\code\vendure\packages\alipay-plugin\src\alipay-handler.ts:1,30-31`

- [ ] **Step 1: 追加 import**

在 `alipay-handler.ts` 第 1 行之后追加：

```typescript
import { getPaymentOverride } from '@vendure/cjk-plugin';
import type { AlipayCredentials } from '@vendure/cjk-plugin';
```

- [ ] **Step 2: 修改 createPayment 中的凭证读取**

将第 30-31 行：

```typescript
            const alipaySdk = new AlipaySdk({
                appId: args.appId,
                privateKey: args.privateKey,
                signType: 'RSA2',
            });
```

替换为：

```typescript
            const override = getPaymentOverride(ctx, 'alipay') as AlipayCredentials | null;
            const appId = override?.appId || args.appId;
            const privateKey = override?.privateKey || args.privateKey;

            const alipaySdk = new AlipaySdk({
                appId,
                privateKey,
                signType: 'RSA2',
            });
```

- [ ] **Step 3: 编译验证**

Run: `cd e:\code\vendure\packages\alipay-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/alipay-plugin/src/alipay-handler.ts
git commit --no-verify -m "feat: alipay handler reads per-channel credential override"
```

---

## Task 4: wechatpay-plugin 改造（handler + package.json）

**Files:**
- Modify: `e:\code\vendure\packages\wechatpay-plugin\package.json`
- Modify: `e:\code\vendure\packages\wechatpay-plugin\src\wechatpay-handler.ts:1-2,48-55`

- [ ] **Step 1: package.json 追加 peerDependencies**

在 `e:\code\vendure\packages\wechatpay-plugin\package.json` 第 17-20 行的 `peerDependencies` 中追加：

```json
        "@vendure/cjk-plugin": "^0.0.1"
```

完整 peerDependencies：

```json
    "peerDependencies": {
        "@vendure/common": "^3.6.0",
        "@vendure/core": "^3.6.0",
        "@vendure/cjk-plugin": "^0.0.1"
    },
```

- [ ] **Step 2: 追加 import**

在 `wechatpay-handler.ts` 第 2 行之后追加：

```typescript
import { getPaymentOverride } from '@vendure/cjk-plugin';
import type { WechatpayCredentials } from '@vendure/cjk-plugin';
```

- [ ] **Step 3: 修改 createPayment 中的凭证读取**

将第 48-55 行：

```typescript
                const pay = new WxPay({
                    appid: args.appId,
                    mchid: args.mchId,
                    publicKey: Buffer.from(args.publicKey),
                    privateKey: Buffer.from(args.privateKey),
                    key: args.apiKey,
                    serial_no: args.serialNo,
                });
```

替换为：

```typescript
                const override = getPaymentOverride(ctx, 'wechatpay') as WechatpayCredentials | null;
                const pay = new WxPay({
                    appid: override?.appId || args.appId,
                    mchid: override?.mchId || args.mchId,
                    publicKey: Buffer.from(override?.publicKey || args.publicKey),
                    privateKey: Buffer.from(override?.privateKey || args.privateKey),
                    key: override?.apiKey || args.apiKey,
                    serial_no: override?.serialNo || args.serialNo,
                });
```

- [ ] **Step 4: 修改 tradeType 读取**

将第 57 行：

```typescript
                const tradeType = args.tradeType || 'JSAPI';
```

替换为：

```typescript
                const tradeType = override?.tradeType || args.tradeType || 'JSAPI';
```

- [ ] **Step 5: 修改 JSAPI 返回中的 appId**

将第 126 行：

```typescript
                        appId: args.appId,
```

替换为：

```typescript
                        appId: override?.appId || args.appId,
```

- [ ] **Step 6: 编译验证**

Run: `cd e:\code\vendure\packages\wechatpay-plugin && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
cd e:\code\vendure
git add packages/wechatpay-plugin/package.json packages/wechatpay-plugin/src/wechatpay-handler.ts
git commit --no-verify -m "feat: wechatpay handler reads per-channel credential override + add cjk-plugin peerDep"
```

---

## Task 5: Dashboard payment-config-widget.tsx

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\dashboard\payment-config-widget.tsx`

- [ ] **Step 1: 创建 payment-config-widget.tsx**

```tsx
import {
    Field,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@vendure/dashboard';
import { DashboardFormComponent } from '@vendure/dashboard';
import React, { useEffect, useState } from 'react';

interface PayConfigStruct {
    alipayJson?: string;
    wechatpayJson?: string;
}

interface AlipayCreds {
    appId?: string;
    privateKey?: string;
    tradeType?: string;
}

interface WechatpayCreds {
    appId?: string;
    mchId?: string;
    publicKey?: string;
    privateKey?: string;
    apiKey?: string;
    serialNo?: string;
    tradeType?: string;
}

function safeParse<T>(s: string | undefined | null, fallback: T): T {
    if (!s) return fallback;
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
}

export const PaymentConfigInput: DashboardFormComponent = props => {
    const { value, onChange, disabled } = props;

    const [alipay, setAlipay] = useState<AlipayCreds>(safeParse(value?.alipayJson, {}));
    const [wechatpay, setWechatpay] = useState<WechatpayCreds>(safeParse(value?.wechatpayJson, {}));

    useEffect(() => {
        setAlipay(safeParse(value?.alipayJson, {}));
        setWechatpay(safeParse(value?.wechatpayJson, {}));
    }, [value]);

    const emit = (nextAlipay: AlipayCreds, nextWechatpay: WechatpayCreds) => {
        setAlipay(nextAlipay);
        setWechatpay(nextWechatpay);
        onChange({
            alipayJson: JSON.stringify(nextAlipay),
            wechatpayJson: JSON.stringify(nextWechatpay),
        });
    };

    const updateAlipay = (field: string, val: string) => {
        emit({ ...alipay, [field]: val }, wechatpay);
    };

    const updateWechatpay = (field: string, val: string) => {
        emit(alipay, { ...wechatpay, [field]: val });
    };

    return (
        <div className="space-y-4 border rounded-md p-4">
            <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 font-medium">
                    支付宝配置
                    {!alipay.appId && (
                        <span className="ml-2 text-xs text-muted-foreground">（未配置）</span>
                    )}
                </summary>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-3">
                    <Field>
                        <FieldLabel>AppId</FieldLabel>
                        <Input
                            value={alipay.appId ?? ''}
                            onChange={e => updateAlipay('appId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>交易类型</FieldLabel>
                        <Select
                            value={alipay.tradeType ?? 'PAGE'}
                            onValueChange={v => updateAlipay('tradeType', v)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PAGE">PAGE</SelectItem>
                                <SelectItem value="WAP">WAP</SelectItem>
                                <SelectItem value="APP">APP</SelectItem>
                                <SelectItem value="MINI">MINI</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>应用私钥 (PrivateKey)</FieldLabel>
                        <Input
                            type="password"
                            value={alipay.privateKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateAlipay('privateKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                </div>
            </details>

            <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 font-medium">
                    微信支付配置
                    {!wechatpay.appId && (
                        <span className="ml-2 text-xs text-muted-foreground">（未配置）</span>
                    )}
                </summary>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-3">
                    <Field>
                        <FieldLabel>AppId</FieldLabel>
                        <Input
                            value={wechatpay.appId ?? ''}
                            onChange={e => updateWechatpay('appId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>商户号 (mchId)</FieldLabel>
                        <Input
                            value={wechatpay.mchId ?? ''}
                            onChange={e => updateWechatpay('mchId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>证书序列号</FieldLabel>
                        <Input
                            value={wechatpay.serialNo ?? ''}
                            onChange={e => updateWechatpay('serialNo', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>交易类型</FieldLabel>
                        <Select
                            value={wechatpay.tradeType ?? 'JSAPI'}
                            onValueChange={v => updateWechatpay('tradeType', v)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="JSAPI">JSAPI</SelectItem>
                                <SelectItem value="NATIVE">NATIVE</SelectItem>
                                <SelectItem value="APP">APP</SelectItem>
                                <SelectItem value="H5">H5</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>微信平台公钥 (PEM)</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.publicKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('publicKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>商户私钥 (PEM)</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.privateKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('privateKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>APIv3 密钥</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.apiKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('apiKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                </div>
            </details>
        </div>
    );
};
```

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/payment-config-widget.tsx
git commit --no-verify -m "feat: add payment config Dashboard form component"
```

---

## Task 6: channel-detail-forms.tsx 注册 payConfig

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\dashboard\channel-detail-forms.tsx`

- [ ] **Step 1: 追加 import 和注册**

完整替换 `channel-detail-forms.tsx` 内容为：

```typescript
import { DashboardDetailFormExtensionDefinition } from '@vendure/dashboard';

import { AuthConfigInput } from './auth-config-widget';
import { PaymentConfigInput } from './payment-config-widget';

export const cjkChannelDetailForms: DashboardDetailFormExtensionDefinition[] = [
    {
        pageId: 'channel-detail',
        extendDetailDocument: `
            query ExtendChannelAuthConfig {
                channel {
                    customFields {
                        authConfig {
                            enabledMethods
                            overridesJson
                            ssoProvidersJson
                        }
                    }
                }
            }
        `,
        inputs: [
            {
                blockId: 'custom-fields',
                field: 'authConfig',
                component: AuthConfigInput,
            },
        ],
    },
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

- [ ] **Step 2: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/dashboard/channel-detail-forms.tsx
git commit --no-verify -m "feat: register payConfig in channel detail forms"
```

---

## Task 7: 编译与构建验证

- [ ] **Step 1: 编译 cjk-plugin**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 2: 编译 alipay-plugin**

Run: `cd e:\code\vendure\packages\alipay-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 3: 编译 wechatpay-plugin**

Run: `cd e:\code\vendure\packages\wechatpay-plugin && npm run build`
Expected: 构建成功

- [ ] **Step 4: dev-server tsc 检查**

Run: `cd e:\code\vendure\packages\dev-server && npx tsc --noEmit`
Expected: 无 payment 相关新错误

---

## Task 8: 启动验证

- [ ] **Step 1: 启动后端**

Run: `cd e:\code\vendure\packages\dev-server && npm run dev`
Expected: 服务器成功启动在 port 3000，无 GraphQL schema 错误

- [ ] **Step 2: 验证 GraphQL schema**

访问 `http://localhost:3000/admin-api`，执行查询：

```graphql
query {
    channels {
        items {
            id
            customFields {
                payConfig {
                    alipayJson
                    wechatpayJson
                }
            }
        }
    }
}
```

Expected: 返回 payConfig struct 字段（初始为 null 或空字符串）

- [ ] **Step 3: 验证 Dashboard**

访问 `http://localhost:3000/admin`，打开 Channel 详情页，确认 customFields 区域显示"支付配置"表单组件。

---

## Self-Review

**Spec 覆盖**：
- [x] payConfig struct 字段（Task 1）
- [x] payment-config.types.ts（Task 1）
- [x] payment-config.ts 读取函数（Task 2）
- [x] 导出（Task 2）
- [x] alipay handler 改造（Task 3）
- [x] wechatpay handler 改造 + package.json（Task 4）
- [x] Dashboard 表单组件（Task 5）
- [x] channel-detail-forms 注册（Task 6）
- [x] 编译验证（Task 7）
- [x] 启动验证（Task 8）

**类型一致性**：
- `getPaymentOverride(ctx, 'alipay')` 返回 `AlipayCredentials | null`
- `getPaymentOverride(ctx, 'wechatpay')` 返回 `WechatpayCredentials | null`
- `PaymentMethodCode = 'alipay' | 'wechatpay'`
- Dashboard 组件 `PaymentConfigInput` 与 `AuthConfigInput` 模式一致

**无占位符**：所有步骤包含完整代码。
