import { Customer, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderService } from './rider.service';
export declare class CapacityService {
    private connection;
    private riderService;
    constructor(connection: TransactionalConnection, riderService: RiderService);
    /** 在线骑手：approved 且 5min 内有心跳，**限当前渠道**。
     * 骑手资格本身按渠道生效（rider.service 用 findOneByUserId 默认按当前渠道过滤），
     * 不做渠道过滤会把 A 店的单派给 B 店骑手（其 assertApprovedRider 会直接拒绝）。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径 customer.customFields.riderStatus
     * （与 rider.service.ts listApplications 写法一致）。内存侧再校验一次 riderStatus 双保险。 */
    listOnlineRiders(ctx: RequestContext): Promise<Customer[]>;
    /** T0 预检：C 端下单前提示「运力紧张」 */
    capacityCheck(ctx: RequestContext): Promise<{
        paused: boolean;
        ridersOnline: number;
    }>;
    /** 心跳（带骑手资格校验的封装）：骑手端 30s 定时调 */
    heartbeat(ctx: RequestContext): Promise<{
        online: boolean;
    }>;
}
