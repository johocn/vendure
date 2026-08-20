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
exports.DadaWebhookController = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const delivery_gateway_service_1 = require("./delivery-gateway.service");
const constants_1 = require("./constants");
/**
 * 达达订单推送回调：POST /delivery-gateway/dada/webhook
 * 验签通过 → parseWebhook → applyStatusEvent（驱动状态机 + OrderPackage 回写）→ 200 {"status":"ok"}
 * 验签失败 401 / provider 未注册 404，均不落库。
 */
let DadaWebhookController = class DadaWebhookController {
    constructor(deliveryGateway, channelService) {
        this.deliveryGateway = deliveryGateway;
        this.channelService = channelService;
    }
    async callback(payload) {
        const provider = this.deliveryGateway.getProvider('dada');
        if (!provider || typeof provider.verifyCallback !== 'function') {
            throw new common_1.NotFoundException('dada provider 未注册');
        }
        if (!provider.verifyCallback(payload)) {
            core_1.Logger.warn('达达回调验签失败，拒绝', constants_1.loggerCtx);
            throw new common_1.UnauthorizedException('签名校验失败');
        }
        const event = provider.parseWebhook(payload);
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
exports.DadaWebhookController = DadaWebhookController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DadaWebhookController.prototype, "callback", null);
exports.DadaWebhookController = DadaWebhookController = __decorate([
    (0, common_1.Controller)('delivery-gateway/dada/webhook'),
    __metadata("design:paramtypes", [delivery_gateway_service_1.DeliveryGatewayService,
        core_1.ChannelService])
], DadaWebhookController);
//# sourceMappingURL=dada-webhook.controller.js.map