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
}
