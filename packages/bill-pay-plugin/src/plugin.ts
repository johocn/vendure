import { Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    Injector,
    Logger,
    PermissionDefinition,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { BillPayAdminResolver } from './bill-pay-admin.resolver';
import { setBillPayBalancePort } from './bill-pay-balance-port';
import { BillPayChannelConfigEntity } from './bill-pay-config.entity';
import { BillPayOrder } from './bill-pay-order.entity';
import { BillPayService, setBillPayGateway } from './bill-pay.service';
import { BillPaySettlement } from './bill-pay-settlement.entity';
import { BillPayShopResolver } from './bill-pay-shop.resolver';
import { BillPayPermissions, loggerCtx } from './constants';
import { MerchantAgreement } from './merchant-agreement.entity';
import { AddBillPayCouponColumnsMigration, CreateBillPayTablesMigration } from './migrations';

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
    couponCode: String
    couponDiscount: Int
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
    couponCode: String
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

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [BillPayOrder, MerchantAgreement, BillPaySettlement, BillPayChannelConfigEntity],
    providers: [BillPayService, CreateBillPayTablesMigration, AddBillPayCouponColumnsMigration],
    exports: [BillPayService],
    adminApiExtensions: {
        schema: () => gql`
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
        resolvers: [BillPayAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
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
        resolvers: [BillPayShopResolver],
    },
    configuration: (config) => {
        // 自定义权限 BillPayManage（对齐 inventory-plugin ViewStock 注册模式）
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            ...Object.values(BillPayPermissions).map(
                name =>
                    new PermissionDefinition({
                        name,
                        description: 'Manage bill pay orders (quote/accept/proof/settle/refund)',
                    }),
            ),
        ];
        return config;
    },
    compatibility: '^3.0.0',
})
export class BillPayPlugin {
    private injector: Injector;

    constructor(
        private billPayService: BillPayService,
        private moduleRef: ModuleRef,
    ) {}

    static init(): Type<BillPayPlugin> {
        return BillPayPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef as any);

        // 微信网关引用 + BP- 前缀回调结算注册（可选依赖 wechatpay-plugin）
        try {
            const { WechatpaySettlementRegistry, WechatpayService } = await import('@vendure/wechatpay-plugin');
            const registry = this.injector.get(WechatpaySettlementRegistry);
            const gateway = this.injector.get(WechatpayService);
            setBillPayGateway(gateway);
            const billPayService = this.injector.get(BillPayService);
            registry.register({
                prefix: 'BP-',
                settle: (ctx, outTradeNo) => billPayService.settleBillPayOrderByOutTradeNo(ctx, outTradeNo),
            });
            Logger.info('BillPayOrder ~BP- settlement registered (wechatpay gateway)', loggerCtx);
        } catch (e: any) {
            setBillPayGateway(null);
            Logger.warn('Wechatpay settlement registry unavailable for bill pay', loggerCtx);
        }

        // 余额能力端口（可选依赖 recharge-card-plugin）：未装载时余额支付入口不可用
        try {
            const { RechargeCardService } = await import('@vendure/recharge-card-plugin');
            const svc = this.injector.get(RechargeCardService);
            setBillPayBalancePort({
                getBalance: (ctx, cid) => svc.getBalance(ctx, cid),
                deductBalance: (ctx, cid, amt) => svc.deductBalance(ctx, cid, amt),
                addBalance: (ctx, cid, amt) => svc.addBalance(ctx, cid, amt, null, null),
            });
            Logger.info('BillPay balance port registered (recharge-card)', loggerCtx);
        } catch (e: any) {
            setBillPayBalancePort(null);
            Logger.info('BillPay balance port unavailable (recharge-card not registered)', loggerCtx);
        }

        Logger.info('BillPayPlugin initialized', loggerCtx);
    }
}
