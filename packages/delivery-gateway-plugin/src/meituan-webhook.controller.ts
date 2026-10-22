import { Body, Controller, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ChannelService, Logger, RequestContext } from '@vendure/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
import { MeituanDeliveryProvider } from './meituan-delivery-provider';
import { loggerCtx } from './constants';

/** 美团配送回调：POST /delivery-gateway/meituan/webhook（与达达回调保持同一路径风格） */
@Controller('delivery-gateway/meituan/webhook')
export class MeituanWebhookController {
    constructor(
        private readonly deliveryGateway: DeliveryGatewayService,
        private readonly channelService: ChannelService,
    ) {}

    @Post()
    @HttpCode(200)
    async callback(@Body() payload: unknown): Promise<{ status: string }> {
        const provider = this.deliveryGateway.getProvider('meituan') as MeituanDeliveryProvider | undefined;
        if (!provider || typeof provider.verifyCallback !== 'function') {
            throw new NotFoundException('meituan provider 未注册');
        }
        if (!provider.verifyCallback(payload)) {
            Logger.warn('美团回调验签失败，拒绝', loggerCtx);
            throw new UnauthorizedException('签名校验失败');
        }
        const event = provider.parseWebhook(payload);
        if (!event.deliveryOrderNo) {
            Logger.warn(`美团回调缺少 order_id: ${JSON.stringify(payload)}`, loggerCtx);
            return { status: 'ignored' };
        }
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
