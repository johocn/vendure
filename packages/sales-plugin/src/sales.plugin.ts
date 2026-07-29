// e:\code\vendure\packages\sales-plugin\src\sales.plugin.ts
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { salesPermissionDefinitions } from './constants';
import { salesCustomerCustomFields } from './config/customer-custom-fields';
import { salesOrderCustomFields } from './config/order-custom-fields';
import { salesOrderLineCustomFields } from './config/order-line-custom-fields';
import { RoleSyncService } from './role-sync';
import { SalesService } from './sales.service';
import { SalesAdminResolver } from './sales-admin.resolver';

const loggerCtx = 'SalesPlugin';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [SalesService],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                enum SalesChannel {
                    store
                    telesales
                    b2b
                }

                enum CustomerType {
                    individual
                    enterprise
                }

                input SalesOrderLineInput {
                    productVariantId: ID!
                    quantity: Int!
                    overwrittenPrice: Int
                }

                input NewCustomerInput {
                    firstName: String!
                    lastName: String!
                    emailAddress: String
                    phoneNumber: String!
                    customerType: CustomerType!
                    companyInfo: JSON
                }

                input SalesCreateOrderInput {
                    customerId: ID
                    newCustomer: NewCustomerInput
                    lines: [SalesOrderLineInput!]!
                    shippingAddress: CreateAddressInput!
                    shippingMethodId: ID!
                    salesChannel: SalesChannel!
                    note: String
                }

                type SalesReportResult {
                    totalOrders: Int!
                    totalRevenue: Int!
                    uniqueCustomers: Int!
                    avgOrderValue: Int!
                    topProducts: [SalesReportTopProduct!]!
                    dailyBreakdown: [SalesReportDaily!]!
                }

                type SalesReportTopProduct {
                    productVariantId: String!
                    name: String!
                    quantitySold: Int!
                    revenue: Int!
                }

                type SalesReportDaily {
                    date: String!
                    orderCount: Int!
                    revenue: Int!
                }

                extend type Query {
                    mySales(state: String, page: Int, pageSize: Int): [Order!]!
                    allSales(state: String, staffId: String, page: Int, pageSize: Int): [Order!]!
                    salesOrder(id: ID!): Order
                    mySalesReport(start: String!, end: String!): SalesReportResult!
                    salesReport(staffId: String, start: String!, end: String!): SalesReportResult!
                }

                extend type Mutation {
                    salesCreateOrder(input: SalesCreateOrderInput!): Order!
                    modifyOrderLinePrice(orderLineId: ID!, newPrice: Int!): Order!
                    cancelSalesOrder(orderId: ID!, reason: String): Order!
                }
            `;
        },
        resolvers: [SalesAdminResolver],
    },
    configuration: (config) => {
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...salesPermissionDefinitions,
        ];
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(salesOrderCustomFields.Order ?? []),
        ];
        config.customFields.Customer = [
            ...(config.customFields.Customer ?? []),
            ...(salesCustomerCustomFields.Customer ?? []),
        ];
        config.customFields.OrderLine = [
            ...(config.customFields.OrderLine ?? []),
            ...(salesOrderLineCustomFields.OrderLine ?? []),
        ];
        return config;
    },
    compatibility: '^3.6.0',
})
export class SalesPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof SalesPlugin => SalesPlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called, moduleRef exists: ' + !!this.moduleRef, loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new Injector(this.moduleRef);
            const roleSync = new RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        } catch (err: any) {
            Logger.error(`Bootstrap failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
