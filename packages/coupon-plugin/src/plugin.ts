import { Inject, OnApplicationBootstrap, Type } from '@nestjs/common';
import {
    EventBus,
    Logger,
    OrderPlacedEvent,
    OrderStateTransitionEvent,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';

import { COUPON_PLUGIN_OPTIONS, loggerCtx } from './constants';
import { CouponCode } from './coupon-code.entity';
import { CouponAdminResolver } from './coupon-admin.resolver';
import { couponOrderAction, setCouponServiceRef } from './coupon-order-action';
import { expireCouponsTask } from './coupon-expire.job';
import { CouponService } from './coupon.service';
import { CouponShopResolver } from './coupon-shop.resolver';
import { Coupon } from './coupon.entity';
import { couponOrderCustomFields } from './order-custom-fields';
import { CouponPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type Coupon implements Node {
        id: ID!
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int!
        maxDiscount: Int!
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        claimedCount: Int!
        limitPerUser: Int!
        isActive: Boolean!
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type CouponList implements PaginatedList {
        items: [Coupon!]!
        totalItems: Int!
    }

    input CreateCouponInput {
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int
        maxDiscount: Int
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        limitPerUser: Int
        isActive: Boolean
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean
    }

    input UpdateCouponInput {
        name: String
        description: String
        startAt: DateTime
        endAt: DateTime
        totalQuantity: Int
        limitPerUser: Int
        isActive: Boolean
    }

    input CouponListOptions

    extend type Query {
        coupons(options: CouponListOptions): CouponList!
        coupon(id: ID!): Coupon
    }

    extend type Mutation {
        createCoupon(input: CreateCouponInput!): Coupon!
        updateCoupon(id: ID!, input: UpdateCouponInput!): Coupon!
        deleteCoupon(id: ID!): Boolean!
    }
`;

const shopSchema = () => gql`
    type Coupon implements Node {
        id: ID!
        name: String!
        description: String
        couponType: String!
        discountValue: Int!
        minSpend: Int!
        maxDiscount: Int!
        startAt: DateTime!
        endAt: DateTime!
        totalQuantity: Int!
        claimedCount: Int!
        limitPerUser: Int!
        isActive: Boolean!
        applicableProductIds: [ID!]
        applicableCategoryIds: [ID!]
        isNewUserOnly: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type CouponCode {
        id: ID!
        couponId: ID!
        coupon: Coupon!
        customerId: ID!
        code: String!
        status: String!
        claimedAt: DateTime
        usedAt: DateTime
        orderId: ID
        createdAt: DateTime!
    }

    type CouponValidationResult {
        valid: Boolean!
        discountAmount: Int!
        error: String
    }

    extend type Query {
        availableCoupons: [Coupon!]!
        myCoupons(status: String): [CouponCode!]!
        validateCoupon(code: String!, orderId: ID): CouponValidationResult!
    }

    extend type Mutation {
        claimCoupon(couponId: ID!): CouponCode!
        redeemCoupon(code: String!, orderId: ID!): CouponCode!
        applyCoupon(orderId: ID!, code: String!): CouponValidationResult!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [Coupon, CouponCode],
    providers: [
        { provide: COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
        CouponService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [CouponAdminResolver],
    },
    shopApiExtensions: {
        schema: shopSchema,
        resolvers: [CouponShopResolver],
    },
    configuration: config => {
        config.customFields.Order = [
            ...(config.customFields.Order ?? []),
            ...(couponOrderCustomFields.Order ?? []),
        ];

        config.promotionOptions = config.promotionOptions || {};
        config.promotionOptions.promotionActions = [
            ...(config.promotionOptions.promotionActions ?? []),
            couponOrderAction,
        ];

        if (!config.schedulerOptions) {
            config.schedulerOptions = { tasks: [] } as any;
        }
        if (!config.schedulerOptions.tasks) {
            config.schedulerOptions.tasks = [];
        }
        config.schedulerOptions.tasks.push(expireCouponsTask);
        return config;
    },
    dashboard: '../dashboard/index.tsx',
    compatibility: '^3.0.0',
})
export class CouponPlugin implements OnApplicationBootstrap {
    private static options: CouponPluginOptions = {};

    constructor(
        @Inject(COUPON_PLUGIN_OPTIONS) private options: CouponPluginOptions,
        private couponService: CouponService,
        private eventBus: EventBus,
    ) {}

    static init(options?: CouponPluginOptions): Type<CouponPlugin> {
        CouponPlugin.options = options ?? {};
        return CouponPlugin;
    }

    async onApplicationBootstrap(): Promise<void> {
        // 注入 service 引用给 PromotionOrderAction（模块级单例）
        setCouponServiceRef(this.couponService);

        // 订单下单后核销券码
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async event => {
            const code = (event.order as any).customFields?.appliedCouponCode;
            if (!code) return;
            try {
                await this.couponService.redeemCoupon(event.ctx, code, event.order.id);
                Logger.info(`Coupon ${code} redeemed on order ${event.order.code} placed`, loggerCtx);
            } catch (e: any) {
                Logger.error(
                    `Failed to redeem coupon ${code} on order ${event.order.code}: ${e?.message ?? e}`,
                    loggerCtx,
                );
            }
        });

        // 订单取消时释放券码（releaseCouponOnOrder 内部已调用 releaseCoupon + 清除 customField）
        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            if (event.toState !== 'Cancelled') return;
            const code = (event.order as any).customFields?.appliedCouponCode;
            if (!code) return;
            try {
                await this.couponService.releaseCouponOnOrder(event.ctx, event.order.id);
                Logger.info(`Coupon ${code} released on order ${event.order.code} cancelled`, loggerCtx);
            } catch (e: any) {
                Logger.error(
                    `Failed to release coupon ${code} on order ${event.order.code}: ${e?.message ?? e}`,
                    loggerCtx,
                );
            }
        });

        Logger.info('CouponPlugin initialized (with Promotion bridge)', loggerCtx);
    }
}
