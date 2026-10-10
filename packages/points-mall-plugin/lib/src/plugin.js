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
var PointsMallPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PointsMallPlugin = void 0;
const core_1 = require("@nestjs/core");
const core_2 = require("@vendure/core");
const member_level_plugin_1 = require("@vendure/member-level-plugin");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const constants_1 = require("./constants");
const points_mall_admin_resolver_1 = require("./points-mall-admin.resolver");
const points_mall_service_1 = require("./points-mall.service");
const points_mall_shop_resolver_1 = require("./points-mall-shop.resolver");
const points_order_expiry_task_1 = require("./points-order-expiry.task");
const product_favorite_entity_1 = require("./product-favorite.entity");
const points_order_entity_1 = require("./points-order.entity");
const points_order_payment_entity_1 = require("./points-order-payment.entity");
const points_product_entity_1 = require("./points-product.entity");
const { gql } = require('graphql-tag');
let pluginOptions = {};
const shopSchema = () => gql `
    type PointsProduct implements Node {
        id: ID!
        productId: ID!
        variantId: ID!
        name: String!
        slug: String!
        image: String
        pointsPrice: Int!
        cashPrice: Int!
        deliveryType: String!
        stock: Int!
        perUserLimit: Int!
        redeemedCount: Int!
        myRedeemedCount: Int!
        validFrom: DateTime
        validTo: DateTime
        sortOrder: Int!
        priceWithTax: Int!
        inStock: Boolean!
    }
    type PointsProductList implements PaginatedList {
        items: [PointsProduct!]!
        totalItems: Int!
    }
    input PointsProductListOptions {
        skip: Int
        take: Int
    }
    type FavoriteProductView {
        productId: ID!
        name: String!
        slug: String!
        image: String
        priceWithTax: Int!
        isOnSale: Boolean!
        pointsPrice: Int
        favoritedAt: DateTime!
    }
    type FavoriteProductList {
        items: [FavoriteProductView!]!
        totalItems: Int!
    }
    type ToggleFavoriteResult {
        favorited: Boolean!
        favoriteCount: Int!
    }
    type FavoriteMeta {
        favoriteCount: Int!
        myFavorited: Boolean!
    }
    type ProductSnapshot {
        productId: ID
        variantId: ID
        name: String
        image: String
        spec: String
    }
    type AddressSnapshot {
        name: String
        phone: String
        province: String
        city: String
        district: String
        detail: String
    }
    type PointsOrder implements Node {
        id: ID!
        code: String!
        customerId: ID!
        quantity: Int!
        pointsTotal: Int!
        cashTotal: Int!
        deliveryType: String!
        status: String!
        productSnapshot: ProductSnapshot
        addressSnapshot: AddressSnapshot
        trackingNo: String
        paidAt: DateTime
        shippedAt: DateTime
        completedAt: DateTime
        createdAt: DateTime!
    }
    type PointsOrderList implements PaginatedList {
        items: [PointsOrder!]!
        totalItems: Int!
    }
    input PointsOrderListOptions {
        skip: Int
        take: Int
        status: String
    }
    type PointsPayParams {
        pointsOrderId: ID!
        outTradeNo: String!
        pay: JSON!
    }
    input CreatePointsOrderInput {
        pointsProductId: ID!
        quantity: Int!
        addressId: ID
    }
    extend type Query {
        pointsProducts(options: PointsProductListOptions): PointsProductList!
        pointsProduct(id: ID!): PointsProduct
        myFavorites(options: PointsProductListOptions): FavoriteProductList!
        productFavoriteMeta(productId: ID!): FavoriteMeta!
        myPointsOrders(options: PointsOrderListOptions): PointsOrderList!
        myPointsOrder(id: ID!): PointsOrder
    }
    extend type Mutation {
        toggleProductFavorite(productId: ID!): ToggleFavoriteResult!
        createPointsOrderExchange(input: CreatePointsOrderInput!): PointsOrder!
        createPointsOrderPayment(pointsOrderId: ID!, tradeType: String, openid: String): PointsPayParams!
        cancelPointsOrder(id: ID!): PointsOrder!
    }
`;
const adminSchema = () => gql `
    type PointsProductAdmin implements Node {
        id: ID!
        productId: ID!
        variantId: ID!
        pointsPrice: Int!
        cashPrice: Int!
        deliveryType: String!
        stock: Int!
        perUserLimit: Int!
        redeemedCount: Int!
        validFrom: DateTime
        validTo: DateTime
        status: String!
        sortOrder: Int!
    }
    type PointsProductAdminList implements PaginatedList {
        items: [PointsProductAdmin!]!
        totalItems: Int!
    }
    input PointsProductAdminListOptions {
        skip: Int
        take: Int
        keyword: String
    }
    input CreatePointsProductInput {
        productId: ID!
        variantId: ID!
        pointsPrice: Int!
        cashPrice: Int
        deliveryType: String!
        stock: Int!
        perUserLimit: Int
        validFrom: DateTime
        validTo: DateTime
        status: String
        sortOrder: Int
    }
    input UpdatePointsProductInput {
        id: ID!
        pointsPrice: Int
        cashPrice: Int
        deliveryType: String
        stock: Int
        perUserLimit: Int
        validFrom: DateTime
        validTo: DateTime
        status: String
        sortOrder: Int
    }
    type PointsOrderAdmin implements Node {
        id: ID!
        code: String!
        customerId: ID!
        quantity: Int!
        pointsTotal: Int!
        cashTotal: Int!
        deliveryType: String!
        status: String!
        productSnapshot: JSON
        addressSnapshot: JSON
        trackingNo: String
        paidAt: DateTime
        shippedAt: DateTime
        completedAt: DateTime
        createdAt: DateTime!
    }
    type PointsOrderAdminList implements PaginatedList {
        items: [PointsOrderAdmin!]!
        totalItems: Int!
    }
    input PointsOrderAdminListOptions {
        skip: Int
        take: Int
        status: String
        keyword: String
    }
    extend type Query {
        pointsProductsAdmin(options: PointsProductAdminListOptions): PointsProductAdminList!
        pointsOrdersAdmin(options: PointsOrderAdminListOptions): PointsOrderAdminList!
    }
    extend type Mutation {
        createPointsProduct(input: CreatePointsProductInput!): PointsProductAdmin!
        updatePointsProduct(input: UpdatePointsProductInput!): PointsProductAdmin!
        deletePointsProduct(id: ID!): Boolean!
        markPointsOrderPaid(id: ID!): PointsOrderAdmin!
        markPointsOrderShipped(id: ID!, trackingNo: String): PointsOrderAdmin!
        markPointsOrderCompleted(id: ID!): PointsOrderAdmin!
    }
`;
let PointsMallPlugin = PointsMallPlugin_1 = class PointsMallPlugin {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    static init(options = {}) {
        pluginOptions = options;
        return PointsMallPlugin_1;
    }
    async onApplicationBootstrap() {
        const injector = new core_2.Injector(this.moduleRef);
        let svc;
        try {
            svc = injector.get(points_mall_service_1.PointsMallService);
        }
        catch (_a) {
            return;
        }
        try {
            const memberLevel = injector.get(member_level_plugin_1.MemberLevelService);
            svc.setMemberLevelService(memberLevel);
        }
        catch (_b) {
            // 未加载 member-level 插件 → 收藏/商城浏览可用，积分兑换不可用
        }
        try {
            const gateway = injector.get(wechatpay_plugin_1.WechatpayService);
            svc.setWechatpayGateway(gateway);
            const registry = injector.get(wechatpay_plugin_1.WechatpaySettlementRegistry);
            registry.register({
                prefix: 'PO-',
                settle: (ctx, outTradeNo) => svc.settlePointsOrderByOutTradeNo(ctx, outTradeNo),
            });
        }
        catch (_c) {
            // 未注册微信网关 → 纯积分模式可用
        }
    }
};
exports.PointsMallPlugin = PointsMallPlugin;
exports.PointsMallPlugin = PointsMallPlugin = PointsMallPlugin_1 = __decorate([
    (0, core_2.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        entities: [product_favorite_entity_1.ProductFavorite, points_product_entity_1.PointsProduct, points_order_entity_1.PointsOrder, points_order_payment_entity_1.PointsOrderPayment],
        providers: [
            points_mall_service_1.PointsMallService,
            { provide: constants_1.POINTS_MALL_PLUGIN_OPTIONS, useFactory: () => pluginOptions },
        ],
        shopApiExtensions: {
            schema: shopSchema,
            resolvers: [points_mall_shop_resolver_1.PointsMallShopResolver],
        },
        adminApiExtensions: {
            schema: adminSchema,
            resolvers: [points_mall_admin_resolver_1.PointsMallAdminResolver],
        },
        compatibility: '^3.0.0',
        configuration: (config) => {
            // 注册待支付订单超时关单 ScheduledTask（幂等：configuration 可能被调用多次）
            if (!config.schedulerOptions) {
                config.schedulerOptions = { tasks: [] };
            }
            if (!config.schedulerOptions.tasks) {
                config.schedulerOptions.tasks = [];
            }
            if (!config.schedulerOptions.tasks.some(t => t.id === constants_1.POINTS_ORDER_EXPIRY_TASK_ID)) {
                config.schedulerOptions.tasks.push(points_order_expiry_task_1.pointsOrderExpiryTask);
            }
            return config;
        },
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], PointsMallPlugin);
//# sourceMappingURL=plugin.js.map