import { EventBus, ChannelService } from '@vendure/core';
export declare class WechatMessageController {
    private channelService;
    private eventBus;
    constructor(channelService: ChannelService, eventBus: EventBus);
    private getCredentials;
    verify(query: {
        signature?: string;
        timestamp?: string;
        nonce?: string;
        echostr?: string;
        channel?: string;
    }): Promise<string>;
    receive(query: {
        channel?: string;
        signature?: string;
        timestamp?: string;
        nonce?: string;
        encrypt_type?: string;
        msg_signature?: string;
    }, body: any): Promise<string>;
}
