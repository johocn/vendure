import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

import { HotelBookingStatus } from './booking-logic';

/**
 * 酒店预订单（P3，per 订单行）：一行酒店订单行 ↔ 一条 booking。
 * - 状态机：pendingDeposit → confirmed（支付事件自动确认）→ checkedIn（核销）→ completed；
 *   分支 cancelled / noShow（均终态）
 * - bookingCode：8 位数字入住码，确认时生成，全局唯一（核销凭码）
 * - cancelDeadlineAt：免费取消截止点（确认时按取消政策 + checkIn 推导固化；P4 取消退款用）
 * - channelToken：创建时的渠道 token（审计冗余；隔离以 productVariantId 全局唯一为准，同 P1 lock）
 * - 日期一律 YYYY-MM-DD varchar（跨库铁律）；时间戳列省略 type + 可选 Date
 */
@Entity()
@Index('idx_hotel_booking_order', ['orderId'])
@Index('idx_hotel_booking_variant_status', ['productVariantId', 'status'])
@Index('idx_hotel_booking_status_dates', ['status', 'checkOut'])
export class HotelBooking extends VendureEntity {
    constructor(input?: DeepPartial<HotelBooking>) {
        super(input);
    }

    /** 入住码（8 位数字，确认时生成；pendingDeposit 阶段为 null。唯一索引允许多 NULL） */
    @Index({ unique: true })
    @Column({ type: 'varchar', length: 8, nullable: true })
    bookingCode: string | null;

    @Column()
    orderId: number;

    @Index()
    @Column()
    orderLineId: number;

    @Column({ type: 'varchar', length: 30, nullable: true })
    orderCode: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    channelToken: string | null;

    @Index()
    @Column()
    productVariantId: number;

    @Column({ type: 'varchar', length: 10 })
    checkIn: string; // YYYY-MM-DD

    @Column({ type: 'varchar', length: 10 })
    checkOut: string; // YYYY-MM-DD

    @Column({ type: 'int' })
    nights: number;

    @Column({ type: 'int', default: 1 })
    roomCount: number; // 间数 = 订单行 quantity

    @Index()
    @Column({ type: 'varchar', length: 20, default: 'pendingDeposit' })
    status: HotelBookingStatus;

    @Column({ type: 'varchar', length: 64, nullable: true })
    ratePlanCode: string | null;

    /** 成交总额（分，订单行实付口径） */
    @Column({ type: 'int' })
    totalCent: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    guestName: string | null;

    @Column({ type: 'varchar', length: 40, nullable: true })
    guestPhone: string | null;

    /** 免费取消截止点（确认时固化；null = 无免费取消窗口或无政策）。可选 Date 省略 type 跨库铁律（勿写 Date | null：联合类型反射成 Object 跨库必炸） */
    @Column({ nullable: true })
    cancelDeadlineAt?: Date;

    @Column({ nullable: true })
    confirmedAt?: Date;

    @Column({ nullable: true })
    checkedInAt?: Date;

    @Column({ nullable: true })
    completedAt?: Date;

    @Column({ nullable: true })
    cancelledAt?: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    cancelReason: string | null;

    /** 实际扣款快照（分，P4 取消时落；0 = 免费取消/未付款；null = 未取消） */
    @Column({ type: 'int', nullable: true })
    cancelFeeCent: number | null;

    /** 关联售后单 id（逾时部分退款走售后审批链；P4，幂等去重用） */
    @Column({ type: 'int', nullable: true })
    afterSalesRequestId: number | null;

    /** 已使用改期次数（P4 Task 15；V1 上限 1，HOTEL_MAX_RESCHEDULES_V1） */
    @Column({ type: 'int', default: 0 })
    rescheduleCount: number;

    /** 最近一次改期完成时间（V1 仅 0/1） */
    @Column({ nullable: true })
    rescheduledAt?: Date;

    /**
     * 待支付补差的改期意向 JSON（P4 Task 15，补差异步支付期间临时持有）：
     * {checkIn,checkOut,nights,newTotalCent,diffCent,paymentId,createdAt}；
     * 支付 Settled 事件完成改期后清空；支付取消/失败亦清空。null = 无在途补差。
     */
    @Column({ type: 'text', nullable: true })
    reschedulePendingJson: string | null;

    /** 是否有在途补差（非持久化；shop SDL 直出） */
    get reschedulePending(): boolean {
        return this.reschedulePendingJson != null;
    }

    /** 房型名（非持久化；仅 admin 列表 listForAdmin 按 ctx 语言 enrich） */
    variantName?: string | null;
}
