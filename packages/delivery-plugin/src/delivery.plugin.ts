import { OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';

import { deliveryAddressCustomFields } from './config/address-custom-fields';
import { deliveryOrderCustomFields } from './config/order-custom-fields';
import { deliveryPermissionDefinitions } from './constants';
import { PermissionAdminResolver } from './permission-admin.resolver';
import { RoleSyncService } from './role-sync';

const loggerCtx = 'DeliveryPlugin';

@VendurePlugin({
    imports: [PluginCommonModule],
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
                }
            `;
        },
        resolvers: [PermissionAdminResolver],
    },
    configuration: (config) => {
        // 注册自定义 Permission
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...deliveryPermissionDefinitions,
        ];
        // 扩展 Order customFields
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(deliveryOrderCustomFields.Order ?? []),
        ];
        // 扩展 Address customFields
        config.customFields.Address = [
            ...(config.customFields.Address ?? []),
            ...(deliveryAddressCustomFields.Address ?? []),
        ];
        return config;
    },
})
export class DeliveryPlugin implements OnApplicationBootstrap {
    constructor(private moduleRef?: ModuleRef) {}

    static init = () => new DeliveryPlugin();

    async onApplicationBootstrap(): Promise<void> {
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new Injector(this.moduleRef);
            const roleSync = new RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        } catch (err: any) {
            // 同步失败不阻塞 bootstrap，仅记录日志，便于后续手动排查
            Logger.error(`Role sync failed on bootstrap: ${err?.message ?? err}`, loggerCtx);
        }
    }
}
