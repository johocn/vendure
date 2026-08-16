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
var DeliveryPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const address_custom_fields_1 = require("./config/address-custom-fields");
const order_custom_fields_1 = require("./config/order-custom-fields");
const delivery_admin_resolver_1 = require("./delivery-admin.resolver");
const delivery_events_1 = require("./delivery-events");
const delivery_service_1 = require("./delivery.service");
const constants_1 = require("./constants");
const permission_admin_resolver_1 = require("./permission-admin.resolver");
const role_sync_1 = require("./role-sync");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const loggerCtx = 'DeliveryPlugin';
let DeliveryPlugin = DeliveryPlugin_1 = class DeliveryPlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    async onApplicationBootstrap() {
        var _a;
        core_2.Logger.info('onApplicationBootstrap called, moduleRef exists: ' + !!this.moduleRef, loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new core_2.Injector(this.moduleRef);
            const roleSync = new role_sync_1.RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
            // 注册自动派单事件订阅（订单进入 PaymentSettled 时触发）
            const eventSubscriber = new delivery_events_1.DeliveryEventSubscriber();
            eventSubscriber.init(injector);
        }
        catch (err) {
            // 同步失败不阻塞 bootstrap，仅记录日志，便于后续手动排查
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, loggerCtx);
        }
    }
};
exports.DeliveryPlugin = DeliveryPlugin;
DeliveryPlugin.init = () => DeliveryPlugin_1;
exports.DeliveryPlugin = DeliveryPlugin = DeliveryPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [delivery_service_1.DeliveryService],
        adminApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
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
                    reportException(orderId: ID!, type: String!, photos: [String!]!, note: String): Order!
                    reassignDelivery(orderId: ID!, newStaffId: ID!): Order!
                }
            `;
            },
            resolvers: [permission_admin_resolver_1.PermissionAdminResolver, delivery_admin_resolver_1.DeliveryAdminResolver],
        },
        configuration: (config) => {
            var _a;
            // 注册自定义 Permission
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...constants_1.deliveryPermissionDefinitions,
            ];
            // 扩展 Order customFields
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.deliveryOrderCustomFields.Order);
            // 扩展 Address customFields
            config.customFields.Address = mergeCustomFields(config.customFields.Address, address_custom_fields_1.deliveryAddressCustomFields.Address);
            return config;
        },
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], DeliveryPlugin);
