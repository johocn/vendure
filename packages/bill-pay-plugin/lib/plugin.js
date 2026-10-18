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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var BillPayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillPayPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const bill_pay_admin_resolver_1 = require("./bill-pay-admin.resolver");
const bill_pay_balance_port_1 = require("./bill-pay-balance-port");
const bill_pay_config_entity_1 = require("./bill-pay-config.entity");
const bill_pay_order_entity_1 = require("./bill-pay-order.entity");
const bill_pay_service_1 = require("./bill-pay.service");
const bill_pay_settlement_entity_1 = require("./bill-pay-settlement.entity");
const bill_pay_shop_resolver_1 = require("./bill-pay-shop.resolver");
const constants_1 = require("./constants");
const merchant_agreement_entity_1 = require("./merchant-agreement.entity");
const migrations_1 = require("./migrations");
const billPayOrderType = `
type BillPayOrder implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    code: String
    customerId: ID!
    merchantName: String!
    expectedAmount: Int!
    quoteAmount: Int
    actualAmount: Int
    discountDetail: JSON
    status: BillPayStatus!
    remark: String
    quoteNote: String
    quoteExpireAt: DateTime
    proofUrl: String
    paymentMethod: String
    operatorId: ID
    settleLedgerId: ID
    paidAt: DateTime
    completedAt: DateTime
    settledAt: DateTime
    refundedAt: DateTime
    completeNote: String
    channelId: ID!
}

input BillPayOrderListOptions {
    skip: Int
    take: Int
    status: BillPayStatus
}

type BillPayOrderList implements PaginatedList {
    items: [BillPayOrder!]!
    totalItems: Int!
}

input CreateBillPayOrderInput {
    merchantName: String!
    expectedAmount: Int!
    remark: String
}

type BillPayDiscountItem {
    rule: String!
    label: JSON
    amount: Int!
}

type MerchantAgreement implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    channelId: ID!
    merchantName: String!
    settleRate: Int!
    settleMode: String!
    contact: String
    note: String
}

input MerchantAgreementInput {
    merchantName: String!
    settleRate: Int!
    settleMode: String
    contact: String
    note: String
}
`;
const wechatPayParamsType = `
type BillPayWechatParams {
    payType: String!
    prepayId: String
    appId: String
    timeStamp: String
    nonceStr: String
    package: String
    signType: String
    paySign: String
    payUrl: String
}

type BillPayWechatResult {
    billPayOrderId: ID!
    outTradeNo: String!
    pay: BillPayWechatParams!
}
`;
const channelConfigType = `
type BillPayMemberDiscount {
    percent: Int!
    label: JSON
}

type BillPayThreshold {
    minSpend: Int!
    reduce: Int!
    label: JSON
}

type BillPayConfig {
    autoQuote: Boolean!
    quoteExpireMinutes: Int!
    couponEnabled: Boolean!
    tolerancePercent: Int!
    dailyLimitAmount: Int!
    minAmount: Int!
    maxAmount: Int!
    memberDiscount: BillPayMemberDiscount
    thresholds: [BillPayThreshold!]!
}
`;
let BillPayPlugin = BillPayPlugin_1 = class BillPayPlugin {
    constructor(billPayService, moduleRef) {
        this.billPayService = billPayService;
        this.moduleRef = moduleRef;
    }
    static init() {
        return BillPayPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        // 微信网关引用 + BP- 前缀回调结算注册（可选依赖 wechatpay-plugin）
        try {
            const { WechatpaySettlementRegistry, WechatpayService } = await import('@vendure/wechatpay-plugin');
            const registry = this.injector.get(WechatpaySettlementRegistry);
            const gateway = this.injector.get(WechatpayService);
            (0, bill_pay_service_1.setBillPayGateway)(gateway);
            const billPayService = this.injector.get(bill_pay_service_1.BillPayService);
            registry.register({
                prefix: 'BP-',
                settle: (ctx, outTradeNo) => billPayService.settleBillPayOrderByOutTradeNo(ctx, outTradeNo),
            });
            core_2.Logger.info('BillPayOrder ~BP- settlement registered (wechatpay gateway)', constants_1.loggerCtx);
        }
        catch (e) {
            (0, bill_pay_service_1.setBillPayGateway)(null);
            core_2.Logger.warn('Wechatpay settlement registry unavailable for bill pay', constants_1.loggerCtx);
        }
        // 余额能力端口（可选依赖 recharge-card-plugin）：未装载时余额支付入口不可用
        try {
            const { RechargeCardService } = await import('@vendure/recharge-card-plugin');
            const svc = this.injector.get(RechargeCardService);
            (0, bill_pay_balance_port_1.setBillPayBalancePort)({
                getBalance: (ctx, cid) => svc.getBalance(ctx, cid),
                deductBalance: (ctx, cid, amt) => svc.deductBalance(ctx, cid, amt),
                addBalance: (ctx, cid, amt) => svc.addBalance(ctx, cid, amt, null, null),
            });
            core_2.Logger.info('BillPay balance port registered (recharge-card)', constants_1.loggerCtx);
        }
        catch (e) {
            (0, bill_pay_balance_port_1.setBillPayBalancePort)(null);
            core_2.Logger.info('BillPay balance port unavailable (recharge-card not registered)', constants_1.loggerCtx);
        }
        core_2.Logger.info('BillPayPlugin initialized', constants_1.loggerCtx);
    }
};
exports.BillPayPlugin = BillPayPlugin;
exports.BillPayPlugin = BillPayPlugin = BillPayPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [bill_pay_order_entity_1.BillPayOrder, merchant_agreement_entity_1.MerchantAgreement, bill_pay_settlement_entity_1.BillPaySettlement, bill_pay_config_entity_1.BillPayChannelConfigEntity],
        providers: [bill_pay_service_1.BillPayService, migrations_1.CreateBillPayTablesMigration],
        exports: [bill_pay_service_1.BillPayService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum BillPayStatus {
                PENDING_QUOTE
                QUOTED
                PAID
                IN_SERVICE
                COMPLETED
                SETTLED
                CANCELLED
                REFUNDED
            }

            ${billPayOrderType}
            ${channelConfigType}

            extend type Query {
                billPayOrdersAdmin(options: BillPayOrderListOptions): BillPayOrderList!
                billPayOrderAdmin(id: ID!): BillPayOrder!
                billPayChannelConfig: BillPayConfig!
                merchantAgreements: [MerchantAgreement!]!
            }

            extend type Mutation {
                updateBillPayQuote(id: ID!, quoteAmount: Int!, note: String!): BillPayOrder!
                acceptBillPayOrder(id: ID!): BillPayOrder!
                completeBillPayOrder(id: ID!, actualAmount: Int!, proofUrl: String!, note: String): BillPayOrder!
                settleBillPayOrder(id: ID!): BillPayOrder!
                refundBillPayOrder(id: ID!, reason: String): BillPayOrder!
                saveMerchantAgreement(input: MerchantAgreementInput!, id: ID): MerchantAgreement!
                saveBillPayChannelConfig(config: JSON!): BillPayConfig!
            }
        `,
            resolvers: [bill_pay_admin_resolver_1.BillPayAdminResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum BillPayStatus {
                PENDING_QUOTE
                QUOTED
                PAID
                IN_SERVICE
                COMPLETED
                SETTLED
                CANCELLED
                REFUNDED
            }

            ${billPayOrderType}
            ${wechatPayParamsType}
            ${channelConfigType}

            extend type Query {
                billPayOrder(id: ID!): BillPayOrder!
                billPayOrders(options: BillPayOrderListOptions): BillPayOrderList!
                billPayConfig: BillPayConfig!
            }

            extend type Mutation {
                createBillPayOrder(input: CreateBillPayOrderInput!): BillPayOrder!
                cancelBillPayOrder(id: ID!): BillPayOrder!
                createWechatBillPayment(id: ID!, tradeType: String, openid: String): BillPayWechatResult!
                payBillPayOrderWithBalance(id: ID!): BillPayOrder!
            }
        `,
            resolvers: [bill_pay_shop_resolver_1.BillPayShopResolver],
        },
        configuration: (config) => {
            var _a;
            // 自定义权限 BillPayManage（对齐 inventory-plugin ViewStock 注册模式）
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                ...Object.values(constants_1.BillPayPermissions).map(name => new core_2.PermissionDefinition({
                    name,
                    description: 'Manage bill pay orders (quote/accept/proof/settle/refund)',
                })),
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __metadata("design:paramtypes", [bill_pay_service_1.BillPayService,
        core_1.ModuleRef])
], BillPayPlugin);
//# sourceMappingURL=plugin.js.map