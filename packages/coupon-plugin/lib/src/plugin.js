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
var CouponPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const coupon_code_entity_1 = require("./coupon-code.entity");
const coupon_admin_resolver_1 = require("./coupon-admin.resolver");
const coupon_order_action_1 = require("./coupon-order-action");
const coupon_expire_job_1 = require("./coupon-expire.job");
const coupon_service_1 = require("./coupon.service");
const coupon_shop_resolver_1 = require("./coupon-shop.resolver");
const coupon_entity_1 = require("./coupon.entity");
const order_custom_fields_1 = require("./order-custom-fields");
const { gql } = require('graphql-tag');
const adminSchema = () => gql `
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
const shopSchema = () => gql `
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
let CouponPlugin = CouponPlugin_1 = class CouponPlugin {
    constructor(options, couponService, eventBus) {
        this.options = options;
        this.couponService = couponService;
        this.eventBus = eventBus;
    }
    static init(options) {
        CouponPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return CouponPlugin_1;
    }
    async onApplicationBootstrap() {
        // 注入 service 引用给 PromotionOrderAction（模块级单例）
        (0, coupon_order_action_1.setCouponServiceRef)(this.couponService);
        // 订单下单后核销券码
        this.eventBus.ofType(core_1.OrderPlacedEvent).subscribe(async (event) => {
            var _a, _b;
            const code = (_a = event.order.customFields) === null || _a === void 0 ? void 0 : _a.appliedCouponCode;
            if (!code)
                return;
            try {
                await this.couponService.redeemCoupon(event.ctx, code, event.order.id);
                core_1.Logger.info(`Coupon ${code} redeemed on order ${event.order.code} placed`, constants_1.loggerCtx);
            }
            catch (e) {
                core_1.Logger.error(`Failed to redeem coupon ${code} on order ${event.order.code}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            }
        });
        // 订单取消时释放券码（releaseCouponOnOrder 内部已调用 releaseCoupon + 清除 customField）
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a, _b;
            if (event.toState !== 'Cancelled')
                return;
            const code = (_a = event.order.customFields) === null || _a === void 0 ? void 0 : _a.appliedCouponCode;
            if (!code)
                return;
            try {
                await this.couponService.releaseCouponOnOrder(event.ctx, event.order.id);
                core_1.Logger.info(`Coupon ${code} released on order ${event.order.code} cancelled`, constants_1.loggerCtx);
            }
            catch (e) {
                core_1.Logger.error(`Failed to release coupon ${code} on order ${event.order.code}: ${(_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e}`, constants_1.loggerCtx);
            }
        });
        core_1.Logger.info('CouponPlugin initialized (with Promotion bridge)', constants_1.loggerCtx);
    }
};
exports.CouponPlugin = CouponPlugin;
CouponPlugin.options = {};
exports.CouponPlugin = CouponPlugin = CouponPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [coupon_entity_1.Coupon, coupon_code_entity_1.CouponCode],
        providers: [
            { provide: constants_1.COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
            coupon_service_1.CouponService,
        ],
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [coupon_admin_resolver_1.CouponAdminResolver],
        },
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [coupon_shop_resolver_1.CouponShopResolver],
        },
        configuration: config => {
            var _a, _b, _c;
            config.customFields.Order = [
                ...((_a = config.customFields.Order) !== null && _a !== void 0 ? _a : []),
                ...((_b = order_custom_fields_1.couponOrderCustomFields.Order) !== null && _b !== void 0 ? _b : []),
            ];
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionActions = [
                ...((_c = config.promotionOptions.promotionActions) !== null && _c !== void 0 ? _c : []),
                coupon_order_action_1.couponOrderAction,
            ];
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            config.schedulerOptions.tasks.push(coupon_expire_job_1.expireCouponsTask);
            return config;
        },
        dashboard: '../dashboard/index.tsx',
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.COUPON_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, coupon_service_1.CouponService,
        core_1.EventBus])
], CouponPlugin);
//# sourceMappingURL=plugin.js.map