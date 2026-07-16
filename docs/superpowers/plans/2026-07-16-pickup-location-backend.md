# 自提点后端改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 PickupLocation 实体省市区街道字段、新增地图服务商抽象层（高德实现 + 腾讯/百度占位）、暴露 GraphQL 查询接口供前端使用。

**Architecture:** 后端分三层：(1) 数据层 — PickupLocation 实体加 4 字段 + migration；(2) 服务层 — MapProvider 接口 + AmapProvider/TencentProvider/BaiduProvider 实现 + MapProviderRegistry + MapService；(3) API 层 — MapAdminResolver 暴露 mapDistricts/reverseGeocode/mapSdkConfig/channelMapConfig 查询。地图配置存 Channel.customFields.mapConfig（struct 字段）。

**Tech Stack:** NestJS + TypeORM + Vendure v3.6.4 + GraphQL（admin-api extensions）

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.entity.ts` | 修改 | 加 province/city/district/street 4 字段 |
| `e:\code\vendure\packages\cjk-plugin\src\plugin.ts` | 修改 | 扩展 GraphQL schema（enum + 4 字段 + isPublic）+ 注册 MapService/MapProviderRegistry/MapAdminResolver |
| `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts` | 修改 | 追加 mapConfig struct 字段 |
| `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location-admin.resolver.ts` | 修改 | create/update 透传省市区街道 + isPublic 字段 |
| `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.service.ts` | 修改 | create/update 方法接收省市区街道 + isPublic |
| `e:\code\vendure\packages\cjk-plugin\src\pickup\i18n-messages.ts` | 修改 | 追加地图相关 i18n 错误 key |
| `e:\code\vendure\packages\cjk-plugin\src\map\map-config.ts` | 创建 | MapProviderConfig 接口 |
| `e:\code\vendure\packages\cjk-plugin\src\map\map-provider.ts` | 创建 | MapProvider 接口 + DistrictNode/ReverseGeocodeResult 类型 |
| `e:\code\vendure\packages\cjk-plugin\src\map\map-provider-registry.ts` | 创建 | Provider 注册与解析 |
| `e:\code\vendure\packages\cjk-plugin\src\map\providers\amap-provider.ts` | 创建 | 高德实现 |
| `e:\code\vendure\packages\cjk-plugin\src\map\providers\tencent-provider.ts` | 创建 | 腾讯占位实现 |
| `e:\code\vendure\packages\cjk-plugin\src\map\providers\baidu-provider.ts` | 创建 | 百度占位实现 |
| `e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts` | 创建 | 根据 Channel 配置解析 provider，暴露 districts/reverseGeocode/sdkConfig |
| `e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts` | 创建 | GraphQL resolver |

---

## 关键约束（已验证）

1. **Vendure v3.6.4** 的 `@VendurePlugin` 装饰器：`providers` 数组注册 NestJS provider，`adminApiExtensions.schema` 是返回 GraphQL AST 的函数（用 `graphql-tag` 的 `gql`），`adminApiExtensions.resolvers` 是 resolver 类数组
2. **Channel customFields struct 字段**：在 `tenant-channel-custom-fields.ts` 的 `Channel` 数组追加，类型为 `struct`，子字段用 `fields` 数组定义
3. **Migration**：Vendure 用 TypeORM，但 cjk-plugin 无独立 migration 目录。**简化方案**：依赖 TypeORM `synchronize: true`（dev 模式自动同步 schema），生产环境需手动加列。本计划不创建独立 migration 文件，在 Task 1 的提交信息中注明
4. **高德 API**：行政区划查询 `/v3/config/district`，逆地理编码 `/v3/geocode/regeo`，JS SDK 加载 `https://webapi.amap.com/maps?v=2.0&key=xxx&plugin=...`
5. **RequestContext**：Vendure resolver 用 `@Ctx() ctx: RequestContext` 获取当前 channelId，通过 `ctx.channelId` 访问
6. **Channel customFields 读取**：`ctx.channel.customFields.mapConfig`
7. **后端 i18n 机制**：cjk-plugin 用 `src/pickup/i18n-messages.ts` 定义 `ERROR_MESSAGES` 字典（支持 zh_Hans/en/ja/ko），用 `translateError(ctx, key)` 函数返回当前语言错误消息。**所有抛给用户的错误消息必须走此机制**，不能硬编码中文

---

## Task 1: 扩展 PickupLocation 实体省市区街道字段

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.entity.ts`

- [ ] **Step 1: 读取当前实体文件**

Run: `Read e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.entity.ts`

Expected: 文件有 `name/type/address/phoneNumber/businessHours/coordinates/partner/isPublic/ownerChannelId` 等字段。

- [ ] **Step 2: 在 partner 字段后追加 4 个可空字段**

在 `pickup-location.entity.ts` 的 `@Column({ nullable: true }) partner: string;` 后追加：

```typescript
    @Column({ nullable: true }) province: string | null;
    @Column({ nullable: true }) city: string | null;
    @Column({ nullable: true }) district: string | null;
    @Column({ nullable: true }) street: string | null;
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/pickup/pickup-location.entity.ts
git commit -m "feat: Add province/city/district/street fields to PickupLocation entity"
```

---

## Task 1.5: 在 i18n-messages.ts 追加地图相关错误 key

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\i18n-messages.ts`

- [ ] **Step 1: 在 ERROR_MESSAGES 字典追加 3 个地图相关 key**

在 `i18n-messages.ts` 的 `PICKUP_LOCATION_NOT_VISIBLE` 项后追加（在 `};` 闭合前）：

```typescript
    MAP_CONFIG_NOT_CONFIGURED: {
        [LanguageCode.zh_Hans]: '地图服务未配置，请在后台 Channel 配置 mapConfig',
        [LanguageCode.en]: 'Map service not configured, please configure mapConfig in Channel settings',
        [LanguageCode.ja]: 'マップサービスが未設定です。バックグラウンド Channel の mapConfig を設定してください',
        [LanguageCode.ko]: '지도 서비스가 미구성되었습니다. 백엔드 Channel의 mapConfig를 구성하십시오',
    } as MessageMap,
    MAP_PROVIDER_NOT_REGISTERED: {
        [LanguageCode.zh_Hans]: '未注册的地图 Provider: {provider}',
        [LanguageCode.en]: 'Unregistered map provider: {provider}',
        [LanguageCode.ja]: '未登録のマッププロバイダ: {provider}',
        [LanguageCode.ko]: '등록되지 않은 지도 프로바이더: {provider}',
    } as MessageMap,
    MAP_PROVIDER_API_ERROR: {
        [LanguageCode.zh_Hans]: '地图服务调用失败: {message}',
        [LanguageCode.en]: 'Map service API error: {message}',
        [LanguageCode.ja]: 'マップサービス呼び出し失敗: {message}',
        [LanguageCode.ko]: '지도 서비스 호출 실패: {message}',
    } as MessageMap,
```

**注意**：`{provider}` 和 `{message}` 是占位符，调用方需手动 `.replace('{provider}', val)`。或者扩展 `translateError` 接受参数对象（但为简化，本计划用 replace 模式）。

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/pickup/i18n-messages.ts
git commit -m "feat: Add map-related i18n error keys"
```

---

## Task 2: 在 tenant-channel-custom-fields.ts 追加 mapConfig

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\tenant\tenant-channel-custom-fields.ts`

- [ ] **Step 1: 在 customDomains 字段后追加 mapConfig**

在 `tenant-channel-custom-fields.ts` 的 `Channel` 数组末尾（`customDomains` 后）追加：

```typescript
        {
            name: 'mapConfig',
            type: 'struct',
            nullable: true,
            public: false,
            label: [{ languageCode: LanguageCode.zh_Hans, value: '地图服务配置' }],
            fields: [
                { name: 'provider', type: 'string' },
                { name: 'apiKey', type: 'text' },
                { name: 'securityJsCode', type: 'text' },
            ],
        },
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/tenant/tenant-channel-custom-fields.ts
git commit -m "feat: Add mapConfig struct customField to Channel"
```

---

## Task 3: 创建 map-config.ts 和 map-provider.ts 接口

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\map-config.ts`
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\map-provider.ts`

- [ ] **Step 1: 创建 map-config.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\map-config.ts
export interface MapProviderConfig {
    provider: 'amap' | 'tencent' | 'baidu';
    apiKey: string;
    securityJsCode?: string;
}
```

- [ ] **Step 2: 创建 map-provider.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\map-provider.ts
export interface MapProvider {
    readonly name: 'amap' | 'tencent' | 'baidu';
    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string;
    fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]>;
    reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult>;
}

export interface DistrictNode {
    adcode: string;
    name: string;
    level: 'province' | 'city' | 'district' | 'street';
    center: { lat: number; lng: number };
}

export interface ReverseGeocodeResult {
    province: string | null;
    city: string | null;
    district: string | null;
    street: string | null;
    formattedAddress: string;
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/map-config.ts packages/cjk-plugin/src/map/map-provider.ts
git commit -m "feat: Add MapProvider interface and types"
```

---

## Task 4: 创建 AmapProvider 实现

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\providers\amap-provider.ts`

- [ ] **Step 1: 创建 amap-provider.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\providers\amap-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

export class AmapProvider implements MapProvider {
    readonly name = 'amap' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        const plugins = 'AMap.Geocoder,AMap.DistrictSearch,AMap.PlaceSearch,AMap.AutoComplete';
        return `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=${plugins}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        // 高德 /v3/config/district：subdistrict=1 返回下一级
        const keywords = parentAdcode ?? '中国';
        const url = `https://restapi.amap.com/v3/config/district?key=${encodeURIComponent(apiKey)}&keywords=${encodeURIComponent(keywords)}&subdistrict=1&extensions=base`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`高德行政区划查询失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德行政区划查询失败: ${data.info}`);
        }
        const districts: any[] = data.districts?.[0]?.districts ?? [];
        return districts.map(d => ({
            adcode: d.adcode,
            name: d.name,
            level: d.level as DistrictNode['level'],
            center: { lat: parseFloat(d.center.split(',')[1]), lng: parseFloat(d.center.split(',')[0]) },
        }));
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        const location = `${lng},${lat}`;
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(apiKey)}&location=${encodeURIComponent(location)}&extensions=base`;
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`高德逆地理编码失败: HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.status !== '1') {
            throw new Error(`高德逆地理编码失败: ${data.info}`);
        }
        const addr = data.regeocoded?.addressComponent ?? {};
        return {
            province: addr.province && addr.province.length > 0 ? addr.province : null,
            city: addr.city && addr.city.length > 0 ? addr.city : null,
            district: addr.district && addr.district.length > 0 ? addr.district : null,
            street: addr.township && addr.township.length > 0 ? addr.township : null,
            formattedAddress: data.regeocoded?.formatted_address ?? '',
        };
    }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/providers/amap-provider.ts
git commit -m "feat: Add AmapProvider implementation"
```

---

## Task 5: 创建 TencentProvider 和 BaiduProvider 占位实现

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\providers\tencent-provider.ts`
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\providers\baidu-provider.ts`

- [ ] **Step 1: 创建 tencent-provider.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\providers\tencent-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

export class TencentProvider implements MapProvider {
    readonly name = 'tencent' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        return `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(apiKey)}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        throw new Error('腾讯地图 Provider 尚未实现，请使用高德');
    }
}
```

- [ ] **Step 2: 创建 baidu-provider.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\providers\baidu-provider.ts
import { DistrictNode, MapProvider, ReverseGeocodeResult } from '../map-provider';

export class BaiduProvider implements MapProvider {
    readonly name = 'baidu' as const;

    getSdkLoaderUrl(apiKey: string, securityJsCode?: string): string {
        return `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(apiKey)}`;
    }

    async fetchDistricts(parentAdcode: string | null, apiKey: string): Promise<DistrictNode[]> {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }

    async reverseGeocode(lat: number, lng: number, apiKey: string): Promise<ReverseGeocodeResult> {
        throw new Error('百度地图 Provider 尚未实现，请使用高德');
    }
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 4: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/providers/tencent-provider.ts packages/cjk-plugin/src/map/providers/baidu-provider.ts
git commit -m "feat: Add TencentProvider and BaiduProvider placeholder implementations"
```

---

## Task 6: 创建 MapProviderRegistry

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\map-provider-registry.ts`

- [ ] **Step 1: 创建 map-provider-registry.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\map-provider-registry.ts
import { Injectable } from '@nestjs/common';
import { MapProvider } from './map-provider';
import { AmapProvider } from './providers/amap-provider';
import { TencentProvider } from './providers/tencent-provider';
import { BaiduProvider } from './providers/baidu-provider';

@Injectable()
export class MapProviderRegistry {
    private providers = new Map<string, MapProvider>();

    constructor() {
        this.register(new AmapProvider());
        this.register(new TencentProvider());
        this.register(new BaiduProvider());
    }

    register(provider: MapProvider): void {
        this.providers.set(provider.name, provider);
    }

    /**
     * 获取 provider。若未注册抛出带 i18n key 的错误对象（由调用方翻译）。
     */
    get(name: string): MapProvider {
        const provider = this.providers.get(name);
        if (!provider) {
            // 抛出带 i18n key 的错误，调用方用 translateError 翻译
            const err = new Error(name) as any;
            err.i18nKey = 'MAP_PROVIDER_NOT_REGISTERED';
            err.i18nVars = { provider: name };
            throw err;
        }
        return provider;
    }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/map-provider-registry.ts
git commit -m "feat: Add MapProviderRegistry"
```

---

## Task 7: 创建 MapService

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts`

- [ ] **Step 1: 创建 map.service.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\map.service.ts
import { Injectable } from '@nestjs/common';
import { ChannelService, ID, RequestContext } from '@vendure/core';
import { MapProviderConfig } from './map-config';
import { DistrictNode, MapProvider, ReverseGeocodeResult } from './map-provider';
import { MapProviderRegistry } from './map-provider-registry';
import { translateError } from '../pickup/i18n-messages';

@Injectable()
export class MapService {
    constructor(
        private registry: MapProviderRegistry,
        private channelService: ChannelService,
    ) {}

    /**
     * 从当前 Channel 的 customFields.mapConfig 读取配置
     * 如果当前 Channel 未配置，回退到默认 Channel
     */
    private async getConfigForChannel(ctx: RequestContext): Promise<MapProviderConfig | null> {
        // 优先用当前 channel
        let channel = ctx.channel;
        let config = channel?.customFields?.mapConfig as MapProviderConfig | undefined;
        
        if (!config) {
            // 回退到默认 channel
            const defaultChannel = await this.channelService.getDefaultChannel(ctx);
            config = defaultChannel?.customFields?.mapConfig as MapProviderConfig | undefined;
        }
        
        return config ?? null;
    }

    /**
     * 包装 provider 调用，捕获 i18n 错误并翻译
     */
    private async callProvider<T>(
        ctx: RequestContext,
        fn: () => Promise<T>,
    ): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            if (err?.i18nKey === 'MAP_PROVIDER_NOT_REGISTERED') {
                const vars = err.i18nVars ?? {};
                const msg = translateError(ctx, 'MAP_PROVIDER_NOT_REGISTERED')
                    .replace('{provider}', vars.provider ?? '');
                throw new Error(msg);
            }
            // provider 内部抛出的普通 Error（含 HTTP 错误信息）
            const msg = translateError(ctx, 'MAP_PROVIDER_API_ERROR')
                .replace('{message}', err?.message ?? 'unknown');
            throw new Error(msg);
        }
    }

    private getProvider(config: MapProviderConfig): MapProvider {
        return this.registry.get(config.provider);
    }

    /**
     * 掩码 apiKey，用于 channelMapConfig 查询（展示用）
     */
    maskApiKey(key: string): string {
        if (key.length <= 8) return '****';
        return key.slice(0, 4) + '****' + key.slice(-4);
    }

    async getDistricts(ctx: RequestContext, parentAdcode: string | null): Promise<DistrictNode[]> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error(translateError(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.fetchDistricts(parentAdcode, config.apiKey));
    }

    async reverseGeocode(ctx: RequestContext, lat: number, lng: number): Promise<ReverseGeocodeResult> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            throw new Error(translateError(ctx, 'MAP_CONFIG_NOT_CONFIGURED'));
        }
        const provider = this.getProvider(config);
        return this.callProvider(ctx, () => provider.reverseGeocode(lat, lng, config.apiKey));
    }

    async getSdkConfig(ctx: RequestContext): Promise<{ provider: string; sdkUrl: string; hasConfigured: boolean }> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            return { provider: '', sdkUrl: '', hasConfigured: false };
        }
        const provider = this.getProvider(config);
        const sdkUrl = provider.getSdkLoaderUrl(config.apiKey, config.securityJsCode);
        return { provider: config.provider, sdkUrl, hasConfigured: true };
    }

    async getChannelMapConfig(ctx: RequestContext): Promise<{ provider: string; apiKey: string; hasConfigured: boolean }> {
        const config = await this.getConfigForChannel(ctx);
        if (!config) {
            return { provider: '', apiKey: '', hasConfigured: false };
        }
        return {
            provider: config.provider,
            apiKey: this.maskApiKey(config.apiKey),
            hasConfigured: true,
        };
    }
}
```

**关键设计**：
- `MapProviderRegistry.get` 抛出带 `i18nKey` 的错误对象
- `MapService.callProvider` 捕获错误，用 `translateError(ctx, key)` 翻译后再抛出
- `MAP_CONFIG_NOT_CONFIGURED` 直接在 MapService 翻译（不需要经过 callProvider，因为不涉及 provider 调用）
- 这样所有抛给前端的错误消息都按 `ctx.languageCode` 返回对应语言

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/map.service.ts
git commit -m "feat: Add MapService with channel config resolution"
```

---

## Task 8: 创建 MapAdminResolver

**Files:**
- Create: `e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts`

- [ ] **Step 1: 创建 map-admin.resolver.ts**

```typescript
// e:\code\vendure\packages\cjk-plugin\src\map\map-admin.resolver.ts
import { Resolver, Query, Args, Ctx } from '@vendure/core';
import { RequestContext } from '@vendure/core';
import { MapService } from './map.service';

@Resolver()
export class MapAdminResolver {
    constructor(private mapService: MapService) {}

    @Query()
    async mapDistricts(
        @Ctx() ctx: RequestContext,
        @Args() args: { parentAdcode?: string | null },
    ) {
        return this.mapService.getDistricts(ctx, args?.parentAdcode ?? null);
    }

    @Query()
    async reverseGeocode(
        @Ctx() ctx: RequestContext,
        @Args() args: { lat: number; lng: number },
    ) {
        return this.mapService.reverseGeocode(ctx, args.lat, args.lng);
    }

    @Query()
    async mapSdkConfig(@Ctx() ctx: RequestContext) {
        return this.mapService.getSdkConfig(ctx);
    }

    @Query()
    async channelMapConfig(@Ctx() ctx: RequestContext) {
        return this.mapService.getChannelMapConfig(ctx);
    }
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/map/map-admin.resolver.ts
git commit -m "feat: Add MapAdminResolver"
```

---

## Task 9: 扩展 plugin.ts — GraphQL schema + providers + resolvers

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\plugin.ts`

- [ ] **Step 1: 读取当前 plugin.ts**

Run: `Read e:\code\vendure\packages\cjk-plugin\src\plugin.ts`

- [ ] **Step 2: 在 imports 区添加新模块导入**

在 `import { DomainShopResolver } from './tenant/domain-shop.resolver';` 后追加：

```typescript
import { MapProviderRegistry } from './map/map-provider-registry';
import { MapService } from './map/map.service';
import { MapAdminResolver } from './map/map-admin.resolver';
```

- [ ] **Step 3: 在 providers 数组追加 MapProviderRegistry 和 MapService**

在 `providers: [...]` 数组的 `DomainResolverService,` 后追加：

```typescript
        MapProviderRegistry,
        MapService,
```

- [ ] **Step 4: 在 adminApiExtensions.resolvers 数组追加 MapAdminResolver**

将 `resolvers: [PickupLocationAdminResolver, EmployeeCustomerAdminResolver, AuthAdminResolver],` 改为：

```typescript
        resolvers: [PickupLocationAdminResolver, EmployeeCustomerAdminResolver, AuthAdminResolver, MapAdminResolver],
```

- [ ] **Step 5: 在 adminApiExtensions.schema 的 gql 模板字符串中扩展 PickupLocation**

将原 `type PickupLocation implements Node { ... }` 块（约第 60-71 行）替换为：

```graphql
                enum PickupLocationType {
                    store
                    point
                    employee
                }

                type PickupLocation implements Node {
                    id: ID!
                    name: String!
                    type: PickupLocationType!
                    address: String!
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean!
                    ownerChannelId: ID
                    province: String
                    city: String
                    district: String
                    street: String
                }
```

- [ ] **Step 6: 修改 CreatePickupLocationInput 和 UpdatePickupLocationInput**

将 `input CreatePickupLocationInput { ... }` 替换为：

```graphql
                input CreatePickupLocationInput {
                    name: String!
                    type: PickupLocationType!
                    address: String!
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean
                    province: String
                    city: String
                    district: String
                    street: String
                }
```

将 `input UpdatePickupLocationInput { ... }` 替换为：

```graphql
                input UpdatePickupLocationInput {
                    id: ID!
                    name: String
                    type: PickupLocationType
                    address: String
                    phoneNumber: String
                    businessHours: String
                    coordinates: JSON
                    partner: String
                    isPublic: Boolean
                    province: String
                    city: String
                    district: String
                    street: String
                }
```

- [ ] **Step 7: 在 adminApiExtensions.schema 的 gql 模板字符串末尾（最后一个 extend type Mutation 之后）追加地图相关 schema**

在 `}\`;`（admin schema 闭合）之前追加：

```graphql

                type DistrictNode {
                    adcode: String!
                    name: String!
                    level: String!
                    center: LatLng!
                }

                type ReverseGeocodeResult {
                    province: String
                    city: String
                    district: String
                    street: String
                    formattedAddress: String!
                }

                type MapSdkConfig {
                    provider: String!
                    sdkUrl: String!
                    hasConfigured: Boolean!
                }

                type ChannelMapConfig {
                    provider: String!
                    apiKey: String!
                    hasConfigured: Boolean!
                }

                type LatLng {
                    lat: Float!
                    lng: Float!
                }

                extend type Query {
                    mapDistricts(parentAdcode: String): [DistrictNode!]!
                    reverseGeocode(lat: Float!, lng: Float!): ReverseGeocodeResult!
                    mapSdkConfig: MapSdkConfig!
                    channelMapConfig: ChannelMapConfig!
                }
```

- [ ] **Step 8: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 9: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/plugin.ts
git commit -m "feat: Extend GraphQL schema with PickupLocationType enum, region fields, and map queries"
```

---

## Task 10: 扩展 PickupLocationService 和 AdminResolver 透传新字段

**Files:**
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.service.ts`
- Modify: `e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location-admin.resolver.ts`

- [ ] **Step 1: 读取 pickup-location.service.ts**

Run: `Read e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location.service.ts`

Expected: 找到 `create` 和 `update` 方法，它们接收 input 对象并创建/更新实体。

- [ ] **Step 2: 在 create 方法中透传省市区街道 + isPublic**

找到 `create` 方法中构造 `PickupLocation` 实例的位置（通常形如 `this.repository.save(new PickupLocation({ ...input }))` 或 `this.connection.getRepository(ctx, PickupLocation).save(...)`），确保 input 中的 `province/city/district/street/isPublic` 字段被传入。

如果 create 方法直接用 `{ ...input }` 透传，无需改动。如果显式列字段，需追加：

```typescript
province: input.province,
city: input.city,
district: input.district,
street: input.street,
isPublic: input.isPublic ?? false,
```

- [ ] **Step 3: 在 update 方法中透传省市区街道 + isPublic**

同理，确保 update 方法处理这些字段。如果是 `Object.assign(existing, input)` 模式，无需改动。如果显式赋值，需追加：

```typescript
if (input.province !== undefined) existing.province = input.province;
if (input.city !== undefined) existing.city = input.city;
if (input.district !== undefined) existing.district = input.district;
if (input.street !== undefined) existing.street = input.street;
if (input.isPublic !== undefined) existing.isPublic = input.isPublic;
```

- [ ] **Step 4: 读取 pickup-location-admin.resolver.ts**

Run: `Read e:\code\vendure\packages\cjk-plugin\src\pickup\pickup-location-admin.resolver.ts`

Expected: 找到 `createPickupLocation` 和 `updatePickupLocation` mutation 定义，它们通常直接调用 service 并返回结果。

- [ ] **Step 5: 确认 resolver 透传 input**

如果 resolver 形如 `@Args() args: { input: CreatePickupLocationInput }` 且直接调用 `this.service.create(ctx, args.input)`，无需改动。

如果 resolver 显式解构字段，需追加 `province/city/district/street/isPublic` 到解构和传递。

- [ ] **Step 6: 验证 TypeScript 编译**

Run: `cd e:\code\vendure\packages\cjk-plugin && npx tsc --noEmit -p tsconfig.json`

Expected: 无错误。

- [ ] **Step 7: 构建 cjk-plugin 产物**

Run: `cd e:\code\vendure\packages\cjk-plugin && npm run build`

Expected: 编译成功，`lib/` 目录更新。

- [ ] **Step 8: 启动后端验证 schema**

启动后端 dev server（如果未运行）：

```bash
cd e:\code\vendure\packages\dev-server && npm run dev
```

等待启动完成后，用 PowerShell 验证 schema：

```bash
$query = '{"query":"query{__type(name:\"PickupLocationType\"){values{name}} mapSdkConfig{hasConfigured} channelMapConfig{hasConfigured}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $query -ContentType 'application/json' -WebSession $session
$r.data | ConvertTo-Json -Depth 5
```

Expected:
- `__type.values` 包含 `store/point/employee`
- `mapSdkConfig.hasConfigured` 为 `false`（未配置）
- `channelMapConfig.hasConfigured` 为 `false`（未配置）

- [ ] **Step 9: 提交**

```bash
cd e:\code\vendure
git add packages/cjk-plugin/src/pickup/pickup-location.service.ts packages/cjk-plugin/src/pickup/pickup-location-admin.resolver.ts packages/cjk-plugin/lib/
git commit -m "feat: Pass through province/city/district/street/isPublic in service and resolver"
```

---

## Task 11: 配置默认 Channel 的 mapConfig 测试

**Files:**
- 无文件改动，仅测试验证

- [ ] **Step 1: 通过 admin-api 更新默认 Channel 的 mapConfig**

用户需提供真实高德 API key。以下命令用占位 key 测试（hasConfigured 会变 true，但实际查询会失败）：

```bash
$mutation = '{"query":"mutation{updateChannel(input:{id:\"1\",customFields:{mapConfig:{provider:\"amap\",apiKey:\"test-key-placeholder\",securityJsCode:\"\"}}}) {... on Channel{id customFields{mapConfig{provider apiKey}}}}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $mutation -ContentType 'application/json' -WebSession $session
$r.data | ConvertTo-Json -Depth 5
```

Expected: 返回 `customFields.mapConfig.provider = "amap"`，`apiKey = "test-key-placeholder"`。

- [ ] **Step 2: 验证 channelMapConfig 掩码**

```bash
$query = '{"query":"{channelMapConfig{provider apiKey hasConfigured}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $query -ContentType 'application/json' -WebSession $session
$r.data | ConvertTo-Json -Depth 5
```

Expected: `apiKey` 显示为 `test****holder`（掩码），`hasConfigured = true`。

- [ ] **Step 3: 验证 mapSdkConfig 返回完整 sdkUrl**

```bash
$query = '{"query":"{mapSdkConfig{provider sdkUrl hasConfigured}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $query -ContentType 'application/json' -WebSession $session
$r.data | ConvertTo-Json -Depth 5
```

Expected: `sdkUrl` 包含 `webapi.amap.com/maps?v=2.0&key=test-key-placeholder&plugin=...`，`hasConfigured = true`。

- [ ] **Step 4: （可选）用真实 key 验证 mapDistricts**

将 Step 1 的 `test-key-placeholder` 替换为真实高德 key，然后：

```bash
$query = '{"query":"{mapDistricts(parentAdcode:null){adcode name level}}"}'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ query = 'mutation { login(username: "superadmin@china.test", password: "superadmin") { ... on CurrentUser { identifier } } }' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $loginBody -ContentType 'application/json' -WebSession $session | Out-Null
$r = Invoke-RestMethod -Uri 'http://localhost:3000/admin-api' -Method Post -Body $query -ContentType 'application/json' -WebSession $session
$r.data.mapDistricts | Select-Object -First 5 | ConvertTo-Json
```

Expected: 返回省级行政区列表（北京、上海、吉林等）。

---

## Self-Review

### Spec coverage
- ✅ PickupLocation 实体扩展 4 字段 → Task 1
- ✅ GraphQL schema 扩展（enum + 4 字段 + isPublic）→ Task 9
- ✅ Migration → Task 1 备注（依赖 synchronize: true）
- ✅ Channel customFields.mapConfig → Task 2
- ✅ MapProvider 接口 → Task 3
- ✅ AmapProvider 实现 → Task 4
- ✅ TencentProvider/BaiduProvider 占位 → Task 5
- ✅ MapProviderRegistry → Task 6
- ✅ MapService → Task 7
- ✅ MapAdminResolver → Task 8
- ✅ Plugin Module 注册 → Task 9
- ✅ PickupLocationService/Resolver 透传新字段 → Task 10
- ✅ channelMapConfig 掩码 → Task 7 + Task 11 验证
- ✅ mapDistricts/reverseGeocode/mapSdkConfig → Task 8 + Task 11 验证

### Placeholder scan
- ✅ 无 TBD/TODO
- ✅ 所有代码完整
- ✅ 所有命令完整

### Type consistency
- ✅ `MapProviderConfig` 在 Task 3 定义，Task 7 使用
- ✅ `DistrictNode` / `ReverseGeocodeResult` 在 Task 3 定义，Task 4/7/8 使用
- ✅ `MapProvider` 接口在 Task 3 定义，Task 4/5/6 实现
- ✅ `PickupLocationType` enum 在 Task 9 schema 定义，前端 plan 将使用
- ✅ `mapDistricts/reverseGeocode/mapSdkConfig/channelMapConfig` Query 在 Task 9 schema 定义，Task 8 resolver 实现

### 卡点修复记录
1. ❌ 原 spec `type: String!` → ✅ 修复为 `PickupLocationType` enum（Task 9 Step 5）
2. ❌ 原 spec `isPublic` 未在 GraphQL schema → ✅ Task 9 Step 5 补充
3. ❌ 原 spec Module 注册未明确 → ✅ Task 9 Step 3/4 明确
4. ❌ 原 spec mapConfig 注册位置未明确 → ✅ Task 2 明确在 tenant-channel-custom-fields.ts
5. ❌ 原 spec Migration 未处理 → ✅ Task 1 备注（依赖 synchronize: true，生产需手动加列）
