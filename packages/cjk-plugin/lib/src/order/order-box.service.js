"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderBoxService = exports.LOGIN_REQUIRED_PAYMENT_CODES = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const coupon_plugin_1 = require("@vendure/coupon-plugin");
const shipping_profile_service_1 = require("../shipping/shipping-profile.service");
const payment_profile_service_1 = require("../payment/payment-profile.service");
const order_box_aggregation_1 = require("./order-box-aggregation");
/** 需要登录才能使用的支付方式 code 集合（余额钱包依赖账户身份，游客结算时应被过滤）。 */
exports.LOGIN_REQUIRED_PAYMENT_CODES = new Set([order_box_aggregation_1.BALANCE_PAYMENT_CODE]);
/**
 * —— 以下为「按箱金额/优惠券」辅助纯函数 ——
 * coupon 判定/折扣数学镜像 coupon-plugin/coupon-scope（lineHasShopId、isDefaultMallChannel）
 * 与 coupon-promotion-condition（FIXED/PERCENT/FULL/FREE_SHIPPING 折扣算法），避免跨包深层导入；
 * 语义与 coupon-plugin 保持一致，后续若将其收敛为共享包可无损替换。
 */
/** 行商品是否属于指定 shopId（平台级券 shopId 为空则不限范围）——镜像 coupon-plugin `lineHasShopId`。 */
function lineMatchesShop(line, shopId) {
    var _a, _b, _c;
    if (shopId == null)
        return true;
    const sid = (_c = (_b = (_a = line === null || line === void 0 ? void 0 : line.productVariant) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.customFields) === null || _c === void 0 ? void 0 : _c.shopId;
    return sid != null && Number(sid) === shopId;
}
/** 默认商城判定——镜像 coupon-plugin `isDefaultMallChannel`。 */
function isMallContext(ctx) {
    var _a, _b, _c, _d;
    const token = String((_b = (_a = ctx.channel) === null || _a === void 0 ? void 0 : _a.token) !== null && _b !== void 0 ? _b : '');
    const code = String((_d = (_c = ctx.channel) === null || _c === void 0 ? void 0 : _c.code) !== null && _d !== void 0 ? _d : '');
    return token === '__default__' || code === '__default_channel__';
}
/** 某券模板对本箱 lines 的抵扣额：goodsDeduct=商品抵扣、shippingDeduct=免邮券的运费抵扣——镜像 coupon-promotion-condition。 */
function couponDeductForBox(tpl, boxLines, shippingCost) {
    const base = boxLines.reduce((s, l) => { var _a; return s + ((_a = l.linePriceWithTax) !== null && _a !== void 0 ? _a : 0); }, 0);
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
function appliedDeductForBox(tpl, mall, boxLines, shippingCost) {
    const shopId = tpl.shopId;
    const matching = mall ? boxLines.filter(l => lineMatchesShop(l, shopId)) : boxLines;
    const effective = matching.length > 0 ? matching : boxLines;
    // 无匹配行 → 本箱不享受该券抵扣（该券属于其它箱）
    if (mall && matching.length === 0) {
        return { goodsDeduct: 0, shippingDeduct: 0 };
    }
    return couponDeductForBox(tpl, effective, shippingCost);
}
/** 券是否对该箱可用：状态（UNUSED/RETURNED）+ 模板启用 + 时间有效 + 本箱至少一行匹配范围 + 门槛满足。 */
function couponUsableForBox(cc, mall, boxLines, boxBase) {
    const tpl = cc.template;
    if (!tpl)
        return false;
    if (cc.status !== 'UNUSED' && cc.status !== 'RETURNED')
        return false;
    if (!tpl.enabled)
        return false;
    const now = new Date();
    if (tpl.startsAt && now < tpl.startsAt)
        return false;
    if (tpl.endsAt && now > tpl.endsAt)
        return false;
    if (mall && !boxLines.some(l => lineMatchesShop(l, tpl.shopId)))
        return false;
    if (tpl.minSpend > boxBase)
        return false;
    return true;
}
/** 券面额对应的简短条件文案。 */
function couponConditionText(tpl) {
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
function localizeCouponName(tpl, locale) {
    var _a;
    const v = tpl.name;
    if (v == null)
        return '优惠券';
    if (typeof v === 'string')
        return unwrapLocalizedString(v, locale);
    if (typeof v === 'object') {
        const rec = v;
        if (rec[locale] != null && typeof rec[locale] === 'string')
            return rec[locale];
        if (rec['en'] != null && typeof rec['en'] === 'string')
            return rec['en'];
        return (_a = Object.values(rec).find(x => typeof x === 'string')) !== null && _a !== void 0 ? _a : '优惠券';
    }
    return unwrapLocalizedString(v, locale);
}
function unwrapLocalizedString(v, locale) {
    var _a;
    const trimmed = v.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
        try {
            const parsed = JSON.parse(v);
            if (parsed != null && typeof parsed === 'object') {
                const rec = parsed;
                if (rec[locale] != null)
                    return rec[locale];
                if (rec['en'] != null)
                    return rec['en'];
                return (_a = Object.values(rec).find(x => typeof x === 'string')) !== null && _a !== void 0 ? _a : '优惠券';
            }
        }
        catch (_b) {
            /* 非合法 JSON，按纯字符串处理 */
        }
    }
    return v;
}
/** 本箱取名（tenantChannelId → Channel.name，兜底 Channel.code / id）。 */
function resolveTenantName(channelsNameMap, tenantChannelId) {
    const ch = channelsNameMap.get(String(tenantChannelId));
    if (ch === null || ch === void 0 ? void 0 : ch.name)
        return ch.name;
    if (ch === null || ch === void 0 ? void 0 : ch.code)
        return ch.code;
    return String(tenantChannelId);
}
let OrderBoxService = class OrderBoxService {
    constructor(shippingProfileService, paymentProfileService, orderService, channelService, customerService, connection) {
        this.shippingProfileService = shippingProfileService;
        this.paymentProfileService = paymentProfileService;
        this.orderService = orderService;
        this.channelService = channelService;
        this.customerService = customerService;
        this.connection = connection;
    }
    /**
     * 将一个订单的 order lines 按「已生效配送档案」分组为若干箱。
     *
     * 规则（对齐 spec §2.3 / resolveEffectiveProfileIds）：
     * - 变体绑定档案若停用（enabled=false）→ 视为未绑定，回退到租户默认档案；
     * - 变体未绑定任何档案 → 直接回退到租户默认档案；
     * - 同一生效档案的 line 合并为同一箱（跨租户/跨档案自动分箱）。
     */
    async computeOrderBoxes(ctx, order) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const lines = (_a = order.lines) !== null && _a !== void 0 ? _a : [];
        if (lines.length === 0)
            return [];
        const tenantDefault = await this.shippingProfileService.getTenantDefault(ctx);
        const defaultId = (_b = tenantDefault === null || tenantDefault === void 0 ? void 0 : tenantDefault.id) !== null && _b !== void 0 ? _b : null;
        // 组：lineIds + 原始 raw profile ids
        const groups = new Map();
        const orderByProfile = [];
        for (const line of lines) {
            const variant = line.productVariant;
            const rawPid = (_c = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _c === void 0 ? void 0 : _c.shippingProfileId;
            let effectivePid = null;
            if (rawPid) {
                const resolved = await this.shippingProfileService.resolveEffectiveProfileIds(ctx, [rawPid]);
                effectivePid = resolved.length > 0 ? resolved[0] : null;
            }
            if (effectivePid == null) {
                effectivePid = defaultId;
            }
            if (effectivePid == null)
                continue;
            const key = String(effectivePid);
            if (!groups.has(key)) {
                groups.set(key, { lineIds: [], rawIds: new Set() });
                orderByProfile.push(key);
            }
            const group = groups.get(key);
            group.lineIds.push(line.id);
            if (rawPid)
                group.rawIds.add(String(rawPid));
        }
        // —— 新增（Additive）：跨箱共享数据，供下方按箱填充明细/金额/优惠券 ——
        const mall = isMallContext(ctx);
        const [channelsNameMap, customerId] = await Promise.all([
            this.loadChannelsNameMap(),
            this.resolveCustomerId(ctx, order),
        ]);
        const customerCoupons = customerId != null ? await this.loadCustomerCoupons(ctx, customerId) : [];
        const appliedCoupon = await this.loadAppliedCoupon(ctx, order);
        const shippingLines = (_d = order.shippingLines) !== null && _d !== void 0 ? _d : [];
        const boxes = [];
        for (const key of orderByProfile) {
            const group = groups.get(key);
            const profile = await this.shippingProfileService.findOne(ctx, key);
            const enabledMethods = ((_e = profile === null || profile === void 0 ? void 0 : profile.shippingMethods) === null || _e === void 0 ? void 0 : _e.length)
                ? (await this.shippingProfileService.findShippingMethodsByIds(ctx, profile.shippingMethods.map(m => m.id))).filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; })
                : [];
            const tenantChannelId = (_h = (_g = (_f = order.channels) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.id) !== null && _h !== void 0 ? _h : ctx.channelId;
            const isDelivery = !((profile === null || profile === void 0 ? void 0 : profile.pickupLocations) && profile.pickupLocations.length > 0);
            // —— 本箱行明细（Additive）——
            const boxLineIdSet = new Set(group.lineIds.map(String));
            const boxLines = lines.filter(l => boxLineIdSet.has(String(l.id)));
            const boxLineInfo = boxLines.map((barrel) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                const id = String(barrel.id);
                const qty = Number((_a = barrel.quantity) !== null && _a !== void 0 ? _a : 0);
                const lineTotal = Math.max(0, Math.round(Number((_b = barrel.linePriceWithTax) !== null && _b !== void 0 ? _b : 0)));
                const unitPrice = Math.max(0, Math.round(Number((_c = barrel.unitPriceWithTax) !== null && _c !== void 0 ? _c : 0)));
                const variantId = String((_e = (_d = barrel.productVariant) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : '');
                const productName = (_k = (_g = (_f = barrel.productVariant) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : (_j = (_h = barrel.productVariant) === null || _h === void 0 ? void 0 : _h.product) === null || _j === void 0 ? void 0 : _j.name) !== null && _k !== void 0 ? _k : `Item ${id}`;
                return {
                    orderLineId: id,
                    productVariantId: variantId,
                    productName,
                    unitPrice,
                    quantity: qty,
                    lineTotal,
                };
            });
            const goodsTotal = boxLineInfo.reduce((s, l) => s + l.lineTotal, 0);
            // —— 本箱配送费（Additive）——
            // 规则：取 order.shippingLines 中「配送方式 id 落在本箱可用集合」的配送线价格（含税）之和；
            // 无按箱匹配且整单仅一条配送线时，将该单条配送线归属给唯一 delivery 箱（未多箱结算的兜底）；
            // 其余（无/多条导致归属不明确）→ 0。
            let shippingCost = 0;
            if (isDelivery) {
                const shippingMethodIdSet = new Set(enabledMethods.map((m) => String(m.id)));
                const matched = shippingLines.filter((sl) => sl.shippingMethodId != null && shippingMethodIdSet.has(String(sl.shippingMethodId)));
                if (matched.length > 0) {
                    shippingCost = matched.reduce((s, sl) => { var _a; return s + ((_a = sl.priceWithTax) !== null && _a !== void 0 ? _a : 0); }, 0);
                }
                else if (shippingLines.length === 1) {
                    shippingCost = (_j = shippingLines[0].priceWithTax) !== null && _j !== void 0 ? _j : 0;
                }
            }
            // —— 本箱免邮券/已应用券抵扣（Additive）——
            let couponDeduct = 0;
            let shippingDiscount = 0;
            if (appliedCoupon === null || appliedCoupon === void 0 ? void 0 : appliedCoupon.template) {
                const applied = appliedDeductForBox(appliedCoupon.template, mall, boxLines, shippingCost);
                couponDeduct = applied.goodsDeduct;
                shippingDiscount = applied.shippingDeduct;
            }
            // —— 本箱可用优惠券（Additive）——
            const boxBase = boxLines.reduce((s, l) => { var _a; return s + ((_a = l.linePriceWithTax) !== null && _a !== void 0 ? _a : 0); }, 0);
            const availableCoupons = [];
            for (const cc of customerCoupons) {
                const tpl = cc.template;
                if (!tpl)
                    continue;
                if (!couponUsableForBox(cc, mall, boxLines, boxBase))
                    continue;
                const ded = couponDeductForBox(tpl, boxLines, isDelivery ? shippingCost : 0);
                const amount = tpl.type === 'FREE_SHIPPING' ? ded.shippingDeduct : ded.goodsDeduct;
                if (amount <= 0)
                    continue; // 本箱无可抵扣额度则不列出（保持紧凑）
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
                profileId: key,
                profileName: (_k = profile === null || profile === void 0 ? void 0 : profile.name) !== null && _k !== void 0 ? _k : key,
                lineIds: group.lineIds,
                type: ((_l = profile === null || profile === void 0 ? void 0 : profile.pickupLocations) === null || _l === void 0 ? void 0 : _l.length) ? 'pickup' : 'delivery',
                tenantChannelId,
                shippingProfileIds: [...group.rawIds],
                availableShippingMethodIds: enabledMethods.map((m) => m.id),
                availableShippingMethods: enabledMethods.map((m) => ({
                    id: m.id,
                    code: m.code,
                    name: Array.isArray(m.translations) && m.translations.length
                        ? (m.translations.find((t) => t.languageCode === ctx.languageCode)
                            || m.translations.find((t) => String(t.languageCode).toLowerCase().startsWith('zh'))
                            || m.translations[0]).name || m.code
                        : m.code,
                })),
                defaultShippingMethodId: enabledMethods.length > 0 ? enabledMethods[0].id : null,
                pickupLocations: (_m = profile === null || profile === void 0 ? void 0 : profile.pickupLocations) !== null && _m !== void 0 ? _m : [],
                availablePaymentMethodCodes: await this.resolvePaymentCodesForProfile(ctx, key),
                loginRequiredPaymentCodes: (await this.resolvePaymentCodesForProfile(ctx, key)).filter(code => exports.LOGIN_REQUIRED_PAYMENT_CODES.has(code)),
                requiresAddress: (_o = profile === null || profile === void 0 ? void 0 : profile.requiresAddress) !== null && _o !== void 0 ? _o : true,
                requiresContact: (_p = profile === null || profile === void 0 ? void 0 : profile.requiresContact) !== null && _p !== void 0 ? _p : false,
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
    async computeMerchantSplit(ctx, order) {
        var _a;
        const boxes = await this.computeOrderBoxes(ctx, order);
        const map = new Map();
        for (const box of boxes) {
            const key = String(box.tenantChannelId);
            const existing = (_a = map.get(key)) !== null && _a !== void 0 ? _a : {
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
    async loadChannelsNameMap() {
        var _a, _b;
        const result = new Map();
        try {
            const all = await this.channelService.findAll(core_1.RequestContext.empty());
            for (const c of all.items) {
                result.set(String(c.id), {
                    // 本版本 Channel 实体无 `.name`，租户展示名取自 customFields.shopName，兜底 code
                    name: (_b = (_a = c.customFields) === null || _a === void 0 ? void 0 : _a.shopName) !== null && _b !== void 0 ? _b : undefined,
                    code: c.code,
                });
            }
        }
        catch (_c) {
            /* 渠道解析不可用时，tenantName 兜底为 id */
        }
        return result;
    }
    /** 解析当前订单的客户 id（优先 order.customer，否则由 activeUserId 查 Customer）。 */
    async resolveCustomerId(ctx, order) {
        var _a;
        const orderCustomerId = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.id;
        if (orderCustomerId != null)
            return orderCustomerId;
        const userId = ctx.activeUserId;
        if (userId == null)
            return undefined;
        try {
            const customer = await this.customerService.findOneByUserId(ctx, userId);
            return customer === null || customer === void 0 ? void 0 : customer.id;
        }
        catch (_b) {
            return undefined;
        }
    }
    /** 加载某客户的全部券（含 template），失败（coupon-plugin 未注册等）时返回空数组，不影响订单分箱主流程。 */
    async loadCustomerCoupons(ctx, customerId) {
        try {
            const repo = this.connection.getRepository(ctx, coupon_plugin_1.CustomerCoupon);
            return await repo.find({
                where: { customerId },
                relations: { template: true },
            });
        }
        catch (_a) {
            return [];
        }
    }
    /** 加载订单当前应用（customFields.couponCode）的券实例，失败时返回 undefined。 */
    async loadAppliedCoupon(ctx, order) {
        var _a, _b;
        const code = (_a = order === null || order === void 0 ? void 0 : order.customFields) === null || _a === void 0 ? void 0 : _a.couponCode;
        if (!code)
            return undefined;
        try {
            const repo = this.connection.getRepository(ctx, coupon_plugin_1.CustomerCoupon);
            return ((_b = (await repo.findOne({
                where: { code },
                relations: { template: true },
            }))) !== null && _b !== void 0 ? _b : undefined);
        }
        catch (_c) {
            return undefined;
        }
    }
    /**
     * 读取订单已保存的分箱选择（boxShippingSelections customField 中的 JSON）。
     * 结构：{ [boxKey]: { shippingMethodId, pickupLocationId } }
     */
    getBoxSelections(order) {
        return this.readSelections(order);
    }
    readSelections(order) {
        var _a;
        const raw = (_a = order.customFields) === null || _a === void 0 ? void 0 : _a.boxShippingSelections;
        if (!raw)
            return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch (_b) {
            return {};
        }
    }
    /**
     * 解析某配送档案可用的支付方式 code 集合（供聚合拆合引擎判定每箱支付白名单）。
     * - 配送档案绑定支付档案 → 用其全部支付方式 code；
     * - 未绑定 → 回退租户默认支付档案。
     */
    async resolvePaymentCodesForProfile(ctx, shippingProfileId) {
        const payProfile = await this.shippingProfileService.getPaymentProfileForShippingProfile(ctx, shippingProfileId);
        const codes = payProfile
            ? (await this.paymentProfileService.getIntersectedPaymentMethods(ctx, [payProfile.id])).map(m => m.code)
            : [];
        // 余额为所有配送档案的内建基础方式（全局共享钱包），始终并入白名单，供前端/聚合引擎启用「余额合单」路径。
        if (!codes.includes(order_box_aggregation_1.BALANCE_PAYMENT_CODE)) {
            codes.push(order_box_aggregation_1.BALANCE_PAYMENT_CODE);
        }
        return codes;
    }
    /** 兼容单箱传入的支付方式白名单解析。 */
    async resolvePaymentCodesForBox(ctx, box) {
        if (!box.profileId)
            return [];
        return this.resolvePaymentCodesForProfile(ctx, box.profileId);
    }
    /**
     * 为订单内一组箱设置配送方式（一次性调核心 setShippingMethod，多 fulfillment）。
     *
     * selections 可选：传入则为各箱配送方式选择快照（用于拆单时把源订单的选择带给新订单）；
     * 未传则读取 order.customFields.boxShippingSelections。每箱未显式选择时用该箱默认配送方式兜底。
     */
    async setShippingForOrder(ctx, order, boxKeys, selections) {
        var _a;
        const boxes = await this.computeOrderBoxes(ctx, order);
        const effectiveKeys = boxes.filter(b => boxKeys.includes(b.boxKey)).map(b => b.boxKey);
        if (effectiveKeys.length === 0)
            return order;
        const selectionsMap = selections !== null && selections !== void 0 ? selections : this.readSelections(order);
        const orderedMethodIds = boxes
            .filter(b => effectiveKeys.includes(b.boxKey))
            .map(b => { var _a, _b; return (_b = (_a = selectionsMap[b.boxKey]) === null || _a === void 0 ? void 0 : _a.shippingMethodId) !== null && _b !== void 0 ? _b : b.defaultShippingMethodId; })
            .filter((id) => !!id);
        if (orderedMethodIds.length === 0)
            return order;
        const result = await this.orderService.setShippingMethod(ctx, order.id, orderedMethodIds);
        if ((0, core_1.isGraphQlErrorResult)(result)) {
            throw new core_1.UserInputError((_a = result.message) !== null && _a !== void 0 ? _a : 'SET_SHIPPING_METHOD_FAILED');
        }
        return this.orderService.findOne(ctx, order.id);
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
    async setBoxShippingMethod(ctx, order, boxKey, shippingMethodId, pickupLocationId) {
        const boxes = await this.computeOrderBoxes(ctx, order);
        const box = boxes.find(b => b.boxKey === boxKey);
        if (!box) {
            throw new core_1.UserInputError(`BOX_NOT_FOUND:${boxKey}`);
        }
        const sid = String(shippingMethodId);
        if (!box.availableShippingMethodIds.some(id => String(id) === sid)) {
            throw new core_1.UserInputError('BOX_SHIPPING_METHOD_INVALID');
        }
        const selections = this.readSelections(order);
        selections[boxKey] = {
            shippingMethodId: sid,
            pickupLocationId: pickupLocationId ? String(pickupLocationId) : null,
        };
        await this.setShippingForOrder(ctx, order, boxes.map(b => b.boxKey), selections);
        await this.orderService.updateCustomFields(ctx, order.id, {
            boxShippingSelections: JSON.stringify(selections),
        });
        return this.orderService.findOne(ctx, order.id);
    }
};
exports.OrderBoxService = OrderBoxService;
exports.OrderBoxService = OrderBoxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shipping_profile_service_1.ShippingProfileService,
        payment_profile_service_1.PaymentProfileService,
        core_1.OrderService,
        core_1.ChannelService,
        core_1.CustomerService,
        core_1.TransactionalConnection])
], OrderBoxService);
//# sourceMappingURL=order-box.service.js.map