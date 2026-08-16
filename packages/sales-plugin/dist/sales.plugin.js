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
var SalesPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const customer_custom_fields_1 = require("./config/customer-custom-fields");
const order_custom_fields_1 = require("./config/order-custom-fields");
const order_line_custom_fields_1 = require("./config/order-line-custom-fields");
const role_sync_1 = require("./role-sync");
const sales_service_1 = require("./sales.service");
const sales_admin_resolver_1 = require("./sales-admin.resolver");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations multiple times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const loggerCtx = 'SalesPlugin';
let SalesPlugin = SalesPlugin_1 = class SalesPlugin {
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
        }
        catch (err) {
            core_2.Logger.error(`Bootstrap failed: ${(_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err}`, loggerCtx);
        }
    }
};
exports.SalesPlugin = SalesPlugin;
SalesPlugin.init = () => SalesPlugin_1;
exports.SalesPlugin = SalesPlugin = SalesPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [sales_service_1.SalesService],
        adminApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
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
            resolvers: [sales_admin_resolver_1.SalesAdminResolver],
        },
        configuration: (config) => {
            var _a;
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...constants_1.salesPermissionDefinitions,
            ];
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.salesOrderCustomFields.Order);
            config.customFields.Customer = mergeCustomFields(config.customFields.Customer, customer_custom_fields_1.salesCustomerCustomFields.Customer);
            config.customFields.OrderLine = mergeCustomFields(config.customFields.OrderLine, order_line_custom_fields_1.salesOrderLineCustomFields.OrderLine);
            return config;
        },
        compatibility: '^3.6.0',
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], SalesPlugin);
