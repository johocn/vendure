import { Injectable } from '@nestjs/common';
import {
    ID,
    Order,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { RiderService } from './rider.service';

@Injectable()
export class HallGrabService {
    constructor(private connection: TransactionalConnection, private riderService: RiderService) {}

    /** 抢单：事务 + pessimistic_write，hallStatus 非 open 即抛「手慢了」。
     * 同时写 delivery customFields（deliveryStaffId/deliveryStatus=assigned），复用其任务体系。
     * 事务内查询与更新均使用事务 em，保证读写同一事务。
     * 注：lock.tables 指定 "order" 表，避免 FOR UPDATE 作用于 customer 外连接的可空侧（PG 报错）。 */
    async grab(ctx: RequestContext, orderId: ID): Promise<Order> {
        const rider = await this.riderService.assertApprovedRider(ctx);
        return this.connection.rawConnection.transaction(async em => {
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
    }

    /**
     * 大厅列表：当前渠道 open 状态订单（含跑腿单），按小费/入厅时间排序。
     * customFields 为嵌入式物理列（物理列名 customFieldsHallstatus 等），
     * QueryBuilder 中必须用 embedded 路径 order.customFields.hallStatus（TypeORM 解析改写），
     * 裸列 order.hallStatus 在 PG 不存在（与 delivery-plugin 同写法）。
     * 渠道过滤：Order 无标量 channelId 列，channels 为多对多关联（同 core findOneInChannel 模式），
     * 故 join order.channels 过滤 channel.id = ctx.channelId。
     */
    async hall(ctx: RequestContext) {
        return this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .leftJoin('order.channels', 'channel')
            .where('channel.id = :ch', { ch: ctx.channelId as any })
            .andWhere('order.customFields.hallStatus = :s', { s: 'open' })
            .orderBy('order.customFields.tip', 'DESC')
            .addOrderBy('order.createdAt', 'ASC')
            .getMany();
    }
}
