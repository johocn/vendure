import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { CustomFields, EventBus, OrderStateTransitionEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { filter } from 'rxjs/operators';

import { PICKUP_PLUGIN_OPTIONS, PickupPluginOptions } from './constants';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';
import { PickupCustomerResolver } from './pickup-customer.resolver';
import { PickupOwnerResolver } from './pickup-owner.resolver';
import { PickupAdminResolver } from './pickup-admin.resolver';
import { PickupGuestOrderResolver } from './pickup-guest-order.resolver';

const { gql } = require('graphql-tag');

/** 自提闭环所需的 Order 自定义字段（自含，避免依赖外部插件装配顺序）。 */
const pickupOrderCustomFields: CustomFields = {
    Order: [
        { name: 'deliveryType', type: 'string', nullable: true, defaultValue: 'delivery', public: true },
        { name: 'pickupClaimed', type: 'boolean', nullable: true, public: true },
        { name: 'collected', type: 'boolean', nullable: true, public: true },
        { name: 'paymentType', type: 'string', nullable: true, public: true },
    ],
};

/** 幂等合并 Order 自定义字段（avoid duplicate definition on re-run). */
function mergeOrderCustomFields(
    existing: { name: string }[] | undefined,
    additions: { name: string }[] | undefined,
): { name: string }[] {
    const names = new Set((existing ?? []).map(f => f.name));
    return [...(existing ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const adminSchema = gql`
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

const shopSchema = gql`
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

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        { provide: PICKUP_PLUGIN_OPTIONS, useFactory: () => PickupPlugin.options },
        PickupService,
    ],
    entities: [PickupRedemption],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [PickupOwnerResolver, PickupAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [PickupCustomerResolver, PickupGuestOrderResolver],
    },
    configuration: (config) => {
        // 注册 Order 自定义字段：deliveryType（履约方式）+ pickupClaimed（自提已核销）
        config.customFields.Order = mergeOrderCustomFields(
            config.customFields.Order,
            pickupOrderCustomFields.Order,
        ) as any;
        return config;
    },
})
export class PickupPlugin implements OnApplicationBootstrap {
    private static options: PickupPluginOptions = {};

    constructor(
        @Inject(PICKUP_PLUGIN_OPTIONS) private options: PickupPluginOptions,
        private service: PickupService,
        private eventBus: EventBus,
    ) {}

    static init(options?: PickupPluginOptions): Type<PickupPlugin> {
        PickupPlugin.options = options ?? {};
        return PickupPlugin;
    }

    onApplicationBootstrap(): void {
        this.eventBus
            .ofType(OrderStateTransitionEvent)
            .pipe(
                filter(event => event.toState === 'Cancelled'),
            )
            .subscribe(event => {
                const orderId = (event.ctx as any)?.orderId ?? event.order?.id;
                if (orderId != null) {
                    this.service.onOrderCancelled(Number(orderId)).catch(err =>
                        console.error(err?.message ?? err, 'pickup-plugin'),
                    );
                }
            });

        this.eventBus
            .ofType(OrderStateTransitionEvent)
            .pipe(
                filter(event => !['AddingItems', 'ArrangingPayment', 'Draft', 'Cancelled', 'PaymentAuthorized'].includes(event.toState)),
            )
            .subscribe(event => {
                const orderId = (event.ctx as any)?.orderId ?? event.order?.id;
                if (orderId != null) {
                    this.service.ensurePickupRedemptionForOrder(event.ctx, orderId).catch(err =>
                        console.error(err?.message ?? err, 'pickup-plugin auto-redeem'),
                    );
                }
            });
    }
}