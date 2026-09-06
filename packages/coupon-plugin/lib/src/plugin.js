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
var CouponPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const constants_1 = require("./constants");
const coupon_admin_resolver_1 = require("./coupon-admin.resolver");
const coupon_customer_coupon_resolver_1 = require("./coupon-customer-coupon.resolver");
const coupon_template_resolver_1 = require("./coupon-template.resolver");
const coupon_promotion_action_1 = require("./coupon-promotion-action");
const coupon_promotion_condition_1 = require("./coupon-promotion-condition");
const coupon_runtime_1 = require("./coupon-runtime");
const coupon_service_1 = require("./coupon.service");
const coupon_shop_resolver_1 = require("./coupon-shop.resolver");
const coupon_template_entity_1 = require("./coupon-template.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const order_custom_fields_1 = require("./order-custom-fields");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations several times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
}
const couponTemplateType = `
type CouponTemplate implements Node {
    id: ID!
    name: String!
    description: String
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
let CouponPlugin = CouponPlugin_1 = class CouponPlugin {
    constructor(options, couponService, eventBus, moduleRef) {
        this.options = options;
        this.couponService = couponService;
        this.eventBus = eventBus;
        this.moduleRef = moduleRef;
    }
    static init(options) {
        CouponPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return CouponPlugin_1;
    }
    async onApplicationBootstrap() {
        this.injector = new core_2.Injector(this.moduleRef);
        this.couponService.init(this.injector);
        (0, coupon_runtime_1.setCouponConnection)(this.injector.get(core_2.TransactionalConnection));
        // 支付成功（订单下单成功）核销券
        this.eventBus.ofType(core_2.OrderPlacedEvent).subscribe(async (event) => {
            try {
                await this.couponService.bindAsUsed(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to bind coupon as used on order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
            }
        });
        // 订单取消回退券（幂等）
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled')
                return;
            try {
                await this.couponService.returnCoupon(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to return coupon on order ${event.order.id} cancel: ${e.message}`, constants_1.loggerCtx);
            }
        });
        core_2.Logger.info('CouponPlugin initialized', constants_1.loggerCtx);
    }
};
exports.CouponPlugin = CouponPlugin;
CouponPlugin.options = {};
exports.CouponPlugin = CouponPlugin = CouponPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [coupon_template_entity_1.CouponTemplate, customer_coupon_entity_1.CustomerCoupon],
        providers: [
            { provide: constants_1.COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
            coupon_service_1.CouponService,
        ],
        exports: [coupon_service_1.CouponService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE }

            ${couponTemplateType}
            ${customerCouponType}

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
                name: String!
                description: String
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
                shopId: ID
            }

            input UpdateCouponTemplateInput {
                id: ID!
                name: String
                description: String
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
            }

            input CouponTemplateListOptions

            input CustomerCouponListOptions

            extend type Query {
                couponTemplates(options: CouponTemplateListOptions): CouponTemplateList!
                couponTemplate(id: ID!): CouponTemplate
                customerCoupons(options: CustomerCouponListOptions): CustomerCouponList!
                couponChannelCustomers(query: String, take: Int, skip: Int): CouponIssueCustomerList!
            }

            extend type Mutation {
                createCouponTemplate(input: CreateCouponTemplateInput!): CouponTemplate!
                updateCouponTemplate(input: UpdateCouponTemplateInput!): CouponTemplate!
                deleteCouponTemplate(id: ID!): Boolean!
                grantCoupon(templateId: ID!, customerIds: [ID!]!): [String!]!
                revokeCustomerCoupon(id: ID!): CustomerCoupon!
                grantCouponIssue(templateId: ID!, customerIds: [ID!]!, notify: Boolean!): [CouponIssueResult!]!
            }
        `,
            resolvers: [coupon_admin_resolver_1.CouponAdminResolver, coupon_template_resolver_1.CouponTemplateResolver, coupon_customer_coupon_resolver_1.CustomerCouponResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
            enum CouponType { FIXED PERCENT FULL FREE_SHIPPING }
            enum CouponStatus { UNUSED USED RETURNED EXPIRED INVALID }
            enum CouponIssuedBy { CENTRE ADMIN EXCHANGE }

            ${couponTemplateType}
            ${customerCouponType}

            type ExchangeCouponResult {
                coupon: CustomerCoupon!
                spentPoints: Int!
            }

            extend type Query {
                couponCentre: [CouponTemplate!]!
                myCoupons(status: CouponStatus): [CustomerCoupon!]!
                pointsMallTemplates: [CouponTemplate!]!
            }

            extend type Mutation {
                claimCoupon(templateId: ID!): CustomerCoupon!
                applyCouponToOrder(code: String!): Order!
                clearCouponFromOrder: Order!
                exchangeCouponWithPoints(templateId: ID!): ExchangeCouponResult!
            }
        `,
            resolvers: [coupon_shop_resolver_1.CouponShopResolver, coupon_template_resolver_1.CouponTemplateResolver, coupon_customer_coupon_resolver_1.CustomerCouponResolver],
        },
        configuration: (config) => {
            var _a, _b;
            config.customFields.Order = mergeCustomFields(config.customFields.Order, order_custom_fields_1.couponOrderCustomFields.Order);
            config.promotionOptions = config.promotionOptions || {};
            config.promotionOptions.promotionConditions = [
                ...((_a = config.promotionOptions.promotionConditions) !== null && _a !== void 0 ? _a : []),
                coupon_promotion_condition_1.couponAppliedCondition,
            ];
            config.promotionOptions.promotionActions = [
                ...((_b = config.promotionOptions.promotionActions) !== null && _b !== void 0 ? _b : []),
                coupon_promotion_action_1.couponDiscountAction,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.COUPON_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, coupon_service_1.CouponService,
        core_2.EventBus,
        core_1.ModuleRef])
], CouponPlugin);
//# sourceMappingURL=plugin.js.map