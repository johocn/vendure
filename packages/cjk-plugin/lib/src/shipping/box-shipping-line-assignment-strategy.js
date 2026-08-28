"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoxShippingLineAssignmentStrategy = void 0;
const shipping_profile_service_1 = require("./shipping-profile.service");
let shippingProfileService;
/**
 * 按「配送档案分箱」分配 OrderLine → ShippingLine 的自定义策略。
 *
 * 当一个订单被设置多个配送方式（对应多个箱）时，核心的 setShippingMethod 会为每个
 * 配送方式创建一个 ShippingLine，并通过本策略决定每个 ShippingLine 挂哪些 OrderLine。
 * 本策略按变体所属的「已生效配送档案」分箱，把每个箱的 lines 归属到该箱配送方式对应的
 * ShippingLine，从而实现「单订单内多 shippingLine / 多 fulfillment」。
 *
 * 单箱场景退化为默认行为（该箱全部 lines 挂到唯一 ShippingLine）。
 */
class BoxShippingLineAssignmentStrategy {
    init(injector) {
        shippingProfileService = injector.get(shipping_profile_service_1.ShippingProfileService);
    }
    async assignShippingLineToOrderLines(ctx, shippingLine, order) {
        var _a, _b, _c, _d, _e;
        const methodId = shippingLine.shippingMethodId;
        const lines = (_a = order.lines) !== null && _a !== void 0 ? _a : [];
        // 按生效档案分箱（与 OrderBoxService.computeOrderBoxes 同源逻辑）
        const tenantDefault = await shippingProfileService.getTenantDefault(ctx);
        const defaultId = (_b = tenantDefault === null || tenantDefault === void 0 ? void 0 : tenantDefault.id) !== null && _b !== void 0 ? _b : null;
        const boxes = new Map();
        const orderByProfile = [];
        for (const line of lines) {
            const variant = line.productVariant;
            const rawPid = (_c = variant === null || variant === void 0 ? void 0 : variant.customFields) === null || _c === void 0 ? void 0 : _c.shippingProfileId;
            let effectivePid = null;
            if (rawPid) {
                const resolved = await shippingProfileService.resolveEffectiveProfileIds(ctx, [rawPid]);
                effectivePid = resolved.length > 0 ? resolved[0] : null;
            }
            if (effectivePid == null)
                effectivePid = defaultId;
            if (effectivePid == null)
                continue;
            const key = String(effectivePid);
            if (!boxes.has(key)) {
                boxes.set(key, []);
                orderByProfile.push(key);
            }
            boxes.get(key).push(line);
        }
        // 属于该配送方式的箱：其允许的配送方式集合中包含当前 shippingMethod 的箱
        const assigned = [];
        for (const key of orderByProfile) {
            const profile = await shippingProfileService.findOne(ctx, key);
            const allowed = (_e = (_d = profile === null || profile === void 0 ? void 0 : profile.shippingMethods) === null || _d === void 0 ? void 0 : _d.map(m => String(m.id))) !== null && _e !== void 0 ? _e : [];
            if (allowed.includes(String(methodId))) {
                assigned.push(...boxes.get(key));
            }
        }
        return assigned;
    }
}
exports.BoxShippingLineAssignmentStrategy = BoxShippingLineAssignmentStrategy;
//# sourceMappingURL=box-shipping-line-assignment-strategy.js.map