import { ChannelService } from '@vendure/core';
import { DeliveryGatewayService } from './delivery-gateway.service';
/** 美团配送回调：POST /delivery-gateway/meituan/webhook（与达达回调保持同一路径风格） */
export declare class MeituanWebhookController {
    private readonly deliveryGateway;
    private readonly channelService;
    constructor(deliveryGateway: DeliveryGatewayService, channelService: ChannelService);
    callback(payload: unknown): Promise<{
        status: string;
    }>;
}
