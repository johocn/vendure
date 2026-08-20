import { ChannelService, Injector, RequestContext } from '@vendure/core';
import { GroupBuyService } from './group-buy.service';
export declare class GroupBuyJob {
    private channelService;
    private groupBuyService;
    constructor(channelService: ChannelService, groupBuyService: GroupBuyService);
    private stockPrewarmService;
    initStock(injector: Injector): void;
    runCheck(ctx: RequestContext): Promise<void>;
}
