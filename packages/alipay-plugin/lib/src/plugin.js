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
var AlipayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlipayPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const alipay_handler_1 = require("./alipay-handler");
const alipay_controller_1 = require("./alipay.controller");
const customer_custom_fields_1 = require("./customer-custom-fields");
const alipay_auth_strategy_1 = require("./alipay-auth-strategy");
const alipay_auth_controller_1 = require("./alipay-auth.controller");
const alipay_auth_shop_resolver_1 = require("./alipay-auth-shop.resolver");
let AlipayPlugin = AlipayPlugin_1 = class AlipayPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        AlipayPlugin_1.options = options;
        return AlipayPlugin_1;
    }
};
exports.AlipayPlugin = AlipayPlugin;
exports.AlipayPlugin = AlipayPlugin = AlipayPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [alipay_controller_1.AlipayController, alipay_auth_controller_1.AlipayAuthController],
        providers: [{ provide: constants_1.ALIPAY_PLUGIN_OPTIONS, useFactory: () => AlipayPlugin.options }],
        configuration: config => {
            var _a, _b;
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                alipay_handler_1.alipayPaymentHandler,
            ];
            const strategy = new alipay_auth_strategy_1.AlipayAuthenticationStrategy(AlipayPlugin.options);
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                strategy,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Customer: [
                    ...(((_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Customer) || []),
                    ...((_b = customer_custom_fields_1.alipayCustomerCustomFields.Customer) !== null && _b !== void 0 ? _b : []),
                ] });
            return config;
        },
        shopApiExtensions: {
            schema: () => {
                const { gql } = require('graphql-tag');
                return gql `
                input AlipayAuthInput {
                    authCode: String!
                    type: String!
                }
            `;
            },
            resolvers: [alipay_auth_shop_resolver_1.AlipayAuthShopResolver],
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.ALIPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], AlipayPlugin);
//# sourceMappingURL=plugin.js.map