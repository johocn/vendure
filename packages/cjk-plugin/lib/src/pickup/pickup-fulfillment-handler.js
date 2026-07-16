"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeePickupFulfillmentHandler = exports.pickupPointFulfillmentHandler = exports.storePickupFulfillmentHandler = void 0;
const core_1 = require("@vendure/core");
const pickup_location_service_1 = require("./pickup-location.service");
const enterprise_customer_service_1 = require("./enterprise-customer/enterprise-customer.service");
const i18n_messages_1 = require("./i18n-messages");
exports.storePickupFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'store-pickup',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '门店自提' },
        { languageCode: core_1.LanguageCode.en, value: 'Store Pickup' },
    ],
    args: {
        storeId: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '门店编号' },
                { languageCode: core_1.LanguageCode.en, value: 'Store ID' },
            ],
        },
        storeName: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '门店名称' },
                { languageCode: core_1.LanguageCode.en, value: 'Store Name' },
            ],
        },
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        return {
            method: `门店自提 - ${args.storeName || args.storeId}`,
            trackingCode: `PICKUP-STORE-${args.storeId}`,
        };
    },
});
exports.pickupPointFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'pickup-point',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点自提' },
        { languageCode: core_1.LanguageCode.en, value: 'Pickup Point' },
    ],
    args: {
        pointId: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点编号' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point ID' },
            ],
        },
        pointName: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点名称' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Name' },
            ],
        },
        pointAddress: {
            type: 'string',
            label: [
                { languageCode: core_1.LanguageCode.zh_Hans, value: '自提点地址' },
                { languageCode: core_1.LanguageCode.en, value: 'Pickup Point Address' },
            ],
        },
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        return {
            method: `自提点自提 - ${args.pointName || args.pointId}`,
            trackingCode: `PICKUP-POINT-${args.pointId}`,
        };
    },
});
let pickupLocationService;
let employeeCustomerService;
const methodLabels = {
    [core_1.LanguageCode.zh_Hans]: '企业职工自提',
    [core_1.LanguageCode.en]: 'Employee Pickup',
    [core_1.LanguageCode.ja]: '従業員受取',
    [core_1.LanguageCode.ko]: '직원 수거',
};
exports.employeePickupFulfillmentHandler = new core_1.FulfillmentHandler({
    code: 'employee-pickup',
    description: [
        { languageCode: core_1.LanguageCode.zh_Hans, value: '企业职工自提' },
        { languageCode: core_1.LanguageCode.en, value: 'Employee Pickup' },
        { languageCode: core_1.LanguageCode.ja, value: '従業員受取' },
        { languageCode: core_1.LanguageCode.ko, value: '직원 수거' },
    ],
    args: {},
    init: (injector) => {
        pickupLocationService = injector.get(pickup_location_service_1.PickupLocationService);
        employeeCustomerService = injector.get(enterprise_customer_service_1.EmployeeCustomerService);
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        const order = orders[0];
        const locationId = order.customFields.selectedPickupLocationId;
        if (!locationId)
            throw new Error((0, i18n_messages_1.translateError)(ctx, 'PICKUP_LOCATION_NOT_SELECTED'));
        const location = await pickupLocationService.findOne(ctx, locationId);
        if (!location)
            throw new Error((0, i18n_messages_1.translateError)(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));
        const mode = ctx.channel.customFields.employeePickupMode;
        if (mode === 'strict') {
            if (!order.customer)
                throw new Error((0, i18n_messages_1.translateError)(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            const bindings = await employeeCustomerService.findByCustomer(ctx, order.customer.id);
            const allowed = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
            if (!allowed.includes(locationId)) {
                throw new Error((0, i18n_messages_1.translateError)(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            }
        }
        return {
            method: `${methodLabels[ctx.languageCode] || methodLabels[core_1.LanguageCode.en]} - ${location.name}`,
            trackingCode: `PICKUP-EMP-${location.id}`,
        };
    },
});
//# sourceMappingURL=pickup-fulfillment-handler.js.map