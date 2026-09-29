import { RequestContext, ChannelService } from '@vendure/core';
export interface ServiceNotifyConfig {
    wecomEnabled?: boolean;
    wecomAgentId?: string;
    wecomCorpId?: string;
    wecomCorpSecret?: string;
    wechatPushEnabled?: boolean;
    wechatPushTemplate?: {
        orderCreated?: string;
        orderShipped?: string;
        orderAfterSale?: string;
    };
    chatChannelEnabled?: boolean;
}
export declare class ServiceNotifyConfigService {
    private channelService;
    constructor(channelService: ChannelService);
    private parseStruct;
    private serializeDomain;
    private mask;
    getMasked(ctx: RequestContext, channelId: string): Promise<ServiceNotifyConfig | null>;
    update(ctx: RequestContext, channelId: string, patch: ServiceNotifyConfig | null): Promise<ServiceNotifyConfig | null>;
}
