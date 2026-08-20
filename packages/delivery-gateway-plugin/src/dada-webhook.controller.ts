import { Body, Controller, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
import { DadaDeliveryProvider } from './dada-delivery-provider';
import { loggerCtx } from './constants';

/**
 * 达达订单推送回调：POST /delivery-gateway/dada/webhook
 * 验签通过 → parseWebhook → applyStatusEvent（驱动状态机 + OrderPackage 回写）→ 200 {"status":"ok"}
 * 验签失败 401 / provider 未注册 404，均不落库。
 */
@Controller('delivery-gateway/dada/webhook')
export class DadaWebhookController {
    constructor(
        private readonly deliveryGateway: DeliveryGatewayService,
        private readonly channelService: ChannelService,
    ) {}

    @Post()
    @HttpCode(200)
    async callback(@Body() payload: unknown): Promise<{ status: string }> {
        const provider = this.deliveryGateway.getProvider('dada') as DadaDeliveryProvider | undefined;
        if (!provider || typeof provider.verifyCallback !== 'function') {
            throw new NotFoundException('dada provider 未注册');
        }
        if (!provider.verifyCallback(payload)) {
            Logger.warn('达达回调验签失败，拒绝', loggerCtx);
            throw new UnauthorizedException('签名校验失败');
        }
        const event = provider.parseWebhook(payload);
        const channel = await this.channelService.getDefaultChannel();
        const ctx = new RequestContext({
            apiType: 'admin',
            channel,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        await this.deliveryGateway.applyStatusEvent(ctx, event);
        return { status: 'ok' };
    }
}