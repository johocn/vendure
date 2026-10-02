import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Order } from '@vendure/core';

import { RedemptionCodeService } from './redemption-code.service';
import { encryptRedemptionCode } from './redemption-crypto';

const KEY = '7'.repeat(64); // 与 service 的 dev 默认一致（REDEMPTION_KEY 未注入时）

/** 构造一张「有有效核销码、未核销」的自提单；_profiles 供 hydrate 注入订单行档案 */
function makeOrder(id: number, code: string, profiles: (string | null)[]) {
    const { cipher, iv } = encryptRedemptionCode('ABC234', KEY);
    return {
        id,
        code,
        customFields: {
            redeemCodeCipher: cipher,
            redeemCodeIv: iv,
            redeemExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            redeemVersion: 1,
        },
        payments: [],
        _profiles: profiles,
    } as any;
}

function makeService(orders: any[], scope: { restricted: boolean; shippingProfileIds: string[] }) {
    const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn(async () => orders),
    };
    const connection = {
        getRepository: vi.fn(() => ({ createQueryBuilder: vi.fn(() => qb) })),
    };
    const hydrator = {
        hydrate: vi.fn(async (_ctx: any, o: any) => {
            o.lines = ((o._profiles ?? []) as (string | null)[]).map((pid, i) => ({
                id: `${o.id}-${i}`,
                quantity: 1,
                linePriceWithTax: 100,
                productVariant: {
                    id: 100 + i,
                    name: 'V',
                    customFields: { shippingProfileId: pid },
                    product: { name: 'P' },
                    options: [],
                },
            }));
        }),
    };
    const redeemScopeService = { resolve: vi.fn(async () => scope) };
    const service = new RedemptionCodeService(
        {} as any,
        connection as any,
        {} as any,
        hydrator as any,
        redeemScopeService as any,
    );
    return { service, hydrator, redeemScopeService };
}

const ctx: any = { channelId: 3, activeUserId: 99 };

describe('RedemptionCodeService.listPending · 受限核销员范围收口', () => {
    it('不受限 → 全量列出，不按行档案过滤（仅本页灌注商品行）', async () => {
        const orders = [makeOrder(1, 'A00001', ['5']), makeOrder(2, 'A00002', ['9'])];
        const { service, hydrator } = makeService(orders, { restricted: false, shippingProfileIds: [] });
        const r = await service.listPending(ctx, {});
        expect(r.totalItems).toBe(2);
        expect(r.items.map(i => i.orderCode)).toEqual(['A00001', 'A00002']);
        // 不受限不做范围判定；hydrate 仅用于本页订单行灌注（每单一次）
        expect(hydrator.hydrate).toHaveBeenCalledTimes(2);
        expect(r.items[0].lines).toHaveLength(1);
    });

    it('受限 + 空白名单 → 一律拒绝（空列表，不做行判定）', async () => {
        const orders = [makeOrder(1, 'A00001', ['5'])];
        const { service, hydrator } = makeService(orders, { restricted: true, shippingProfileIds: [] });
        const r = await service.listPending(ctx, {});
        expect(r.totalItems).toBe(0);
        expect(r.items).toEqual([]);
        expect(hydrator.hydrate).not.toHaveBeenCalled();
    });

    it('受限 + 白名单：全部行命中才可见，任一行越界即隐藏', async () => {
        const orders = [
            makeOrder(1, 'HIT000', ['5', '5']),
            makeOrder(2, 'MISS00', ['5', '9']),
        ];
        const { service } = makeService(orders, { restricted: true, shippingProfileIds: ['5'] });
        const r = await service.listPending(ctx, {});
        expect(r.totalItems).toBe(1);
        expect(r.items.map(i => i.orderCode)).toEqual(['HIT000']);
    });

    it('受限 + 分页：totalItems 与分页均在过滤后计算（范围外不计入）', async () => {
        const orders = [
            makeOrder(1, 'OUT001', ['9']),   // 范围外，排在最前
            makeOrder(2, 'IN0001', ['5']),
            makeOrder(3, 'IN0002', ['5']),
        ];
        const { service } = makeService(orders, { restricted: true, shippingProfileIds: ['5'] });
        const page = await service.listPending(ctx, { skip: 0, take: 1 });
        expect(page.totalItems).toBe(2);            // 过滤后总数（非 3）
        expect(page.items.map(i => i.orderCode)).toEqual(['IN0001']);
        const page2 = await service.listPending(ctx, { skip: 1, take: 1 });
        expect(page2.items.map(i => i.orderCode)).toEqual(['IN0002']);
    });
});