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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlipayController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const alipay_sdk_1 = require("alipay-sdk");
let AlipayController = class AlipayController {
    constructor(options, paymentService, channelService) {
        this.options = options;
        this.paymentService = paymentService;
        this.channelService = channelService;
    }
    async notify(req, res, body) {
        try {
            const sign = body.sign;
            const signType = body.sign_type || 'RSA2';
            const alipaySdk = new alipay_sdk_1.AlipaySdk({
                appId: body.app_id,
                privateKey: '',
                alipayPublicKey: this.options.alipayPublicKey,
                signType,
            });
            const verified = alipaySdk.checkNotifySign(body);
            if (!verified) {
                core_1.Logger.warn('Alipay notify signature verification failed', constants_1.loggerCtx);
                res.send('fail');
                return;
            }
            const tradeStatus = body.trade_status;
            const outTradeNo = body.out_trade_no;
            if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
                core_1.Logger.info(`Alipay trade success: ${outTradeNo}`, constants_1.loggerCtx);
            }
            res.send('success');
        }
        catch (e) {
            core_1.Logger.error(`Alipay notify error: ${e.message}`, constants_1.loggerCtx);
            res.send('fail');
        }
    }
};
exports.AlipayController = AlipayController;
__decorate([
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AlipayController.prototype, "notify", null);
exports.AlipayController = AlipayController = __decorate([
    (0, common_1.Controller)('alipay'),
    __param(0, (0, common_1.Inject)(constants_1.ALIPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.PaymentService,
        core_1.ChannelService])
], AlipayController);
//# sourceMappingURL=alipay.controller.js.map