import { ChannelService } from '@vendure/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
/**
 * 达达订单推送回调：POST /delivery-gateway/dada/webhook
 * 验签通过 → parseWebhook → applyStatusEvent（驱动状态机 + OrderPackage 回写）→ 200 {"status":"ok"}
 * 验签失败 401 / provider 未注册 404，均不落库。
 */
export declare class DadaWebhookController {
    private readonly deliveryGateway;
    private readonly channelService;
    constructor(deliveryGateway: DeliveryGatewayService, channelService: ChannelService);
    callback(payload: unknown): Promise<{
        status: string;
    }>;
}
