import { describe, expect, it, vi } from 'vitest';
import { InventoryShopResolver } from './inventory-shop.resolver';

describe('InventoryShopResolver.variantStockInfo', () => {
    function makeResolver(overrides: Record<string, any> = {}) {
        const r: any = new InventoryShopResolver({} as any);
        Object.assign(r, {
            virtualPhysicalStockService: {
                getSaleableAndDetail: vi.fn().mockResolvedValue({
                    saleableStock: 12,
                    physicalStockEnabled: true,
                    stockDetail: [
                        { locationId: 'l1', name: '默认仓', lat: 30, lng: 120, onHand: 12, distanceKm: 3.2 },
                    ],
                }),
            },
            ...overrides,
        });
        return r;
    }

    it('返回 saleableStock + stockDetail + physicalStockEnabled', async () => {
        const r = makeResolver();
        const out = await r.variantStockInfo({ channel: { code: 't1' } } as any, 'p1');
        expect(out.saleableStock).toBe(12);
        expect(out.physicalStockEnabled).toBe(true);
        expect(out.stockDetail[0].locationId).toBe('l1');
    });
});
