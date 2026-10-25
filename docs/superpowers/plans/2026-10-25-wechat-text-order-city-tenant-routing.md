# 公众号文字订购：城市识别 / 租户路由 / 配送校验 实现计划（P0）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让平台号公众号在文字订购时按地址自动确定城市与可服务租户、下单前校验配送范围，并在下单成功消息中给出订单号、商品、金额与预计送达。

**Architecture:** 采用「延迟绑定」——搜索阶段不打断用户，下单落单前用默认/新建地址反推城市，经 `tenant-router` 选租户；若租户与当前渠道不同，用原关键词在新渠道重搜并重建编号；`delivery-guard` 调用 `address-plugin` 判定范围，超范围返回可服务区域文案。所有纯逻辑（编码推导、索引构建、候选排序）拆成纯函数以便单测。

**Tech Stack:** Vendure 3.6.4 插件、NestJS DI、TypeORM、TypeScript、vitest、MeiliSearch（既有）、cjk-plugin MapService（既有）、address-plugin DeliveryService（既有）。

**Spec:** `docs/superpowers/specs/2026-10-25-wechat-text-order-city-tenant-routing-design.md`

**范围调整（相对 spec）:** 本期不做门店实体直读与区县/半径级判定；P0 数据源为渠道字段 `servingCities`、`minOrderAmount`、`deliveryMinutes`（`MerchantStore`、`DeliveryRange` 放到 P1）。

**实施修正（2026-10-25）:** 经仓库核实，渠道原本**没有** `minOrderAmount` / `deliveryMinutes` 字段（同名配置在 campus-delivery 的门店配置里），已在 Task 1 一并补为渠道 customField：`minOrderAmount`（int，单位分）、`deliveryMinutes`（int，分钟）。Task 4 的城市目录服务从渠道 customFields 读取这两个值，语义成立。

**实施修正二（2026-10-25，Task 10 前）:** 核对线上部署（`/www/apps/vendure` → pm2 `vendure` → Postgres 库 `vendure`）确认：**不存在 `delivery_range` 表，`AddressPlugin` 从未在 `dev-config.ts` 注册，`merchant-plugin` 也未上线**。原 Task 4/6 依赖的 `DeliveryRange` / `DeliveryService` 在线上不可用，若按原样注册 provider 会因实体元数据缺失导致下单链路抛错。经确认改为**城市级校验**：城市索引只读渠道 `servingCities`（未配置的渠道视为不限，进 `allChannels` 兜底）；配送守卫判定「地址城市码是否在渠道服务城市内」，不再引入 address-plugin（`package.json`/lockfile 中的 `@vendure/address-plugin` 依赖已同步移除）。P1 若上线地址/范围插件，再补区县与半径精度。

**实施修正三（2026-10-25，Task 11 冒烟后）:** 冒烟发现两处线上问题并修复（`b601f22ff`）：① 切店重搜无命中时原实现保留旧店结果与会话渠道，用户继续回编号会落回旧店并在守卫处反复切店——现无论是否命中都切会话渠道并覆盖结果，无命中提示换词重搜；② 直辖市地址（城市字段为空）超范围文案会显示城市码，现用省份兜底。另记录遗留项：`customer-binding` 的「手机号已注册 → 补绑定」分支不保存本次输入地址，该类老用户会跳过路由/守卫（待产品确认是否 P0 补建）。

**实施修正四（2026-10-25，遗留项收口）:** ① `customer-binding` 补绑定分支改为与全新建档共用 `saveInitialAddress`，保存本次输入地址（复验：既有顾客 + 北京地址 → 地址入库 + 守卫拦截、无订单）；② `delivery-guard` 增加坐标兜底：地理编码失败时用地址簿已存坐标逆地理出省市区短文本再补取区划码，仍失败才 fail closed；`AddressBookItem` 透出 `latitude/longitude`；③ 直辖市超范围文案取不到省市时从地址原文提取城市名，不再显示城市码。另因线上 `order` 表已删列累积触发 Postgres 1600 列上限、启动崩溃，`dev-config` 增加 `DB_SYNC` 开关并在线上置 `0`（详见运维清单第 5 节）。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts`（改） | 新增 `servingCities` 渠道字段 |
| `packages/wechat-shopping-assistant-plugin/src/city/address-parser.ts`（新） | 区划码推导、手机号/缺失字段识别（纯函数） |
| `.../src/city/address-parser.spec.ts`（新） | 上述纯函数单测 |
| `.../src/city/city-catalog.ts`（新） | `buildCityIndex()` 纯函数 + 类型 |
| `.../src/city/city-catalog.spec.ts`（新） | 索引构建单测 |
| `.../src/city/city-catalog.service.ts`（新） | 读取 Channel 并缓存城市索引 |
| `.../src/city/tenant-router.ts`（新） | `rankCandidates()` 纯函数 |
| `.../src/city/tenant-router.spec.ts`（新） | 排序单测 |
| `.../src/city/tenant-router.service.ts`（新） | 解析城市 + 选租户 |
| `.../src/city/delivery-guard.service.ts`（新） | 地址→区划码→渠道服务城市校验 |
| `.../src/city/delivery-guard.spec.ts`（新） | 守卫分支单测（stub Channel/GeoService） |
| `.../src/card-builder.ts`（改） | 超范围卡、切店提示、ETA |
| `.../src/card-builder.spec.ts`（改） | 新文案单测 |
| `.../src/types.ts`（改） | draft 扩展 |
| `.../src/assistant.service.ts`（改） | `placeOrder` 前置编排、切店重搜 |
| `.../src/assistant-flow.spec.ts`（改） | 主/异常路径 |
| `.../src/plugin.ts`（改） | 注册新 provider |
| `.../package.json`（改） | 渠道字段依赖（无新增外部依赖） |

---

### Task 1: 渠道新增 `servingCities` 字段

**Files:**
- Modify: `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts`

- [ ] **Step 1: 定位渠道 customFields 定义块**

打开 `packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts`，搜索 `name: 'shopName'` 定位字段声明（约 L1-L60 范围内）。

- [ ] **Step 2: 在 `shopName` 之后添加字段**

```ts
        {
            name: 'servingCities',
            type: 'string',
            list: true,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '服务城市（城市码）' }],
            description: [
                {
                    languageCode: LanguageCode.zh_Hans,
                    value: '该店铺服务城市的 6 位城市码（如吉林市 220200，取区县码前 4 位 + 00），用于公众号文字订购的城市匹配；留空则按配送范围推导',
                },
            ],
        },
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @vendure/cjk-plugin build`
Expected: 编译成功，无 TS 错误。

- [ ] **Step 4: 提交**

```bash
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts packages/cjk-plugin/lib
git commit -m "feat(cjk): 渠道新增服务城市 servingCities 字段"
```

---

### Task 2: 区划码与地址解析纯函数

**Files:**
- Create: `packages/wechat-shopping-assistant-plugin/src/city/address-parser.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/city/address-parser.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, test } from 'vitest';
import { codesFromAdcode, extractPhone, buildParsedAddress } from './address-parser';

describe('codesFromAdcode', () => {
    test('6 位区县码推导省/市/区县码', () => {
        expect(codesFromAdcode('220211')).toEqual({
            provinceCode: '220000',
            cityCode: '220200',
            districtCode: '220211',
        });
    });
    test('非 6 位返回全 null', () => {
        expect(codesFromAdcode('2202')).toEqual({ provinceCode: null, cityCode: null, districtCode: null });
        expect(codesFromAdcode(null)).toEqual({ provinceCode: null, cityCode: null, districtCode: null });
    });
});

describe('extractPhone', () => {
    test('从文本识别 11 位手机号并从文本剥离', () => {
        expect(extractPhone('吉林市丰满区江南街1号 张三 13800138000')).toEqual({
            phoneNumber: '13800138000',
            rest: '吉林市丰满区江南街1号 张三',
        });
    });
    test('无手机号', () => {
        expect(extractPhone('吉林市丰满区江南街1号')).toEqual({ phoneNumber: null, rest: '吉林市丰满区江南街1号' });
    });
});

describe('buildParsedAddress', () => {
    const geo = {
        province: '吉林省',
        city: '吉林市',
        district: '丰满区',
        adcode: '220211',
        lat: 43.8,
        lng: 126.5,
        formattedAddress: '吉林省吉林市丰满区江南街1号',
    };

    test('完整地址无 missing', () => {
        const r = buildParsedAddress(geo, '江南街1号 13800138000');
        expect(r.cityCode).toBe('220200');
        expect(r.districtCode).toBe('220211');
        expect(r.phoneNumber).toBe('13800138000');
        expect(r.missing).toEqual([]);
    });

    test('缺坐标 → missing 含 district（无法判定区县）', () => {
        const r = buildParsedAddress({ ...geo, adcode: null }, '江南街1号 13800138000');
        expect(r.missing).toContain('district');
    });

    test('缺电话 → missing 含 phone', () => {
        const r = buildParsedAddress(geo, '江南街1号');
        expect(r.missing).toContain('phone');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/address-parser.spec.ts`
Expected: FAIL，`Cannot find module './address-parser'`。

- [ ] **Step 3: 实现**

```ts
/**
 * 地址解析纯函数：地图编码结果 → 结构化地址 + 缺失字段。
 * 不发起网络请求（geocode 由调用方传入），便于单测与复用。
 */
export type MissingField = 'city' | 'district' | 'street' | 'phone';

export interface ParsedAddress {
    province: string | null;
    city: string | null;
    cityCode: string | null;
    district: string | null;
    districtCode: string | null;
    provinceCode: string | null;
    streetLine1: string;
    phoneNumber: string | null;
    lat: number | null;
    lng: number | null;
    missing: MissingField[];
}

export interface GeoLike {
    province: string | null;
    city: string | null;
    district: string | null;
    adcode?: string | null;
    lat: number;
    lng: number;
    formattedAddress: string;
}

export function codesFromAdcode(adcode?: string | null): {
    provinceCode: string | null;
    cityCode: string | null;
    districtCode: string | null;
} {
    const code = String(adcode ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { provinceCode: null, cityCode: null, districtCode: null };
    }
    return {
        provinceCode: `${code.slice(0, 2)}0000`,
        cityCode: `${code.slice(0, 4)}00`,
        districtCode: code,
    };
}

export function extractPhone(text: string): { phoneNumber: string | null; rest: string } {
    const m = /(1[3-9]\d{9})/.exec(text);
    if (!m) return { phoneNumber: null, rest: text.trim() };
    return {
        phoneNumber: m[1],
        rest: text.replace(m[1], '').replace(/\s+/g, ' ').trim(),
    };
}

export function buildParsedAddress(geo: GeoLike | null, rawText: string): ParsedAddress {
    const { phoneNumber, rest } = extractPhone(rawText);
    const codes = codesFromAdcode(geo?.adcode);
    const missing: MissingField[] = [];
    if (!geo?.city) missing.push('city');
    if (!codes.cityCode || !geo?.district) missing.push('district');
    if (!geo?.formattedAddress && !rest) missing.push('street');
    if (!phoneNumber) missing.push('phone');

    return {
        province: geo?.province ?? null,
        city: geo?.city ?? null,
        cityCode: codes.cityCode,
        district: geo?.district ?? null,
        districtCode: codes.districtCode,
        provinceCode: codes.provinceCode,
        streetLine1: geo?.formattedAddress || rest,
        phoneNumber,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        missing,
    };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/address-parser.spec.ts`
Expected: PASS（7 个用例）。

- [ ] **Step 5: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/city/address-parser.ts packages/wechat-shopping-assistant-plugin/src/city/address-parser.spec.ts
git commit -m "feat(assistant): 地址解析纯函数（区划码/手机号/缺失字段）"
```

---

### Task 3: 城市索引纯函数

**Files:**
- Create: `packages/wechat-shopping-assistant-plugin/src/city/city-catalog.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/city/city-catalog.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, test } from 'vitest';
import { buildCityIndex } from './city-catalog';

const channels = [
    { id: '1', code: 'default', token: 'default-token', name: '平台', servingCities: [] as string[] },
    { id: '111', code: 'limin', token: 'official-20', name: '东利民', servingCities: ['220200'] },
];
const ranges = [
    { channelId: 1, shopId: 1, rangeType: 'all', districtCodes: null, radiusKm: null, centerLat: null, centerLng: null, enabled: true },
    { channelId: 111, shopId: 111, rangeType: 'district', districtCodes: '["220211"]', radiusKm: null, centerLat: null, centerLng: null, enabled: true },
    { channelId: 222, shopId: 222, rangeType: 'circle', districtCodes: null, radiusKm: 3, centerLat: 43.83, centerLng: 126.55, enabled: true },
];

describe('buildCityIndex', () => {
    test('显式 servingCities 优先', () => {
        const index = buildCityIndex(channels, ranges);
        expect(index.byCity.get('220200')?.[0]).toMatchObject({ channelId: '111', precision: 'explicit' });
    });

    test('district 白名单推导上级城市码', () => {
        const index = buildCityIndex(
            [{ ...channels[0], id: '333', servingCities: [] }],
            [{ channelId: 333, shopId: 333, rangeType: 'district', districtCodes: '["220202"]', radiusKm: null, centerLat: null, centerLng: null, enabled: true }],
        );
        expect(index.byCity.get('220200')?.[0]).toMatchObject({ channelId: '333', precision: 'district' });
    });

    test('all 标记 allChannels，不产生城市键', () => {
        const index = buildCityIndex(channels, ranges);
        expect(index.allChannels.map(c => c.channelId)).toContain('1');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/city-catalog.spec.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

```ts
/** 城市 → 可服务渠道索引（纯函数，数据由 service 注入）。 */
export type Precision = 'explicit' | 'district' | 'circle' | 'all';

export interface CatalogChannel {
    channelId: string;
    channelCode: string;
    channelToken: string;
    channelName: string;
    precision: Precision;
    minOrderAmount: number;
    deliveryMinutes: number | null;
    storeId: string | null;
    /** 门店/配送圆心坐标（circle 类型），路由时算用户距离 */
    centerLat: number | null;
    centerLng: number | null;
    /** 用户到门店的距离（km），由路由服务按坐标计算后填入 */
    distanceKm: number | null;
}

export interface ChannelLike {
    id: string;
    code: string;
    token: string;
    name: string;
    servingCities: string[];
    minOrderAmount?: number;
    deliveryMinutes?: number | null;
}

export interface RangeLike {
    channelId: number | string;
    shopId: number | string;
    rangeType: 'all' | 'circle' | 'district' | string;
    districtCodes: string | null;
    radiusKm: number | null;
    centerLat: number | null;
    centerLng: number | null;
    enabled: boolean;
}

export interface CityIndex {
    byCity: Map<string, CatalogChannel[]>;
    allChannels: CatalogChannel[];
}

function parseCodes(raw: string | null): string[] {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
        return [];
    }
}

export function buildCityIndex(channels: ChannelLike[], ranges: RangeLike[]): CityIndex {
    const byCity = new Map<string, CatalogChannel[]>();
    const allChannels: CatalogChannel[] = [];
    const push = (city: string, item: CatalogChannel) => {
        const list = byCity.get(city) ?? [];
        list.push(item);
        byCity.set(city, list);
    };

    for (const ch of channels) {
        const base = {
            channelId: String(ch.id),
            channelCode: ch.code,
            channelToken: ch.token,
            channelName: ch.name,
            minOrderAmount: ch.minOrderAmount ?? 0,
            deliveryMinutes: ch.deliveryMinutes ?? null,
            storeId: null as string | null,
            centerLat: null as number | null,
            centerLng: null as number | null,
            distanceKm: null as number | null,
        };
        for (const city of ch.servingCities ?? []) {
            push(city, { ...base, precision: 'explicit' });
        }
        const range = ranges.find(r => String(r.channelId) === String(ch.id));
        if (!range || !range.enabled) continue;

        if (range.rangeType === 'all') {
            allChannels.push({ ...base, precision: 'all' });
        } else if (range.rangeType === 'district') {
            for (const code of parseCodes(range.districtCodes)) {
                const cityCode = code.length === 6 ? `${code.slice(0, 4)}00` : code;
                push(cityCode, { ...base, precision: 'district', storeId: String(range.shopId) });
            }
        } else if (range.rangeType === 'circle') {
            // 半径覆盖需要用户坐标：索引阶段带上圆心，距离由 TenantRouterService 计算
            allChannels.push({
                ...base,
                precision: 'circle',
                storeId: String(range.shopId),
                centerLat: range.centerLat,
                centerLng: range.centerLng,
            });
        }
    }
    return { byCity, allChannels };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/city-catalog.spec.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/city/city-catalog.ts packages/wechat-shopping-assistant-plugin/src/city/city-catalog.spec.ts
git commit -m "feat(assistant): 城市→渠道索引纯函数"
```

---

### Task 4: 城市目录服务（缓存 + 数据加载）

**Files:**
- Create: `packages/wechat-shopping-assistant-plugin/src/city/city-catalog.service.ts`

- [ ] **Step 1: 实现服务**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryRange } from '@vendure/address-plugin';

import { buildCityIndex, CityIndex, ChannelLike, RangeLike } from './city-catalog';

const loggerCtx = 'WechatAssistantCityCatalog';
const CACHE_TTL_MS = 5 * 60_000;

@Injectable()
export class CityCatalogService {
    private cache: { index: CityIndex; expiresAt: number } | null = null;

    constructor(private readonly connection: TransactionalConnection) {}

    async getIndex(ctx: RequestContext): Promise<CityIndex> {
        if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.index;
        // 用 rawConnection 绕过 ChannelAware 过滤：目录需要跨渠道全量（ctx 通道过滤会漏掉其他租户）
        const [channels, ranges] = await Promise.all([
            this.connection.rawConnection.getRepository(Channel).find(),
            this.connection.rawConnection.getRepository(DeliveryRange).find(),
        ]);
        const channelLikes: ChannelLike[] = channels.map(ch => {
            const cf = (ch.customFields ?? {}) as any;
            return {
                id: String(ch.id),
                code: ch.code,
                token: ch.token,
                name: String(cf.shopName ?? ch.code),
                servingCities: Array.isArray(cf.servingCities) ? cf.servingCities.map(String) : [],
                minOrderAmount: Number(cf.minOrderAmount ?? 0) || 0,
                deliveryMinutes: cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null,
            };
        });
        const rangeLikes = ranges.map(r => ({
            channelId: String((r as any).channelId),
            shopId: String((r as any).shopId),
            rangeType: String((r as any).rangeType),
            districtCodes: (r as any).districtCodes ?? null,
            radiusKm: (r as any).radiusKm ?? null,
            centerLat: (r as any).centerLat ?? null,
            centerLng: (r as any).centerLng ?? null,
            enabled: Boolean((r as any).enabled),
        })) as RangeLike[];
        const index = buildCityIndex(channelLikes, rangeLikes);
        this.cache = { index, expiresAt: Date.now() + CACHE_TTL_MS };
        Logger.info(
            `City catalog built: cities=${index.byCity.size} all=${index.allChannels.length}`,
            loggerCtx,
        );
        return index;
    }

    /** 渠道字段变更后立即失效（后台保存时调用） */
    invalidate(): void {
        this.cache = null;
    }
}
```

- [ ] **Step 2: 加依赖并编译**

在 `packages/wechat-shopping-assistant-plugin/package.json` 的 `peerDependencies` 与 `devDependencies` 增加（已确认 `packages/address-plugin/index.ts` 导出 `DeliveryRange` / `DeliveryService`；渠道 `servingCities` 为 customField，无需依赖 cjk-plugin）：

```json
"@vendure/address-plugin": "workspace:*"
```

Run: `pnpm install; pnpm --filter @vendure/address-plugin build; pnpm --filter @vendure/wechat-shopping-assistant-plugin build`
Expected: 编译成功。

- [ ] **Step 3: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/package.json pnpm-lock.yaml packages/wechat-shopping-assistant-plugin/src/city/city-catalog.service.ts
git commit -m "feat(assistant): 城市目录服务（5 分钟缓存）"
```

---

### Task 5: 租户排序纯函数 + 路由服务

**Files:**
- Create: `packages/wechat-shopping-assistant-plugin/src/city/tenant-router.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/city/tenant-router.spec.ts`
- Create: `packages/wechat-shopping-assistant-plugin/src/city/tenant-router.service.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, test } from 'vitest';
import { rankCandidates, Candidate } from './tenant-router';

const c = (over: Partial<Candidate>): Candidate => ({
    channelId: '1', channelCode: 'a', channelToken: 't', channelName: 'A',
    precision: 'all', minOrderAmount: 0, deliveryMinutes: 30, storeId: null,
    centerLat: null, centerLng: null, distanceKm: null,
    ...over,
});

describe('rankCandidates', () => {
    test('精度：explicit > district > circle > all', () => {
        const r = rankCandidates([c({ channelId: 'a', precision: 'all' }), c({ channelId: 'b', precision: 'circle', distanceKm: 1 }), c({ channelId: 'c', precision: 'district' })], {});
        expect(r.map(x => x.channelId)).toEqual(['c', 'b', 'a']);
    });
    test('同精度按起送价、时效、距离', () => {
        const r = rankCandidates(
            [
                c({ channelId: 'a', precision: 'district', minOrderAmount: 2000 }),
                c({ channelId: 'b', precision: 'district', minOrderAmount: 0, deliveryMinutes: 20 }),
                c({ channelId: 'c', precision: 'district', minOrderAmount: 0, deliveryMinutes: 40 }),
            ],
            {},
        );
        expect(r.map(x => x.channelId)).toEqual(['b', 'c', 'a']);
    });
    test('半径候选按距离过滤超出 0 结果的项', () => {
        const r = rankCandidates([c({ channelId: 'a', precision: 'circle', distanceKm: 5 })], { maxDistanceKm: 3 });
        expect(r).toEqual([]);
    });
    test('同渠道多精度命中：去重保留最高精度', () => {
        const r = rankCandidates(
            [c({ channelId: 'a', precision: 'all' }), c({ channelId: 'a', precision: 'explicit' })],
            {},
        );
        expect(r).toHaveLength(1);
        expect(r[0].precision).toBe('explicit');
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/tenant-router.spec.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯函数**

```ts
import { CatalogChannel, Precision } from './city-catalog';

export type Candidate = CatalogChannel;

const PRECISION_WEIGHT: Record<Precision, number> = { explicit: 0, district: 1, circle: 2, all: 3 };

export interface RankOptions {
    /** 半径候选的最大距离（km），缺省 3 */
    maxDistanceKm?: number;
}

export function rankCandidates(candidates: Candidate[], opts: RankOptions = {}): Candidate[] {
    const maxKm = opts.maxDistanceKm ?? 3;
    const usable = candidates.filter(c => c.precision !== 'circle' || (c.distanceKm != null && c.distanceKm <= maxKm));
    const sorted = usable.slice().sort((a, b) => {
        const p = PRECISION_WEIGHT[a.precision] - PRECISION_WEIGHT[b.precision];
        if (p !== 0) return p;
        const min = (a.minOrderAmount ?? 0) - (b.minOrderAmount ?? 0);
        if (min !== 0) return min;
        const dm = (a.deliveryMinutes ?? 999) - (b.deliveryMinutes ?? 999);
        if (dm !== 0) return dm;
        return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });
    // 同渠道可能同时命中 explicit/district/all，排序后按渠道去重，保留精度最高的那条
    const seen = new Set<string>();
    return sorted.filter(c => {
        if (seen.has(c.channelId)) return false;
        seen.add(c.channelId);
        return true;
    });
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/tenant-router.spec.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 实现路由服务**

```ts
import { Injectable } from '@nestjs/common';
import { RequestContext } from '@vendure/core';

import { CityCatalogService } from './city-catalog.service';
import { Candidate, rankCandidates } from './tenant-router';

export interface TenantRouteResult {
    chosen: Candidate | null;
    candidates: Candidate[];
    ambiguous: boolean;
    /** 当前渠道是否仍在候选内（false 表示需要切店重搜） */
    currentInCandidates: boolean;
}

@Injectable()
export class TenantRouterService {
    constructor(private readonly catalog: CityCatalogService) {}

    async resolve(
        ctx: RequestContext,
        input: { cityCode?: string | null; currentChannelId?: string | null; lat?: number | null; lng?: number | null },
    ): Promise<TenantRouteResult> {
        const index = await this.catalog.getIndex(ctx);
        const cityHits = input.cityCode ? (index.byCity.get(input.cityCode) ?? []) : [];
        // 半径渠道：用户坐标 + 圆心坐标都齐全才计算距离；缺圆心则 distanceKm 保持 null，
        // 被 rankCandidates 过滤掉（不猜，交由 delivery-guard 明确拒绝）
        const others = index.allChannels.map(c => {
            if (c.precision !== 'circle') return c;
            if (input.lat == null || input.lng == null || c.centerLat == null || c.centerLng == null) return c;
            return { ...c, distanceKm: haversineKm(input.lat, input.lng, c.centerLat, c.centerLng) };
        });
        const candidates = rankCandidates([...cityHits, ...others]).slice(0, 3);
        const currentChannelId = String(input.currentChannelId ?? '');
        return {
            chosen: candidates[0] ?? null,
            candidates,
            ambiguous: candidates.length > 1 && candidates[0].precision === candidates[1].precision,
            currentInCandidates: candidates.some(c => c.channelId === currentChannelId),
        };
    }
}

/** 两点球面距离（km），保留 2 位小数 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 100) / 100;
}
```

- [ ] **Step 6: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/city/tenant-router.ts packages/wechat-shopping-assistant-plugin/src/city/tenant-router.spec.ts packages/wechat-shopping-assistant-plugin/src/city/tenant-router.service.ts
git commit -m "feat(assistant): 租户候选排序与路由服务"
```

---

### Task 6: 配送守卫服务

**Files:**
- Create: `packages/wechat-shopping-assistant-plugin/src/city/delivery-guard.service.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/city/delivery-guard.spec.ts`

- [ ] **Step 1: 写失败测试（stub 依赖）**

```ts
import { describe, expect, test } from 'vitest';
import { DeliveryGuardService } from './delivery-guard.service';
import { buildParsedAddress } from './address-parser';

const geo = {
    province: '吉林省', city: '吉林市', district: '丰满区', adcode: '220211',
    lat: 43.8, lng: 126.5, formattedAddress: '吉林省吉林市丰满区江南街1号',
};

/** connection 假件：rawConnection.getRepository(...).findOne 返回指定配送范围 */
function makeGuard(range: any, results: any[], geocode: any = geo) {
    const deliveryService = { validateDelivery: async () => results };
    const connection = { rawConnection: { getRepository: () => ({ findOne: async () => range }) } };
    const geoService = { geocode: async () => geocode };
    return new DeliveryGuardService(deliveryService as any, connection as any, geoService as any);
}

describe('DeliveryGuardService.check', () => {
    test('范围内 → OK', async () => {
        const guard = makeGuard({ channelId: 111, shopId: 111, rangeType: 'district', radiusKm: null, districtCodes: '["220211"]' }, [{ inRange: true, reason: 'OK' }]);
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OK');
        expect(r.parsed?.cityCode).toBe('220200');
    });

    test('超范围 → OUT_OF_RANGE + 半径文案', async () => {
        const guard = makeGuard({ channelId: 111, shopId: 111, rangeType: 'circle', radiusKm: 3, districtCodes: null }, [{ inRange: false, reason: 'BEYOND_RANGE' }]);
        const r = await guard.check({} as any, '111', '江南街1号 13800138000');
        expect(r.status).toBe('OUT_OF_RANGE');
        expect(r.serviceAreaText).toContain('3 公里');

    });

    test('无配送配置 → OUT_OF_RANGE', async () => {
        const guard = makeGuard(null, []);
        const r = await guard.check({} as any, '111', '江南街1号');
        expect(r.status).toBe('OUT_OF_RANGE');
    });

    test('地理编码失败 → UNKNOWN（fail closed）', async () => {
        const guard = makeGuard({}, [], null);
        const r = await guard.check({} as any, '111', '乱写的地址');
        expect(r.status).toBe('UNKNOWN');
    });

    test('parse 只解析地址，不判定范围', async () => {
        const guard = makeGuard(null, []);
        const parsed = await guard.parse({} as any, '江南街1号 13800138000');
        expect(parsed?.cityCode).toBe('220200');
        expect(parsed?.phoneNumber).toBe('13800138000');
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/delivery-guard.spec.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { DeliveryRange, DeliveryService } from '@vendure/address-plugin';

import { GeoService } from '../geo.service';
import { buildParsedAddress, ParsedAddress } from './address-parser';

const loggerCtx = 'WechatAssistantDeliveryGuard';

export type GuardStatus = 'OK' | 'OUT_OF_RANGE' | 'UNKNOWN';

export interface GuardResult {
    status: GuardStatus;
    reason?: string;
    serviceAreaText: string;
    parsed: ParsedAddress | null;
}

@Injectable()
export class DeliveryGuardService {
    constructor(
        private readonly deliveryService: DeliveryService,
        private readonly connection: TransactionalConnection,
        private readonly geoService: GeoService,
    ) {}

    /** 只做地理编码 + 字段解析，不判定范围（供租户路由先用城市选店） */
    async parse(ctx: RequestContext, addressText: string): Promise<ParsedAddress | null> {
        const geo = await this.geoService.geocode(ctx, addressText);
        if (!geo) {
            Logger.warn(`Delivery guard geocode failed: "${addressText.slice(0, 40)}"`, loggerCtx);
            return null;
        }
        return buildParsedAddress(geo, addressText);
    }

    /** 解析 + 校验（外部一律用这个方法，避免漏掉 geocode 失败分支） */
    async check(ctx: RequestContext, channelId: string, addressText: string): Promise<GuardResult> {
        const parsed = await this.parse(ctx, addressText);
        if (!parsed) return { status: 'UNKNOWN', serviceAreaText: '', parsed: null };
        return this.checkParsed(ctx, channelId, parsed);
    }

    /** 已解析地址的范围判定：读该渠道配送档 → DeliveryService 判 rangeType */
    async checkParsed(
        ctx: RequestContext,
        channelId: string,
        parsed: ParsedAddress,
    ): Promise<GuardResult> {
        // rawConnection：按显式 channelId 查，避免 ctx 通道过滤挡住跨租户校验
        const range = await this.connection.rawConnection
            .getRepository(DeliveryRange)
            .findOne({ where: { channelId: Number(channelId), enabled: true } as any });
        if (!range) {
            return {
                status: 'OUT_OF_RANGE',
                reason: 'NO_DELIVERY',
                serviceAreaText: '该店铺暂未开通配送，回复「客服」可咨询。',
                parsed,
            };
        }
        const [result] = await this.deliveryService.validateDelivery(
            ctx,
            {
                fullName: '',
                phone: parsed.phoneNumber ?? '',
                provinceCode: parsed.provinceCode,
                cityCode: parsed.cityCode,
                districtCode: parsed.districtCode,
                detail: parsed.streetLine1,
                lat: parsed.lat,
                lng: parsed.lng,
            },
            [String(range.shopId)],
        );
        if (result?.inRange) return { status: 'OK', serviceAreaText: '', parsed };
        Logger.info(`Delivery out of range: channel=${channelId} reason=${result?.reason}`, loggerCtx);
        return {
            status: 'OUT_OF_RANGE',
            reason: result?.reason,
            serviceAreaText: this.describeArea(range),
            parsed,
        };
    }

    private describeArea(range: any): string {
        if (!range) return '该店铺暂未开通配送。';
        if (range.rangeType === 'circle') {
            return `本店配送范围为以门店为中心 ${range.radiusKm ?? 0} 公里内。`;
        }
        if (range.rangeType === 'district') {
            return '本店目前仅服务指定区县，回复「客服」可查询具体可配送区域。';
        }
        return '本店配送范围以门店确认为准，回复「客服」可查询。';
    }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/city/delivery-guard.spec.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/city/delivery-guard.service.ts packages/wechat-shopping-assistant-plugin/src/city/delivery-guard.spec.ts
git commit -m "feat(assistant): 配送守卫服务（地址→区划码→范围判定）"
```

---

### Task 7: 新增文案卡片（超范围 / 切店 / 预计送达）

**Files:**
- Modify: `packages/wechat-shopping-assistant-plugin/src/card-builder.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/card-builder.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `card-builder.spec.ts` 顶部 import 增加 `buildOutOfRangeText`、`buildChannelSwitchText`，并追加：

```ts
describe('城市路由相关文案', () => {
    test('超范围卡：不出现下单失败，给可服务区域与出口', () => {
        const msg = buildOutOfRangeText('oX', {
            address: '北京市朝阳区建国路1号',
            serviceAreaText: '本店配送范围为以门店为中心 3 公里内。',
            channelName: '东利民粮油店',
        });
        expect(msg.content).toContain('不在配送范围');
        expect(msg.content).toContain('3 公里');
        expect(msg.content).toContain('东利民粮油店');
        expect(msg.content).not.toContain('下单失败');
        expect(msg.content).toContain('回复「客服」');
    });

    test('切店提示：说明已切换并请重新回复编号', () => {
        const msg = buildChannelSwitchText('oX', '东利民粮油店');
        expect(msg.content).toContain('已为你切换到「东利民粮油店」');
        expect(msg.content).toContain('重新回复编号');
    });

    test('预计送达：有时效显示分钟，无则电话确认', () => {
        expect(buildOrderSuccessText('oX', { orderCode: 'A1', total: 100, items: [], etaMinutes: 40 }).content).toContain('约 40 分钟');
        expect(buildOrderSuccessText('oX', { orderCode: 'A1', total: 100, items: [] }).content).toContain('电话确认送达时间');
    });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/card-builder.spec.ts`
Expected: FAIL，`buildOutOfRangeText is not a function`。

- [ ] **Step 3: 实现文案**

在 `card-builder.ts` 末尾追加：

```ts
/** 地址超出配送范围：说明原因 + 可服务区域 + 出口，不出现「下单失败」 */
export function buildOutOfRangeText(
    touser: string,
    input: { address: string; serviceAreaText: string; channelName?: string | null },
): TextMessage {
    const lines = [
        `很抱歉，您填写的地址（${input.address}）不在配送范围。`,
        input.serviceAreaText,
    ];
    if (input.channelName) lines.push(`当前店铺：${input.channelName}`);
    lines.push('可以换个更近的收货地址，或回复「客服」/「留言」让我们帮您处理。');
    return { kind: 'text', touser, content: lines.join('\n') };
}

/** 已切换到目标租户：提示价格已更新、需重新选编号 */
export function buildChannelSwitchText(touser: string, channelName: string): TextMessage {
    return {
        kind: 'text',
        touser,
        content: `根据您的收货地址，已为你切换到「${channelName}」，商品与价格以该店为准。\n请重新回复编号下单。`,
    };
}

```

并修改 `buildOrderSuccessText` 入参：

```ts
        payUrl?: string;
        /** 确认时选定的支付方式展示名（渠道配置） */
        paymentName?: string;
        /** 门店预计送达分钟数（渠道配置），缺省时提示电话确认 */
        etaMinutes?: number | null;
```

在 `lines.push(\`订单号：${input.orderCode}\`);` 之前插入：

```ts
    lines.push(
        input.etaMinutes != null
            ? `预计送达：约 ${input.etaMinutes} 分钟`
            : '预计送达：下单后门店会电话确认送达时间',
    );
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/card-builder.spec.ts`
Expected: PASS（含新增 3 个用例）。

- [ ] **Step 5: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/card-builder.ts packages/wechat-shopping-assistant-plugin/src/card-builder.spec.ts
git commit -m "feat(assistant): 超范围/切店/预计送达文案"
```

---

### Task 8: 扩展会话 draft 字段

**Files:**
- Modify: `packages/wechat-shopping-assistant-plugin/src/types.ts`

- [ ] **Step 1: 在 `AssistantFlowDraft` 追加字段**

```ts
    /** 已确认城市码（6 位区县码 → 城市码） */
    cityCode?: string | null;
    /** 当前实际履约渠道 id（可能与公众号默认渠道不同） */
    resolvedChannelId?: string | null;
    /** 切店后用于重搜的原始关键词 */
    pendingQuery?: string | null;
    /** 地址解析结果（含区划码与缺失字段） */
    addressCandidate?: import('./city/address-parser').ParsedAddress | null;
```

- [ ] **Step 2: 编译**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/types.ts packages/wechat-shopping-assistant-plugin/lib
git commit -m "feat(assistant): 会话草稿增加城市/渠道/待重搜字段"
```

---

### Task 9: 下单前编排（守卫 + 切店重搜）

**Files:**
- Modify: `packages/wechat-shopping-assistant-plugin/src/assistant.service.ts`
- Test: `packages/wechat-shopping-assistant-plugin/src/assistant-flow.spec.ts`

- [ ] **Step 1: 写失败测试（流程级）**

```ts
test('地址超范围 → 超范围卡，不建单', async () => {
    const order = makeOrderStub(null);
    const { svc, outbound } = makeService({
        order,
        guard: {
            status: 'OUT_OF_RANGE',
            reason: 'BEYOND_RANGE',
            serviceAreaText: '本店配送范围为以门店为中心 3 公里内。',
            parsed: null,
        },
    });
    await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
    await svc.onMessage(textEvent('买1', 'M2'));
    await svc.onMessage(textEvent('1', 'M3')); // 选地址 → 确认卡
    await svc.onMessage(textEvent('1', 'M4')); // 确认下单 → 被守卫拦截
    const last = outbound[outbound.length - 1];
    expect(last.content).toContain('不在配送范围');
    expect(last.content).toContain('3 公里');
    expect(order.calls.length).toBe(0);
});

test('地址属于其他租户 → 切换店铺并重搜，不直接下单', async () => {
    const order = makeOrderStub(null);
    const search = {
        calls: [] as any[],
        searchProducts: async (input: any) => {
            search.calls.push(input);
            return SEARCH_HITS.map((h, i) => ({ index: i + 1, quantity: 1, ...h }));
        },
    };
    const { svc, outbound, connection } = makeService({
        order,
        search,
        route: {
            chosen: { channelId: '111', channelName: '东利民', channelToken: 'official-20' },
            candidates: [],
            ambiguous: false,
            currentInCandidates: false,
        },
    });
    await svc.onMessage(textEvent('买一瓶酱油', 'M1'));
    await svc.onMessage(textEvent('买1', 'M2'));
    await svc.onMessage(textEvent('1', 'M3'));
    await svc.onMessage(textEvent('1', 'M4'));
    const last = outbound[outbound.length - 1];
    expect(last.content).toContain('已为你切换到「东利民」');
    expect(order.calls.length).toBe(0);
    expect(search.calls.length).toBe(2);
    expect(search.calls[1].channelId).toBe('111');
    const session = connection.sessions.get('openid-user-1');
    expect(session.channelId).toBe('111');
    expect(session.results.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin exec vitest --config vitest.config.mts --run src/assistant-flow.spec.ts`
Expected: FAIL（新增用例失败；需在 `makeService` 注入 guard/route stub）。

- [ ] **Step 3: 实现编排**

在 `assistant.service.ts` 顶部补 import：

```ts
import { DeliveryGuardService } from './city/delivery-guard.service';
import { TenantRouterService } from './city/tenant-router.service';
```

（`buildOutOfRangeText`、`buildChannelSwitchText` 一并加入 card-builder 的 import 列表。）

构造函数末尾追加：

```ts
        private readonly deliveryGuard: DeliveryGuardService,
        private readonly tenantRouter: TenantRouterService,
```

在 `placeOrder()` 里 `const addrItem = ...` 之后、`const address = ...` / `createOrder` 之前插入（守卫必须在建单前返回）：

```ts
        // 城市路由：解析地址 → 匹配租户 → 切换或校验范围（可用 ASSISTANT_CITY_ROUTING=off 关闭）
        const routingOn = process.env.ASSISTANT_CITY_ROUTING !== 'off';
        if (routingOn && addrItem?.streetLine1) {
            const parsed = await this.deliveryGuard.parse(ctx, addrItem.streetLine1);
            if (!parsed) {
                return buildOrderFailText(touser, '配送校验暂时不可用，请稍后再试');
            }
            const route = await this.tenantRouter.resolve(ctx, {
                cityCode: parsed.cityCode,
                currentChannelId: String(ctx.channelId),
                lat: parsed.lat,
                lng: parsed.lng,
            });
            // 排序第一的渠道不是当前渠道 → 切店（当前渠道即使也在候选内，精度/优先级更低时也要让位）
            const target =
                route.chosen && route.chosen.channelId !== String(ctx.channelId) ? route.chosen : null;
            if (target) {
                // 切店：用原关键词在新渠道重搜，结果写回会话（channelId 一并切换），让用户重新回编号
                const session = await this.sessionService.getActive(touser);
                const query = session?.query?.trim() ?? '';
                await this.sessionService.saveDraft(
                    touser,
                    { cityCode: parsed.cityCode, resolvedChannelId: target.channelId, pendingQuery: query || null },
                    this.opts.sessionTtlMinutes ?? 30,
                );
                if (query) {
                    try {
                        const hits = await this.searchService.searchProducts({
                            query,
                            channelId: target.channelId,
                            locale: this.opts.searchLocale ?? 'zh',
                            limit: this.opts.searchLimit ?? 5,
                            storefrontUrl: this.storefront(),
                            productUrlTemplate: this.opts.productUrlTemplate,
                        });
                        if (hits.length) {
                            await this.sessionService.saveResults(
                                touser,
                                target.channelId,
                                hits.map(h => ({ ...h, quantity: picked[0]?.quantity ?? 1 })),
                                query,
                                this.opts.sessionTtlMinutes ?? 30,
                            );
                        }
                    } catch (e) {
                        Logger.warn(`Assistant switch-channel search failed: ${String(e)}`, loggerCtx);
                    }
                }
                await this.sessionService.clearFlow(touser);
                Logger.info(
                    `Assistant channel switched: ${ctx.channelId} → ${target.channelId} city=${parsed.cityCode}`,
                    loggerCtx,
                );
                return buildChannelSwitchText(touser, target.channelName);
            }
            const guard = await this.deliveryGuard.checkParsed(ctx, String(ctx.channelId), parsed);
            if (guard.status === 'UNKNOWN') {
                return buildOrderFailText(touser, '配送校验暂时不可用，请稍后再试');
            }
            if (guard.status === 'OUT_OF_RANGE') {
                return buildOutOfRangeText(touser, {
                    address: addrItem.streetLine1,
                    serviceAreaText: guard.serviceAreaText,
                    channelName: await this.channelName(String(ctx.channelId)),
                });
            }
        }
```

并在 `placeOrder` 的 `case 'ok'` 里补 ETA：

```ts
                return buildOrderSuccessText(touser, {
                    orderCode: outcome.order.code,
                    total: outcome.order.totalWithTax,
                    items: outcome.items,
                    payUrl,
                    paymentName: selected.name,
                    etaMinutes: await this.channelDeliveryMinutes(String(ctx.channelId)),
                });
```

新增两个小工具（放在 `placeOrder` 之后的基础设施区）：

```ts
    /** 渠道展示名：装修 shopName → channel.code */
    private async channelName(channelId: string): Promise<string | null> {
        const ch = await this.connection.getRepository(Channel).findOne({ where: { id: channelId as any } });
        const cf = (ch?.customFields ?? {}) as any;
        return cf.shopName ? String(cf.shopName) : ch?.code ?? null;
    }

    /** 渠道预计送达分钟数（未配置返回 null → 文案提示电话确认） */
    private async channelDeliveryMinutes(channelId: string): Promise<number | null> {
        const ch = await this.connection.getRepository(Channel).findOne({ where: { id: channelId as any } });
        const cf = (ch?.customFields ?? {}) as any;
        return cf.deliveryMinutes != null ? Number(cf.deliveryMinutes) : null;
    }
```

- [ ] **Step 4: 更新 `makeService` 假件与 import**

在 `assistant-flow.spec.ts` 的 `makeService` 的 `overrides` 类型里增加 `guard?: any; route?: any;`，构造 stubs：

```ts
    const guard = overrides.guard ?? { status: 'OK', serviceAreaText: '', parsed: null };
    const route = overrides.route ?? { chosen: null, candidates: [], ambiguous: false, currentInCandidates: true };
    const guardStub = {
        parse: async () => ({ cityCode: '220200', districtCode: '220211', phoneNumber: '13800138000' }),
        checkParsed: async () => guard,
        check: async () => guard,
    };
```

并在 `new AssistantService(...)` 末尾追加两个参数：

```ts
        guardStub as any,
        { resolve: async () => route } as any,
```

- [ ] **Step 5: 运行全部测试**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin test`
Expected: 全部 PASS（现有 110+ 与新增 2 条）。

- [ ] **Step 6: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/assistant.service.ts packages/wechat-shopping-assistant-plugin/src/assistant-flow.spec.ts packages/wechat-shopping-assistant-plugin/src/types.ts
git commit -m "feat(assistant): 下单前配送守卫与跨租户切店重搜"
```

---

### Task 10: 注册 provider、开关与运维配置清单

**Files:**
- Modify: `packages/wechat-shopping-assistant-plugin/src/plugin.ts`
- Create: `docs/superpowers/plans/2026-10-25-city-routing-ops-checklist.md`

- [ ] **Step 1: 注册 provider**

无需注册 `AddressPlugin`：城市索引与守卫只依赖 `Channel` 实体（Vendure 核心）与 `GeoService`（本插件既有 provider）。

在 `providers` 数组追加：

```ts
        CityCatalogService,
        TenantRouterService,
        DeliveryGuardService,
```

并在 `plugin.ts` 顶部补 import：

```ts
import { CityCatalogService } from './city/city-catalog.service';
import { TenantRouterService } from './city/tenant-router.service';
import { DeliveryGuardService } from './city/delivery-guard.service';
```

- [ ] **Step 2: 编译与测试**

Run: `pnpm --filter @vendure/wechat-shopping-assistant-plugin build && pnpm --filter @vendure/wechat-shopping-assistant-plugin test`
Expected: 编译成功、测试全绿。

- [ ] **Step 3: 写运维配置清单**

```markdown
# 城市路由上线配置清单

每个渠道（tenant-channel）逐项确认：

1. 渠道装修 → 服务城市 `servingCities`：填 6 位城市码（如吉林市 220200 = 区县码前 4 位 + 00），至少覆盖主力城市。
2. 未配置 `servingCities` 的渠道视为**不限城市**（保留原有下单能力）；配置后该渠道只接服务城市内的地址，其他城市会收到「不在配送范围」提示。
3. 渠道 `deliveryMinutes`：填写后订单确认显示「约 X 分钟送达」；不填显示「电话确认」。
4. 渠道 `minOrderAmount`：租户排序用（分）；不填按 0 处理。
5. 回滚开关：`ASSISTANT_CITY_ROUTING=off` → 关闭守卫与切店，恢复原下单链路。
```

- [ ] **Step 4: 提交**

```bash
git add packages/wechat-shopping-assistant-plugin/src/plugin.ts packages/wechat-shopping-assistant-plugin/lib docs/superpowers/plans/2026-10-25-city-routing-ops-checklist.md
git commit -m "feat(assistant): 注册城市路由服务并补充上线配置清单"
```

---

### Task 11: 线上冒烟与回归

- [x] **Step 1: 部署**

```bash
git push origin master
ssh joho "cd /www/apps/vendure && git fetch origin -q && git reset --hard origin/master -q && pm2 restart vendure && sleep 12 && pm2 list | grep -i vendure | head -1"
```

Expected: `online`。实测：`0685faab5`、`b601f22ff` 两次部署均 `online`，启动日志有 `WechatShoppingAssistantPlugin initialized`。

- [x] **Step 2: 冒烟 A（可配送）**

用测试 openid 发「买袋面」→ 回编号 → 用该城市地址下单。
Expected: 回复含订单号、商品、金额、预计送达（或电话确认）、支付链接。

- [x] **Step 3: 冒烟 B（超范围）**

发同一商品，地址填外省地址。
Expected: 超范围卡，含「不在配送范围」+ 服务区域 + 客服/留言出口；数据库无新订单。
实测：北京地址 → 「本店目前不服务「北京市」地区的地址」，无新订单。注意：必须用**全新手机号**，否则命中「手机号已注册 → 补绑定不建地址」分支会跳过守卫（见遗留项）。

- [x] **Step 4: 冒烟 C（切店）**

在有 `servingCities` 的另一城市地址下单。
Expected: 收到「已为你切换到『XX』」，旧编号失效，重搜后编号可用。
实测：长春地址 → 切到「新生」（ch7）；因该店无「面」商品，返回「该店暂时没有「面」相关的商品，换个商品名再试试」，会话渠道已切到 7、旧编号失效。修复提交 `b601f22ff`。

- [x] **Step 5: 清理测试数据**

```sql
delete from wechat_shopping_session where openid like 'oQaCityRoute-%';
delete from wechat_processed_message where "dedupKey" like '%oQaCityRoute-%';
```

实测补充：另删除冒烟新建的顾客 198/199/200/201（含 `authentication_method`、`user`、`customer_channels_channel`、`address`），并清除既有顾客 161/197 的测试 openid 绑定；临时渠道 `servingCities` 已回滚为 null 并重启。

- [x] **Step 6: 提交验证记录**

把 3 条冒烟结果与截图路径追加到 `docs/superpowers/plans/2026-10-25-city-routing-ops-checklist.md`，提交：

```bash
git add docs/superpowers/plans/2026-10-25-city-routing-ops-checklist.md
git commit -m "docs: 城市路由线上冒烟记录"
```

---

## 自检

- **Spec 覆盖**：城市识别（Task 2/3/4）、租户匹配与排序（Task 3/5）、配送校验与超范围文案（Task 6/7）、下单前守卫（Task 9）、订单确认含预计送达（Task 7/9）、异常 fail-closed（Task 6/9）、开关回滚（Task 10）。
- **地址补全**：复用现有地址流程（新增地址已含电话询问、地理编码失败回「地址无法识别」），P0 不新增补问状态机；`ParsedAddress.missing` 仅作为诊断字段，暂无消费方（不做无用文案）。
- **未覆盖（P1）**：跨渠道订单状态推送、最近租户推荐、门店实体直读、城市主数据后台。
- **类型一致性**：`ParsedAddress.cityCode`、`Candidate.precision/centerLat/centerLng/distanceKm`、`GuardResult.status` 在 Task 2/5/6/9 中名称一致；`DeliveryGuardService.parse/checkParsed/check` 三方法在 Task 6 定义、Task 9 调用，签名一致。
- **已核实**：`placeOrder` 无 session 入参 → 切换租户时用 `this.sessionService.getActive(touser)` 取 `query`（已写入 Task 9）；`AssistantSearchService.searchProducts` 入参为 `{query, channelId, locale, limit, storefrontUrl, productUrlTemplate}`；线上无 `DeliveryRange` 表 → 守卫改为渠道 `servingCities` 城市级判定（见「实施修正二」）。
- **已知取舍**：`ParsedAddress.cityCode` 缺失（地理编码只给到区县以外）时守卫按「城市不在服务范围」拒绝，不做猜测；渠道未配置 `servingCities` 时放行以保留原有下单能力。
