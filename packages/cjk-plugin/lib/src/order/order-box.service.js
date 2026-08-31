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
exports.OrderBoxService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const shipping_profile_service_1 = require("../shipping/shipping-profile.service");
const payment_profile_service_1 = require("../payment/payment-profile.service");
const order_box_aggregation_1 = require("./order-box-aggregation");
let OrderBoxService = class OrderBoxService {
    constructor(shippingProfileService, paymentProfileService, orderService) {
        this.shippingProfileService = shippingProfileService;
        this.paymentProfileService = paymentProfileService;
        this.orderService = orderService;
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
        const boxes = [];
        for (const key of orderByProfile) {
            const group = groups.get(key);
            const profile = await this.shippingProfileService.findOne(ctx, key);
            const enabledMethods = ((_d = profile === null || profile === void 0 ? void 0 : profile.shippingMethods) === null || _d === void 0 ? void 0 : _d.length)
                ? (await this.shippingProfileService.findShippingMethodsByIds(ctx, profile.shippingMethods.map(m => m.id))).filter((m) => { var _a; return ((_a = m.customFields) === null || _a === void 0 ? void 0 : _a.enabled) !== false; })
                : [];
            boxes.push({
                boxKey: `box:${key}`,
                profileId: key,
                profileName: (_e = profile === null || profile === void 0 ? void 0 : profile.name) !== null && _e !== void 0 ? _e : key,
                lineIds: group.lineIds,
                type: ((_f = profile === null || profile === void 0 ? void 0 : profile.pickupLocations) === null || _f === void 0 ? void 0 : _f.length) ? 'pickup' : 'delivery',
                tenantChannelId: (_j = (_h = (_g = order.channels) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : ctx.channelId,
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
                pickupLocations: (_k = profile === null || profile === void 0 ? void 0 : profile.pickupLocations) !== null && _k !== void 0 ? _k : [],
                availablePaymentMethodCodes: await this.resolvePaymentCodesForProfile(ctx, key),
                requiresAddress: (_l = profile === null || profile === void 0 ? void 0 : profile.requiresAddress) !== null && _l !== void 0 ? _l : true,
                requiresContact: (_m = profile === null || profile === void 0 ? void 0 : profile.requiresContact) !== null && _m !== void 0 ? _m : false,
            });
        }
        return boxes;
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
        core_1.OrderService])
], OrderBoxService);
//# sourceMappingURL=order-box.service.js.map