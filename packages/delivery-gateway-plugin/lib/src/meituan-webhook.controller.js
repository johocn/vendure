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
exports.MeituanWebhookController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const delivery_gateway_service_1 = require("./delivery-gateway.service");
const constants_1 = require("./constants");
/** 美团配送回调：POST /delivery-gateway/meituan/webhook（与达达回调保持同一路径风格） */
let MeituanWebhookController = class MeituanWebhookController {
    constructor(deliveryGateway, channelService) {
        this.deliveryGateway = deliveryGateway;
        this.channelService = channelService;
    }
    async callback(payload) {
        const provider = this.deliveryGateway.getProvider('meituan');
        if (!provider || typeof provider.verifyCallback !== 'function') {
            throw new common_1.NotFoundException('meituan provider 未注册');
        }
        if (!provider.verifyCallback(payload)) {
            core_1.Logger.warn('美团回调验签失败，拒绝', constants_1.loggerCtx);
            throw new common_1.UnauthorizedException('签名校验失败');
        }
        const event = provider.parseWebhook(payload);
        if (!event.deliveryOrderNo) {
            core_1.Logger.warn(`美团回调缺少 order_id: ${JSON.stringify(payload)}`, constants_1.loggerCtx);
            return { status: 'ignored' };
        }
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new core_1.RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        await this.deliveryGateway.applyStatusEvent(ctx, event);
        return { status: 'ok' };
    }
};
exports.MeituanWebhookController = MeituanWebhookController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeituanWebhookController.prototype, "callback", null);
exports.MeituanWebhookController = MeituanWebhookController = __decorate([
    (0, common_1.Controller)('delivery-gateway/meituan/webhook'),
    __metadata("design:paramtypes", [delivery_gateway_service_1.DeliveryGatewayService,
        core_1.ChannelService])
], MeituanWebhookController);
//# sourceMappingURL=meituan-webhook.controller.js.map