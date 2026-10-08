import { Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';

import { INSTALLMENT_PLUGIN_OPTIONS } from './constants';
import { InstallmentPlan } from './installment-plan.entity';
import { InstallmentAdminResolver } from './installment-admin.resolver';
import { InstallmentService } from './installment.service';
import { InstallmentPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [InstallmentPlan],
    providers: [
        { provide: INSTALLMENT_PLUGIN_OPTIONS, useFactory: () => InstallmentPlugin.options },
        InstallmentService,
    ],
    exports: [InstallmentService],
    adminApiExtensions: {
        schema: () => gql`
            type InstallmentPlan implements Node {
                id: ID!
                name: String!
                variantId: ID!
                downPaymentRatio: Int!
                periods: Int!
                intervalUnit: String!
                intervalCount: Int!
                feeRule: JSON
                allowCod: Boolean!
                enabled: Boolean!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type InstallmentPlanList implements PaginatedList {
                items: [InstallmentPlan!]!
                totalItems: Int!
            }

            input CreateInstallmentPlanInput {
                name: String!
                variantId: ID!
                downPaymentRatio: Int
                periods: Int
                intervalUnit: String
                intervalCount: Int
                feeRule: JSON
                allowCod: Boolean
                enabled: Boolean
            }

            input UpdateInstallmentPlanInput {
                id: ID!
                name: String
                downPaymentRatio: Int
                periods: Int
                intervalUnit: String
                intervalCount: Int
                feeRule: JSON
                allowCod: Boolean
                enabled: Boolean
            }

            input InstallmentPlanListOptions

            extend type Query {
                installmentPlans(options: InstallmentPlanListOptions): InstallmentPlanList!
                installmentPlan(id: ID!): InstallmentPlan
            }

            extend type Mutation {
                createInstallmentPlan(input: CreateInstallmentPlanInput!): InstallmentPlan!
                updateInstallmentPlan(input: UpdateInstallmentPlanInput!): InstallmentPlan!
                deleteInstallmentPlan(id: ID!): Boolean!
            }
        `,
        resolvers: [InstallmentAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class InstallmentPlugin {
    private static options: InstallmentPluginOptions = {};

    static init(options?: InstallmentPluginOptions): Type<InstallmentPlugin> {
        InstallmentPlugin.options = options ?? {};
        return InstallmentPlugin;
    }
}
