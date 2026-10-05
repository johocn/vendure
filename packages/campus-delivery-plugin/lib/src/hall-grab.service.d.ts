import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderService } from './rider.service';
export declare class HallGrabService {
    private connection;
    private riderService;
    constructor(connection: TransactionalConnection, riderService: RiderService);
    /** 抢单：事务 + pessimistic_write，hallStatus 非 open 即抛「手慢了」。
     * 同时写 delivery customFields（deliveryStaffId/deliveryStatus=assigned），复用其任务体系。
     * 事务内查询与更新均使用事务 em，保证读写同一事务。
     * 注：lock.tables 指定 "order" 表，避免 FOR UPDATE 作用于 customer 外连接的可空侧（PG 报错）。 */
    grab(ctx: RequestContext, orderId: ID): Promise<Order>;
    /**
     * 大厅列表：当前渠道 open 状态订单（含跑腿单），按小费/入厅时间排序。
     * customFields 为嵌入式物理列（物理列名 customFieldsHallstatus 等），
     * QueryBuilder 中必须用 embedded 路径 order.customFields.hallStatus（TypeORM 解析改写），
     * 裸列 order.hallStatus 在 PG 不存在（与 delivery-plugin 同写法）。
     * 渠道过滤：Order 无标量 channelId 列，channels 为多对多关联（同 core findOneInChannel 模式），
     * 故 join order.channels 过滤 channel.id = ctx.channelId。
     */
    hall(ctx: RequestContext): Promise<Order[]>;
}
