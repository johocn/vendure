import { OnApplicationBootstrap, Type } from '@nestjs/common';
import { EventBus } from '@vendure/core';
import { MemberLevelPluginOptions } from './types';
import { MemberLevelService } from './member-level.service';
export declare class MemberLevelPlugin implements OnApplicationBootstrap {
    private options;
    private memberLevelService;
    private eventBus;
    private static options;
    constructor(options: MemberLevelPluginOptions, memberLevelService: MemberLevelService, eventBus: EventBus);
    static init(options?: MemberLevelPluginOptions): Type<MemberLevelPlugin>;
    onApplicationBootstrap(): Promise<void>;
    private handleOrderDelivered;
    /**
     * 订单取消 → 回退已抵扣积分（若该订单曾 redeemPoints 且未回退）+ 清空订单字段。
     */
    private handleOrderCancelled;
    private handleRefundSettled;
}
