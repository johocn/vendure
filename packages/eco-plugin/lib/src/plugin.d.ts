import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EcoEventsListener } from './eco-events.listener';
import { EcoPluginOptions } from './types';
/**
 * 生态行为回调钩子（E5b）：
 * - purchase：监听 OrderPlacedEvent，上报下单用户的 SSO ID（targetId=订单 code）
 * - distribute：监听 distribution-plugin 的 CommissionRecordCreatedEvent，上报 inviter 的 SSO ID
 * - view_product / view_price：POST /eco/events 转发端点（供 nshop 前端调用）
 * 签名密钥/游戏地址走插件 config 或环境变量 GAME_ECO_URL / GAME_ECO_SECRET；
 * 上报为 fire-and-forget + 2s 超时 + 失败静默，绝不影响订单/佣金主流程。
 */
export declare class EcoPlugin implements OnApplicationBootstrap {
    private options;
    private listener;
    private static options;
    constructor(options: EcoPluginOptions, listener: EcoEventsListener);
    static init(options?: EcoPluginOptions): Type<EcoPlugin>;
    onApplicationBootstrap(): Promise<void>;
}
