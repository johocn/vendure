import { Injectable } from '@nestjs/common';
import { Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Order } from '@vendure/core';
import { DeliverySlot } from './delivery-slot.entity';

@Injectable()
export class SlotLockService {
    constructor(private connection: TransactionalConnection) {}

    /**
     * 支付成功后锁位：先原子「容量 +1」（UPDATE ... WHERE lockedCount < capacity），
     * 再原子认领订单 slotLocked(false→true)；认领失败=支付事件重放/并发二次入厅，归还本次多占容量后返回 true。
     * 先占容量再接单可消除旧实现的竞态窗口：旧实现先认领标记、后判容量，若容量已满再回滚标记，
     * 期间并发事件看到「已认领」会错误返回 true，最终订单未占位却按已锁位入厅（时段超额）。
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
        const orderId = Number(order?.id ?? NaN);
        // 容量条件直接用列比较：先用读到快照做条件时，管理员并发调低 capacity 会超额锁位
        const res = await this.connection
            .getRepository(ctx, DeliverySlot)
            .createQueryBuilder()
            .update(DeliverySlot)
            .set({ lockedCount: () => '"lockedCount" + 1' })
            .where('id = :id AND "lockedCount" < "capacity"', { id: slot.id })
            .execute();
        if ((res.affected ?? 0) <= 0) return false; // 时段已满：未写订单标记，无需回滚
        if (Number.isFinite(orderId)) {
            const claim: any = await this.connection.rawConnection.query(
                'UPDATE "order" SET "customFieldsSlotlocked" = true '
                + 'WHERE id = $1 AND COALESCE("customFieldsSlotlocked", false) = false RETURNING id',
                [orderId],
            );
            const claimed = Array.isArray(claim) && Array.isArray(claim[0]) ? claim[0] : claim;
            if (!Array.isArray(claimed) || !claimed.length) {
                // 已锁位（重放/并发）：本次多占的容量必须归还，否则取消只释放一次会虚增容量
                await this.connection
                    .getRepository(ctx, DeliverySlot)
                    .createQueryBuilder()
                    .update(DeliverySlot)
                    .set({ lockedCount: () => 'GREATEST("lockedCount" - 1, 0)' })
                    .where('id = :id', { id: slot.id })
                    .execute();
            }
        }
        return true;
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
