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
var CustomerServicePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerServicePlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const after_sales_plugin_1 = require("@vendure/after-sales-plugin");
const order_custom_fields_1 = require("./config/order-custom-fields");
const customer_service_admin_resolver_1 = require("./customer-service-admin.resolver");
const customer_service_service_1 = require("./customer-service.service");
const role_sync_1 = require("./role-sync");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const loggerCtx = 'CustomerServicePlugin';
const { gql } = require('graphql-tag');
let CustomerServicePlugin = CustomerServicePlugin_1 = class CustomerServicePlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    async onApplicationBootstrap() {
        var _a;
        core_2.Logger.info('onApplicationBootstrap called', loggerCtx);
        if (!this.moduleRef) {
            return;
        }
        try {
            const injector = new core_2.Injector(this.moduleRef);
            const roleSync = new role_sync_1.RoleSyncService();
            roleSync.init(injector);
            await roleSync.syncRoles();
        }
        catch (err) {
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, loggerCtx);
        }
    }
};
exports.CustomerServicePlugin = CustomerServicePlugin;
CustomerServicePlugin.init = () => CustomerServicePlugin_1;
exports.CustomerServicePlugin = CustomerServicePlugin = CustomerServicePlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule, after_sales_plugin_1.AfterSalesPlugin],
        providers: [customer_service_service_1.CustomerServiceService],
        adminApiExtensions: {
            schema: () => gql `
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
            resolvers: [customer_service_admin_resolver_1.CustomerServiceAdminResolver],
        },
        configuration: (config) => {
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.csOrderCustomFields.Order);
            return config;
        },
        compatibility: '^3.6.0',
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], CustomerServicePlugin);
