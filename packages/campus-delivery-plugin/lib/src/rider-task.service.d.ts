import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderService } from './rider.service';
export declare class RiderTaskService {
    private connection;
    private riderService;
    constructor(connection: TransactionalConnection, riderService: RiderService);
    /** 我的任务：本骑手名下已进入配送流程的订单，按下单时间倒序。
     * customFields 在 Vendure 中注册为扁平物理列（registerCustomEntityFields），
     * 故用扁平列取法 order.deliveryStaffId / order.deliveryStatus（同 hall() 的 order.hallStatus）。
     * 渠道过滤：Order 无标量 channelId，join order.channels 过滤 channel.id（同 hall()）。 */
    myTasks(ctx: RequestContext, status?: string): Promise<Order[]>;
    /** 开始配送：assigned → in_progress */
    start(ctx: RequestContext, orderId: ID): Promise<Order>;
    /** 送达：拍照必传 → delivered → 分成入余额 */
    deliver(ctx: RequestContext, orderId: ID, photos: string[], note?: string): Promise<Order>;
    /** 异常上报：不校验状态，标记 exception */
    reportException(ctx: RequestContext, orderId: ID, type: string, photos: string[], note?: string): Promise<Order>;
    private calcEarning;
    private getConfig;
    private assertOwner;
}
