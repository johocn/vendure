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
var WechatpayPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatpayPlugin = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const wechatpay_handler_1 = require("./wechatpay-handler");
const wechatpay_controller_1 = require("./wechatpay.controller");
let WechatpayPlugin = WechatpayPlugin_1 = class WechatpayPlugin {
    constructor(options) {
        this.options = options;
    }
    static init(options) {
        WechatpayPlugin_1.options = options;
        return WechatpayPlugin_1;
    }
};
exports.WechatpayPlugin = WechatpayPlugin;
exports.WechatpayPlugin = WechatpayPlugin = WechatpayPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        controllers: [wechatpay_controller_1.WechatpayController],
        providers: [{ provide: constants_1.WECHATPAY_PLUGIN_OPTIONS, useFactory: () => WechatpayPlugin.options }],
        configuration: config => {
            const handler = (0, wechatpay_handler_1.createWechatpayHandler)(WechatpayPlugin.options);
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                handler,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.WECHATPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], WechatpayPlugin);
//# sourceMappingURL=plugin.js.map