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
var MultivendorPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultivendorPlugin = void 0;
const core_1 = require("@vendure/core");
const api_extensions_1 = require("./api/api-extensions");
const mv_resolver_1 = require("./api/mv.resolver");
const mv_order_process_1 = require("./config/mv-order-process");
const mv_order_seller_strategy_1 = require("./config/mv-order-seller-strategy");
const mv_payment_handler_1 = require("./config/mv-payment-handler");
const mv_shipping_eligibility_checker_1 = require("./config/mv-shipping-eligibility-checker");
const mv_shipping_line_assignment_strategy_1 = require("./config/mv-shipping-line-assignment-strategy");
const constants_1 = require("./constants");
const mv_service_1 = require("./service/mv.service");
/**
 * @description
 * This is an example of how to implement a multivendor marketplace app using the new features introduced in
 * Vendure v2.0.
 *
 * ## Setup
 *
 * Add this plugin to your VendureConfig:
 * ```ts
 *  plugins: [
 *    MultivendorPlugin.init({
 *        platformFeePercent: 10,
 *        platformFeeSKU: 'FEE',
 *    }),
 *    // ...
 *  ]
 * ```
 *
 * ## Create a Seller
 *
 * Now you can create new sellers with the following mutation:
 *
 * ```graphql
 * mutation RegisterSeller {
 *   registerNewSeller(input: {
 *     shopName: "Bob's Parts",
 *     seller {
 *       firstName: "Bob"
 *       lastName: "Dobalina"
 *       emailAddress: "bob@bobs-parts.com"
 *       password: "test",
 *     }
 *   }) {
 *     id
 *     code
 *     token
 *   }
 * }
 * ```
 *
 * This mutation will:
 *
 * - Create a new Seller representing the shop "Bob's Parts"
 * - Create a new Channel and associate it with the new Seller
 * - Create a Role & Administrator for Bob to access his shop admin account
 * - Create a ShippingMethod for Bob's shop
 * - Create a StockLocation for Bob's shop
 *
 * Bob can then go and sign in to the Admin UI using the provided emailAddress & password credentials, and start
 * creating some products.
 *
 * Repeat this process for more Sellers.
 *
 * ## Storefront
 *
 * To create a multivendor Order, use the default Channel in the storefront and add variants to an Order from
 * various Sellers.
 *
 * ### Shipping
 *
 * When it comes to setting the shipping method, the `eligibleShippingMethods` query should just return the
 * shipping methods for the shops from which the OrderLines come. So assuming the Order contains items from 3 different
 * Sellers, there should be at least 3 eligible ShippingMethods (plus any global ones from the default Channel).
 *
 * You should now select the IDs of all the Seller-specific ShippingMethods:
 *
 * ```graphql
 * mutation {
 *   setOrderShippingMethod(shippingMethodId: ["3", "4"]) {
 *     ... on Order {
 *       id
 *     }
 *   }
 * }
 * ```
 *
 * ### Payment
 *
 * This plugin automatically creates a "connected payment method" in the default Channel, which is a simple simulation
 * of something like Stripe Connect.
 *
 * ```graphql
 * mutation {
 *   addPaymentToOrder(input: { method: "connected-payment-method", metadata: {} }) {
 *     ... on Order { id }
 *     ... on ErrorResult {
 *       errorCode
 *       message
 *     }
 *     ... on PaymentFailedError {
 *       paymentErrorMessage
 *     }
 *   }
 * }
 * ```
 *
 * After that, you should be able to see that the Order has been split into an "aggregate" order in the default Channel,
 * and then one or more "seller" orders in each Channel from which the customer bought items.
 */
let MultivendorPlugin = MultivendorPlugin_1 = class MultivendorPlugin {
    constructor(connection, channelService, requestContextService, paymentMethodService) {
        this.connection = connection;
        this.channelService = channelService;
        this.requestContextService = requestContextService;
        this.paymentMethodService = paymentMethodService;
    }
    static init(options) {
        MultivendorPlugin_1.options = options;
        return MultivendorPlugin_1;
    }
    async onApplicationBootstrap() {
        await this.ensureConnectedPaymentMethodExists();
    }
    async ensureConnectedPaymentMethodExists() {
        const paymentMethod = await this.connection.rawConnection.getRepository(core_1.PaymentMethod).findOne({
            where: {
                code: constants_1.CONNECTED_PAYMENT_METHOD_CODE,
            },
        });
        if (!paymentMethod) {
            const ctx = await this.requestContextService.create({ apiType: 'admin' });
            const allChannels = await this.connection.getRepository(ctx, core_1.Channel).find();
            const createdPaymentMethod = await this.paymentMethodService.create(ctx, {
                code: constants_1.CONNECTED_PAYMENT_METHOD_CODE,
                enabled: true,
                handler: {
                    code: mv_payment_handler_1.multivendorPaymentMethodHandler.code,
                    arguments: [],
                },
                translations: [
                    {
                        languageCode: core_1.LanguageCode.en,
                        name: 'Connected Payments',
                    },
                ],
            });
            await this.channelService.assignToChannels(ctx, core_1.PaymentMethod, createdPaymentMethod.id, allChannels.map(c => c.id));
        }
    }
};
exports.MultivendorPlugin = MultivendorPlugin;
exports.MultivendorPlugin = MultivendorPlugin = MultivendorPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        configuration: config => {
            config.customFields.Seller.push({
                name: 'connectedAccountId',
                label: [{ languageCode: core_1.LanguageCode.en, value: 'Connected account ID' }],
                description: [
                    { languageCode: core_1.LanguageCode.en, value: 'The ID used to process connected payments' },
                ],
                type: 'string',
                public: false,
            });
            config.paymentOptions.paymentMethodHandlers.push(mv_payment_handler_1.multivendorPaymentMethodHandler);
            const customDefaultOrderProcess = (0, core_1.configureDefaultOrderProcess)({
                checkFulfillmentStates: false,
            });
            config.orderOptions.process = [customDefaultOrderProcess, mv_order_process_1.multivendorOrderProcess];
            config.orderOptions.orderSellerStrategy = new mv_order_seller_strategy_1.MultivendorSellerStrategy();
            config.catalogOptions.productVariantPriceUpdateStrategy =
                new core_1.DefaultProductVariantPriceUpdateStrategy({
                    syncPricesAcrossChannels: true,
                });
            config.shippingOptions.shippingEligibilityCheckers.push(mv_shipping_eligibility_checker_1.multivendorShippingEligibilityChecker);
            config.shippingOptions.shippingLineAssignmentStrategy =
                new mv_shipping_line_assignment_strategy_1.MultivendorShippingLineAssignmentStrategy();
            return config;
        },
        shopApiExtensions: {
            schema: api_extensions_1.shopApiExtensions,
            resolvers: [mv_resolver_1.MultivendorResolver],
        },
        providers: [
            mv_service_1.MultivendorService,
            { provide: constants_1.MULTIVENDOR_PLUGIN_OPTIONS, useFactory: () => MultivendorPlugin.options },
        ],
    }),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ChannelService,
        core_1.RequestContextService,
        core_1.PaymentMethodService])
], MultivendorPlugin);
//# sourceMappingURL=multivendor.plugin.js.map