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
var MarketplacePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplacePlugin = void 0;
const graphql_1 = require("graphql");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const ledger_service_1 = require("./ledger.service");
const marketplace_inventory_ledger_entity_1 = require("./entities/marketplace-inventory-ledger.entity");
const custom_fields_1 = require("./custom-fields");
const marketplace_service_1 = require("./marketplace.service");
const marketplace_seller_service_1 = require("./marketplace-seller-service");
const api_extensions_1 = require("./api/api-extensions");
const shop_resolver_1 = require("./api/shop.resolver");
const mv_shipping_eligibility_checker_1 = require("./config/mv-shipping-eligibility-checker");
const marketplace_seller_strategy_1 = require("./marketplace-seller.strategy");
const marketplace_stock_strategy_1 = require("./marketplace-stock.strategy");
const marketplace_order_process_1 = require("./marketplace-order-process");
const api_extensions_2 = require("./payment/api-extensions");
const direct_payment_resolver_1 = require("./payment/direct-payment.resolver");
const admin_api_extensions_1 = require("./api/admin.api-extensions");
const admin_resolver_1 = require("./api/admin.resolver");
const merchant_api_controller_1 = require("./api/merchant-api.controller");
const settlement_service_1 = require("./settlement.service");
let MarketplacePlugin = MarketplacePlugin_1 = class MarketplacePlugin {
    constructor(eventBus, connection, entityHydrator, ledgerService, roleService, channelService, configService, requestContextService) {
        this.eventBus = eventBus;
        this.connection = connection;
        this.entityHydrator = entityHydrator;
        this.ledgerService = ledgerService;
        this.roleService = roleService;
        this.channelService = channelService;
        this.configService = configService;
        this.requestContextService = requestContextService;
    }
    static init(options) {
        MarketplacePlugin_1.options = options;
        return MarketplacePlugin_1;
    }
    async onApplicationBootstrap() {
        await this.ensurePlatformOpsRole();
        this.eventBus.ofType(core_1.OrderStateTransitionEvent).subscribe(async (event) => {
            var _a;
            const { order, ctx } = event;
            // 仅记录 marketplace 商家子单的销售
            if (((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.saleSource) !== constants_1.SALE_SOURCE_MARKETPLACE) {
                return;
            }
            const states = new Set(['Shipped', 'Fulfilled', 'Delivered', 'Completed']);
            if (!event.toState || !states.has(event.toState)) {
                return;
            }
            await this.entityHydrator.hydrate(ctx, order, {
                relations: ['lines', 'lines.productVariant', 'lines.productVariant.stockLevels', 'lines.sellerChannel'],
            });
            for (const line of order.lines) {
                const merchantChannelId = line.sellerChannelId
                    ? String(line.sellerChannelId)
                    : String(ctx.channelId);
                const stockOnHand = line.productVariant.stockLevels
                    ? line.productVariant.stockLevels.reduce((sum, l) => sum + l.stockOnHand, 0)
                    : 0;
                await this.ledgerService.recordChange(ctx, {
                    variantId: line.productVariantId,
                    merchantChannelId,
                    saleSource: constants_1.SALE_SOURCE_MARKETPLACE,
                    stockBefore: stockOnHand,
                    stockAfter: stockOnHand - line.quantity,
                    stockDelta: -line.quantity,
                    actionType: 'sale',
                    orderId: String(order.id),
                });
            }
        });
        // marketplace 商家子单退款时回补库存（actionType='refund'，stockDelta 为正）
        this.eventBus.ofType(core_1.RefundEvent).subscribe(async (event) => {
            var _a, _b, _c;
            const { order, refund, ctx } = event;
            // 仅处理 marketplace 商家子单的退款
            if (((_a = order.customFields) === null || _a === void 0 ? void 0 : _a.saleSource) !== constants_1.SALE_SOURCE_MARKETPLACE) {
                return;
            }
            await this.entityHydrator.hydrate(ctx, refund, {
                relations: [
                    'lines',
                    'lines.orderLine',
                    'lines.orderLine.productVariant',
                    'lines.orderLine.productVariant.stockLevels',
                    'lines.orderLine.sellerChannel',
                ],
            });
            for (const line of (_b = refund.lines) !== null && _b !== void 0 ? _b : []) {
                const orderLine = line.orderLine;
                if (!orderLine) {
                    continue;
                }
                const merchantChannelId = orderLine.sellerChannelId
                    ? String(orderLine.sellerChannelId)
                    : String(ctx.channelId);
                const stockOnHand = ((_c = orderLine.productVariant) === null || _c === void 0 ? void 0 : _c.stockLevels)
                    ? orderLine.productVariant.stockLevels.reduce((sum, l) => sum + l.stockOnHand, 0)
                    : 0;
                await this.ledgerService.recordChange(ctx, {
                    variantId: orderLine.productVariantId,
                    merchantChannelId,
                    saleSource: constants_1.SALE_SOURCE_MARKETPLACE,
                    stockBefore: stockOnHand,
                    stockAfter: stockOnHand + line.quantity,
                    stockDelta: line.quantity,
                    actionType: 'refund',
                    orderId: String(order.id),
                });
            }
        });
    }
    /**
     * 幂等创建「平台运营」角色（code = platform-ops），用于接入 marketplace 审批等平台运营能力。
     */
    async ensurePlatformOpsRole() {
        var _a;
        const ctx = await this.getSuperAdminContext();
        const roleCode = (_a = MarketplacePlugin_1.options.platformOpsRoleCode) !== null && _a !== void 0 ? _a : 'platform-ops';
        const existing = await this.connection.getRepository(ctx, core_1.Role).findOne({
            where: { code: roleCode },
        });
        if (existing) {
            return;
        }
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        await this.roleService.create(ctx, {
            code: roleCode,
            description: '平台运营',
            channelIds: [defaultChannel.id],
            permissions: [
                core_1.Permission.ReadCatalog,
                core_1.Permission.UpdateCatalog,
                core_1.Permission.ReadProduct,
                core_1.Permission.UpdateProduct,
                core_1.Permission.ReadOrder,
                core_1.Permission.UpdateOrder,
                core_1.Permission.ReadCustomer,
            ],
        });
    }
    async getSuperAdminContext() {
        const { superadminCredentials } = this.configService.authOptions;
        const superAdminUser = await this.connection.getRepository(core_1.RequestContext.empty(), core_1.User).findOne({
            where: {
                identifier: superadminCredentials.identifier,
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return this.requestContextService.create({
            apiType: 'shop',
            user: superAdminUser,
        });
    }
};
exports.MarketplacePlugin = MarketplacePlugin;
exports.MarketplacePlugin = MarketplacePlugin = MarketplacePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [marketplace_inventory_ledger_entity_1.MarketplaceInventoryLedger],
        configuration: config => {
            config.customFields.Product = [
                ...(config.customFields.Product || []),
                ...custom_fields_1.marketplaceCustomFields.Product,
            ];
            config.customFields.Order = [
                ...(config.customFields.Order || []),
                ...custom_fields_1.marketplaceCustomFields.Order,
            ];
            config.customFields.Channel = [
                ...(config.customFields.Channel || []),
                ...custom_fields_1.marketplaceCustomFields.Channel,
            ];
            config.customFields.Seller = [
                ...(config.customFields.Seller || []),
                ...custom_fields_1.marketplaceCustomFields.Seller,
            ];
            config.shippingOptions.shippingEligibilityCheckers.push(mv_shipping_eligibility_checker_1.multivendorShippingEligibilityChecker);
            const customDefaultOrderProcess = (0, core_1.configureDefaultOrderProcess)({ checkFulfillmentStates: false });
            config.orderOptions.process = [customDefaultOrderProcess, marketplace_order_process_1.marketplaceOrderProcess];
            config.orderOptions.orderSellerStrategy = new marketplace_seller_strategy_1.MarketplaceSellerStrategy();
            config.catalogOptions.productVariantPriceUpdateStrategy =
                new core_1.DefaultProductVariantPriceUpdateStrategy({ syncPricesAcrossChannels: true });
            config.catalogOptions.stockLocationStrategy = new marketplace_stock_strategy_1.MarketplaceStockLocationStrategy();
            return config;
        },
        shopApiExtensions: {
            schema: () => (0, graphql_1.parse)(`${api_extensions_1.shopApiExtensions}\n${api_extensions_2.paymentApiExtensions}`),
            resolvers: [shop_resolver_1.ShopResolver, direct_payment_resolver_1.DirectPaymentResolver],
        },
        adminApiExtensions: {
            schema: () => (0, graphql_1.parse)(`${admin_api_extensions_1.adminApiExtensions}`),
            resolvers: [admin_resolver_1.AdminMarketplaceResolver],
        },
        providers: [
            marketplace_service_1.MarketplaceService,
            marketplace_seller_service_1.MarketplaceSellerService,
            settlement_service_1.SettlementService,
            ledger_service_1.LedgerService,
            { provide: constants_1.MARKETPLACE_PLUGIN_OPTIONS, useFactory: () => MarketplacePlugin.options },
        ],
        controllers: [merchant_api_controller_1.MerchantApiController],
    }),
    __metadata("design:paramtypes", [core_1.EventBus,
        core_1.TransactionalConnection,
        core_1.EntityHydrator,
        ledger_service_1.LedgerService,
        core_1.RoleService,
        core_1.ChannelService,
        core_1.ConfigService,
        core_1.RequestContextService])
], MarketplacePlugin);
