import { ID, Order, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderService } from './rider.service';
import { CampusNotifyService } from './campus-notify.service';
export declare class HallGrabService {
    private connection;
    private riderService;
    private notify;
    constructor(connection: TransactionalConnection, riderService: RiderService, notify: CampusNotifyService);
    /** 抢单：事务 + pessimistic_write，hallStatus 非 open 即抛「手慢了」。
     * 同时写 delivery customFields（deliveryStaffId/deliveryStatus=assigned），复用其任务体系。
     * 事务内查询与更新均使用事务 em，保证读写同一事务。
     * 注：lock.tables 指定 "order" 表，避免 FOR UPDATE 作用于 customer 外连接的可空侧（PG 报错）。
     * 多单顺路（plan 3.3）：主单带 routeGroupId 时，同组 hallStatus='open' 的单在同一事务内
     * 一并锁定并写同一骑手（整组接走）；组内骑手自己的单跳过留在大厅。组内查询按 id 升序
     * FOR UPDATE，保证并发抢同组两单时加锁顺序一致，避免 PG 死锁（败者整体回滚重试）。 */
    grab(ctx: RequestContext, orderId: ID): Promise<Order>;
    /** T2/T3 强派原语：hallStatus='open' → 'grabbed'（事务+悲观锁，与 grab 同款防双抢）。
     * 目标骑手须 approved；低信用分在调用方（DispatchJobService）过滤。 */
    grabByRider(ctx: RequestContext, orderId: ID, rider: {
        id: ID;
    }): Promise<boolean>;
    /**
     * 大厅列表：当前渠道 open 状态订单（含跑腿单）。
     * T1: 滞留 > 5min 加急置顶，其次小费降序，再按入厅时间升序（JS 排序，避免 customFields
     * 物理列名在 SQL 排序中的风险）。customFields 为嵌入式物理列，QueryBuilder 中必须用
     * embedded 路径 order.customFields.hallStatus（TypeORM 解析改写）。
     * 渠道过滤：Order 无标量 channelId 列，channels 为多对多关联（同 core findOneInChannel 模式），
     * 故 join order.channels 过滤 channel.id = ctx.channelId。
     */
    hall(ctx: RequestContext): Promise<Order[]>;
}
