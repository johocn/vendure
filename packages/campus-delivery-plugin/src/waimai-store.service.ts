import { Injectable } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusRoute, normalizeRouteFirstLeg, ROUTE_FIRST_LEG_OPTIONS } from './route-matrix';

export interface WaimaiStore {
    channelId: number;
    channelToken: string;
    name: string;
    logo: string | null;
    tags: string[];
    monthlySales: number;
    promoText: string | null;
    paused: boolean;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    businessHours: string | null;
    errandBaseFee: number | null;
    freeShippingThreshold: number | null;
}

export interface CampusStoreConfigWithChannel {
    channelId: number;
    channelName: string;
    channelToken: string;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    errandBaseFee: number | null;
    thirdPartyBaseFee: number | null;
    freeShippingThreshold: number | null;
    notifyTemplateAccepted: string | null;
    notifyTemplateRiderAssigned: string | null;
    notifyTemplateCookingDone: string | null;
    notifyTemplateDelivered: string | null;
    notifyTemplateExceptionHandled: string | null;
    notifyTemplateOrderPlaced: string | null;
    notifyTemplatePaymentPending: string | null;
    notifyTemplateCancelled: string | null;
    notifyTemplateAfterSales: string | null;
    notifyTemplateAddressChanged: string | null;
    h5BaseUrl: string | null;
    printMode: 'off' | 'onPaid' | 'onAccepted';
    routeFirstLeg: Array<{ route: string; carrier: string }>;
    handoverPoints: Array<{ route: string; name: string; address: string | null; phone: string | null; lat: number; lng: number; isDefault: boolean }>;
    providerShopNo: Array<{ provider: string; shopNo: string }>;
    merchantAcceptMinutes: number;
    externalPushTimeoutMinutes: number;
    externalFallbackMinutes: number;
    storeLat: number | null;
    storeLng: number | null;
    timeoutCompensationEnabled: boolean;
    timeoutGraceMinutes: number;
    timeoutCompensationWindowHours: number;
    timeoutCompensationCouponTemplateId: string | null;
    /** 动态计价配置 JSON 字符串（null=关闭，回退分区固定运费） */
    dynamicPricing: string | null;
}

const PRINT_MODES = ['off', 'onPaid', 'onAccepted'] as const;
type PrintMode = (typeof PRINT_MODES)[number];

/** printMode 归一化：null/非法值一律回 'off'（存量行与脏配置兜底） */
export function normalizePrintMode(v: unknown): PrintMode {
    return PRINT_MODES.includes(v as PrintMode) ? (v as PrintMode) : 'off';
}

const ROUTE_WHITELIST = ['R1', 'R2', 'R3', 'R4', 'R5'];

/** 数值配置合法区间（金额=分，时长=分钟）：与 campus-config 另一写入口同口径，超界直接拒绝 */
const INT_RANGES: Record<string, [number, number]> = {
    deliveryMinutes: [1, 240],
    minOrderAmount: [0, 10_000_000],
    deliveryFee: [0, 10_000_000],
    errandBaseFee: [0, 10_000_000],
    thirdPartyBaseFee: [0, 10_000_000],
    freeShippingThreshold: [0, 10_000_000],
    merchantAcceptMinutes: [0, 240],
    externalPushTimeoutMinutes: [1, 240],
    externalFallbackMinutes: [1, 240],
};

/** R4 自提点标记：campus 配置管理的本渠道门店自提点（幂等 upsert 键，复用 cjk PickupLocation 体系） */
const CAMPUS_R4_REMARK = 'campus-r4';

@Injectable()
export class WaimaiStoreService {
    constructor(private connection: TransactionalConnection) {}

    /** 店铺列表：有履约配置的渠道即外卖店铺（跨渠道公开元数据聚合，供 C 端首页）。
     * C 端进入店铺后用 channelToken 作 vendure-token 切换渠道拉菜单/下单。 */
    async listStores(ctx: RequestContext): Promise<WaimaiStore[]> {
        const configs = await this.connection.getRepository(ctx, CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, Channel).find();
        const stores: WaimaiStore[] = [];
        for (const ch of channels) {
            const cfg = byChannel.get(Number(ch.id));
            if (!cfg) continue;
            if (ch.code === '__default_channel__') continue;   // 默认渠道是平台会话渠道，不是店铺（防脏配置污染 C 端列表/骑手大厅）
            const cf = (ch.customFields ?? {}) as any;
            // 外卖准入：仅餐饮行业租户展示（设计文档 2026-10-09 §4.2；存量由 BackfillWaimaiIndustryMigration 刷数）。
            // 仅过滤 C 端列表；listStoreConfigs（admin 配置视图）不过滤，避免管理员看不到已配履约的非餐饮渠道。
            if (cf.industryType !== 'catering') continue;
            stores.push({
                channelId: Number(ch.id),
                channelToken: ch.token,
                name: ch.code,
                logo: cf.waimaiLogo ?? null,
                tags: typeof cf.waimaiTags === 'string' && cf.waimaiTags.length
                    ? cf.waimaiTags.split(',').map((t: string) => t.trim()).filter(Boolean)
                    : [],
                monthlySales: cf.waimaiMonthlySales ?? 0,
                promoText: cf.waimaiPromoText ?? null,
                paused: cfg.paused,
                routesEnabled: cfg.routesEnabled ?? [],
                deliveryMinutes: cfg.deliveryMinutes ?? null,
                minOrderAmount: cfg.minOrderAmount ?? null,
                deliveryFee: cfg.deliveryFee ?? null,
                storeAddress: cfg.storeAddress ?? null,
                storePhone: cfg.storePhone ?? null,
                storeNotice: cfg.storeNotice ?? null,
                businessHours: cf.waimaiBusinessHours ?? null,
                errandBaseFee: cfg.errandBaseFee ?? null,
                freeShippingThreshold: cfg.freeShippingThreshold ?? null,
            });
        }
        return stores;
    }

    /** admin：全店铺配置（跨渠道，join Channel 取店铺名/token；默认渠道是平台会话渠道，跳过） */
    async listStoreConfigs(ctx: RequestContext): Promise<CampusStoreConfigWithChannel[]> {
        const configs = await this.connection.getRepository(ctx, CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, Channel).find();
        const out: CampusStoreConfigWithChannel[] = [];
        for (const ch of channels) {
            if (ch.code === '__default_channel__') continue;
            const cfg = byChannel.get(Number(ch.id));
            out.push(this.toConfigView(Number(ch.id), ch.code, ch.token, cfg));
        }
        return out;
    }

    /** admin：按 channelId upsert（幂等），routesEnabled 白名单 R1-R5，负数金额拒绝 */
    async updateStoreConfig(
        ctx: RequestContext,
        channelId: number,
        input: {
            routesEnabled: string[];
            deliveryMinutes?: number | null;
            minOrderAmount?: number | null;
            deliveryFee?: number | null;
            storeAddress?: string | null;
            storePhone?: string | null;
            storeNotice?: string | null;
            errandBaseFee?: number | null;
            thirdPartyBaseFee?: number | null;
            freeShippingThreshold?: number | null;
            notifyTemplateAccepted?: string | null;
            notifyTemplateRiderAssigned?: string | null;
            notifyTemplateCookingDone?: string | null;
            notifyTemplateDelivered?: string | null;
            notifyTemplateExceptionHandled?: string | null;
            notifyTemplateOrderPlaced?: string | null;
            notifyTemplatePaymentPending?: string | null;
            notifyTemplateCancelled?: string | null;
            notifyTemplateAfterSales?: string | null;
            notifyTemplateAddressChanged?: string | null;
            h5BaseUrl?: string | null;
            printMode?: string | null;
            timeoutCompensationEnabled?: boolean | null;
            timeoutGraceMinutes?: number | null;
            timeoutCompensationWindowHours?: number | null;
            timeoutCompensationCouponTemplateId?: string | null;
            routeFirstLeg?: Array<{ route: string; carrier: string }> | null;
            handoverPoints?: Array<{ route: string; name: string; address?: string | null; phone?: string | null; lat: number; lng: number; isDefault?: boolean | null }> | null;
            providerShopNo?: Array<{ provider: string; shopNo: string }> | null;
            merchantAcceptMinutes?: number | null;
            externalPushTimeoutMinutes?: number | null;
            externalFallbackMinutes?: number | null;
            storeLat?: number | null;
            storeLng?: number | null;
            /** 动态计价 JSON 字符串；null/'' = 关闭 */
            dynamicPricing?: string | null;
        },
    ): Promise<CampusStoreConfigWithChannel> {
        // 路线去重：重复项会让开点校验/前端渲染出现重复楼层
        const routes = Array.from(new Set((input.routesEnabled ?? []).map(r => String(r))));
        const bad = routes.filter(r => !ROUTE_WHITELIST.includes(r));
        if (bad.length) throw new UserInputError(`不支持的配送路线: ${bad.join(', ')}（仅接受 R1-R5）`);
        if (input.printMode != null && !PRINT_MODES.includes(input.printMode as PrintMode)) {
            throw new UserInputError(`不支持的打印模式: ${input.printMode}（仅接受 off/onPaid/onAccepted）`);
        }
        // 数值字段：有限数 + 区间校验 + 整数归一（金额为分），超界一律拒绝，避免脏值污染运费/超时链路
        const nums: Record<string, number> = {};
        for (const [key, [min, max]] of Object.entries(INT_RANGES)) {
            const raw = (input as any)[key];
            if (raw == null) continue;
            const n = Number(raw);
            if (!Number.isFinite(n)) throw new UserInputError(`${key} 必须是数字`);
            if (n < 0) throw new UserInputError(`${key} 不能为负数`);
            if (n > max) throw new UserInputError(`${key} 超出允许上限（${max}）`);
            if (n < min) throw new UserInputError(`${key} 不能小于 ${min}`);
            nums[key] = Math.round(n);
        }

        // 第一段承运：只有 R1（merchant|owned）、R3（campus|owned|external）可配
        const routeFirstLeg: Record<string, string> = {};
        for (const item of input.routeFirstLeg ?? []) {
            const route = String(item?.route ?? '');
            if (route !== 'R1' && route !== 'R3') {
                throw new UserInputError(`路线 ${route || '(空)'} 不支持配置第一段承运方（仅 R1、R3）`);
            }
            const carrier = normalizeRouteFirstLeg(route, item?.carrier);
            if (!carrier) {
                throw new UserInputError(
                    `路线 ${route} 的第一段承运方不合法: ${item?.carrier ?? '(空)'}（可选 ${ROUTE_FIRST_LEG_OPTIONS[route as CampusRoute].join('/')}）`,
                );
            }
            routeFirstLeg[route] = carrier;
        }

        // 校园交接点：只有 R1、R2 需要；同一路线可配多个，按楼栋距离选最近，默认点做无坐标兜底
        const handoverPoints: Record<string, Array<{ name: string; address?: string; phone?: string; lat: number; lng: number; isDefault?: boolean }>> = {};
        for (const item of input.handoverPoints ?? []) {
            const route = String(item?.route ?? '');
            if (route !== 'R1' && route !== 'R2') {
                throw new UserInputError(`路线 ${route || '(空)'} 不需要校园交接点（仅 R1、R2）`);
            }
            const name = String(item?.name ?? '').trim();
            const lat = Number(item?.lat);
            const lng = Number(item?.lng);
            if (!name) throw new UserInputError(`路线 ${route} 的交接点名称不能为空`);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                throw new UserInputError(`路线 ${route} 的交接点经纬度不合法`);
            }
            (handoverPoints[route] ??= []).push({
                name,
                address: item?.address?.trim() || undefined,
                phone: item?.phone?.trim() || undefined,
                lat,
                lng,
                ...(item?.isDefault ? { isDefault: true } : {}),
            });
        }
        // 每条路线只保留一个默认点：已标注取第一个，未标注取该路线第一个
        for (const list of Object.values(handoverPoints)) {
            let seen = false;
            for (const p of list) {
                if (p.isDefault && !seen) seen = true;
                else delete p.isDefault;
            }
            if (!seen && list[0]) list[0].isDefault = true;
        }

        // 外部快递门店编号：外部快递用哪家由运营中心派单时决定，这里只存各家的门店编号
        const providerShopNo: Record<string, string> = {};
        for (const item of input.providerShopNo ?? []) {
            const provider = String(item?.provider ?? '');
            if (provider !== 'dada' && provider !== 'meituan') {
                throw new UserInputError(`不支持的外部快递: ${provider || '(空)'}（仅 dada/meituan）`);
            }
            const shopNo = String(item?.shopNo ?? '').trim();
            if (shopNo) providerShopNo[provider] = shopNo;
        }
        const chRepo = this.connection.getRepository(ctx, Channel);
        const ch = (await chRepo.find()).find(c => Number(c.id) === Number(channelId));
        if (!ch) throw new UserInputError(`渠道不存在: ${channelId}`);
        const repo = this.connection.getRepository(ctx, CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: channelId as any } });
        if (!cfg) cfg = new CampusFulfillmentConfig({ channelId: channelId as any });
        // 记录「本次新开通」的路线：只有新开通 R1/R2 才强制交接点，历史配置（已开通但缺点）不阻断其它字段编辑
        const prevEnabled = [...(cfg.routesEnabled ?? [])];
        cfg.routesEnabled = routes;
        cfg.deliveryMinutes = nums.deliveryMinutes ?? null;
        cfg.minOrderAmount = nums.minOrderAmount ?? null;
        cfg.deliveryFee = nums.deliveryFee ?? null;
        cfg.storeAddress = input.storeAddress ?? null;
        cfg.storePhone = input.storePhone ?? null;
        cfg.storeNotice = input.storeNotice ?? null;
        cfg.errandBaseFee = nums.errandBaseFee ?? null;
        // 第三方到校基价：未传即保留（旧表单不清空）；传 null 表示不接管顾客侧运费
        if (input.thirdPartyBaseFee !== undefined) cfg.thirdPartyBaseFee = nums.thirdPartyBaseFee ?? null;
        cfg.freeShippingThreshold = nums.freeShippingThreshold ?? null;
        cfg.notifyTemplateAccepted = input.notifyTemplateAccepted ?? null;
        cfg.notifyTemplateRiderAssigned = input.notifyTemplateRiderAssigned ?? null;
        cfg.notifyTemplateCookingDone = input.notifyTemplateCookingDone ?? null;
        cfg.notifyTemplateDelivered = input.notifyTemplateDelivered ?? null;
        cfg.notifyTemplateExceptionHandled = input.notifyTemplateExceptionHandled ?? null;
        cfg.notifyTemplateOrderPlaced = input.notifyTemplateOrderPlaced ?? null;
        cfg.notifyTemplatePaymentPending = input.notifyTemplatePaymentPending ?? null;
        cfg.notifyTemplateCancelled = input.notifyTemplateCancelled ?? null;
        cfg.notifyTemplateAfterSales = input.notifyTemplateAfterSales ?? null;
        cfg.notifyTemplateAddressChanged = input.notifyTemplateAddressChanged ?? null;
        cfg.h5BaseUrl = input.h5BaseUrl ?? null;
        cfg.printMode = input.printMode == null || input.printMode === '' ? 'off' : input.printMode;
        // 超时赔付：未传即保留（旧表单不会清空已配值）
        if (input.timeoutCompensationEnabled != null) cfg.timeoutCompensationEnabled = input.timeoutCompensationEnabled;
        if (input.timeoutGraceMinutes != null) cfg.timeoutGraceMinutes = input.timeoutGraceMinutes;
        if (input.timeoutCompensationWindowHours != null) {
            const hours = Number(input.timeoutCompensationWindowHours);
            if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
                throw new UserInputError('赔付回扫窗口必须为 1-168 的整数（小时）');
            }
            cfg.timeoutCompensationWindowHours = hours;
        }
        if (input.timeoutCompensationCouponTemplateId !== undefined) {
            cfg.timeoutCompensationCouponTemplateId = input.timeoutCompensationCouponTemplateId || null;
        }
        // 未传即保留：后台旧表单不认识的字段不被清空
        if (input.routeFirstLeg !== undefined) cfg.routeFirstLeg = input.routeFirstLeg === null ? null : routeFirstLeg;
        if (input.handoverPoints !== undefined) cfg.handoverPoints = input.handoverPoints === null ? null : handoverPoints;
        if (input.providerShopNo !== undefined) cfg.providerShopNo = input.providerShopNo === null ? null : providerShopNo;
        if (input.merchantAcceptMinutes != null) cfg.merchantAcceptMinutes = nums.merchantAcceptMinutes;
        if (input.externalPushTimeoutMinutes != null) cfg.externalPushTimeoutMinutes = nums.externalPushTimeoutMinutes;
        if (input.externalFallbackMinutes != null) cfg.externalFallbackMinutes = nums.externalFallbackMinutes;
        // 门店坐标：R2/R3 距离计算与动态计价依赖，必须为有限数且在合法经纬度范围内
        for (const [key, limit] of [['storeLat', 90], ['storeLng', 180]] as const) {
            if (input[key] === undefined) continue;
            if (input[key] == null) {
                cfg[key] = null;
                continue;
            }
            const n = Number(input[key]);
            if (!Number.isFinite(n) || Math.abs(n) > limit) {
                throw new UserInputError(`${key} 不合法（需 -${limit}~${limit} 的有限数）`);
            }
            cfg[key] = n;
        }
        // 动态计价：未传即保留；传 null/'' 关闭。写入前解析校验，坏 JSON 直接拒绝
        if (input.dynamicPricing !== undefined) {
            if (input.dynamicPricing === null || input.dynamicPricing.trim() === '') {
                cfg.dynamicPricing = null;
            } else {
                let parsed: any;
                try {
                    parsed = JSON.parse(input.dynamicPricing);
                } catch {
                    throw new UserInputError('动态计价配置不是合法 JSON');
                }
                if (!parsed || typeof parsed !== 'object') throw new UserInputError('动态计价配置必须是 JSON 对象');
                cfg.dynamicPricing = parsed;
            }
        }

        // 跨字段：新开通 R1/R2 必须有至少一个可用交接点（名称+经纬度），否则订单会降级为传信者到店取餐
        const enabled = routes;
        const hasPoint = (r: 'R1' | 'R2') => {
            const raw = cfg.handoverPoints?.[r];
            const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
            return list.some(p => !!String(p?.name ?? '').trim() && p?.lat != null && p?.lng != null);
        };
        const missingPoint = (['R1', 'R2'] as const).filter(
            r => enabled.includes(r) && !prevEnabled.includes(r) && !hasPoint(r),
        );
        if (missingPoint.length) {
            throw new UserInputError(`开通 ${missingPoint.join('、')} 需要先填写至少一个校园交接点（名称+经纬度）`);
        }
        await repo.save(cfg);
        const address = (input.storeAddress ?? '').trim();
        if (address) {
            // R4：同步幂等 upsert 本渠道门店自提点（名称=店铺名，地址=storeAddress），核销走 pickup_redemption 零新表
            await this.upsertStorePickupLocation(Number(channelId), ch.code, address, (input.storePhone ?? '').trim() || null);
        }
        return this.toConfigView(channelId, ch.code, ch.token, cfg);
    }

    /** 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；PickupLocation 由 cjk-plugin 注册于同一进程）。
     * 可见性：isPublic=false + ownerChannelId=本渠道 + channels 含本渠道 → shop 端 applyVisibility 对本渠道可见（cjk pickup-location.service.ts:35）。 */
    private async upsertStorePickupLocation(channelId: number, name: string, address: string, phone: string | null) {
        const repo = this.connection.rawConnection.getRepository('PickupLocation');
        const existing = await repo.findOne({ where: { ownerChannelId: channelId, remark: CAMPUS_R4_REMARK } });
        if (existing) {
            existing.name = name;
            existing.address = address;
            existing.phoneNumber = phone;
            existing.enabled = true;
            await repo.save(existing);
            return existing;
        }
        return repo.save({
            name,
            address,
            phoneNumber: phone,
            type: 'store',
            stockType: 'own',
            enabled: true,
            isPublic: false,
            ownerChannelId: channelId,
            channels: [{ id: channelId }],
            remark: CAMPUS_R4_REMARK,
        });
    }

    private toConfigView(
        channelId: number,
        channelName: string,
        channelToken: string,
        cfg: CampusFulfillmentConfig | undefined,
    ): CampusStoreConfigWithChannel {
        return {
            channelId,
            channelName,
            channelToken,
            routesEnabled: cfg?.routesEnabled ?? [],
            deliveryMinutes: cfg?.deliveryMinutes ?? null,
            minOrderAmount: cfg?.minOrderAmount ?? null,
            deliveryFee: cfg?.deliveryFee ?? null,
            storeAddress: cfg?.storeAddress ?? null,
            storePhone: cfg?.storePhone ?? null,
            storeNotice: cfg?.storeNotice ?? null,
            errandBaseFee: cfg?.errandBaseFee ?? null,
            thirdPartyBaseFee: cfg?.thirdPartyBaseFee ?? null,
            freeShippingThreshold: cfg?.freeShippingThreshold ?? null,
            notifyTemplateAccepted: cfg?.notifyTemplateAccepted ?? null,
            notifyTemplateRiderAssigned: cfg?.notifyTemplateRiderAssigned ?? null,
            notifyTemplateCookingDone: cfg?.notifyTemplateCookingDone ?? null,
            notifyTemplateDelivered: cfg?.notifyTemplateDelivered ?? null,
            notifyTemplateExceptionHandled: cfg?.notifyTemplateExceptionHandled ?? null,
            notifyTemplateOrderPlaced: cfg?.notifyTemplateOrderPlaced ?? null,
            notifyTemplatePaymentPending: cfg?.notifyTemplatePaymentPending ?? null,
            notifyTemplateCancelled: cfg?.notifyTemplateCancelled ?? null,
            notifyTemplateAfterSales: cfg?.notifyTemplateAfterSales ?? null,
            notifyTemplateAddressChanged: cfg?.notifyTemplateAddressChanged ?? null,
            h5BaseUrl: cfg?.h5BaseUrl ?? null,
            printMode: normalizePrintMode(cfg?.printMode),
            timeoutCompensationEnabled: cfg?.timeoutCompensationEnabled ?? false,
            timeoutGraceMinutes: cfg?.timeoutGraceMinutes ?? 10,
            timeoutCompensationWindowHours: cfg?.timeoutCompensationWindowHours ?? 24,
            timeoutCompensationCouponTemplateId: cfg?.timeoutCompensationCouponTemplateId ?? null,
            routeFirstLeg: Object.entries(cfg?.routeFirstLeg ?? {}).map(([route, carrier]) => ({ route, carrier })),
            handoverPoints: Object.entries(cfg?.handoverPoints ?? {}).flatMap(([route, raw]) =>
                (Array.isArray(raw) ? raw : raw ? [raw] : []).map(p => ({
                    route,
                    name: p.name,
                    address: p.address ?? null,
                    phone: p.phone ?? null,
                    lat: p.lat,
                    lng: p.lng,
                    isDefault: !!p.isDefault,
                })),
            ),
            providerShopNo: Object.entries(cfg?.providerShopNo ?? {}).map(([provider, shopNo]) => ({ provider, shopNo })),
            merchantAcceptMinutes: cfg?.merchantAcceptMinutes ?? 5,
            externalPushTimeoutMinutes: cfg?.externalPushTimeoutMinutes ?? 10,
            externalFallbackMinutes: cfg?.externalFallbackMinutes ?? 20,
            storeLat: cfg?.storeLat ?? null,
            storeLng: cfg?.storeLng ?? null,
            dynamicPricing: cfg?.dynamicPricing ? JSON.stringify(cfg.dynamicPricing) : null,
        };
    }
}
