"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockEmailAddressChangeEvent = exports.mockPasswordResetEvent = exports.mockAccountRegistrationEvent = exports.mockOrderStateTransitionEvent = void 0;
const generated_shop_types_1 = require("@vendure/common/lib/generated-shop-types");
const core_1 = require("@vendure/core");
exports.mockOrderStateTransitionEvent = new core_1.OrderStateTransitionEvent('ArrangingPayment', 'PaymentSettled', {}, new core_1.Order({
    id: '6',
    currencyCode: core_1.CurrencyCode.USD,
    createdAt: '2018-10-31T11:18:29.261Z',
    updatedAt: '2018-10-31T15:24:17.000Z',
    orderPlacedAt: '2018-10-31T13:54:17.000Z',
    code: 'T3EPGJKTVZPBD6Z9',
    state: 'ArrangingPayment',
    active: true,
    customer: new core_1.Customer({
        id: '3',
        firstName: 'Test',
        lastName: 'Customer',
        emailAddress: 'test@test.com',
    }),
    lines: [
        new core_1.OrderLine({
            id: '5',
            featuredAsset: {
                preview: '/mailbox/placeholder-image',
            },
            productVariant: new core_1.ProductVariant({
                id: '2',
                name: 'Curvy Monitor 24 inch',
                sku: 'C24F390',
            }),
            quantity: 1,
            listPrice: 14374,
            listPriceIncludesTax: true,
            adjustments: [
                {
                    adjustmentSource: 'Promotion:1',
                    type: generated_shop_types_1.AdjustmentType.PROMOTION,
                    amount: -1000,
                    description: '$10 off computer equipment',
                },
            ],
            taxLines: [],
        }),
        new core_1.OrderLine({
            id: '6',
            featuredAsset: {
                preview: '/mailbox/placeholder-image',
            },
            productVariant: new core_1.ProductVariant({
                id: '4',
                name: 'Hard Drive 1TB',
                sku: 'IHD455T1',
            }),
            quantity: 1,
            listPrice: 3799,
            listPriceIncludesTax: true,
            adjustments: [],
            taxLines: [],
        }),
    ],
    subTotal: 15144,
    subTotalWithTax: 18173,
    shipping: 1000,
    shippingLines: [
        new core_1.ShippingLine({
            listPrice: 1000,
            listPriceIncludesTax: true,
            taxLines: [{ taxRate: 20, description: 'shipping tax' }],
            shippingMethod: {
                code: 'express-flat-rate',
                name: 'Express Shipping',
                description: 'Express Shipping',
                id: '2',
            },
        }),
    ],
    surcharges: [],
    shippingAddress: {
        fullName: 'Test Customer',
        company: '',
        streetLine1: '6000 Pagac Land',
        streetLine2: '',
        city: 'Port Kirsten',
        province: 'Avon',
        postalCode: 'ZU32 9CP',
        country: 'Cabo Verde',
        phoneNumber: '',
    },
    payments: [],
}));
exports.mockAccountRegistrationEvent = new core_1.AccountRegistrationEvent({}, new core_1.User({
    verified: false,
    authenticationMethods: [
        new core_1.NativeAuthenticationMethod({
            identifier: 'test@test.com',
            verificationToken: 'MjAxOC0xMS0xM1QxNToxNToxNC42ODda_US2U6UK1WZC7NDAX',
        }),
    ],
    identifier: 'test@test.com',
}));
exports.mockPasswordResetEvent = new core_1.PasswordResetEvent({}, new core_1.User({
    identifier: 'test@test.com',
    authenticationMethods: [
        new core_1.NativeAuthenticationMethod({
            passwordResetToken: 'MjAxOS0wNC0xNVQxMzozMDozOC43MjFa_MA2FR6HRZBW7JWD6',
        }),
    ],
}));
exports.mockEmailAddressChangeEvent = new core_1.IdentifierChangeRequestEvent({}, new core_1.User({
    identifier: 'old-address@test.com',
    authenticationMethods: [
        new core_1.NativeAuthenticationMethod({
            pendingIdentifier: 'new-address@test.com',
            identifierChangeToken: 'MjAxOS0wNC0xNVQxMzozMDozOC43MjFa_MA2FR6HRZBW7JWD6',
        }),
    ],
}));
//# sourceMappingURL=mock-events.js.map