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
        controllers: [alipay_controller_1.AlipayController],
        providers: [{ provide: constants_1.ALIPAY_PLUGIN_OPTIONS, useFactory: () => AlipayPlugin.options }],
        configuration: config => {
            config.paymentOptions.paymentMethodHandlers = [
                ...(config.paymentOptions.paymentMethodHandlers || []),
                alipay_handler_1.alipayPaymentHandler,
            ];
            return config;
        },
        compatibility: '^3.0.0',
    }),
    __param(0, (0, common_1.Inject)(constants_1.ALIPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], AlipayPlugin);
//# sourceMappingURL=plugin.js.map