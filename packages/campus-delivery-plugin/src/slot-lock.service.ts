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
     * 幂等：先原子认领订单 slotLocked(false→true)，认领失败=已锁过（支付事件重放/并发二次入厅），
     * 直接返回 true 不再递增容量；若容量已满则回滚认领，避免取消时误减造成容量虚增。
     */
    async lock(ctx: RequestContext, order: Order | null): Promise<boolean> {
        const slotId = (order?.customFields as any)?.deliverySlotId;
        if (!slotId) return true; // 未选时段（立即单）跳过
        const slot = await this.connection.getRepository(ctx, DeliverySlot).findOne({ where: { id: slotId as any } });
        if (!slot) {
            Logger.warn(`Order ${order?.code} slot ${slotId} not found, skip lock`, 'CampusSlot');
            return true; // 时段被管理员删除：不阻断，靠 T3 告警人工跟进
        }
        const orderId = Number(order?.id ?? NaN);
        if (Number.isFinite(orderId)) {
            const claim: any = await this.connection.rawConnection.query(
                'UPDATE "order" SET "customFieldsSlotlocked" = true '
                + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = false RETURNING id',
                [orderId],
            );
            const claimed = Array.isArray(claim) && Array.isArray(claim[0]) ? claim[0] : claim;
            if (!Array.isArray(claimed) || !claimed.length) return true; // 已锁位：幂等跳过
        }
        const res = await this.connection
            .getRepository(ctx, DeliverySlot)
            .createQueryBuilder()
            .update(DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < :cap', { id: slot.id, cap: slot.capacity })
            .execute();
        const ok = (res.affected ?? 0) > 0;
        if (!ok && Number.isFinite(orderId)) {
            // 时段已满：回滚认领标记（未真正占位，取消时不得释放名额）
            await this.connection.rawConnection.query(
                'UPDATE "order" SET "customFieldsSlotlocked" = false WHERE id = $1',
                [orderId],
            );
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
