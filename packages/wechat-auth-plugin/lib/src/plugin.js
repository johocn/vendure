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
var WechatAuthPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatAuthPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const customer_custom_fields_1 = require("./customer-custom-fields");
const wechat_auth_strategy_1 = require("./wechat-auth-strategy");
const wechat_auth_controller_1 = require("./wechat-auth.controller");
let WechatAuthPlugin = WechatAuthPlugin_1 = class WechatAuthPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        WechatAuthPlugin_1.options = options;
        return WechatAuthPlugin_1;
    }
};
exports.WechatAuthPlugin = WechatAuthPlugin;
exports.WechatAuthPlugin = WechatAuthPlugin = WechatAuthPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [wechat_auth_controller_1.WechatAuthController],
        providers: [
            { provide: constants_1.WECHAT_AUTH_PLUGIN_OPTIONS, useFactory: () => WechatAuthPlugin.options },
        ],
        configuration: config => {
            var _a;
            const strategy = new wechat_auth_strategy_1.WechatAuthenticationStrategy(WechatAuthPlugin.options);
            config.authOptions.shopAuthenticationStrategy = [
                ...(config.authOptions.shopAuthenticationStrategy || []),
                strategy,
            ];
            config.customFields = Object.assign(Object.assign({}, config.customFields), { Customer: [
                    ...(((_a = config.customFields) === null || _a === void 0 ? void 0 : _a.Customer) || []),
                    ...customer_custom_fields_1.wechatCustomerCustomFields.Customer,
                ] });
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.WECHAT_AUTH_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], WechatAuthPlugin);
//# sourceMappingURL=plugin.js.map