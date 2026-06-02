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
exports.WechatpayController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
let WechatpayController = class WechatpayController {
    constructor(options, orderService, channelService) {
        this.options = options;
        this.orderService = orderService;
        this.channelService = channelService;
    }
    async notify(req, res, body) {
        try {
            const eventType = body === null || body === void 0 ? void 0 : body.event_type;
            if (eventType === 'TRANSACTION.SUCCESS') {
                const resource = body === null || body === void 0 ? void 0 : body.resource;
                const ciphertext = resource === null || resource === void 0 ? void 0 : resource.ciphertext;
                const outTradeNo = ciphertext === null || ciphertext === void 0 ? void 0 : ciphertext.out_trade_no;
                const transactionId = ciphertext === null || ciphertext === void 0 ? void 0 : ciphertext.transaction_id;
                core_1.Logger.info(`WeChat Pay trade success: ${outTradeNo}, txId: ${transactionId}`, constants_1.loggerCtx);
                if (outTradeNo) {
                    try {
                        const channel = await this.channelService.getDefaultChannel();
                        const ctx = new core_1.RequestContext({
                            apiType: 'admin',
                            channel,
                            isAuthorized: true,
                            authorizedAsOwnerOnly: false,
                        });
                        const order = await this.orderService.findOneByCode(ctx, outTradeNo);
                        if (order && order.active) {
                            const payments = order.payments || [];
                            for (const payment of payments) {
                                if (payment.state === 'Authorized') {
                                    await this.orderService.settlePayment(ctx, payment.id);
                                    core_1.Logger.info(`Settled payment ${payment.id} for order ${outTradeNo}`, constants_1.loggerCtx);
                                }
                            }
                        }
                    }
                    catch (e) {
                        core_1.Logger.error(`Failed to settle payment for order ${outTradeNo}: ${e.message}`, constants_1.loggerCtx);
                    }
                }
            }
            res.status(200).json({ code: 'SUCCESS', message: 'OK' });
        }
        catch (e) {
            core_1.Logger.error(`WeChat Pay notify error: ${e.message}`, constants_1.loggerCtx);
            res.status(500).json({ code: 'FAIL', message: e.message });
        }
    }
};
exports.WechatpayController = WechatpayController;
__decorate([
    (0, common_1.Post)('notify'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], WechatpayController.prototype, "notify", null);
exports.WechatpayController = WechatpayController = __decorate([
    (0, common_1.Controller)('wechatpay'),
    __param(0, (0, common_1.Inject)(constants_1.WECHATPAY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.OrderService,
        core_1.ChannelService])
], WechatpayController);
//# sourceMappingURL=wechatpay.controller.js.map