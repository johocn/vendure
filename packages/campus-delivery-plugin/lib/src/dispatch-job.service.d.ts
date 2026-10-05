import { OnApplicationShutdown } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CapacityService } from './capacity.service';
import { HallGrabService } from './hall-grab.service';
import { HallService } from './hall.service';
import { RiderCreditService } from './rider-credit.service';
export declare class DispatchJobService implements OnApplicationShutdown {
    private connection;
    private grab;
    private hall;
    private capacity;
    private credit;
    private timer;
    private running;
    constructor(connection: TransactionalConnection, grab: HallGrabService, hall: HallService, capacity: CapacityService, credit: RiderCreditService);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    private tick;
    private ctxForChannel;
    /**
     * 扫描当前 ctx 渠道：
     * 1) assigned 超 15min 未取货 → 回大厅 + 骑手扣分
     * 2) open 超 autoAssignMinutes → 强派最佳在线骑手（T2）
     * （T4 退款扫描在 Task 8 追加到此方法）
     */
    scan(ctx: RequestContext): Promise<void>;
    /** 订单渠道匹配：channels 关联未加载（无 scalar channelId 可比对）时视为匹配，
     * grabByRider 事务内二次校验 hallStatus 保证幂等，跨渠道重复尝试无害。 */
    private orderInChannel;
}
