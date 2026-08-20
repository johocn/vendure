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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AfterSalesPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfterSalesPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
const after_sales_request_entity_1 = require("./after-sales-request.entity");
const after_sales_service_1 = require("./after-sales.service");
const after_sales_shop_resolver_1 = require("./after-sales-shop.resolver");
const after_sales_admin_resolver_1 = require("./after-sales-admin.resolver");
const order_custom_fields_1 = require("./order-custom-fields");
const { gql } = require('graphql-tag');
let AfterSalesPlugin = AfterSalesPlugin_1 = class AfterSalesPlugin {
    constructor(options, afterSalesService, moduleRef) {
        this.options = options;
        this.afterSalesService = afterSalesService;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        AfterSalesPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return AfterSalesPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.afterSalesService.init(this.injector);
        core_2.Logger.info('AfterSalesPlugin initialized', constants_1.loggerCtx);
    }
};
exports.AfterSalesPlugin = AfterSalesPlugin;
AfterSalesPlugin.options = {};
exports.AfterSalesPlugin = AfterSalesPlugin = AfterSalesPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [after_sales_request_entity_1.AfterSalesRequest],
        providers: [
            { provide: constants_1.AFTER_SALES_PLUGIN_OPTIONS, useFactory: () => AfterSalesPlugin.options },
            after_sales_service_1.AfterSalesService,
        ],
        exports: [after_sales_service_1.AfterSalesService],
        shopApiExtensions: {
            schema: () => gql `
            enum AfterSalesType { return_refund refund_only exchange }
            enum AfterSalesState { Pending Approved Rejected Returning Received Refunded Closed }

            type AfterSalesRequest implements Node {
                id: ID!
                orderId: ID!
                orderLineId: ID
                type: AfterSalesType!
                state: AfterSalesState!
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                returnTrackingNo: String
                returnCarrier: String
                rejectReason: String
                receivedQuantity: Int
                createdAt: DateTime!
                updatedAt: DateTime!
                order: Order!
                orderLine: OrderLine
            }

            type AfterSalesRequestList implements PaginatedList {
                items: [AfterSalesRequest!]!
                totalItems: Int!
            }

            input CreateAfterSalesRequestInput {
                orderId: ID!
                orderLineId: ID
                type: AfterSalesType
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                receivedQuantity: Int
            }

            input AfterSalesRequestListOptions


            extend type Query {
                myAfterSalesRequests(options: AfterSalesRequestListOptions): AfterSalesRequestList!
                afterSalesRequest(id: ID!): AfterSalesRequest
            }

            extend type Mutation {
                createAfterSalesRequest(input: CreateAfterSalesRequestInput!): AfterSalesRequest!
                cancelAfterSalesRequest(id: ID!): AfterSalesRequest!
                updateReturnTracking(id: ID!, trackingNo: String!, carrier: String!): AfterSalesRequest!
            }
        `,
            resolvers: [after_sales_shop_resolver_1.AfterSalesShopResolver],
        },
        adminApiExtensions: {
            schema: () => gql `
            type AfterSalesRequestAdmin implements Node {
                id: ID!
                orderId: ID!
                orderLineId: ID
                type: String!
                state: String!
                reason: String!
                description: String
                evidenceImages: [String!]
                refundAmount: Int!
                returnTrackingNo: String
                returnCarrier: String
                rejectReason: String
                receivedQuantity: Int
                restockJson: String
                customerId: ID!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type AfterSalesRequestAdminList implements PaginatedList {
                items: [AfterSalesRequestAdmin!]!
                totalItems: Int!
            }

            input AfterSalesRequestAdminListOptions

            extend type Query {
                afterSalesRequests(options: AfterSalesRequestAdminListOptions): AfterSalesRequestAdminList!
            }

            extend type Mutation {
                approveAfterSalesRequest(id: ID!): AfterSalesRequestAdmin!
                rejectAfterSalesRequest(id: ID!, reason: String!): AfterSalesRequestAdmin!
                confirmReturnReceived(id: ID!, receivedQuantity: Int): AfterSalesRequestAdmin!
                processAfterSalesRefund(id: ID!): AfterSalesRequestAdmin!
            }
        `,
            resolvers: [after_sales_admin_resolver_1.AfterSalesAdminResolver],
        },
        configuration: (config) => {
            var _a, _b;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Order: [
                    ...((_b = (_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Order) !== null && _b !== void 0 ? _b : []),
                    ...order_custom_fields_1.afterSalesOrderCustomFields.Order,
                ] });
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.AFTER_SALES_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, after_sales_service_1.AfterSalesService,
        core_1.ModuleRef])
], AfterSalesPlugin);
//# sourceMappingURL=plugin.js.map