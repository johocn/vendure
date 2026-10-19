import { RequestContext, VendureEvent } from '@vendure/core';
/** 提醒阶段：到期前 3 天 / 1 天（PRD FR-A2，各提醒一次） */
export type CouponExpireStage = '3d' | '1d';
/** 一条待触达的券过期提醒载荷 */
export interface CouponExpireRemindPayload {
    customerId: number;
    templateId: number;
    /** 已按会话语言本地化的券名 */
    templateName: string;
    /** 券码（唯一，R4 去重的券维度锚点） */
    couponCode: string;
    expiresAt: Date;
    stage: CouponExpireStage;
}
/**
 * 券过期提醒事件（coupon-plugin 定时扫描产出，notification-plugin 订阅触达）。
 * 通道选择（站内信全量 + 公众号增强）与 R4 防骚扰（同用户同券同阶段 7 天内最多 1 次）
 * 统一在 notification-plugin 订阅侧处理，coupon-plugin 只负责圈出临期券。
 */
export declare class CouponExpireRemindEvent extends VendureEvent {
    readonly ctx: RequestContext;
    readonly payload: CouponExpireRemindPayload;
    constructor(ctx: RequestContext, payload: CouponExpireRemindPayload);
}
