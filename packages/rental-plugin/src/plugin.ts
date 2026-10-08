import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { RENTAL_PLUGIN_OPTIONS } from './constants';
import { RentalPlan } from './rental-plan.entity';
import { RentalAdminResolver } from './rental-admin.resolver';
import { RentalService } from './rental.service';
import { RentalPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [RentalPlan],
    providers: [
        { provide: RENTAL_PLUGIN_OPTIONS, useFactory: () => RentalPlugin.options },
        RentalService,
    ],
    exports: [RentalService],
    adminApiExtensions: {
        schema: () => gql`
            type RentalPlan implements Node {
                id: ID!
                name: String!
                variantId: ID!
                depositAmount: Int!
                rentAmount: Int!
                rentUnit: String!
                prepaidOrPostpaid: String!
                buyoutPrice: Int
                allowBuyout: Boolean!
                allowCod: Boolean!
                enabled: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type RentalPlanList implements PaginatedList {
                items: [RentalPlan!]!
                totalItems: Int!
            }

            input CreateRentalPlanInput {
                name: String!
                variantId: ID!
                depositAmount: Int!
                rentAmount: Int!
                rentUnit: String
                prepaidOrPostpaid: String
                buyoutPrice: Int
                allowBuyout: Boolean
                allowCod: Boolean
                enabled: Boolean
            }

            input UpdateRentalPlanInput {
                id: ID!
                name: String
                depositAmount: Int
                rentAmount: Int
                rentUnit: String
                prepaidOrPostpaid: String
                buyoutPrice: Int
                allowBuyout: Boolean
                allowCod: Boolean
                enabled: Boolean
            }

            input RentalPlanListOptions

            extend type Query {
                rentalPlans(options: RentalPlanListOptions): RentalPlanList!
                rentalPlan(id: ID!): RentalPlan
            }

            extend type Mutation {
                createRentalPlan(input: CreateRentalPlanInput!): RentalPlan!
                updateRentalPlan(input: UpdateRentalPlanInput!): RentalPlan!
                deleteRentalPlan(id: ID!): Boolean!
            }
        `,
        resolvers: [RentalAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class RentalPlugin {
    private static options: RentalPluginOptions = {};

    static init(options?: RentalPluginOptions): Type<RentalPlugin> {
        RentalPlugin.options = options ?? {};
        return RentalPlugin;
    }
}
