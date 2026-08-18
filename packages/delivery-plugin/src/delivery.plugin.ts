import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { deliveryAddressCustomFields } from './config/address-custom-fields';
import { deliveryOrderCustomFields } from './config/order-custom-fields';
import { DeliveryAdminResolver } from './delivery-admin.resolver';
import { DeliveryEventSubscriber } from './delivery-events';
import { DeliveryService } from './delivery.service';
import { deliveryPermissionDefinitions } from './constants';
import { PermissionAdminResolver } from './permission-admin.resolver';
import { RoleSyncService } from './role-sync';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const loggerCtx = 'DeliveryPlugin';

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [DeliveryService],
    adminApiExtensions: {
        schema: () => {
            const { gql } = require('graphql-tag');
            return gql`
                type PermissionModule {
                    code: String!
                    name: String!
                    enabled: Boolean!
                    entryPath: String!
                    icon: String!
                    sort: Int!
                }

                type MyPermissionsResult {
                    roles: [String!]!
                    permissions: [String!]!
                    visibleModules: [PermissionModule!]!
                }

                extend type Query {
                    myPermissions: MyPermissionsResult!
                    myDeliveries(status: String): [Order!]!
                    allDeliveries(status: String): [Order!]!
                }

                extend type Mutation {
                    startDelivery(orderId: ID!): Order!
                    markDelivered(orderId: ID!, photos: [String!]!, note: String): Order!
                    confirmPickupHandover(orderId: ID!): Order!
                    reportException(orderId: ID!, type: String!, photos: [String!]!, note: String): Order!
                    reassignDelivery(orderId: ID!, newStaffId: ID!): Order!
                }
            `;
        },
        resolvers: [PermissionAdminResolver, DeliveryAdminResolver],
    },
    configuration: (config) => {
        // 注册自定义 Permission
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...deliveryPermissionDefinitions,
        ];
        // 扩展 Order customFields
        config.customFields.Order = mergeCustomFields(config.customFields.Order, deliveryOrderCustomFields.Order);
        // 扩展 Address customFields
        config.customFields.Address = mergeCustomFields(config.customFields.Address, deliveryAddressCustomFields.Address);
        return config;
    },
})
export class DeliveryPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = (): typeof DeliveryPlugin => DeliveryPlugin;

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

            // 注册自动派单事件订阅（订单进入 PaymentSettled 时触发）
            const eventSubscriber = new DeliveryEventSubscriber();
            eventSubscriber.init(injector);
        } catch (err: any) {
            // 同步失败不阻塞 bootstrap，仅记录日志，便于后续手动排查
            Logger.error(`Bootstrap failed: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
