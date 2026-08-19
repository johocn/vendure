import { FulfillmentHandler, Injector, LanguageCode, TransactionalConnection } from '@vendure/core';
import { PickupLocationService } from './pickup-location.service';
import { EmployeeCustomerService } from './enterprise-customer/enterprise-customer.service';
import { translateError } from './i18n-messages';

export const storePickupFulfillmentHandler = new FulfillmentHandler({
    code: 'store-pickup',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '门店自提' },
        { languageCode: LanguageCode.en, value: 'Store Pickup' },
    ],
    args: {
        storeId: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '门店编号' },
                { languageCode: LanguageCode.en, value: 'Store ID' },
            ],
        },
        storeName: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '门店名称' },
                { languageCode: LanguageCode.en, value: 'Store Name' },
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

export const pickupPointFulfillmentHandler = new FulfillmentHandler({
    code: 'pickup-point',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '自提点自提' },
        { languageCode: LanguageCode.en, value: 'Pickup Point' },
    ],
    args: {
        pointId: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点编号' },
                { languageCode: LanguageCode.en, value: 'Pickup Point ID' },
            ],
        },
        pointName: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点名称' },
                { languageCode: LanguageCode.en, value: 'Pickup Point Name' },
            ],
        },
        pointAddress: {
            type: 'string',
            label: [
                { languageCode: LanguageCode.zh_Hans, value: '自提点地址' },
                { languageCode: LanguageCode.en, value: 'Pickup Point Address' },
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

let pickupLocationService: PickupLocationService;
let employeeCustomerService: EmployeeCustomerService;
let connection: TransactionalConnection;

const methodLabels: Partial<Record<LanguageCode, string>> = {
    [LanguageCode.zh_Hans]: '企业职工自提',
    [LanguageCode.en]: 'Employee Pickup',
    [LanguageCode.ja]: '従業員受取',
    [LanguageCode.ko]: '직원 수거',
};

export const employeePickupFulfillmentHandler = new FulfillmentHandler({
    code: 'employee-pickup',
    description: [
        { languageCode: LanguageCode.zh_Hans, value: '企业职工自提' },
        { languageCode: LanguageCode.en, value: 'Employee Pickup' },
        { languageCode: LanguageCode.ja, value: '従業員受取' },
        { languageCode: LanguageCode.ko, value: '직원 수거' },
    ],
    args: {},
    init: (injector: Injector) => {
        pickupLocationService = injector.get(PickupLocationService);
        employeeCustomerService = injector.get(EmployeeCustomerService);
        connection = injector.get(TransactionalConnection);
    },
    createFulfillment: async (ctx, orders, lines, args) => {
        const order = orders[0];
        // relation 自定义字段（selectedPickupLocationId）不随 Order 实体加载（未设 eager），
        // 用 QueryBuilder 关联查询读取 FK 值（与 CustomFieldRelationResolverService 同法，跨库通用）
        const row = await connection
            .getRepository(ctx, order.constructor as any)
            .createQueryBuilder('o')
            .leftJoin('o.customFields.selectedPickupLocationId', 'pl')
            .select('pl.id', 'pickupLocationId')
            .where('o.id = :id', { id: order.id })
            .getRawOne();
        const locationId = row?.pickupLocationId;
        if (!locationId) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_SELECTED'));

        const location = await pickupLocationService.findOne(ctx, locationId);
        if (!location) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_VISIBLE'));

        const mode = (ctx.channel as any).customFields.employeePickupMode;
        if (mode === 'strict') {
            if (!order.customer) throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            const bindings = await employeeCustomerService.findByCustomer(ctx, order.customer.id);
            const allowed = bindings.flatMap(b => b.pickupLocations.map(l => l.id));
            if (!allowed.includes(locationId)) {
                throw new Error(translateError(ctx, 'PICKUP_LOCATION_NOT_BOUND'));
            }
        }

        return {
            method: `${methodLabels[ctx.languageCode] || methodLabels[LanguageCode.en]} - ${location.name}`,
            trackingCode: `PICKUP-EMP-${location.id}`,
        };
    },
});
