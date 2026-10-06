import { Injectable } from '@nestjs/common';
import {
    ID,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { RiderService } from './rider.service';
import { CampusNotifyService } from './campus-notify.service';

@Injectable()
export class HallGrabService {
    constructor(
        private connection: TransactionalConnection,
        private riderService: RiderService,
        private notify: CampusNotifyService,
    ) {}

    /** 抢单：事务 + pessimistic_write，hallStatus 非 open 即抛「手慢了」。
     * 同时写 delivery customFields（deliveryStaffId/deliveryStatus=assigned），复用其任务体系。
     * 事务内查询与更新均使用事务 em，保证读写同一事务。
     * 注：lock.tables 指定 "order" 表，避免 FOR UPDATE 作用于 customer 外连接的可空侧（PG 报错）。 */
    async grab(ctx: RequestContext, orderId: ID): Promise<Order> {
        const rider = await this.riderService.assertApprovedRider(ctx);
        const order = await this.connection.rawConnection.transaction(async em => {
            const order = await em.getRepository(Order).findOne({
                where: { id: orderId as any },
                relations: ['customer'],
                lock: { mode: 'pessimistic_write', tables: ['order'] },
            });
            const cf = order?.customFields as any;
            if (!order || cf?.hallStatus !== 'open') throw new UserInputError('手慢了，该订单已被抢');
            if (order.customer?.id === rider.id) throw new UserInputError('不能抢自己的订单');
            await em.getRepository(Order).update(order.id, {
                customFields: {
                    hallStatus: 'grabbed',
                    deliveryStaffId: String(rider.id),
                    deliveryStatus: 'assigned',
                    assignedAt: new Date(),
                },
            } as any);
            return em.getRepository(Order).findOneByOrFail({ id: orderId as any });
        });
        // 事务提交后通知下单用户（fire-and-forget，不影响抢单主流程）
        this.notify.user(ctx, order.id, 'riderAssigned');
        return order;
    }

    /** T2/T3 强派原语：hallStatus='open' → 'grabbed'（事务+悲观锁，与 grab 同款防双抢）。
     * 目标骑手须 approved；低信用分在调用方（DispatchJobService）过滤。 */
    async grabByRider(ctx: RequestContext, orderId: ID, rider: { id: ID }): Promise<boolean> {
        const ok = await this.connection.rawConnection.transaction(async em => {
            const order = await em.getRepository(Order).findOne({
                where: { id: orderId as any },
                lock: { mode: 'pessimistic_write' },
            });
            const cf = order?.customFields as any;
            if (!order || cf?.hallStatus !== 'open') return false;
            await em.getRepository(Order).update(order.id, {
                customFields: {
                    hallStatus: 'grabbed',
                    deliveryStaffId: String(rider.id),
                    deliveryStatus: 'assigned',
                    assignedAt: new Date(),
                },
            } as any);
            return true;
        });
        // 事务提交后通知下单用户（T2 自动强派/手动强派共用此触点）
        if (ok) this.notify.user(ctx, orderId, 'riderAssigned');
        return ok;
    }

    /**
     * 大厅列表：当前渠道 open 状态订单（含跑腿单）。
     * T1: 滞留 > 5min 加急置顶，其次小费降序，再按入厅时间升序（JS 排序，避免 customFields
     * 物理列名在 SQL 排序中的风险）。customFields 为嵌入式物理列，QueryBuilder 中必须用
     * embedded 路径 order.customFields.hallStatus（TypeORM 解析改写）。
     * 渠道过滤：Order 无标量 channelId 列，channels 为多对多关联（同 core findOneInChannel 模式），
     * 故 join order.channels 过滤 channel.id = ctx.channelId。
     */
    async hall(ctx: RequestContext) {
        const orders = await this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus = :s', { s: 'open' })
            .getMany();
        const now = Date.now();
        const urgentBefore = now - 5 * 60_000;
        const urgent = (o: Order) => {
            const at = (o.customFields as any).hallEnteredAt;
            return at ? new Date(at).getTime() < urgentBefore : false;
        };
        return orders.sort((a, b) =>
            (urgent(b) ? 1 : 0) - (urgent(a) ? 1 : 0)
            || ((b.customFields as any).tip ?? 0) - ((a.customFields as any).tip ?? 0)
            || new Date((a.customFields as any).hallEnteredAt ?? a.createdAt).getTime()
                - new Date((b.customFields as any).hallEnteredAt ?? b.createdAt).getTime());
    }
}
