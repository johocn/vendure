import { DynamicModule, OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, OrderStateTransitionEvent, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { filter } from 'rxjs/operators';

import { PICKUP_PLUGIN_OPTIONS, PickupPluginOptions } from './constants';
import { PickupRedemption } from './pickup-redemption.entity';
import { PickupService } from './pickup.service';
import { PickupCustomerResolver } from './pickup-customer.resolver';
import { PickupOwnerResolver } from './pickup-owner.resolver';
import { PickupAdminResolver } from './pickup-admin.resolver';

const { gql } = require('graphql-tag');

const adminSchema = gql`
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

const shopSchema = gql`
    extend type Query {
        myPickupCode(orderId: ID!): PickupRedemption!
    }
    extend type Mutation {
        claimMyPickup(orderId: ID!, code: String!): PickupRedemption!
    }
    `;

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [PickupService],
    entities: [PickupRedemption],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [PickupOwnerResolver, PickupAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [PickupCustomerResolver],
    },
})
export class PickupPlugin implements OnApplicationBootstrap {
    constructor(private service: PickupService, private eventBus: EventBus) {}

    static init(options: PickupPluginOptions): DynamicModule {
        return { module: PickupPlugin, providers: [{ provide: PICKUP_PLUGIN_OPTIONS, useValue: options }] };
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
    }
}