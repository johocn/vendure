// e:\code\vendure\packages\customer-service-plugin\src\customer-service.plugin.ts
import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AfterSalesPlugin } from '@vendure/after-sales-plugin';

import { csOrderCustomFields } from './config/order-custom-fields';
import { CustomerServiceAdminResolver } from './customer-service-admin.resolver';
import { CustomerServiceService } from './customer-service.service';
import { RoleSyncService } from './role-sync';

const loggerCtx = 'CustomerServicePlugin';

const { gql } = require('graphql-tag');

@VendurePlugin({
    imports: [PluginCommonModule, AfterSalesPlugin],
    providers: [CustomerServiceService],
    adminApiExtensions: {
        schema: () => gql`
            type CsOrderList {
                items: [Order!]!
                totalItems: Int!
            }

            type CsExceptionInfo {
                deliveryStatus: String!
                exceptionType: String
                exceptionNote: String
                exceptionPhotos: [String!]
                deliveryStaffId: String
            }

            type CsOrderDetail {
                order: Order!
                afterSalesRequests: [AfterSalesRequestAdmin!]!
                exceptionInfo: CsExceptionInfo
            }

            type CsAfterSalesList {
                items: [AfterSalesRequestAdmin!]!
                totalItems: Int!
            }

            type CsExceptionOrderList {
                items: [CsExceptionOrder!]!
                totalItems: Int!
            }

            type CsNote {
                content: String!
                createdBy: String!
                createdAt: DateTime!
            }

            type CsExceptionOrder {
                order: Order!
                exceptionInfo: CsExceptionInfo!
                csNotes: [CsNote!]!
            }

            extend type Query {
                csAllOrders(
                    state: String
                    customerEmail: String
                    startDate: String
                    endDate: String
                    page: Int
                    pageSize: Int
                ): CsOrderList!
                csOrderDetail(id: ID!): CsOrderDetail
                csAfterSalesRequests(state: String, page: Int, pageSize: Int): CsAfterSalesList!
                csAfterSalesRequestDetail(id: ID!): AfterSalesRequestAdmin
                csExceptionOrders(exceptionType: String, page: Int, pageSize: Int): CsExceptionOrderList!
            }

            extend type Mutation {
                csApproveAfterSales(id: ID!): AfterSalesRequestAdmin!
                csRejectAfterSales(id: ID!, reason: String!): AfterSalesRequestAdmin!
                csConfirmReturnReceived(id: ID!): AfterSalesRequestAdmin!
                csProcessRefund(id: ID!): AfterSalesRequestAdmin!
                csAddExceptionNote(orderId: ID!, note: String!): CsExceptionOrder!
            }
        `,
        resolvers: [CustomerServiceAdminResolver],
    },
    configuration: (config) => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(csOrderCustomFields.Order ?? []),
        ];
        return config;
    },
    compatibility: '^3.6.0',
})
export class CustomerServicePlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof CustomerServicePlugin => CustomerServicePlugin;

    async onApplicationBootstrap(): Promise<void> {
        Logger.info('onApplicationBootstrap called', loggerCtx);
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
