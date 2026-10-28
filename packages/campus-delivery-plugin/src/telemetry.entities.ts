import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

/**
 * P4-4 前端埋点：C 端（匿名可用）批量上报的行为事件。
 * 表由 p11-telemetry 迁移创建（生产 synchronize:false）。
 */
@Entity('campus_track_event')
export class CampusTrackEvent extends VendureEntity {
    constructor(input?: DeepPartial<CampusTrackEvent>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    /** 已登录顾客 id（游客为 null） */
    @Column({ type: 'int', nullable: true })
    customerId: number | null;

    /** 端侧匿名会话 id（同一次小程序/H5 会话内稳定） */
    @Column({ type: 'varchar', length: 64, nullable: true })
    sessionId: string | null;

    /** 事件名：page_view / add_to_cart / submit_order / pay_success / review_submit … */
    @Column({ type: 'varchar', length: 64 })
    eventName: string;

    /** 事件发生的页面路径 */
    @Column({ type: 'varchar', length: 128, nullable: true })
    page: string | null;

    /** 事件附加属性（已裁剪体积） */
    @Column({ type: 'jsonb', nullable: true })
    props: Record<string, any> | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ua: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    ip: string | null;
}

/**
 * P4-4 前端错误上报：C 端 / 后台的未捕获异常与 Promise rejection。
 * 与埋点同表族，后台「系统监控」页统一消费。
 */
@Entity('campus_error_report')
export class CampusErrorReport extends VendureEntity {
    constructor(input?: DeepPartial<CampusErrorReport>) {
        super(input);
    }

    @Column({ type: 'int' })
    channelId: number;

    /** c-end（C 端小程序/H5）/ admin（商家后台） */
    @Column({ type: 'varchar', length: 16 })
    source: string;

    /** error / warn */
    @Column({ type: 'varchar', length: 16 })
    level: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ type: 'text', nullable: true })
    stack: string | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    page: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    url: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    ua: string | null;

    @Column({ type: 'int', nullable: true })
    customerId: number | null;
}
