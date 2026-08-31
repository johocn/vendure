import { describe, expect, it } from 'vitest';
import { buildGuestOverview, guestLookupAllowed, isGuestOrder } from './pickup-guest-order';

function fakeOrder(over: any = {}): any {
    return {
        id: '1', code: 'ABC', state: 'PaymentSettled', currencyCode: 'CNY',
        totalQuantity: 1, subTotal: 442, shippingWithTax: 0, totalWithTax: 499,
        orderPlacedAt: new Date(), customer: { user: null },
        customFields: { deliveryType: 'pickup', pickupClaimed: false, contactPhone: null, selectedPickupLocationId: { name: '门店A', address: '长春某路', businessHours: '9-18' } },
        fulfillments: [{ state: 'Shipped' }],
        lines: [{ productVariant: { product: { name: '中行' }, sku: 'P1' }, quantity: 1, linePriceWithTax: 499 }],
        ...over,
    };
}

describe('guestLookupAllowed', () => {
    it('手机号匹配（游客单）允许长期访问', () => {
        const order = fakeOrder({ customFields: { deliveryType: 'pickup', contactPhone: '13200998877' } });
        expect(guestLookupAllowed(order, { phone: '13200998877' }, false).allowed).toBe(true);
    });
    it('手机号不匹配则拒绝', () => {
        const order = fakeOrder({ customFields: { contactPhone: '13200998877' } });
        expect(guestLookupAllowed(order, { phone: '100' }, false).reason).toBe('phone_mismatch');
    });
    it('登录用户不能用手机号通道', () => {
        const order = fakeOrder({ customer: { user: { id: 'u1' } }, customFields: { contactPhone: '13200998877' } });
        expect(guestLookupAllowed(order, { phone: '13200998877' }, false).reason).toBe('not_guest');
    });
    it('不带手机号时仅当窗口放行才允许', () => {
        const order = fakeOrder();
        expect(guestLookupAllowed(order, { phone: null }, false).reason).toBe('window');
        expect(guestLookupAllowed(order, { phone: null }, true).allowed).toBe(true);
    });
    it('订单不存在拒绝', () => {
        expect(guestLookupAllowed(null, { phone: null }, true).allowed).toBe(false);
    });
});

describe('buildGuestOverview', () => {
    it('返回脱敏概览且不含地址/支付/邮箱', () => {
        const overview = buildGuestOverview(fakeOrder(), { code: 'ABC234' } as any);
        expect(overview.pickupCode).toBe('ABC234');
        expect(overview.isPickup).toBe(true);
        expect(overview.pickupClaimable).toBe(true);
        expect(overview.lines[0].productName).toBe('中行');
        expect('shippingAddress' in overview).toBe(false);
        expect('emailAddress' in overview).toBe(false);
    });
    it('非自提单无提货码/不可取货', () => {
        const overview = buildGuestOverview(fakeOrder({ customFields: { deliveryType: 'delivery' } }), null);
        expect(overview.isPickup).toBe(false);
        expect(overview.pickupCode).toBeNull();
        expect(overview.pickupClaimable).toBe(false);
    });
});