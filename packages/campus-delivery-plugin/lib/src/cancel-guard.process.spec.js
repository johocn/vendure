"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const cancel_guard_process_1 = require("./cancel-guard.process");
const guard = cancel_guard_process_1.campusCancelGuardProcess.onTransitionStart;
(0, vitest_1.describe)('campusCancelGuardProcess', () => {
    const shop = { apiType: 'shop' };
    const admin = { apiType: 'admin' };
    (0, vitest_1.it)('C 端已送达 → 拒绝取消', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { deliveredAt: new Date(), hallStatus: 'delivered' } },
        })).rejects.toThrow('订单已送达');
    });
    (0, vitest_1.it)('C 端骑手已取货（in_progress）→ 拒绝取消', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { deliveryStatus: 'in_progress', hallStatus: 'grabbed' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });
    (0, vitest_1.it)('C 端外部运单已接单 → 拒绝取消', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { thirdPartyState: 'accepted', hallStatus: 'third_party' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });
    (0, vitest_1.it)('C 端商户自配送中 → 拒绝取消', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { hallStatus: 'merchant_delivering' } },
        })).rejects.toThrow('骑手已接单或配送中');
    });
    (0, vitest_1.it)('C 端未取货（仍在大厅）→ 允许取消', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: shop,
            order: { customFields: { hallStatus: 'open' } },
        })).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('后台强制取消（apiType=admin）→ 不受限', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Cancelled', {
            ctx: admin,
            order: { customFields: { deliveryStatus: 'in_progress', hallStatus: 'grabbed' } },
        })).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('非取消过渡 → 不拦截', async () => {
        await (0, vitest_1.expect)(guard('PaymentSettled', 'Shipped', {
            ctx: shop,
            order: { customFields: { deliveryStatus: 'in_progress' } },
        })).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=cancel-guard.process.spec.js.map