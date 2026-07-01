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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var DistributionPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributionPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const commission_job_1 = require("./commission.job");
const commission_record_entity_1 = require("./commission-record.entity");
const commission_service_1 = require("./commission.service");
const distribution_admin_resolver_1 = require("./distribution-admin.resolver");
const distribution_service_1 = require("./distribution.service");
const distribution_shop_resolver_1 = require("./distribution-shop.resolver");
const distributor_entity_1 = require("./distributor.entity");
const withdrawal_request_entity_1 = require("./withdrawal-request.entity");
const withdrawal_service_1 = require("./withdrawal.service");
const channel_custom_fields_1 = require("./channel-custom-fields");
const customer_custom_fields_1 = require("./customer-custom-fields");
let DistributionPlugin = DistributionPlugin_1 = class DistributionPlugin {
    constructor(options, commissionService, commissionJob, channelService) {
        this.options = options;
        this.commissionService = commissionService;
        this.commissionJob = commissionJob;
        this.channelService = channelService;
    }
    static init(options) {
        DistributionPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return DistributionPlugin_1;
    }
    async onApplicationBootstrap() {
        var _a;
        await this.commissionService.init();
        await this.commissionJob.init();
        const emptyCtx = core_1.RequestContext.empty();
        const channels = await this.channelService.findAll(emptyCtx);
        for (const channel of channels.items) {
            if ((_a = channel.customFields) === null || _a === void 0 ? void 0 : _a.distributionEnabled) {
                await this.commissionJob.scheduleSettlement(channel.id);
                core_1.Logger.info(`Scheduled commission settlement for channel ${channel.id}`, constants_1.loggerCtx);
            }
        }
        core_1.Logger.info('DistributionPlugin initialized', constants_1.loggerCtx);
    }
};
exports.DistributionPlugin = DistributionPlugin;
DistributionPlugin.options = {};
exports.DistributionPlugin = DistributionPlugin = DistributionPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [distributor_entity_1.Distributor, commission_record_entity_1.CommissionRecord, withdrawal_request_entity_1.WithdrawalRequest],
        providers: [
            { provide: constants_1.DISTRIBUTION_PLUGIN_OPTIONS, useFactory: () => DistributionPlugin.options },
            distribution_service_1.DistributionService,
            commission_service_1.CommissionService,
            withdrawal_service_1.WithdrawalService,
            commission_job_1.CommissionJob,
        ],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum DistributorStatus { active frozen pending }
            enum CommissionType { direct indirect }
            enum CommissionStatus { pending confirmed paid cancelled }
            enum WithdrawalMethod { bank alipay wechat }
            enum WithdrawalStatus { pending approved rejected paid }

            type Distributor implements Node {
                id: ID!
                customerId: ID!
                parentId: ID
                level: Int!
                status: DistributorStatus!
                totalEarnings: Int!
                availableBalance: Int!
                frozenBalance: Int!
                referralCode: String!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type CommissionRecord implements Node {
                id: ID!
                distributorId: ID!
                orderId: ID!
                commissionType: CommissionType!
                commissionRate: Int!
                orderAmount: Int!
                commissionAmount: Int!
                status: CommissionStatus!
                settledAt: DateTime
                createdAt: DateTime!
            }

            type WithdrawalRequest implements Node {
                id: ID!
                distributorId: ID!
                amount: Int!
                method: WithdrawalMethod!
                accountInfo: String!
                status: WithdrawalStatus!
                reviewedAt: DateTime
                paidAt: DateTime
                createdAt: DateTime!
            }

            type DistributorList implements PaginatedList {
                items: [Distributor!]!
                totalItems: Int!
            }

            type CommissionRecordList implements PaginatedList {
                items: [CommissionRecord!]!
                totalItems: Int!
            }

            type WithdrawalRequestList implements PaginatedList {
                items: [WithdrawalRequest!]!
                totalItems: Int!
            }

            input DistributorListOptions
            input CommissionRecordListOptions
            input WithdrawalRequestListOptions

            extend type Query {
                distributors(options: DistributorListOptions): DistributorList!
                commissionRecords(options: CommissionRecordListOptions): CommissionRecordList!
                withdrawalRequests(options: WithdrawalRequestListOptions): WithdrawalRequestList!
            }

            extend type Mutation {
                approveDistributor(id: ID!): Distributor!
                freezeDistributor(id: ID!): Distributor!
                approveWithdrawal(id: ID!): WithdrawalRequest!
                rejectWithdrawal(id: ID!): WithdrawalRequest!
                markWithdrawalPaid(id: ID!): WithdrawalRequest!
            }
        `,
            resolvers: [distribution_admin_resolver_1.DistributionAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum DistributorStatus { active frozen pending }
            enum CommissionType { direct indirect }
            enum CommissionStatus { pending confirmed paid cancelled }
            enum WithdrawalMethod { bank alipay wechat }
            enum WithdrawalStatus { pending approved rejected paid }

            type Distributor implements Node {
                id: ID!
                customerId: ID!
                parentId: ID
                level: Int!
                status: DistributorStatus!
                totalEarnings: Int!
                availableBalance: Int!
                frozenBalance: Int!
                referralCode: String!
                createdAt: DateTime!
                updatedAt: DateTime!
            }

            type CommissionRecord implements Node {
                id: ID!
                distributorId: ID!
                commissionType: CommissionType!
                commissionRate: Int!
                orderAmount: Int!
                commissionAmount: Int!
                status: CommissionStatus!
                settledAt: DateTime
                createdAt: DateTime!
            }

            type WithdrawalRequest implements Node {
                id: ID!
                distributorId: ID!
                amount: Int!
                method: WithdrawalMethod!
                accountInfo: String!
                status: WithdrawalStatus!
                reviewedAt: DateTime
                paidAt: DateTime
                createdAt: DateTime!
            }

            extend type Query {
                myDistributorProfile: Distributor
                myCommissionRecords: [CommissionRecord!]!
                myWithdrawalRequests: [WithdrawalRequest!]!
            }

            extend type Mutation {
                applyDistributor: Distributor!
                requestWithdrawal(amount: Int!, method: WithdrawalMethod!, accountInfo: String!): WithdrawalRequest!
            }
        `,
            resolvers: [distribution_shop_resolver_1.DistributionShopResolver],
        },
        configuration: config => {
            var _a, _b, _c, _d;
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Channel: [
                    ...((_b = (_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Channel) !== null && _b !== void 0 ? _b : []),
                    ...channel_custom_fields_1.distributionChannelCustomFields.Channel,
                ], Customer: [
                    ...((_d = (_c = config.customFields) === null || _c === void 0 ? void 0 : _c.Customer) !== null && _d !== void 0 ? _d : []),
                    ...customer_custom_fields_1.distributionCustomerCustomFields.Customer,
                ] });
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.DISTRIBUTION_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, commission_service_1.CommissionService,
        commission_job_1.CommissionJob,
        core_1.ChannelService])
], DistributionPlugin);
//# sourceMappingURL=plugin.js.map