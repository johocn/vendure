import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    EventBus,
    Injector,
    Logger,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    PluginCommonModule,
    TransactionalConnection,
    VendurePlugin,
} from '@vendure/core';
import gql from 'graphql-tag';

import { COUPON_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CouponAdminResolver } from './coupon-admin.resolver';
import { CouponBindingAdminResolver } from './coupon-binding-admin.resolver';
import { CouponBindingService } from './coupon-binding.service';
import { CustomerCouponResolver } from './coupon-customer-coupon.resolver';
import { CouponTemplateResolver } from './coupon-template.resolver';
import { couponDiscountAction } from './coupon-promotion-action';
import { couponAppliedCondition } from './coupon-promotion-condition';
import { setCouponConnection } from './coupon-runtime';
import { setBindingService } from './coupon-settlement';
import { CouponService } from './coupon.service';
import { CouponShopResolver } from './coupon-shop.resolver';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { AddCouponFieldsMigration, AddCouponIndexes20260919, CreateProductCouponBindingMigration } from './migrations';
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
    createdAt: DateTime!
    updatedAt: DateTime!
}`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [CouponTemplate, CustomerCoupon, ProductCouponBinding],
    providers: [
        { provide: COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
        CouponService,
        CouponBindingService,
        AddCouponFieldsMigration,
        CreateProductCouponBindingMigration,
        AddCouponIndexes20260919,
    ],
    exports: [CouponService, CouponBindingService],
    adminApiExtensions: {
        schema: () => gql`
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE }

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
            }

            input CouponTemplateListOptions

            input CustomerCouponListOptions

            extend type Query {
                couponTemplates(options: CouponTemplateListOptions): CouponTemplateList!
                couponTemplate(id: ID!): CouponTemplate
                customerCoupons(options: CustomerCouponListOptions): CustomerCouponList!
                couponChannelCustomers(query: String, take: Int, skip: Int): CouponIssueCustomerList!
                productCouponBindings(productId: ID!): [ProductCouponBinding!]!
            }

            extend type Mutation {
                createCouponTemplate(input: CreateCouponTemplateInput!): CouponTemplate!
                updateCouponTemplate(input: UpdateCouponTemplateInput!): CouponTemplate!
                deleteCouponTemplate(id: ID!): Boolean!
                grantCoupon(templateId: ID!, customerIds: [ID!]!): [String!]!
                revokeCustomerCoupon(id: ID!): CustomerCoupon!
                grantCouponIssue(templateId: ID!, customerIds: [ID!]!, notify: Boolean!): [CouponIssueResult!]!
                createProductCouponBinding(input: CreateProductCouponBindingInput!): ProductCouponBinding!
                updateProductCouponBinding(input: UpdateProductCouponBindingInput!): ProductCouponBinding!
                deleteProductCouponBinding(id: ID!): Boolean!
            }
        `,
        resolvers: [CouponAdminResolver, CouponTemplateResolver, CustomerCouponResolver, CouponBindingAdminResolver],
    },
    shopApiExtensions: {
        schema: () => gql`
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE }

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

            extend type Query {
                couponCentre: [CouponTemplate!]!
                myCoupons(status: CouponStatus): [CustomerCoupon!]!
                pointsMallTemplates: [CouponTemplate!]!
                productCoupons(productId: ID!): [ProductCouponBinding!]!
            }

            extend type Mutation {
                claimCoupon(templateId: ID!): CustomerCoupon!
                claimProductCoupon(bindingId: ID!): CustomerCoupon!
                redeemCouponByCode(claimCode: String!): CustomerCoupon!
                applyCouponToOrder(code: String!): Order!
                clearCouponFromOrder: Order!
                exchangeCouponWithPoints(templateId: ID!): ExchangeCouponResult!
            }
        `,
        resolvers: [CouponShopResolver, CouponTemplateResolver, CustomerCouponResolver],
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

        Logger.info('CouponPlugin initialized', loggerCtx);
    }
}