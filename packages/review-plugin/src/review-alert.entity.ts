import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * P4-2 评价品质闭环 · 渠道级预警规则（每渠道一条，缺省 2 星以下预警、不发券）。
 * 表由 campus-delivery-plugin 的 p10-review-alert 迁移创建（生产 synchronize:false）。
 */
@Entity('campus_review_alert_rule')
export class ReviewAlertRule extends VendureEntity {
    constructor(input?: DeepPartial<ReviewAlertRule>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    /** 星级阈值（含）：rating ≤ maxRating 即预警。1-5，默认 2。 */
    @Column({ type: 'int', default: 2 })
    maxRating: number;

    /** 自动致歉券模板 ID（空 = 不发券，仅预警） */
    @Column({ type: 'varchar', nullable: true })
    couponTemplateId: string | null;
}

/** 预警处置状态：new 待处理 / replied 已回评 / closed 已关闭 */
export type ReviewAlertStatus = 'new' | 'replied' | 'closed';

/** 致歉券状态：none 未配置/未发 / issued 已发 / failed 发放失败（可重试） */
export type ReviewAlertCouponStatus = 'none' | 'issued' | 'failed';

/**
 * P4-2 评价品质闭环 · 单条差评预警（reviewId 唯一，幂等）。
 * 与评价解耦存一份快照（正文/星级），后台列表无需 join 评价表。
 */
@Entity('campus_review_alert')
export class ReviewAlert extends VendureEntity {
    constructor(input?: DeepPartial<ReviewAlert>) {
        super(input);
    }

    @Column({ type: 'int', unique: true })
    reviewId: number;

    @Column({ type: 'int' })
    channelId: number;

    @Column({ type: 'int' })
    productId: number;

    @Column({ type: 'int' })
    customerId: number;

    @Column({ type: 'int' })
    rating: number;

    @Column({ type: 'text' })
    content: string;

    /** 归因标签（剧本：异物/少送漏送/口味差…），jsonb 存储 */
    @Column({ type: 'simple-json', nullable: true })
    tags: string[] | null;

    @Column({ type: 'varchar', default: 'none' })
    couponStatus: ReviewAlertCouponStatus;

    @Column({ type: 'varchar', nullable: true })
    couponCode: string | null;

    @Column({ type: 'varchar', default: 'new' })
    status: ReviewAlertStatus;

    /** 处置备注（关闭原因 / 发券失败原因） */
    @Column({ type: 'text', nullable: true })
    note: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    handledAt: Date | null;
}
