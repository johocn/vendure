"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pickup_guest_order_1 = require("./pickup-guest-order");
function fakeOrder(over = {}) {
    return Object.assign({ id: '1', code: 'ABC', state: 'PaymentSettled', currencyCode: 'CNY', totalQuantity: 1, subTotal: 442, shippingWithTax: 0, totalWithTax: 499, orderPlacedAt: new Date(), customer: { user: null }, customFields: { deliveryType: 'pickup', pickupClaimed: false, contactPhone: null, selectedPickupLocationId: { name: '门店A', address: '长春某路', businessHours: '9-18' } }, fulfillments: [{ state: 'Shipped' }], lines: [{ productVariant: { product: { name: '中行' }, sku: 'P1' }, quantity: 1, linePriceWithTax: 499 }] }, over);
}
(0, vitest_1.describe)('guestLookupAllowed', () => {
    (0, vitest_1.it)('手机号匹配（游客单）允许长期访问', () => {
        const order = fakeOrder({ customFields: { deliveryType: 'pickup', contactPhone: '13200998877' } });
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(order, { phone: '13200998877' }, false).allowed).toBe(true);
    });
    (0, vitest_1.it)('手机号不匹配则拒绝', () => {
        const order = fakeOrder({ customFields: { contactPhone: '13200998877' } });
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(order, { phone: '100' }, false).reason).toBe('phone_mismatch');
    });
    (0, vitest_1.it)('登录用户不能用手机号通道', () => {
        const order = fakeOrder({ customer: { user: { id: 'u1' } }, customFields: { contactPhone: '13200998877' } });
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(order, { phone: '13200998877' }, false).reason).toBe('not_guest');
    });
    (0, vitest_1.it)('不带手机号时仅当窗口放行才允许', () => {
        const order = fakeOrder();
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(order, { phone: null }, false).reason).toBe('window');
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(order, { phone: null }, true).allowed).toBe(true);
    });
    (0, vitest_1.it)('订单不存在拒绝', () => {
        (0, vitest_1.expect)((0, pickup_guest_order_1.guestLookupAllowed)(null, { phone: null }, true).allowed).toBe(false);
    });
});
(0, vitest_1.describe)('buildGuestOverview', () => {
    (0, vitest_1.it)('返回脱敏概览且不含地址/支付/邮箱', () => {
        const overview = (0, pickup_guest_order_1.buildGuestOverview)(fakeOrder(), { code: 'ABC234' });
        (0, vitest_1.expect)(overview.pickupCode).toBe('ABC234');
        (0, vitest_1.expect)(overview.isPickup).toBe(true);
        (0, vitest_1.expect)(overview.pickupClaimable).toBe(true);
        (0, vitest_1.expect)(overview.lines[0].productName).toBe('中行');
        (0, vitest_1.expect)('shippingAddress' in overview).toBe(false);
        (0, vitest_1.expect)('emailAddress' in overview).toBe(false);
    });
    (0, vitest_1.it)('非自提单无提货码/不可取货', () => {
        const overview = (0, pickup_guest_order_1.buildGuestOverview)(fakeOrder({ customFields: { deliveryType: 'delivery' } }), null);
        (0, vitest_1.expect)(overview.isPickup).toBe(false);
        (0, vitest_1.expect)(overview.pickupCode).toBeNull();
        (0, vitest_1.expect)(overview.pickupClaimable).toBe(false);
    });
});
//# sourceMappingURL=pickup-guest-order.spec.js.map