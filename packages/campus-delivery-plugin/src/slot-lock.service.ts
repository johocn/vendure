import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
import { DeliverySlot } from './delivery-slot.entity';

@Injectable()
export class SlotLockService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * 支付成功后锁位：UPDATE ... WHERE lockedCount < capacity 乐观锁，affected=0 即满。
     * 返回 false 时调用方标 campusCause='slot_full' 进调度告警，不阻断订单。
     */
    async lock(ctx: RequestContext, order: Order | null): Promise<boolean> {
        const slotId = (order?.customFields as any)?.deliverySlotId;
        if (!slotId) return true; // 未选时段（立即单）跳过
        const slot = await this.connection.getRepository(ctx, DeliverySlot).findOne({ where: { id: slotId as any } });
        if (!slot) {
            Logger.warn(`Order ${order?.code} slot ${slotId} not found, skip lock`, 'CampusSlot');
            return true; // 时段被管理员删除：不阻断，靠 T3 告警人工跟进
        }
        const res = await this.connection
            .getRepository(ctx, DeliverySlot)
            .createQueryBuilder()
            .update(DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < :cap', { id: slot.id, cap: slot.capacity })
            .execute();
        return (res.affected ?? 0) > 0;
    }

    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 仅由「Cancelled 状态转换」调用一次（状态机保证每单只触发一次），
     * 因此无需额外幂等标记；lockedCount 用 GREATEST 兜底防负数。
     */
    async unlock(ctx: RequestContext, orderId: number): Promise<boolean> {
        const order = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
        });
        const slotId = (order?.customFields as any)?.deliverySlotId;
        if (!slotId) return false;
        const res = await this.connection
            .getRepository(ctx, DeliverySlot)
            .createQueryBuilder()
            .update(DeliverySlot)
            .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
            .where('id = :id', { id: slotId as any })
            .execute();
        Logger.info(`Order ${order?.code} slot ${slotId} released`, 'CampusSlot');
        return (res.affected ?? 0) > 0;
    }
}
