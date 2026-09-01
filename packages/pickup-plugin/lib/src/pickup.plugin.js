"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PickupPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const operators_1 = require("rxjs/operators");
const constants_1 = require("./constants");
const pickup_redemption_entity_1 = require("./pickup-redemption.entity");
const pickup_service_1 = require("./pickup.service");
const pickup_customer_resolver_1 = require("./pickup-customer.resolver");
const pickup_owner_resolver_1 = require("./pickup-owner.resolver");
const pickup_admin_resolver_1 = require("./pickup-admin.resolver");
const pickup_guest_order_resolver_1 = require("./pickup-guest-order.resolver");
const { gql } = require('graphql-tag');
/** 自提闭环所需的 Order 自定义字段（自含，避免依赖外部插件装配顺序）。 */
const pickupOrderCustomFields = {
    Order: [
        { name: 'deliveryType', type: 'string', nullable: true, defaultValue: 'delivery', public: true },
        { name: 'pickupClaimed', type: 'boolean', nullable: true, public: true },
        { name: 'collected', type: 'boolean', nullable: true, public: true },
        { name: 'paymentType', type: 'string', nullable: true, public: true },
    ],
};
/** 幂等合并 Order 自定义字段（avoid duplicate definition on re-run). */
function mergeOrderCustomFields(existing, additions) {
    const names = new Set((existing !== null && existing !== void 0 ? existing : []).map(f => f.name));
    return [...(existing !== null && existing !== void 0 ? existing : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const adminSchema = gql `
    type PickupRedemption {
        id: ID!
        orderId: ID!
        orderCode: String
        code: String!
        status: String!
        claimedAt: DateTime
        claimChannel: String
        paymentType: String
        collected: Boolean!
    }
    type PickupRedemptionList {
        items: [PickupRedemption!]!
        totalItems: Int!
    }
    input PickupListOptions {
        skip: Int
        take: Int
    }
    extend type Query {
        myPickupOrders(options: PickupListOptions): PickupRedemptionList!
        pickupRedemptions(options: PickupListOptions): PickupRedemptionList!
    }
    extend type Mutation {
        claimPickupByShop(code: String!, collect: Boolean): PickupRedemption!
    }
    `;
const shopSchema = gql `
    type PickupRedemption {
        id: ID!
        orderId: ID!
        orderCode: String
        code: String!
        status: String!
        claimedAt: DateTime
        claimChannel: String
        paymentType: String
        collected: Boolean!
    }
    extend type Query {
        myPickupCode(orderId: ID!): PickupRedemption!
    }
    extend type Mutation {
        claimMyPickup(orderId: ID!, code: String!): PickupRedemption!
    }
    type GuestOrderOverview {
        orderCode: String!
        orderPlacedAt: DateTime
        state: String!
        currencyCode: String!
        totalQuantity: Int!
        subTotal: Int!
        shippingWithTax: Int!
        totalWithTax: Int!
        isPickup: Boolean!
        pickupClaimed: Boolean!
        paymentType: String
        collected: Boolean!
        pickupCode: String
        pickupClaimable: Boolean!
        pickupLocation: GuestPickupLocation
        lines: [GuestOrderLine!]!
        hasPhone: Boolean!
    }
    type GuestPickupLocation {
        name: String!
        address: String!
        businessHours: String
    }
    type GuestOrderLine {
        productName: String!
        sku: String!
        quantity: Int!
        linePriceWithTax: Int!
    }
    input GuestOrderLookupInput {
        orderCode: String!
        phone: String
    }
    input GuestSetOrderCustomFieldsInput {
        orderCode: String!
        phone: String!
        name: String
    }
    extend type Query {
        guestOrderLookup(input: GuestOrderLookupInput!): GuestOrderOverview!
    }
    extend type Mutation {
        guestSetOrderCustomFields(input: GuestSetOrderCustomFieldsInput!): GuestOrderOverview!
    }
    `;
let PickupPlugin = PickupPlugin_1 = class PickupPlugin {
    constructor(options, service, eventBus) {
        this.options = options;
        this.service = service;
        this.eventBus = eventBus;
    }
    static init(options) {
        PickupPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return PickupPlugin_1;
    }
    onApplicationBootstrap() {
        this.eventBus
            .ofType(core_1.OrderStateTransitionEvent)
            .pipe((0, operators_1.filter)(event => event.toState === 'Cancelled'))
            .subscribe(event => {
            var _a, _b, _c;
            const orderId = (_b = (_a = event.ctx) === null || _a === void 0 ? void 0 : _a.orderId) !== null && _b !== void 0 ? _b : (_c = event.order) === null || _c === void 0 ? void 0 : _c.id;
            if (orderId != null) {
                this.service.onOrderCancelled(Number(orderId)).catch(err => { var _a; return console.error((_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err, 'pickup-plugin'); });
            }
        });
        this.eventBus
            .ofType(core_1.OrderStateTransitionEvent)
            .pipe((0, operators_1.filter)(event => !['AddingItems', 'ArrangingPayment', 'Draft', 'Cancelled', 'PaymentAuthorized'].includes(event.toState)))
            .subscribe(event => {
            var _a, _b, _c;
            const orderId = (_b = (_a = event.ctx) === null || _a === void 0 ? void 0 : _a.orderId) !== null && _b !== void 0 ? _b : (_c = event.order) === null || _c === void 0 ? void 0 : _c.id;
            if (orderId != null) {
                this.service.ensurePickupRedemptionForOrder(event.ctx, orderId).catch(err => { var _a; return console.error((_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err, 'pickup-plugin auto-redeem'); });
            }
        });
    }
};
exports.PickupPlugin = PickupPlugin;
PickupPlugin.options = {};
exports.PickupPlugin = PickupPlugin = PickupPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [
            { provide: constants_1.PICKUP_PLUGIN_OPTIONS, useFactory: () => PickupPlugin.options },
            pickup_service_1.PickupService,
        ],
        entities: [pickup_redemption_entity_1.PickupRedemption],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [pickup_owner_resolver_1.PickupOwnerResolver, pickup_admin_resolver_1.PickupAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [pickup_customer_resolver_1.PickupCustomerResolver, pickup_guest_order_resolver_1.PickupGuestOrderResolver],
        },
        configuration: (config) => {
            // 注册 Order 自定义字段：deliveryType（履约方式）+ pickupClaimed（自提已核销）
            config.customFields.Order = mergeOrderCustomFields(config.customFields.Order, pickupOrderCustomFields.Order);
            return config;
        },
    }),
    __param(0, (0, common_1.Inject)(constants_1.PICKUP_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, pickup_service_1.PickupService,
        core_1.EventBus])
], PickupPlugin);
//# sourceMappingURL=pickup.plugin.js.map