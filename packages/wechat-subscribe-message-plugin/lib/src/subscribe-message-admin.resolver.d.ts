import { RequestContext } from '@vendure/core';
import { SubscribeMessageService, SubscribeMessageLogListOptions } from './subscribe-message.service';
export declare class SubscribeMessageAdminResolver {
    private subscribeMessageService;
    constructor(subscribeMessageService: SubscribeMessageService);
    subscribeMessageLogs(ctx: RequestContext, options: SubscribeMessageLogListOptions | undefined): Promise<any>;
}
