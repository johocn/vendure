import { describe, expect, it } from 'vitest';
import { campusCancelGuardProcess } from './cancel-guard.process';

const guard = campusCancelGuardProcess.onTransitionStart as any;

describe('campusCancelGuardProcess', () => {
    const shop = { apiType: 'shop' } as any;
    const admin = { apiType: 'admin' } as any;

    it('C 端已送达 → 拒绝取消', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { deliveredAt: new Date(), hallStatus: 'delivered' } },
        })).rejects.toThrow('订单已送达');
    });

    it('C 端骑手已取货（in_progress）→ 拒绝取消', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { deliveryStatus: 'in_progress', hallStatus: 'grabbed' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });

    it('C 端外部运单已接单 → 拒绝取消', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { thirdPartyState: 'accepted', hallStatus: 'third_party' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });

    it('C 端商户自配送中 → 拒绝取消', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { hallStatus: 'merchant_delivering' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });

    it('C 端未取货（仍在大厅）→ 允许取消', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { hallStatus: 'open' } },
        })).resolves.toBeUndefined();
    });

    it('后台强制取消（apiType=admin）→ 不受限', async () => {
        await expect(guard('PaymentSettled', 'Cancelled', {
            ctx: admin,
            order: { customFields: { deliveryStatus: 'in_progress', hallStatus: 'grabbed' } },
        })).resolves.toBeUndefined();
    });

    it('非取消过渡 → 不拦截', async () => {
        await expect(guard('PaymentSettled', 'Shipped', {
            ctx: shop,
            order: { customFields: { deliveryStatus: 'in_progress' } },
        })).resolves.toBeUndefined();
    });
});
