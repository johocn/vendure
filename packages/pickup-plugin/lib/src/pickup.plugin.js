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
var PickupPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PickupPlugin = void 0;
const core_1 = require("@vendure/core");
const operators_1 = require("rxjs/operators");
const constants_1 = require("./constants");
const pickup_redemption_entity_1 = require("./pickup-redemption.entity");
const pickup_service_1 = require("./pickup.service");
const pickup_customer_resolver_1 = require("./pickup-customer.resolver");
const pickup_owner_resolver_1 = require("./pickup-owner.resolver");
const pickup_admin_resolver_1 = require("./pickup-admin.resolver");
const { gql } = require('graphql-tag');
const adminSchema = gql `
    type PickupRedemption {
        id: ID!
        orderId: ID!
        orderCode: String
        code: String!
        status: String!
        claimedAt: DateTime
        claimChannel: String
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
        claimPickupByShop(code: String!): PickupRedemption!
    }
    `;
const shopSchema = gql `
    extend type Query {
        myPickupCode(orderId: ID!): PickupRedemption!
    }
    extend type Mutation {
        claimMyPickup(orderId: ID!, code: String!): PickupRedemption!
    }
    `;
let PickupPlugin = PickupPlugin_1 = class PickupPlugin {
    constructor(service, eventBus) {
        this.service = service;
        this.eventBus = eventBus;
    }
    static init(options) {
        return { module: PickupPlugin_1, providers: [{ provide: constants_1.PICKUP_PLUGIN_OPTIONS, useValue: options }] };
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
    }
};
exports.PickupPlugin = PickupPlugin;
exports.PickupPlugin = PickupPlugin = PickupPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        providers: [pickup_service_1.PickupService],
        entities: [pickup_redemption_entity_1.PickupRedemption],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [pickup_owner_resolver_1.PickupOwnerResolver, pickup_admin_resolver_1.PickupAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [pickup_customer_resolver_1.PickupCustomerResolver],
        },
    }),
    __metadata("design:paramtypes", [pickup_service_1.PickupService, core_1.EventBus])
], PickupPlugin);
//# sourceMappingURL=pickup.plugin.js.map