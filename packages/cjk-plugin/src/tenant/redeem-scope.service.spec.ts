import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Administrator, Order, ProductVariant } from '@vendure/core';
import { ProductCouponBinding } from '@vendure/coupon-plugin';

import { RedeemScopeService } from './redeem-scope.service';
import { TenantMember } from './tenant-member.entity';

const VERIFY = 'VerifyOrder';

function ctxOf(opts: { restricted?: boolean; userId?: number | null; channelId?: number } = {}): any {
    return {
        activeUserId: opts.userId === undefined ? 99 : opts.userId,
        channelId: opts.channelId ?? 3,
        userHasPermissions: (perms: any[]) => (opts.restricted ?? false) && perms.includes(VERIFY),
    };
}

interface RepoStub {
    admin?: any;
    member?: any;
    order?: any;
    variants?: any[];
    productVariants?: any[];
    bindings?: any[];
}

function makeService(repos: RepoStub) {
    const adminRepo = { findOne: vi.fn(async () => repos.admin ?? null) };
    const memberRepo = { findOne: vi.fn(async () => repos.member ?? null) };
    const orderRepo = { findOne: vi.fn(async () => repos.order ?? null) };
    const variantRepo = {
        find: vi.fn(async (arg: any) =>
            arg?.where?.product ? (repos.productVariants ?? []) : (repos.variants ?? []),
        ),
    };
    const bindingRepo = { find: vi.fn(async () => repos.bindings ?? []) };
    const connection = {
        getRepository: vi.fn((_c: any, entity: any) => {
            if (entity === Administrator) return adminRepo;
            if (entity === TenantMember) return memberRepo;
            if (entity === Order) return orderRepo;
            if (entity === ProductVariant) return variantRepo;
            if (entity === ProductCouponBinding) return bindingRepo;
            throw new Error(`unknown entity: ${entity?.name ?? entity}`);
        }),
    };
    return { service: new RedeemScopeService(connection as any), adminRepo, memberRepo, orderRepo, variantRepo, bindingRepo };
}

const variant = (id: number, profileId: string | null) => ({
    id,
    customFields: { shippingProfileId: profileId },
});

describe('RedeemScopeService.resolve', () => {
    it('不受限（无 VerifyOrder）→ restricted:false，不查库', async () => {
        const { service, memberRepo } = makeService({});
        expect(await service.resolve(ctxOf({ restricted: false }))).toEqual({
            restricted: false,
            shippingProfileIds: [],
        });
        expect(memberRepo.findOne).not.toHaveBeenCalled();
    });

    it('受限 + 成员有白名单 → restricted:true + 白名单字符串化', async () => {
        const { service } = makeService({
            admin: { id: 11 },
            member: { shippingProfileIds: [5, '7'] },
        });
        expect(await service.resolve(ctxOf({ restricted: true }))).toEqual({
            restricted: true,
            shippingProfileIds: ['5', '7'],
        });
    });

    it('受限 + 无成员记录 → restricted:true + 空集（默认拒绝）', async () => {
        const { service } = makeService({ admin: { id: 11 }, member: null });
        expect(await service.resolve(ctxOf({ restricted: true }))).toEqual({
            restricted: true,
            shippingProfileIds: [],
        });
    });

    it('受限 + 无登录用户 → restricted:true + 空集', async () => {
        const { service } = makeService({});
        expect(await service.resolve(ctxOf({ restricted: true, userId: null }))).toEqual({
            restricted: true,
            shippingProfileIds: [],
        });
    });
});

describe('RedeemScopeService.orderInScope', () => {
    it('不受限 scope → true，不查库', async () => {
        const { service, orderRepo } = makeService({});
        expect(await service.orderInScope(ctxOf(), 1, { restricted: false, shippingProfileIds: [] })).toBe(true);
        expect(orderRepo.findOne).not.toHaveBeenCalled();
    });

    it('受限 + 空白名单 → false（默认拒绝）', async () => {
        const { service, orderRepo } = makeService({});
        expect(await service.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: [] })).toBe(false);
        expect(orderRepo.findOne).not.toHaveBeenCalled();
    });

    it('受限 + 全部行命中 → true', async () => {
        const { service } = makeService({
            order: { id: 1, lines: [{ productVariant: variant(1, '5') }, { productVariant: variant(2, '5') }] },
        });
        expect(await service.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: ['5'] })).toBe(true);
    });

    it('受限 + 任一行越界 → false', async () => {
        const { service } = makeService({
            order: { id: 1, lines: [{ productVariant: variant(1, '5') }, { productVariant: variant(2, '9') }] },
        });
        expect(await service.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });

    it('受限 + 行档案为空 → false', async () => {
        const { service } = makeService({
            order: { id: 1, lines: [{ productVariant: variant(1, null) }] },
        });
        expect(await service.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });

    it('受限 + 订单无行 / 订单不存在 → false', async () => {
        const { service } = makeService({ order: { id: 1, lines: [] } });
        expect(await service.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
        const { service: s2 } = makeService({ order: null });
        expect(await s2.orderInScope(ctxOf(), 1, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });
});

describe('RedeemScopeService.couponTemplateInScope', () => {
    it('不受限 scope → true，不查库', async () => {
        const { service, bindingRepo } = makeService({});
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: false, shippingProfileIds: [] })).toBe(true);
        expect(bindingRepo.find).not.toHaveBeenCalled();
    });

    it('受限 + 无绑定记录（通用券）→ false', async () => {
        const { service } = makeService({ bindings: [] });
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });

    it('受限 + 绑定 variantIds 全部命中 → true', async () => {
        const { service } = makeService({
            bindings: [{ couponTemplateId: 7, productId: 1, variantIds: [11, 12] }],
            variants: [variant(11, '5'), variant(12, '5')],
        });
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: true, shippingProfileIds: ['5'] })).toBe(true);
    });

    it('受限 + 绑定变体有一项越界 → false', async () => {
        const { service } = makeService({
            bindings: [{ couponTemplateId: 7, productId: 1, variantIds: [11, 12] }],
            variants: [variant(11, '5'), variant(12, '9')],
        });
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });

    it('受限 + 绑定未细化变体 → 取商品全部变体判定', async () => {
        const { service } = makeService({
            bindings: [{ couponTemplateId: 7, productId: 1, variantIds: null }],
            productVariants: [{ id: 21 }, { id: 22 }],
            variants: [variant(21, '5'), variant(22, '5')],
        });
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: true, shippingProfileIds: ['5'] })).toBe(true);
    });

    it('受限 + 多个绑定需全部命中，任一不通过 → false', async () => {
        const { service } = makeService({
            bindings: [
                { couponTemplateId: 7, productId: 1, variantIds: [11] },
                { couponTemplateId: 7, productId: 2, variantIds: [21] },
            ],
            variants: [variant(11, '5'), variant(21, '9')],
        });
        expect(await service.couponTemplateInScope(ctxOf(), 7, { restricted: true, shippingProfileIds: ['5'] })).toBe(false);
    });
});