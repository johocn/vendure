"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERIFY_ORDER_PERMISSION = void 0;
exports.setRedeemScopeResolver = setRedeemScopeResolver;
exports.resolveRedeemScope = resolveRedeemScope;
exports.orderInScope = orderInScope;
exports.couponTemplateInScope = couponTemplateInScope;
/** 单一来源：cjk-plugin tenant-permissions.ts 的 VerifyOrder；此处用字面量避免反向依赖 */
exports.VERIFY_ORDER_PERMISSION = 'VerifyOrder';
let provider = null;
function setRedeemScopeResolver(p) {
    provider = p;
}
async function resolveRedeemScope(ctx) {
    if (!provider)
        return { restricted: false, shippingProfileIds: [] };
    return provider.resolve(ctx);
}
async function orderInScope(ctx, orderId, scope) {
    if (!provider)
        return true;
    const s = scope !== null && scope !== void 0 ? scope : (await provider.resolve(ctx));
    if (!s.restricted)
        return true;
    return provider.orderInScope(ctx, orderId, s);
}
async function couponTemplateInScope(ctx, templateId, scope) {
    if (!provider)
        return true;
    const s = scope !== null && scope !== void 0 ? scope : (await provider.resolve(ctx));
    if (!s.restricted)
        return true;
    return provider.couponTemplateInScope(ctx, templateId, s);
}
//# sourceMappingURL=redeem-scope.js.map