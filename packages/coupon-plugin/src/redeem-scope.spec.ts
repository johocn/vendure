import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    RedeemScope,
    RedeemScopeProvider,
    couponTemplateInScope,
    orderInScope,
    resolveRedeemScope,
    setRedeemScopeResolver,
} from './redeem-scope';

const ctx: any = { channelId: 3, activeUserId: 99 };

describe('redeem-scope 适配器：未注册实现（向后兼容）', () => {
    beforeEach(() => setRedeemScopeResolver(null));

    it('resolveRedeemScope 返回不受限空集', async () => {
        expect(await resolveRedeemScope(ctx)).toEqual({ restricted: false, shippingProfileIds: [] });
    });

    it('orderInScope / couponTemplateInScope 恒为命中', async () => {
        expect(await orderInScope(ctx, 1)).toBe(true);
        expect(await couponTemplateInScope(ctx, 7)).toBe(true);
    });
});

describe('redeem-scope 适配器：已注册实现', () => {
    const restrictedScope: RedeemScope = { restricted: true, shippingProfileIds: ['5'] };
    let provider: RedeemScopeProvider;

    beforeEach(() => {
        provider = {
            resolve: vi.fn(async () => restrictedScope),
            orderInScope: vi.fn(async () => false),
            couponTemplateInScope: vi.fn(async () => false),
        };
        setRedeemScopeResolver(provider);
    });
    afterEach(() => setRedeemScopeResolver(null));

    it('resolveRedeemScope 委托给实现', async () => {
        expect(await resolveRedeemScope(ctx)).toEqual(restrictedScope);
        expect(provider.resolve).toHaveBeenCalledWith(ctx);
    });

    it('受限 → orderInScope / couponTemplateInScope 委托实现', async () => {
        expect(await orderInScope(ctx, 1)).toBe(false);
        expect(await couponTemplateInScope(ctx, 7)).toBe(false);
        expect(provider.orderInScope).toHaveBeenCalledWith(ctx, 1, restrictedScope);
        expect(provider.couponTemplateInScope).toHaveBeenCalledWith(ctx, 7, restrictedScope);
    });

    it('显式传入不受限 scope → 短路为 true，不查实现', async () => {
        const open: RedeemScope = { restricted: false, shippingProfileIds: [] };
        expect(await orderInScope(ctx, 1, open)).toBe(true);
        expect(await couponTemplateInScope(ctx, 7, open)).toBe(true);
        expect(provider.orderInScope).not.toHaveBeenCalled();
        expect(provider.couponTemplateInScope).not.toHaveBeenCalled();
    });

    it('显式传入受限 scope → 免二次 resolve 直接委托实现', async () => {
        expect(await orderInScope(ctx, 1, restrictedScope)).toBe(false);
        expect(provider.resolve).not.toHaveBeenCalled();
        expect(provider.orderInScope).toHaveBeenCalledWith(ctx, 1, restrictedScope);
    });
});