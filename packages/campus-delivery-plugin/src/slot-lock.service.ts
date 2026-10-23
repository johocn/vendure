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
     * 锁位成功写 slotLocked=true，取消时只有带此标记的单才归还容量（否则未支付/锁位失败单
     * 取消会把已满时段「放空」，造成容量虚增与超卖）。
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
        const ok = (res.affected ?? 0) > 0;
        if (ok && order?.id) {
            // 锁位成功标记：与容量递增同源，供取消时幂等释放
            await this.connection.getRepository(ctx, Order).update(order.id as any, {
                customFields: { slotLocked: true },
            } as any);
        }
        return ok;
    }

    /**
     * 释放锁位（取消/退款/未支付超时）：订单离开履约链路时归还容量。
     * 原子认领 slotLocked=true → false，保证「同一单只释放一次」，且未锁位/锁位失败的单一律不释放。
     * 返回 true 表示本次确实归还了一个名额。
     */
    async unlock(ctx: RequestContext, orderId: number): Promise<boolean> {
        const claimed: any = await this.connection.rawConnection.query(
            'UPDATE "order" SET "customFieldsSlotlocked" = false '
            + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = true '
            + 'RETURNING "customFieldsDeliveryslotid" AS slot',
            [orderId],
        );
        const rows = Array.isArray(claimed) && Array.isArray(claimed[0]) ? claimed[0] : claimed;
        const slotId = rows?.[0]?.slot;
        if (!slotId) return false; // 未锁位（未支付取消 / 时段已满 / 已释放过）
        const res = await this.connection
            .getRepository(ctx, DeliverySlot)
            .createQueryBuilder()
            .update(DeliverySlot)
            .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
            .where('id = :id', { id: slotId })
            .execute();
        Logger.info(`Order ${orderId} slot ${slotId} released`, 'CampusSlot');
        return (res.affected ?? 0) > 0;
    }
}
