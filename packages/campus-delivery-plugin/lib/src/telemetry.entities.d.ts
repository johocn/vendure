import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * P4-4 前端埋点：C 端（匿名可用）批量上报的行为事件。
 * 表由 p11-telemetry 迁移创建（生产 synchronize:false）。
 */
export declare class CampusTrackEvent extends VendureEntity {
    constructor(input?: DeepPartial<CampusTrackEvent>);
    channelId: number;
    /** 已登录顾客 id（游客为 null） */
    customerId: number | null;
    /** 端侧匿名会话 id（同一次小程序/H5 会话内稳定） */
    sessionId: string | null;
    /** 事件名：page_view / add_to_cart / submit_order / pay_success / review_submit … */
    eventName: string;
    /** 事件发生的页面路径 */
    page: string | null;
    /** 事件附加属性（已裁剪体积） */
    props: Record<string, any> | null;
    ua: string | null;
    ip: string | null;
}
/**
 * P4-4 前端错误上报：C 端 / 后台的未捕获异常与 Promise rejection。
 * 与埋点同表族，后台「系统监控」页统一消费。
 */
export declare class CampusErrorReport extends VendureEntity {
    constructor(input?: DeepPartial<CampusErrorReport>);
    channelId: number;
    /** c-end（C 端小程序/H5）/ admin（商家后台） */
    source: string;
    /** error / warn */
    level: string;
    message: string;
    stack: string | null;
    page: string | null;
    url: string | null;
    ua: string | null;
    customerId: number | null;
}
