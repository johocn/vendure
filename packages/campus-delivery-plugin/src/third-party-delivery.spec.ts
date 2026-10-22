import { describe, expect, it } from 'vitest';
import { nextHallStateAfterHandover } from './third-party-delivery.service';

describe('third-party delivery', () => {
    it('R1/R2 送达交接点 → 进抢单大厅接力', () => {
        expect(nextHallStateAfterHandover('to_campus_rider')).toEqual({
            hallStatus: 'open', deliveryStatus: null,
        });
    });

    it('R3 外部快递直送 → 直接完成', () => {
        expect(nextHallStateAfterHandover('direct_to_user')).toEqual({
            hallStatus: 'delivered', deliveryStatus: 'delivered',
        });
    });

    it('无交接方式（不认识的快照）→ 不误判完成，回落大厅', () => {
        expect(nextHallStateAfterHandover('')).toEqual({ hallStatus: 'open', deliveryStatus: null });
    });
});
