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
var SettlementPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const merchant_account_entity_1 = require("./merchant-account.entity");
const settlement_entry_entity_1 = require("./settlement-entry.entity");
const withdrawal_request_entity_1 = require("./withdrawal-request.entity");
const settlement_admin_resolver_1 = require("./settlement-admin.resolver");
const settlement_shop_resolver_1 = require("./settlement-shop.resolver");
const settlement_service_1 = require("./settlement.service");
const { gql } = require('graphql-tag');
/** admin-api 共用类型（店主/平台两套 resolver 都用，schema 只需在 admin 声明一次）。 */
const settlementTypeDefs = `
    type MerchantAccount implements Node {
        id: ID!
        shopId: ID!
        commissionRate: Float!
        availableBalance: Int!
        totalGoodsAmount: Int!
        totalShippingAmount: Int!
        totalCommission: Int!
        totalWithdrawn: Int!
    }

    type SettlementEntry implements Node {
        id: ID!
        shopId: ID!
        orderId: ID!
        orderCode: String!
        goodsAmountWithTax: Int!
        shippingAmountWithTax: Int!
        commissionAmount: Int!
        netAmountWithTax: Int!
        settledAt: DateTime
    }

    type WithdrawalRequest implements Node {
        id: ID!
        shopId: ID!
        amount: Int!
        status: String!
        reviewNote: String
        paidAt: DateTime
    }

    type SettlementEntryList {
        items: [SettlementEntry!]!
        totalItems: Int!
    }

    type MerchantAccountList {
        items: [MerchantAccount!]!
        totalItems: Int!
    }

    type WithdrawalRequestList {
        items: [WithdrawalRequest!]!
        totalItems: Int!
    }

    type SettlementSummary {
        goodsAmountWithTax: Int!
        shippingAmountWithTax: Int!
        commissionAmount: Int!
        netAmountWithTax: Int!
    }

    input ListOptions {
        skip: Int
        take: Int
    }
`;
const adminSchema = () => gql `
    ${settlementTypeDefs}

    extend type Query {
        merchantAccounts(options: ListOptions): MerchantAccountList!
        settlementEntriesByShop(shopId: ID!, options: ListOptions): SettlementEntryList!
        withdrawalRequests(options: ListOptions): WithdrawalRequestList!
        myMerchantAccount: MerchantAccount!
        mySettlementEntries(options: ListOptions): SettlementEntryList!
        myWithdrawalRequests(options: ListOptions): WithdrawalRequestList!
        mySettlementSummary(from: DateTime, to: DateTime): SettlementSummary!
    }

    extend type Mutation {
        requestWithdrawal(amount: Int!): WithdrawalRequest!
        approveWithdrawal(id: ID!): WithdrawalRequest!
        payWithdrawal(id: ID!): WithdrawalRequest!
        rejectWithdrawal(id: ID!, note: String): WithdrawalRequest!
        setMerchantCommissionRate(shopId: ID!, rate: Float!): MerchantAccount!
    }
`;
let SettlementPlugin = SettlementPlugin_1 = class SettlementPlugin {
    constructor(options, eventBus, settlementService) {
        this.options = options;
        this.eventBus = eventBus;
        this.settlementService = settlementService;
    }
    static init(options) {
        SettlementPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return SettlementPlugin_1;
    }
    onApplicationBootstrap() {
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe((event) => {
            if (!constants_1.SETTLE_TRIGGER_STATES.includes(event.toState)) {
                return;
            }
            void this.settlementService.handleOrderSettled(event.ctx, event.order.id);
        });
    }
};
exports.SettlementPlugin = SettlementPlugin;
SettlementPlugin.options = {};
exports.SettlementPlugin = SettlementPlugin = SettlementPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [merchant_account_entity_1.MerchantAccount, settlement_entry_entity_1.SettlementEntry, withdrawal_request_entity_1.WithdrawalRequest],
        providers: [
            { provide: constants_1.SETTLEMENT_PLUGIN_OPTIONS, useFactory: () => SettlementPlugin.options },
            settlement_service_1.SettlementService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [settlement_shop_resolver_1.SettlementShopResolver, settlement_admin_resolver_1.SettlementAdminResolver],
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.SETTLEMENT_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.EventBus,
        settlement_service_1.SettlementService])
], SettlementPlugin);
//# sourceMappingURL=plugin.js.map