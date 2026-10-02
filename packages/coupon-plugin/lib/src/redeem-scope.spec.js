"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const redeem_scope_1 = require("./redeem-scope");
const ctx = { channelId: 3, activeUserId: 99 };
(0, vitest_1.describe)('redeem-scope 适配器：未注册实现（向后兼容）', () => {
    (0, vitest_1.beforeEach)(() => (0, redeem_scope_1.setRedeemScopeResolver)(null));
    (0, vitest_1.it)('resolveRedeemScope 返回不受限空集', async () => {
        (0, vitest_1.expect)(await (0, redeem_scope_1.resolveRedeemScope)(ctx)).toEqual({ restricted: false, shippingProfileIds: [] });
    });
    (0, vitest_1.it)('orderInScope / couponTemplateInScope 恒为命中', async () => {
        (0, vitest_1.expect)(await (0, redeem_scope_1.orderInScope)(ctx, 1)).toBe(true);
        (0, vitest_1.expect)(await (0, redeem_scope_1.couponTemplateInScope)(ctx, 7)).toBe(true);
    });
});
(0, vitest_1.describe)('redeem-scope 适配器：已注册实现', () => {
    const restrictedScope = { restricted: true, shippingProfileIds: ['5'] };
    let provider;
    (0, vitest_1.beforeEach)(() => {
        provider = {
            resolve: vitest_1.vi.fn(async () => restrictedScope),
            orderInScope: vitest_1.vi.fn(async () => false),
            couponTemplateInScope: vitest_1.vi.fn(async () => false),
        };
        (0, redeem_scope_1.setRedeemScopeResolver)(provider);
    });
    (0, vitest_1.afterEach)(() => (0, redeem_scope_1.setRedeemScopeResolver)(null));
    (0, vitest_1.it)('resolveRedeemScope 委托给实现', async () => {
        (0, vitest_1.expect)(await (0, redeem_scope_1.resolveRedeemScope)(ctx)).toEqual(restrictedScope);
        (0, vitest_1.expect)(provider.resolve).toHaveBeenCalledWith(ctx);
    });
    (0, vitest_1.it)('受限 → orderInScope / couponTemplateInScope 委托实现', async () => {
        (0, vitest_1.expect)(await (0, redeem_scope_1.orderInScope)(ctx, 1)).toBe(false);
        (0, vitest_1.expect)(await (0, redeem_scope_1.couponTemplateInScope)(ctx, 7)).toBe(false);
        (0, vitest_1.expect)(provider.orderInScope).toHaveBeenCalledWith(ctx, 1, restrictedScope);
        (0, vitest_1.expect)(provider.couponTemplateInScope).toHaveBeenCalledWith(ctx, 7, restrictedScope);
    });
    (0, vitest_1.it)('显式传入不受限 scope → 短路为 true，不查实现', async () => {
        const open = { restricted: false, shippingProfileIds: [] };
        (0, vitest_1.expect)(await (0, redeem_scope_1.orderInScope)(ctx, 1, open)).toBe(true);
        (0, vitest_1.expect)(await (0, redeem_scope_1.couponTemplateInScope)(ctx, 7, open)).toBe(true);
        (0, vitest_1.expect)(provider.orderInScope).not.toHaveBeenCalled();
        (0, vitest_1.expect)(provider.couponTemplateInScope).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('显式传入受限 scope → 免二次 resolve 直接委托实现', async () => {
        (0, vitest_1.expect)(await (0, redeem_scope_1.orderInScope)(ctx, 1, restrictedScope)).toBe(false);
        (0, vitest_1.expect)(provider.resolve).not.toHaveBeenCalled();
        (0, vitest_1.expect)(provider.orderInScope).toHaveBeenCalledWith(ctx, 1, restrictedScope);
    });
});
//# sourceMappingURL=redeem-scope.spec.js.map