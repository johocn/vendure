"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const third_party_delivery_service_1 = require("./third-party-delivery.service");
(0, vitest_1.describe)('third-party delivery', () => {
    (0, vitest_1.it)('R1/R2 送达交接点 → 进抢单大厅接力', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('to_campus_rider')).toEqual({
            hallStatus: 'open', deliveryStatus: null,
        });
    });
    (0, vitest_1.it)('R3 外部快递直送 → 直接完成', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('direct_to_user')).toEqual({
            hallStatus: 'delivered', deliveryStatus: 'delivered',
        });
    });
    (0, vitest_1.it)('无交接方式（不认识的快照）→ 不误判完成，回落大厅', () => {
        (0, vitest_1.expect)((0, third_party_delivery_service_1.nextHallStateAfterHandover)('')).toEqual({ hallStatus: 'open', deliveryStatus: null });
    });
});
//# sourceMappingURL=third-party-delivery.spec.js.map