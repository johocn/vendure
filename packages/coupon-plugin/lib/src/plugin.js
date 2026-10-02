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
const coupon_binding_admin_resolver_1 = require("./coupon-binding-admin.resolver");
const coupon_binding_service_1 = require("./coupon-binding.service");
const coupon_bundle_resolver_1 = require("./coupon-bundle.resolver");
const coupon_balance_port_1 = require("./coupon-balance-port");
const coupon_sale_admin_resolver_1 = require("./coupon-sale-admin.resolver");
const coupon_sale_shop_resolver_1 = require("./coupon-sale-shop.resolver");
const coupon_sale_service_1 = require("./coupon-sale.service");
const coupon_customer_coupon_resolver_1 = require("./coupon-customer-coupon.resolver");
const coupon_template_resolver_1 = require("./coupon-template.resolver");
const coupon_promotion_action_1 = require("./coupon-promotion-action");
const coupon_promotion_condition_1 = require("./coupon-promotion-condition");
const coupon_runtime_1 = require("./coupon-runtime");
const coupon_settlement_1 = require("./coupon-settlement");
const coupon_service_1 = require("./coupon.service");
const coupon_shop_resolver_1 = require("./coupon-shop.resolver");
const coupon_template_entity_1 = require("./coupon-template.entity");
const coupon_bundle_entity_1 = require("./coupon-bundle.entity");
const coupon_sale_order_entity_1 = require("./coupon-sale-order.entity");
const customer_coupon_entity_1 = require("./customer-coupon.entity");
const migrations_1 = require("./migrations");
const add_coupon_distribution_channels_1 = require("./migrations/add-coupon-distribution-channels");
const in_store_bill_entity_1 = require("./in-store-bill.entity");
const in_store_bill_admin_resolver_1 = require("./in-store-bill-admin.resolver");
const in_store_bill_service_1 = require("./in-store-bill.service");
const order_custom_fields_1 = require("./order-custom-fields");
const product_coupon_binding_entity_1 = require("./product-coupon-binding.entity");
/** Idempotently merge custom fields, deduplicating by field name (preBootstrapConfig may run plugin configurations several times). */
function mergeCustomFields(existingFields, additions) {
    const names = new Set((existingFields !== null && existingFields !== void 0 ? existingFields : []).map(f => f.name));
    return [...(existingFields !== null && existingFields !== void 0 ? existingFields : []), ...(additions !== null && additions !== void 0 ? additions : []).filter(f => !names.has(f.name))];
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
        var _a;
        this.injector = new core_2.Injector(this.moduleRef);
        this.couponService.init(this.injector);
        (0, coupon_runtime_1.setCouponConnection)(this.injector.get(core_2.TransactionalConnection));
        (0, coupon_settlement_1.setBindingService)(this.injector.get(coupon_binding_service_1.CouponBindingService));
        // 余额能力端口（可选依赖 recharge-card-plugin）：未装载时余额支付入口一律不可用
        try {
            const { RechargeCardService } = await import('@vendure/recharge-card-plugin');
            const svc = this.injector.get(RechargeCardService);
            (0, coupon_balance_port_1.setCouponBalancePort)({
                getBalance: (ctx, cid) => svc.getBalance(ctx, cid),
                deductBalance: (ctx, cid, amt) => svc.deductBalance(ctx, cid, amt),
                addBalance: (ctx, cid, amt) => svc.addBalance(ctx, cid, amt, null, null),
            });
            core_2.Logger.info('Coupon balance port registered (recharge-card)', constants_1.loggerCtx);
        }
        catch (e) {
            (0, coupon_balance_port_1.setCouponBalancePort)(null);
            core_2.Logger.info('Coupon balance port unavailable (recharge-card not registered)', constants_1.loggerCtx);
        }
        // 微信回调结算注册（前缀 CS-）+ 网关引用注入（可选依赖 wechatpay-plugin）
        try {
            const { WechatpaySettlementRegistry, WechatpayService } = await import('@vendure/wechatpay-plugin');
            const registry = this.injector.get(WechatpaySettlementRegistry);
            const gateway = this.injector.get(WechatpayService);
            (0, coupon_sale_service_1.setCouponSaleGateway)(gateway);
            const saleService = this.injector.get(coupon_sale_service_1.CouponSaleService);
            registry.register({
                prefix: 'CS-',
                settle: (ctx, outTradeNo) => saleService.settleCouponSaleOrderByOutTradeNo(ctx, outTradeNo),
            });
            core_2.Logger.info('CouponSaleOrder ~CS- settlement registered (wechatpay gateway)', constants_1.loggerCtx);
        }
        catch (e) {
            (0, coupon_sale_service_1.setCouponSaleGateway)(null);
            core_2.Logger.warn('Wechatpay settlement registry unavailable for coupon sale', constants_1.loggerCtx);
        }
        // 可选定时清扫：收敛无人访问的存量过期券（惰性 on-read 已覆盖用户路径，此为长线兜底）。
        // 显式 set COUPON_EXPIRE_SWEEP_MS 才启动；默认关闭避免生产意外全量 UPDATE。
        const sweepMs = Number((_a = process.env.COUPON_EXPIRE_SWEEP_MS) !== null && _a !== void 0 ? _a : 0);
        if (sweepMs > 0) {
            const sweep = () => {
                this.couponService
                    .expireDueCouponsAll()
                    .then((n) => {
                    if (n > 0)
                        core_2.Logger.info(`Expired ${n} coupon(s) via sweep`, constants_1.loggerCtx);
                })
                    .catch((e) => core_2.Logger.error(`Coupon expire sweep failed: ${e.message}`, constants_1.loggerCtx));
            };
            sweep();
            setInterval(sweep, sweepMs);
            core_2.Logger.info(`Coupon expire sweep enabled (every ${sweepMs}ms)`, constants_1.loggerCtx);
        }
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
        // 整单全额退款回退券（A3）：累计已退金额达应付 → 回退；部分退不触发（返回由 returnCoupon 保证幂等）
        this.eventBus.ofType(core_2.RefundStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Settled')
                return;
            try {
                await this.couponService.returnCouponOnFullRefund(event.ctx, event.refund.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to return coupon on refund ${event.refund.id}: ${e.message}`, constants_1.loggerCtx);
            }
            // 加价购：整单退款 Settled → 回收加价购券（与订单取消同语义）
            try {
                await this.injector
                    .get(coupon_sale_service_1.CouponSaleService)
                    .refundSurchargeOrdersForOrder(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to recycle coupon surcharge on refund of order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
            }
        });
        // 加价购：主订单支付成功 → 结算 PENDING 加价购单并发券
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'PaymentSettled')
                return;
            try {
                await this.injector
                    .get(coupon_sale_service_1.CouponSaleService)
                    .settleSurchargeOrdersForOrder(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to settle coupon surcharge on order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
            }
        });
        // 加价购：主订单取消 / 整单退款 → 回收加价购券（钱随主订单退回）
        this.eventBus.ofType(core_2.OrderStateTransitionEvent).subscribe(async (event) => {
            if (event.toState !== 'Cancelled')
                return;
            try {
                await this.injector
                    .get(coupon_sale_service_1.CouponSaleService)
                    .refundSurchargeOrdersForOrder(event.ctx, event.order.id);
            }
            catch (e) {
                core_2.Logger.error(`Failed to recycle coupon surcharge on order ${event.order.id}: ${e.message}`, constants_1.loggerCtx);
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
        entities: [coupon_template_entity_1.CouponTemplate, customer_coupon_entity_1.CustomerCoupon, product_coupon_binding_entity_1.ProductCouponBinding, in_store_bill_entity_1.InStoreBill, coupon_sale_order_entity_1.CouponSaleOrder, coupon_bundle_entity_1.CouponBundle, coupon_bundle_entity_1.CouponBundleItem],
        providers: [
            { provide: constants_1.COUPON_PLUGIN_OPTIONS, useFactory: () => CouponPlugin.options },
            coupon_service_1.CouponService,
            coupon_binding_service_1.CouponBindingService,
            coupon_sale_service_1.CouponSaleService,
            in_store_bill_service_1.InStoreBillService,
            migrations_1.AddCouponFieldsMigration,
            migrations_1.CreateProductCouponBindingMigration,
            migrations_1.AddCouponIndexes20260919,
            migrations_1.AddCouponUsageSceneMigration,
            add_coupon_distribution_channels_1.AddCouponDistributionChannelsMigration,
            migrations_1.CreateInStoreBillMigration,
            migrations_1.CreateCouponSaleMigration,
        ],
        exports: [coupon_service_1.CouponService, coupon_binding_service_1.CouponBindingService, coupon_sale_service_1.CouponSaleService],
        adminApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
            resolvers: [coupon_admin_resolver_1.CouponAdminResolver, coupon_template_resolver_1.CouponTemplateResolver, coupon_customer_coupon_resolver_1.CustomerCouponResolver, coupon_binding_admin_resolver_1.CouponBindingAdminResolver, in_store_bill_admin_resolver_1.InStoreBillAdminResolver, coupon_sale_admin_resolver_1.CouponSaleAdminResolver, coupon_bundle_resolver_1.CouponBundleResolver],
        },
        shopApiExtensions: {
            schema: () => (0, graphql_tag_1.default) `
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
                myCoupons(status: CouponStatus): [CustomerCoupon!]!
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
            resolvers: [coupon_shop_resolver_1.CouponShopResolver, coupon_template_resolver_1.CouponTemplateResolver, coupon_customer_coupon_resolver_1.CustomerCouponResolver, coupon_sale_shop_resolver_1.CouponSaleShopResolver, coupon_bundle_resolver_1.CouponBundleResolver],
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