import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    CustomerService,
    ID,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
    isGraphQlErrorResult,
} from '@vendure/core';
import { CouponTemplate, CustomerCoupon } from '@vendure/coupon-plugin';
import { ShippingProfileService } from '../shipping/shipping-profile.service';
import { PaymentProfileService } from '../payment/payment-profile.service';
import { PickupLocation } from '../pickup/pickup-location.entity';
import { BALANCE_PAYMENT_CODE } from './order-box-aggregation';

/** 需要登录才能使用的支付方式 code 集合（余额钱包依赖账户身份，游客结算时应被过滤）。 */
export const LOGIN_REQUIRED_PAYMENT_CODES: ReadonlySet<string> = new Set([BALANCE_PAYMENT_CODE]);

/**
 * 订单分箱结果（Box）。
 * 分箱键 = 变体 customFields.shippingProfileId（配送档案）：
 * - 同档案合箱；
 * - 未绑定/已停用档案 → 依据 ShippingProfileService.resolveEffectiveProfileIds 回退到租户默认档案并入其分组。
 */
export interface OrderBox {
    /** 箱的唯一稳定标识（`box:<profileId>`） */
    boxKey: string;
    /** 生效配送档案 id；未解析到任何档案时为 null */
    profileId: ID | null;
    /** 生效配送档案名称 */
    profileName: string;
    /** 落入该箱的 OrderLine id 列表 */
    lineIds: ID[];
    /** 箱型：pickup=自提类，delivery=物流类 */
    type: 'delivery' | 'pickup';
    /** 该箱所在租户渠道 id */
    tenantChannelId: ID;
    /** 落入该箱的原始变体配送档案 id（去重，含回退前的原始绑定） */
    shippingProfileIds: ID[];
    /** 该箱配送档案允许的可用配送方式 id（已过滤停用） */
    availableShippingMethodIds: ID[];
    /** 该箱可用配送方式详情（含译名），供前端渲染方法名称，不依赖 eligibleShippingMethods */
    availableShippingMethods: Array<{ id: ID; code: string; name: string }>;
    /** 该箱默认配送方式 id（可用集合中第一个），用于未显式选择时的兜底 */
    defaultShippingMethodId: ID | null;
    /** 该箱允许的自提点集合 */
    pickupLocations: PickupLocation[];
    /** 该箱可用支付方式 code 集合（来自配送档案绑定的支付档案，供聚合拆合引擎用） */
    availablePaymentMethodCodes: string[];
    /** 该箱可用支付方式中需要登录才能使用的 code 集合（如余额钱包），供前端游客结算过滤 */
    loginRequiredPaymentCodes: string[];
    /** 该箱是否需要收货地址（物流档案=true） */
    requiresAddress: boolean;
    /** 该箱是否需要联系方式（到店需联系方式档案=true） */
    requiresContact: boolean;
    /** 该箱落入的 OrderLine 明细（含商品名、含税单价、含税行小计），供前端按箱展示商品 */
    lines: OrderBoxLine[];
    /** 该箱当前可用（未使用/回退）且满足该箱范围的优惠券，供前端按箱选券 */
    availableCoupons: BoxCouponInfo[];
    /** 本箱配送费（含税），非免邮时 > 0 */
    shippingCost: number;
    /** 本箱免邮券等折扣额（正值） */
    shippingDiscount: number;
    /** 本箱小计 = max(0, 商品合计(含税) - 券抵扣 + shippingCost - shippingDiscount) */
    subtotal: number;
    /** 租户名，由 tenantChannelId 解析 Channel.name（兜底 Channel.code / id） */
    tenantName: string;
}

/** 装箱明细行（Additive，新增字段） */
export interface OrderBoxLine {
    orderLineId: string;
    productVariantId: string;
    productName: string;
    /** 含税单价 */
    unitPrice: number;
    quantity: number;
    /** 含税行小计 >= 0 */
    lineTotal: number;
    /** 商品主图（asset.source；前端按动态 origin 拼全 URL）。缺失时可空。 */
    featureAssetSource: string | null;
    /** 规格名（优先取 variant.options 名称拼接；无 options 时取 variant.name 去重后）。缺失时可空。 */
    variantName: string | null;
    /** 规格 SKU。缺失时可空。 */
    sku: string | null;
}

/** 某箱可用优惠券摘要（Additive，新增字段） */
export interface BoxCouponInfo {
    /** 券码 */
    code: string;
    /** 券名（多语言按 ctx 语言取，无则原值） */
    name: string;
    /** 展示条件文案（简短） */
    condition: string;
    /** 对「本箱」的最大可抵扣金额（正值）；免邮券则近似为可抵扣的运费 */
    amount: number;
}

/** 商户（租户）结算拆分结果（新增 Top-level Query orderMerchantSplit） */
export interface MerchantSplit {
    tenantChannelId: ID;
    tenantName: string;
    amount: number;
}

/**
 * —— 以下为「按箱金额/优惠券」辅助纯函数 ——
 * coupon 判定/折扣数学镜像 coupon-plugin/coupon-scope（lineHasShopId、isDefaultMallChannel）
 * 与 coupon-promotion-condition（FIXED/PERCENT/FULL/FREE_SHIPPING 折扣算法），避免跨包深层导入；
 * 语义与 coupon-plugin 保持一致，后续若将其收敛为共享包可无损替换。
 */

/** 行商品是否属于指定 shopId（平台级券 shopId 为空则不限范围）——镜像 coupon-plugin `lineHasShopId`。 */
function lineMatchesShop(line: any, shopId: number | undefined): boolean {
    if (shopId == null) return true;
    const sid = (line as any)?.productVariant?.product?.customFields?.shopId;
    return sid != null && Number(sid) === shopId;
}

/** 默认商城判定——镜像 coupon-plugin `isDefaultMallChannel`。 */
function isMallContext(ctx: RequestContext): boolean {
    const token = String((ctx.channel as any)?.token ?? '');
    const code = String((ctx.channel as any)?.code ?? '');
    return token === '__default__' || code === '__default_channel__';
}

/** 某券模板对本箱 lines 的抵扣额：goodsDeduct=商品抵扣、shippingDeduct=免邮券的运费抵扣——镜像 coupon-promotion-condition。 */
function couponDeductForBox(
    tpl: CouponTemplate,
    boxLines: any[],
    shippingCost: number,
): { goodsDeduct: number; shippingDeduct: number } {
    const base = boxLines.reduce((s: number, l: any) => s + (l.linePriceWithTax ?? 0), 0);
    if (tpl.type === 'PERCENT') {
        const rate = (100 - tpl.discountValue) / 100;
        return { goodsDeduct: Math.round(base * rate), shippingDeduct: 0 };
    }
    if (tpl.type === 'FREE_SHIPPING') {
        return { goodsDeduct: 0, shippingDeduct: Math.max(0, shippingCost) };
    }
    // FIXED / FULL：直减 discountValue，且不超过本箱商品小计
    return { goodsDeduct: Math.max(0, Math.min(tpl.discountValue, base)), shippingDeduct: 0 };
}

/**
 * 已应用券在本箱的抵扣。默认商城下先按 shopId 过滤本箱行；无匹配行则该箱不享受该券抵扣
 * （与该券归属于其它 shop 箱时一致）。
 */
function appliedDeductForBox(
    tpl: CouponTemplate,
    mall: boolean,
    boxLines: any[],
    shippingCost: number,
): { goodsDeduct: number; shippingDeduct: number } {
    const shopId = tpl.shopId as number | undefined;
    const matching = mall ? boxLines.filter(l => lineMatchesShop(l, shopId)) : boxLines;
    const effective = matching.length > 0 ? matching : boxLines;
    // 无匹配行 → 本箱不享受该券抵扣（该券属于其它箱）
    if (mall && matching.length === 0) {
        return { goodsDeduct: 0, shippingDeduct: 0 };
    }
    return couponDeductForBox(tpl, effective, shippingCost);
}

/** 券是否对该箱可用：状态（UNUSED/RETURNED）+ 模板启用 + 时间有效 + 本箱至少一行匹配范围 + 门槛满足。 */
function couponUsableForBox(
    cc: CustomerCoupon,
    mall: boolean,
    boxLines: any[],
    boxBase: number,
): boolean {
    const tpl = cc.template;
    if (!tpl) return false;
    if (cc.status !== 'UNUSED' && cc.status !== 'RETURNED') return false;
    if (!tpl.enabled) return false;
    const now = new Date();
    if (tpl.startsAt && now < tpl.startsAt) return false;
    if (tpl.endsAt && now > tpl.endsAt) return false;
    if (mall && !boxLines.some(l => lineMatchesShop(l, tpl.shopId as number | undefined))) return false;
    if (tpl.minSpend > boxBase) return false;
    return true;
}

/** 券面额对应的简短条件文案。 */
function couponConditionText(tpl: CouponTemplate): string {
    switch (tpl.type) {
        case 'PERCENT':
            return `满${tpl.minSpend}打${tpl.discountValue}折`;
        case 'FREE_SHIPPING':
            return '免运费';
        case 'FULL':
            return `直减${tpl.discountValue}`;
        default:
            return `满${tpl.minSpend}减${tpl.discountValue}`;
    }
}

/** 券名多语言求值——镜像 coupon-plugin/localize.localizeText（兼容纯字符串 / LocalizedText / JSON 字符串）。 */
function localizeCouponName(tpl: CouponTemplate, locale: string): string {
    const v = tpl.name as any;
    if (v == null) return '优惠券';
    if (typeof v === 'string') return unwrapLocalizedString(v, locale);
    if (typeof v === 'object') {
        const rec = v as Record<string, string>;
        if (rec[locale] != null && typeof rec[locale] === 'string') return rec[locale];
        if (rec['en'] != null && typeof rec['en'] === 'string') return rec['en'];
        return Object.values(rec).find(x => typeof x === 'string') ?? '优惠券';
    }
    return unwrapLocalizedString(v, locale);
}
function unwrapLocalizedString(v: string, locale: string): string {
    const trimmed = v.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
        try {
            const parsed = JSON.parse(v);
            if (parsed != null && typeof parsed === 'object') {
                const rec = parsed as Record<string, string>;
                if (rec[locale] != null) return rec[locale];
                if (rec['en'] != null) return rec['en'];
                return Object.values(rec).find(x => typeof x === 'string') ?? '优惠券';
            }
        } catch {
            /* 非合法 JSON，按纯字符串处理 */
        }
    }
    return v;
}

/** 本箱取名（tenantChannelId → Channel.name，兜底 Channel.code / id）。 */
function resolveTenantName(
    channelsNameMap: ReadonlyMap<string, { name?: string | null; code?: string | null }>,
    tenantChannelId: ID,
): string {
    const ch = channelsNameMap.get(String(tenantChannelId));
    if (ch?.name) return ch.name;
    if (ch?.code) return ch.code;
    return String(tenantChannelId);
}

@Injectable()
export class OrderBoxService {
    constructor(
        private shippingProfileService: ShippingProfileService,
        private paymentProfileService: PaymentProfileService,
        private orderService: OrderService,
        private channelService: ChannelService,
        private customerService: CustomerService,
        private connection: TransactionalConnection,
    ) {}

    /**
     * 将一个订单的 order lines 按「已生效配送档案」分组为若干箱。
     *
     * 规则（对齐 spec §2.3 / resolveEffectiveProfileIds）：
     * - 变体绑定档案若停用（enabled=false）→ 视为未绑定，回退到租户默认档案；
     * - 变体未绑定任何档案 → 直接回退到租户默认档案；
     * - 同一生效档案的 line 合并为同一箱（跨租户/跨档案自动分箱）。
     */
    async computeOrderBoxes(ctx: RequestContext, order: Order): Promise<OrderBox[]> {
        const lines = order.lines ?? [];
        if (lines.length === 0) return [];

        const tenantDefault = await this.shippingProfileService.getTenantDefault(ctx);
        const defaultId = tenantDefault?.id ?? null;

        // 组：lineIds + 原始 raw profile ids
        const groups = new Map<string, { lineIds: ID[]; rawIds: Set<string> }>();
        const orderByProfile: string[] = [];

        for (const line of lines) {
            const variant = (line as any).productVariant;
            const rawPid = variant?.customFields?.shippingProfileId as ID | undefined;

            let effectivePid: ID | null = null;
            if (rawPid) {
                const resolved = await this.shippingProfileService.resolveEffectiveProfileIds(ctx, [rawPid]);
                effectivePid = resolved.length > 0 ? resolved[0] : null;
            }
            if (effectivePid == null) {
                effectivePid = defaultId;
            }
            if (effectivePid == null) continue;

            const key = String(effectivePid);
            if (!groups.has(key)) {
                groups.set(key, { lineIds: [], rawIds: new Set<string>() });
                orderByProfile.push(key);
            }
            const group = groups.get(key)!;
            group.lineIds.push(line.id as ID);
            if (rawPid) group.rawIds.add(String(rawPid));
        }

        // —— 新增（Additive）：跨箱共享数据，供下方按箱填充明细/金额/优惠券 ——
        const mall = isMallContext(ctx);
        const [channelsNameMap, customerId] = await Promise.all([
            this.loadChannelsNameMap(),
            this.resolveCustomerId(ctx, order),
        ]);
        const customerCoupons: CustomerCoupon[] =
            customerId != null ? await this.loadCustomerCoupons(ctx, customerId) : [];
        const appliedCoupon: CustomerCoupon | undefined = await this.loadAppliedCoupon(ctx, order);
        const shippingLines: any[] = (order as any).shippingLines ?? [];

        const boxes: OrderBox[] = [];
        for (const key of orderByProfile) {
            const group = groups.get(key)!;
            const profile = await this.shippingProfileService.findOne(ctx, key as any);

            const enabledMethods = profile?.shippingMethods?.length
                ? (await this.shippingProfileService.findShippingMethodsByIds(
                      ctx,
                      profile.shippingMethods.map(m => m.id as ID),
                  )).filter((m: any) => m.customFields?.enabled !== false)
                : [];

            const tenantChannelId: ID = order.channels?.[0]?.id ?? ctx.channelId;
            const isDelivery = !(profile?.pickupLocations && profile.pickupLocations.length > 0);

            // —— 本箱行明细（Additive）——
            const boxLineIdSet = new Set(group.lineIds.map(String));
            const boxLines: any[] = lines.filter(l => boxLineIdSet.has(String((l as any).id)));
            const boxLineInfo: OrderBoxLine[] = boxLines.map((barrel: any) => {
                const id = String((barrel as any).id);
                const qty = Number((barrel as any).quantity ?? 0);
                const lineTotal = Math.max(0, Math.round(Number((barrel as any).linePriceWithTax ?? 0)));
                const unitPrice = Math.max(0, Math.round(Number((barrel as any).unitPriceWithTax ?? 0)));
                const variantId = String((barrel as any).productVariant?.id ?? '');
                const productName =
                    (barrel as any).productVariant?.product?.name
                    ?? (barrel as any).productVariant?.name
                    ?? `Item ${id}`;
                const variant = (barrel as any).productVariant;
                const options = Array.isArray(variant?.options) ? variant.options : [];
                const variantName = options.length
                    ? options.map((o: any) => o.name).join(' · ')
                    : (variant?.name && variant?.name !== productName ? variant.name : null);
                const feat =
                    (barrel as any).featuredAsset
                    ?? variant?.featuredAsset
                    ?? (barrel as any).product?.featuredAsset;
                return {
                    orderLineId: id,
                    productVariantId: variantId,
                    productName,
                    unitPrice,
                    quantity: qty,
                    lineTotal,
                    featureAssetSource: feat?.source ?? null,
                    variantName,
                    sku: variant?.sku ?? null,
                };
            });
            const goodsTotal = boxLineInfo.reduce((s, l) => s + l.lineTotal, 0);

            // —— 本箱配送费（Additive）——
            // 规则：取 order.shippingLines 中「配送方式 id 落在本箱可用集合」的配送线价格（含税）之和；
            // 无按箱匹配且整单仅一条配送线时，将该单条配送线归属给唯一 delivery 箱（未多箱结算的兜底）；
            // 其余（无/多条导致归属不明确）→ 0。
            let shippingCost = 0;
            if (isDelivery) {
                const shippingMethodIdSet = new Set(enabledMethods.map((m: any) => String(m.id)));
                const matched = shippingLines.filter(
                    (sl: any) => sl.shippingMethodId != null && shippingMethodIdSet.has(String(sl.shippingMethodId)),
                );
                if (matched.length > 0) {
                    shippingCost = matched.reduce((s: number, sl: any) => s + (sl.priceWithTax ?? 0), 0);
                } else if (shippingLines.length === 1) {
                    shippingCost = shippingLines[0].priceWithTax ?? 0;
                }
            }

            // —— 本箱免邮券/已应用券抵扣（Additive）——
            let couponDeduct = 0;
            let shippingDiscount = 0;
            if (appliedCoupon?.template) {
                const applied = appliedDeductForBox(
                    appliedCoupon.template,
                    mall,
                    boxLines,
                    shippingCost,
                );
                couponDeduct = applied.goodsDeduct;
                shippingDiscount = applied.shippingDeduct;
            }

            // —— 本箱可用优惠券（Additive）——
            const boxBase = boxLines.reduce((s: number, l: any) => s + (l.linePriceWithTax ?? 0), 0);
            const availableCoupons: BoxCouponInfo[] = [];
            for (const cc of customerCoupons) {
                const tpl = cc.template;
                if (!tpl) continue;
                if (!couponUsableForBox(cc, mall, boxLines, boxBase)) continue;
                const ded = couponDeductForBox(tpl, boxLines, isDelivery ? shippingCost : 0);
                const amount = tpl.type === 'FREE_SHIPPING' ? ded.shippingDeduct : ded.goodsDeduct;
                if (amount <= 0) continue; // 本箱无可抵扣额度则不列出（保持紧凑）
                availableCoupons.push({
                    code: cc.code,
                    name: localizeCouponName(tpl, String(ctx.languageCode)),
                    condition: couponConditionText(tpl),
                    amount: Math.max(0, amount),
                });
            }

            // —— 本箱小计（Additive）：max(0, 商品合计 - 券抵扣 + 配送费 - 免邮折扣) ——
            const subtotal = Math.max(0, goodsTotal - couponDeduct + shippingCost - shippingDiscount);

            boxes.push({
                boxKey: `box:${key}`,
                profileId: key as ID,
                profileName: profile?.name ?? key,
                lineIds: group.lineIds,
                type: profile?.pickupLocations?.length ? 'pickup' : 'delivery',
                tenantChannelId,
                shippingProfileIds: [...group.rawIds] as ID[],
                availableShippingMethodIds: enabledMethods.map((m: any) => m.id as ID),
                availableShippingMethods: enabledMethods.map((m: any) => ({
                    id: m.id as ID,
                    code: m.code,
                    name: Array.isArray(m.translations) && m.translations.length
                        ? (m.translations.find((t: any) => t.languageCode === ctx.languageCode)
                            || m.translations.find((t: any) => String(t.languageCode).toLowerCase().startsWith('zh'))
                            || m.translations[0]).name || m.code
                        : m.code,
                })),
                defaultShippingMethodId: enabledMethods.length > 0 ? (enabledMethods[0].id as ID) : null,
                pickupLocations: profile?.pickupLocations ?? [],
                availablePaymentMethodCodes: await this.resolvePaymentCodesForProfile(ctx, key as ID),
                loginRequiredPaymentCodes: (await this.resolvePaymentCodesForProfile(ctx, key as ID)).filter(
                    code => LOGIN_REQUIRED_PAYMENT_CODES.has(code),
                ),
                requiresAddress: profile?.requiresAddress ?? true,
                requiresContact: profile?.requiresContact ?? false,
                lines: boxLineInfo,
                availableCoupons,
                shippingCost,
                shippingDiscount,
                subtotal,
                tenantName: resolveTenantName(channelsNameMap, tenantChannelId),
            });
        }
        return boxes;
    }

    /**
     * 商户（租户）结算拆分：按 tenantChannelId 聚合各箱 subtotal，
     * 返回每租户应结算金额。可复用 computeOrderBoxes（含已算好的 subtotal / tenantName）。
     */
    async computeMerchantSplit(ctx: RequestContext, order: Order): Promise<MerchantSplit[]> {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const map = new Map<string, MerchantSplit>();
        for (const box of boxes) {
            const key = String(box.tenantChannelId);
            const existing = map.get(key) ?? {
                tenantChannelId: box.tenantChannelId,
                tenantName: box.tenantName,
                amount: 0,
            };
            existing.amount += box.subtotal;
            map.set(key, existing);
        }
        return [...map.values()];
    }

    /** 预加载订单内所有 Channel 的 name/code（跨所有箱共用的租户名解析，均以 id 为 key），失败时返回空 Map。 */
    private async loadChannelsNameMap(): Promise<Map<string, { name?: string | null; code?: string | null }>> {
        const result = new Map<string, { name?: string | null; code?: string | null }>();
        try {
            const all = await this.channelService.findAll(RequestContext.empty());
            for (const c of all.items) {
                result.set(String(c.id), {
                    // 本版本 Channel 实体无 `.name`，租户展示名取自 customFields.shopName，兜底 code
                    name: (c.customFields as any)?.shopName ?? undefined,
                    code: c.code,
                });
            }
        } catch {
            /* 渠道解析不可用时，tenantName 兜底为 id */
        }
        return result;
    }

    /** 解析当前订单的客户 id（优先 order.customer，否则由 activeUserId 查 Customer）。 */
    private async resolveCustomerId(ctx: RequestContext, order: Order): Promise<number | undefined> {
        const orderCustomerId = (order as any)?.customer?.id;
        if (orderCustomerId != null) return orderCustomerId as number;
        const userId = ctx.activeUserId;
        if (userId == null) return undefined;
        try {
            const customer = await this.customerService.findOneByUserId(ctx, userId);
            return customer?.id as number | undefined;
        } catch {
            return undefined;
        }
    }

    /** 加载某客户的全部券（含 template），失败（coupon-plugin 未注册等）时返回空数组，不影响订单分箱主流程。 */
    private async loadCustomerCoupons(ctx: RequestContext, customerId: number): Promise<CustomerCoupon[]> {
        try {
            const repo = this.connection.getRepository(ctx, CustomerCoupon);
            return await repo.find({
                where: { customerId } as any,
                relations: { template: true } as any,
            });
        } catch {
            return [];
        }
    }

    /** 加载订单当前应用（customFields.couponCode）的券实例，失败时返回 undefined。 */
    private async loadAppliedCoupon(ctx: RequestContext, order: Order): Promise<CustomerCoupon | undefined> {
        const code = (order as any)?.customFields?.couponCode;
        if (!code) return undefined;
        try {
            const repo = this.connection.getRepository(ctx, CustomerCoupon);
            return (
                (await repo.findOne({
                    where: { code } as any,
                    relations: { template: true } as any,
                })) ?? undefined
            );
        } catch {
            return undefined;
        }
    }

    /**
     * 读取订单已保存的分箱选择（boxShippingSelections customField 中的 JSON）。
     * 结构：{ [boxKey]: { shippingMethodId, pickupLocationId } }
     */
    getBoxSelections(order: Order): Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }> {
        return this.readSelections(order);
    }

    private readSelections(order: Order): Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }> {
        const raw = (order as any).customFields?.boxShippingSelections;
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    /**
     * 解析某配送档案可用的支付方式 code 集合（供聚合拆合引擎判定每箱支付白名单）。
     * - 配送档案绑定支付档案 → 用其全部支付方式 code；
     * - 未绑定 → 回退租户默认支付档案。
     */
    async resolvePaymentCodesForProfile(ctx: RequestContext, shippingProfileId: ID): Promise<string[]> {
        const payProfile = await this.shippingProfileService.getPaymentProfileForShippingProfile(ctx, shippingProfileId);
        const codes = payProfile
            ? (await this.paymentProfileService.getIntersectedPaymentMethods(ctx, [payProfile.id])).map(m => m.code)
            : [];
        // 余额为所有配送档案的内建基础方式（全局共享钱包），始终并入白名单，供前端/聚合引擎启用「余额合单」路径。
        if (!codes.includes(BALANCE_PAYMENT_CODE)) {
            codes.push(BALANCE_PAYMENT_CODE);
        }
        return codes;
    }

    /** 兼容单箱传入的支付方式白名单解析。 */
    async resolvePaymentCodesForBox(ctx: RequestContext, box: Pick<OrderBox, 'profileId'>): Promise<string[]> {
        if (!box.profileId) return [];
        return this.resolvePaymentCodesForProfile(ctx, box.profileId);
    }

    /**
     * 为订单内一组箱设置配送方式（一次性调核心 setShippingMethod，多 fulfillment）。
     *
     * selections 可选：传入则为各箱配送方式选择快照（用于拆单时把源订单的选择带给新订单）；
     * 未传则读取 order.customFields.boxShippingSelections。每箱未显式选择时用该箱默认配送方式兜底。
     */
    async setShippingForOrder(
        ctx: RequestContext,
        order: Order,
        boxKeys: string[],
        selections?: Record<string, { shippingMethodId?: ID; pickupLocationId?: ID | null }>,
    ): Promise<Order> {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const effectiveKeys = boxes.filter(b => boxKeys.includes(b.boxKey)).map(b => b.boxKey);
        if (effectiveKeys.length === 0) return order;
        const selectionsMap = selections ?? this.readSelections(order);

        const orderedMethodIds = boxes
            .filter(b => effectiveKeys.includes(b.boxKey))
            .map(b => selectionsMap[b.boxKey]?.shippingMethodId ?? b.defaultShippingMethodId)
            .filter((id): id is ID => !!id);
        if (orderedMethodIds.length === 0) return order;

        const result = await this.orderService.setShippingMethod(ctx, order.id, orderedMethodIds);
        if (isGraphQlErrorResult(result)) {
            throw new UserInputError((result as any).message ?? 'SET_SHIPPING_METHOD_FAILED');
        }
        return this.orderService.findOne(ctx, order.id) as Promise<Order>;
    }

    /**
     * 为某一箱设置配送方式（并把该箱的 lines 通过核心 setShippingMethod 关联到对应 ShippingLine）。
     *
     * 实现了「单订单内多配送组」的统一骨架：
     * - 依据各箱当前选择 + 默认兜底，构造整单配送方式 id 数组，一次调用核心
     *   setShippingMethod（配合 BoxShippingLineAssignmentStrategy，每个 ShippingLine 只挂其箱内 lines）。
     * - pickupLocationId 仅供自提类方式使用，写入该箱选择快照。
     *
     * 注意：核心结算入口是整单级的（eligibility/price 针对整单计算，非该箱 line 子集），
     * 自提（免费/固定价）方式不受影响；阶梯重量/件数等按整单计费的方式无法按箱独立计价，见报告。
     */
    async setBoxShippingMethod(
        ctx: RequestContext,
        order: Order,
        boxKey: string,
        shippingMethodId: ID,
        pickupLocationId?: ID,
    ): Promise<Order> {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const box = boxes.find(b => b.boxKey === boxKey);
        if (!box) {
            throw new UserInputError(`BOX_NOT_FOUND:${boxKey}`);
        }
        const sid = String(shippingMethodId);
        if (!box.availableShippingMethodIds.some(id => String(id) === sid)) {
            throw new UserInputError('BOX_SHIPPING_METHOD_INVALID');
        }

        const selections = this.readSelections(order);
        selections[boxKey] = {
            shippingMethodId: sid as ID,
            pickupLocationId: pickupLocationId ? (String(pickupLocationId) as ID) : null,
        };

        await this.setShippingForOrder(ctx, order, boxes.map(b => b.boxKey), selections);

        await this.orderService.updateCustomFields(ctx, order.id, {
            boxShippingSelections: JSON.stringify(selections),
        } as any);

        return this.orderService.findOne(ctx, order.id) as Promise<Order>;
    }
}