import { describe, expect, it } from 'vitest';
import { DELIVERY_TRANSITIONS, validateDeliveryTransition } from './delivery-state';

describe('delivery-state', () => {
    it('self/express 正常链路合法', () => {
        expect(validateDeliveryTransition('self', 'Draft', 'Shipped')).toBe(true);
        expect(validateDeliveryTransition('express', 'Shipped', 'InTransit')).toBe(true);
        expect(validateDeliveryTransition('self', 'InProgress', 'Delivered')).toBe(true);
    });

    it('pickup 链路合法', () => {
        expect(validateDeliveryTransition('pickup', 'PickupPending', 'PickupReady')).toBe(true);
        expect(validateDeliveryTransition('pickup', 'PickupReady', 'Completed')).toBe(true);
    });

    it('transfer 链路合法', () => {
        expect(validateDeliveryTransition('transfer', 'TransferPending', 'InTransit')).toBe(true);
        expect(validateDeliveryTransition('transfer', 'InTransit', 'Arrived')).toBe(true);
    });

    it('非法迁移拒绝', () => {
        expect(validateDeliveryTransition('express', 'Draft', 'Delivered')).toBe(false);
        expect(validateDeliveryTransition('self', 'Delivered', 'InProgress')).toBe(false);
        expect(validateDeliveryTransition('pickup', 'Draft', 'Completed')).toBe(false);
    });

    it('异常分支合法', () => {
        expect(validateDeliveryTransition('express', 'Shipped', 'Exception')).toBe(true);
        expect(validateDeliveryTransition('express', 'Exception', 'Returned')).toBe(true);
        expect(validateDeliveryTransition('self', 'InTransit', 'Returned')).toBe(true);
    });

    it('未知状态/模式拒绝', () => {
        expect(validateDeliveryTransition('express', 'Nope' as any, 'Shipped')).toBe(false);
        expect(validateDeliveryTransition('unknown' as any, 'Draft', 'Shipped')).toBe(false);
    });
});
