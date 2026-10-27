import { Column, Entity, Index } from 'typeorm';
import { DeepPartial, ID, VendureEntity } from '@vendure/core';

/**
 * 广告投放单（P2-3）：商家自助下单 → 模拟支付 → 平台审核 → 按日期投放。
 *
 * 计费口径：按天 × 广告位单价，下单即固化为 unitPriceFen / totalFen，
 * 之后广告位调价不影响已创建的投放单。
 */
@Entity()
@Index('idx_campus_ad_channel_slot', ['channelId', 'slot', 'status'])
export class CampusAdCampaign extends VendureEntity {
    @Column('int') channelId: ID;
    /** homeBanner（首页横幅）/ shopTop（店铺页顶部） */
    @Column({ type: 'varchar', length: 32 }) slot: string;
    @Column({ type: 'varchar', length: 64 }) title: string;
    @Column({ type: 'varchar', length: 512, nullable: true }) imageUrl: string | null;
    @Column({ type: 'varchar', length: 255, nullable: true }) linkUrl: string | null;
    /** 投放起止日（含首尾，YYYY-MM-DD） */
    @Column({ type: 'date' }) startDate: string;
    @Column({ type: 'date' }) endDate: string;
    @Column('int') days: number;
    @Column('int') unitPriceFen: number;
    @Column('int') totalFen: number;
    /** pendingPay / pendingReview / running / rejected / cancelled（已结束由日期实时判定） */
    @Column({ length: 16, default: 'pendingPay' }) status: string;
    @Column({ type: 'varchar', length: 64, nullable: true }) payRef: string | null;
    @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
    @Column({ type: 'text', nullable: true }) reviewNote: string | null;
    @Column({ type: 'varchar', nullable: true }) reviewedBy: string | null;
    @Column({ type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
    @Column({ type: 'varchar', nullable: true }) createdBy: string | null;
    constructor(input?: DeepPartial<CampusAdCampaign>) {
        super(input);
    }
}
