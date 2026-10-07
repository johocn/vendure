import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    EventBus,
    Injector,
    Logger,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    RefundStateTransitionEvent,
    PluginCommonModule,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { COUPON_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CouponAdminResolver } from './coupon-admin.resolver';
import { CouponBindingAdminResolver } from './coupon-binding-admin.resolver';
import { CouponBindingService } from './coupon-binding.service';
import { CouponBundleResolver } from './coupon-bundle.resolver';
import { setCouponBalancePort } from './coupon-balance-port';
import { CouponSaleAdminResolver } from './coupon-sale-admin.resolver';
import { CouponSaleShopResolver } from './coupon-sale-shop.resolver';
import { CouponSaleService, setCouponSaleGateway } from './coupon-sale.service';
import { CustomerCouponResolver } from './coupon-customer-coupon.resolver';
import { CouponTemplateResolver } from './coupon-template.resolver';
import { couponDiscountAction } from './coupon-promotion-action';
import { couponAppliedCondition } from './coupon-promotion-condition';
import { setCouponConnection } from './coupon-runtime';
import { setBindingService } from './coupon-settlement';
import { CouponService } from './coupon.service';
import { CouponShopResolver } from './coupon-shop.resolver';
import { CouponTemplate } from './coupon-template.entity';
import { CouponBundle, CouponBundleItem } from './coupon-bundle.entity';
import { CouponSaleOrder } from './coupon-sale-order.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import {
    AddCouponFieldsMigration,
    AddCouponIndexes20260919,
    AddCouponUsageSceneMigration,
    CreateCouponSaleMigration,
    CreateInStoreBillMigration,
    CreateProductCouponBindingMigration,
} from './migrations';
import { AddCouponDistributionChannelsMigration } from './migrations/add-coupon-distribution-channels';
import { InStoreBill } from './in-store-bill.entity';
import { InStoreBillAdminResolver } from './in-store-bill-admin.resolver';
import { InStoreBillService } from './in-store-bill.service';
import { couponOrderCustomFields } from './order-custom-fields';
import { ProductCouponBinding } from './product-coupon-binding.entity';
import { CouponPluginOptions } from './types';

/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations several times). */
function mergeCustomFields<T extends { name: string }>(
    existingFields: T[] | undefined,
    additions: T[] | undefined,
): T[] {
    const names = new Set((existingFields ?? []).map(f => f.name));
    return [...(existingFields ?? []), ...(additions ?? []).filter(f => !names.has(f.name))];
}

const couponTemplateType = `
type CouponTemplate implements Node {
    id: ID!
    name: String!
    nameZh: String
    nameEn: String
    description: String
    descZh: String
    descEn: String
    type: CouponType!
    discountValue: Int!
    minSpend: Int!
    startsAt: DateTime
    endsAt: DateTime
    totalCount: Int!
    claimedCount: Int!
    pointsPrice: Int!
    perUserLimit: Int!
    scope: String!
    categoryId: ID
    variantId: ID
    enabled: Boolean!
    claimable: Boolean!
    claimCode: String
    validDays: Int
    newCustomerOnly: Boolean!
    memberLevel: String
    shopId: ID
    usageScene: CouponUsageScene!
    distributionChannels: String
    salePrice: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
}`;

const customerCouponType = `
type CustomerCoupon implements Node {
    id: ID!
    customerId: ID!
    templateId: ID!
    code: String!
    status: CouponStatus!
    issuedBy: CouponIssuedBy!
    reservedOrderId: ID
    usedOrderId: ID
    issuedAt: DateTime
    usedAt: DateTime
    expiredAt: DateTime
    template: CouponTemplate
    customer: Customer
    createdAt: DateTime!
    updatedAt: DateTime!
}`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CouponTemplate, CustomerCoupon, ProductCouponBinding, InStoreBill, CouponSaleOrder, CouponBundle, CouponBundleItem],
    providers: [
        { provide: COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
        CouponService,
        CouponBindingService,
        CouponSaleService,
        InStoreBillService,
        AddCouponFieldsMigration,
        CreateProductCouponBindingMigration,
        AddCouponIndexes20260919,
        AddCouponUsageSceneMigration,
        AddCouponDistributionChannelsMigration,
        CreateInStoreBillMigration,
        CreateCouponSaleMigration,
    ],
    exports: [CouponService, CouponBindingService, CouponSaleService],
    adminApiExtensions: {
        schema: () => gql`
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE SALE }
            enum CouponUsageScene { ONLINE IN_STORE ALL }

            ${couponTemplateType}
            ${customerCouponType}

            type ProductCouponBinding implements Node {
                id: ID!
                productId: ID!
                variantIds: [ID!]
                couponTemplateId: ID!
                enabled: Boolean!
                displayOrder: Int!
                badgeText: String
                promoTitle: String
                remark: String
                template: CouponTemplate
            }

            input CreateProductCouponBindingInput {
                productId: ID!
                variantIds: [ID!]
                couponTemplateId: ID!
                enabled: Boolean
                displayOrder: Int
                badgeText: String
                promoTitle: String
                remark: String
            }

            input UpdateProductCouponBindingInput {
                id: ID!
                variantIds: [ID!]
                enabled: Boolean
                displayOrder: Int
                badgeText: String
                promoTitle: String
                remark: String
            }

            type CouponTemplateList implements PaginatedList {
                items: [CouponTemplate!]!
                totalItems: Int!
            }

            type CustomerCouponList implements PaginatedList {
                items: [CustomerCoupon!]!
                totalItems: Int!
            }

            type InStoreBillQuote {
                ok: Boolean!
                reason: String
                couponCode: String
                couponName: String
                discountType: String
                discountValue: Int
                minSpend: Int
                originalAmount: Int
                discountAmount: Int
                finalAmount: Int
                customerName: String
                customerPhone: String
                expiresAt: DateTime
            }

            type InStoreBill implements Node {
                id: ID!
                channelId: ID!
                couponCode: String!
                couponTemplateId: ID!
                couponName: String
                customerId: ID!
                customerName: String
                customerPhone: String
                discountType: String!
                discountValue: Int!
                originalAmount: Int!
                discountAmount: Int!
                finalAmount: Int!
                operatorId: ID!
                operatorName: String
                remark: String
                billedAt: DateTime!
                createdAt: DateTime!
            }

            type InStoreBillList implements PaginatedList {
                items: [InStoreBill!]!
                totalItems: Int!
            }

            type InStoreBillSummary {
                count: Int!
                originalTotal: Int!
                discountTotal: Int!
                finalTotal: Int!
            }

            input InStoreBillListOptions {
                skip: Int
                take: Int
                couponCode: String
                from: DateTime
                to: DateTime
            }

            input InStoreBillSummaryOptions {
                from: DateTime
                to: DateTime
            }

            type CouponIssueCustomer implements Node {
                id: ID!
                emailAddress: String!
                firstName: String
                lastName: String
                phoneNumber: String
            }

            type CouponIssueCustomerList implements PaginatedList {
                items: [CouponIssueCustomer!]!
                totalItems: Int!
            }

            type CouponIssueResult {
                customerId: ID!
                ok: Boolean!
                code: String
                reason: String
            }

            input CreateCouponTemplateInput {
                name: String
                description: String
                nameZh: String
                nameEn: String
                descZh: String
                descEn: String
                type: CouponType!
                discountValue: Int!
                minSpend: Int
                startsAt: DateTime
                endsAt: DateTime
                totalCount: Int
                pointsPrice: Int
                perUserLimit: Int
                scope: String
                categoryId: ID
                variantId: ID
                enabled: Boolean
                claimable: Boolean
                claimCode: String
                validDays: Int
                newCustomerOnly: Boolean
                memberLevel: String
                shopId: ID
                usageScene: CouponUsageScene
                distributionChannels: String
                salePrice: Int
            }

            input UpdateCouponTemplateInput {
                id: ID!
                name: String
                description: String
                nameZh: String
                nameEn: String
                descZh: String
                descEn: String
                type: CouponType
                discountValue: Int
                minSpend: Int
                startsAt: DateTime
                endsAt: DateTime
                totalCount: Int
                pointsPrice: Int
                perUserLimit: Int
                scope: String
                categoryId: ID
                variantId: ID
                enabled: Boolean
                claimable: Boolean
                claimCode: String
                validDays: Int
                newCustomerOnly: Boolean
                memberLevel: String
                usageScene: CouponUsageScene
                distributionChannels: String
                salePrice: Int
            }

            input CouponTemplateListOptions

            input CustomerCouponListOptions

            type CouponBundleItem {
                id: ID!
                bundleId: ID!
                templateId: ID!
                quantity: Int!
            }

            type CouponBundle implements Node {
                id: ID!
                name: String!
                description: String
                salePrice: Int!
                enabled: Boolean!
                shopId: ID
                channelId: ID!
                items: [CouponBundleItem!]!
            }

            type CouponBundleList implements PaginatedList {
                items: [CouponBundle!]!
                totalItems: Int!
            }

            input CouponBundleItemInput {
                templateId: ID!
                quantity: Int
            }

            input CouponBundleInput {
                name: String
                description: String
                salePrice: Int!
                enabled: Boolean
                shopId: ID
                items: [CouponBundleItemInput!]
            }

            input CouponBundleListOptions {
                skip: Int
                take: Int
            }

            type CouponSaleOrder implements Node {
                id: ID!
                customerId: ID!
                payMode: String!
                templateId: ID
                bundleId: ID
                orderId: ID
                amount: Int!
                status: String!
                paymentMethod: String
                externalRef: String
                paidAt: DateTime
                refundedAt: DateTime
                createdAt: DateTime!
            }

            type CouponSaleOrderList implements PaginatedList {
                items: [CouponSaleOrder!]!
                totalItems: Int!
            }

            input CouponSaleOrderListOptions {
                skip: Int
                take: Int
                status: String
            }

            extend type Query {
                couponTemplates(options: CouponTemplateListOptions): CouponTemplateList!
                couponTemplate(id: ID!): CouponTemplate
                customerCoupons(options: CustomerCouponListOptions): CustomerCouponList!
                couponChannelCustomers(query: String, take: Int, skip: Int): CouponIssueCustomerList!
                productCouponBindings(productId: ID!): [ProductCouponBinding!]!
                couponBoundProducts(templateId: ID!): [ProductCouponBinding!]!
                inStoreBillQuote(code: String!, originalAmount: Int): InStoreBillQuote!
                inStoreBills(options: InStoreBillListOptions): InStoreBillList!
                inStoreBillSummary(options: InStoreBillSummaryOptions): InStoreBillSummary!
                inStoreCustomerCoupons(customerId: ID!): [CustomerCoupon!]!
                couponBundles(options: CouponBundleListOptions): CouponBundleList!
                couponBundle(id: ID!): CouponBundle
                couponSaleOrders(options: CouponSaleOrderListOptions): CouponSaleOrderList!
                couponSaleOrder(id: ID!): CouponSaleOrder
            }

            extend type Mutation {
                inStoreBillRedeem(code: String!, originalAmount: Int!, remark: String): InStoreBill!
                createCouponTemplate(input: CreateCouponTemplateInput!): CouponTemplate!
                updateCouponTemplate(input: UpdateCouponTemplateInput!): CouponTemplate!
                deleteCouponTemplate(id: ID!): Boolean!
                grantCoupon(templateId: ID!, customerIds: [ID!]!): [String!]!
                revokeCustomerCoupon(id: ID!): CustomerCoupon!
                grantCouponIssue(templateId: ID!, customerIds: [ID!]!, notify: Boolean!): [CouponIssueResult!]!
                createProductCouponBinding(input: CreateProductCouponBindingInput!): ProductCouponBinding!
                updateProductCouponBinding(input: UpdateProductCouponBindingInput!): ProductCouponBinding!
                deleteProductCouponBinding(id: ID!): Boolean!
                bindProductsToCoupon(templateId: ID!, productIds: [ID!]!, variantIds: [ID!]): Int!
                unbindProductFromCoupon(templateId: ID!, productId: ID!): Boolean!
                createCouponBundle(input: CouponBundleInput!): CouponBundle!
                updateCouponBundle(id: ID!, input: CouponBundleInput!): CouponBundle!
                deleteCouponBundle(id: ID!): Boolean!
                refundCouponSaleOrder(id: ID!, reason: String): CouponSaleOrder!
            }
        `,
        resolvers: [CouponAdminResolver, CouponTemplateResolver, CustomerCouponResolver, CouponBindingAdminResolver, InStoreBillAdminResolver, CouponSaleAdminResolver, CouponBundleResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE SALE }
            enum CouponUsageScene { ONLINE IN_STORE ALL }

            ${couponTemplateType}
            ${customerCouponType}

            type ProductCouponBinding implements Node {
                id: ID!
                productId: ID!
                variantIds: [ID!]
                couponTemplateId: ID!
                enabled: Boolean!
                displayOrder: Int!
                badgeText: String
                promoTitle: String
                template: CouponTemplate
            }

            type ExchangeCouponResult {
                coupon: CustomerCoupon!
                spentPoints: Int!
            }

            type CouponSaleCatalogue {
                templates: [CouponTemplate!]!
                bundles: [CouponBundle!]!
            }

            type CouponBundleItem {
                id: ID!
                bundleId: ID!
                templateId: ID!
                quantity: Int!
            }

            type CouponBundle implements Node {
                id: ID!
                name: String!
                description: String
                salePrice: Int!
                enabled: Boolean!
                channelId: ID!
                items: [CouponBundleItem!]!
            }

            type CouponSaleOrder implements Node {
                id: ID!
                customerId: ID!
                payMode: String!
                templateId: ID
                bundleId: ID
                orderId: ID
                amount: Int!
                status: String!
                paidAt: DateTime
                refundedAt: DateTime
                createdAt: DateTime!
            }

            type CouponWechatPayParams {
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

            type CouponWechatPayResult {
                saleOrderId: ID!
                outTradeNo: String!
                pay: CouponWechatPayParams!
            }

            extend type Query {
                couponCentre: [CouponTemplate!]!
                couponCentreUpcoming: [CouponTemplate!]!
                myCoupons(status: CouponStatus): [CustomerCoupon!]!
                customerCouponByCode(code: String!): CustomerCoupon
                pointsMallTemplates: [CouponTemplate!]!
                productCoupons(productId: ID!): [ProductCouponBinding!]!
                couponSaleCatalogue(scene: CouponUsageScene): CouponSaleCatalogue!
                myCouponSaleOrders: [CouponSaleOrder!]!
            }

            extend type Mutation {
                claimCoupon(templateId: ID!): CustomerCoupon!
                claimProductCoupon(bindingId: ID!): CustomerCoupon!
                redeemCouponByCode(claimCode: String!): CustomerCoupon!
                applyCouponToOrder(code: String!): Order!
                clearCouponFromOrder: Order!
                exchangeCouponWithPoints(templateId: ID!): ExchangeCouponResult!
                createCouponSaleOrder(templateId: ID, bundleId: ID): CouponSaleOrder!
                payCouponSaleWithBalance(id: ID!): CouponSaleOrder!
                createWechatCouponPayment(saleOrderId: ID!, tradeType: String, openid: String): CouponWechatPayResult!
                cancelCouponSaleOrder(id: ID!): CouponSaleOrder!
                refundCouponSaleOrder(id: ID!, reason: String): CouponSaleOrder!
                attachCouponToOrder(orderId: ID!, templateId: ID!): CouponSaleOrder!
                detachCouponFromOrder(orderId: ID!, templateId: ID!): Boolean!
            }
        `,
        resolvers: [CouponShopResolver, CouponTemplateResolver, CustomerCouponResolver, CouponSaleShopResolver, CouponBundleResolver],
    },
    configuration: (config) => {
        config.customFields.Order = mergeCustomFields(config.customFields.Order, couponOrderCustomFields.Order);

        config.promotionOptions = config.promotionOptions || {};
        config.promotionOptions.promotionConditions = [
            ...(config.promotionOptions.promotionConditions ?? []),
            couponAppliedCondition,
        ];
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ?? []),
            couponDiscountAction,
        ];

        return config;
    },
    compatibility: '^3.0.0',
})
export class CouponPlugin implements OnApplicationBootstrap {
    private static options: CouponPluginOptions = {};
    private injector: Injector;

    constructor(
        @Inject(COUPON_PLUGIN_OPTIONS) private options: CouponPluginOptions,
        private couponService: CouponService,
        private eventBus: EventBus,
        private moduleRef: ModuleRef,
    ) {}

    static init(options?: CouponPluginOptions): Type<CouponPlugin> {
        CouponPlugin.options = options ?? {};
        return CouponPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        this.injector = new Injector(this.moduleRef as any);
        this.couponService.init(this.injector);
        setCouponConnection(this.injector.get(TransactionalConnection));
        setBindingService(this.injector.get(CouponBindingService));

        // 余额能力端口（可选依赖 recharge-card-plugin）：未装载时余额支付入口一律不可用
        try {
            const { RechargeCardService } = await import('@vendure/recharge-card-plugin');
            const svc = this.injector.get(RechargeCardService);
            setCouponBalancePort({
                getBalance: (ctx, cid) => svc.getBalance(ctx, cid),
                deductBalance: (ctx, cid, amt) => svc.deductBalance(ctx, cid, amt),
                addBalance: (ctx, cid, amt) => svc.addBalance(ctx, cid, amt, null, null),
            });
            Logger.info('Coupon balance port registered (recharge-card)', loggerCtx);
        } catch (e: any) {
            setCouponBalancePort(null);
            Logger.info('Coupon balance port unavailable (recharge-card not registered)', loggerCtx);
        }

        // 微信回调结算注册（前缀 CS-）+ 网关引用注入（可选依赖 wechatpay-plugin）
        try {
            const { WechatpaySettlementRegistry, WechatpayService } = await import('@vendure/wechatpay-plugin');
            const registry = this.injector.get(WechatpaySettlementRegistry);
            const gateway = this.injector.get(WechatpayService);
            setCouponSaleGateway(gateway);
            const saleService = this.injector.get(CouponSaleService);
            registry.register({
                prefix: 'CS-',
                settle: (ctx, outTradeNo) => saleService.settleCouponSaleOrderByOutTradeNo(ctx, outTradeNo),
            });
            Logger.info('CouponSaleOrder ~CS- settlement registered (wechatpay gateway)', loggerCtx);
        } catch (e: any) {
            setCouponSaleGateway(null);
            Logger.warn('Wechatpay settlement registry unavailable for coupon sale', loggerCtx);
        }

        // 可选定时清扫：收敛无人访问的存量过期券（惰性 on-read 已覆盖用户路径，此为长线兜底）。
        // 显式 set COUPON_EXPIRE_SWEEP_MS 才启动；默认关闭避免生产意外全量 UPDATE。
        const sweepMs = Number(process.env.COUPON_EXPIRE_SWEEP_MS ?? 0);
        if (sweepMs > 0) {
            const sweep = () => {
                this.couponService
                    .expireDueCouponsAll()
                    .then((n) => {
                        if (n > 0) Logger.info(`Expired ${n} coupon(s) via sweep`, loggerCtx);
                    })
                    .catch((e) => Logger.error(`Coupon expire sweep failed: ${e.message}`, loggerCtx));
            };
            sweep();
            setInterval(sweep, sweepMs);
            Logger.info(`Coupon expire sweep enabled (every ${sweepMs}ms)`, loggerCtx);
        }

        // 支付成功（订单下单成功）核销券
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event) => {
            try {
                await this.couponService.bindAsUsed(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(`Failed to bind coupon as used on order ${event.order.id}: ${e.message}`, loggerCtx);
            }
        });

        // 订单取消回退券（幂等）
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled') return;
            try {
                await this.couponService.returnCoupon(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(`Failed to return coupon on order ${event.order.id} cancel: ${e.message}`, loggerCtx);
            }
        });

        // 整单全额退款回退券（A3）：累计已退金额达应付 → 回退；部分退不触发（返回由 returnCoupon 保证幂等）
        this.eventBus.ofType(RefundStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Settled') return;
            try {
                await this.couponService.returnCouponOnFullRefund(event.ctx, event.refund.id as any);
            } catch (e: any) {
                Logger.error(`Failed to return coupon on refund ${event.refund.id}: ${e.message}`, loggerCtx);
            }
            // 加价购：整单退款 Settled → 回收加价购券（与订单取消同语义）
            try {
                await this.injector
                    .get(CouponSaleService)
                    .refundSurchargeOrdersForOrder(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(
                    `Failed to recycle coupon surcharge on refund of order ${event.order.id}: ${e.message}`,
                    loggerCtx,
                );
            }
        });

        // 加价购：主订单支付成功 → 结算 PENDING 加价购单并发券
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'PaymentSettled') return;
            try {
                await this.injector
                    .get(CouponSaleService)
                    .settleSurchargeOrdersForOrder(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(`Failed to settle coupon surcharge on order ${event.order.id}: ${e.message}`, loggerCtx);
            }
        });

        // 加价购：主订单取消 / 整单退款 → 回收加价购券（钱随主订单退回）
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled') return;
            try {
                await this.injector
                    .get(CouponSaleService)
                    .refundSurchargeOrdersForOrder(event.ctx, event.order.id);
            } catch (e: any) {
                Logger.error(`Failed to recycle coupon surcharge on order ${event.order.id}: ${e.message}`, loggerCtx);
            }
        });

        Logger.info('CouponPlugin initialized', loggerCtx);
    }
}