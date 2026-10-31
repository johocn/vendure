import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 客服工单（站内留言，非实时 IM）：顾客提交 → 运营回复 → 关闭。 */
export declare class CampusSupportTicket extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    /** 顾客工单为下单顾客；系统工单（外部运单异常等）无顾客，为 null */
    customerId: number | null;
    orderCode: string | null;
    /** 关联订单主键（建单时按订单号解析并校验归属；未匹配到订单为 null） */
    orderId: number | null;
    /** 关联售后单主键（工单与售后打通：建单自动挂接在途售后单，运营也可手工关联） */
    afterSalesRequestId: number | null;
    /** 来源：customer（顾客提交）/ third_party_exception（外部运单异常自动建单） */
    source: string;
    /** 系统工单幂等键（顾客工单为 null）：同一异常只建一张 */
    dedupeKey: string | null;
    /** 值班人管理员 userId（系统工单建单时按本店值班表自动指派；无值班/顾客工单为 null） */
    assigneeId: number | null;
    /** order / delivery / refund / invoice / other */
    category: string;
    content: string;
    /** 图片 URL 列表（simple-array，逗号分隔） */
    images: string[] | null;
    /** open / replied / closed */
    status: string;
    reply: string | null;
    repliedBy: string | null;
    repliedAt: Date | null;
    constructor(input?: DeepPartial<CampusSupportTicket>);
}
/** 骑手申诉：信用扣分申诉单，后台审核通过后回补信用分。 */
export declare class CampusRiderAppeal extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    riderCustomerId: ID;
    orderId: number | null;
    orderCode: string | null;
    reason: string;
    images: string[] | null;
    /** pending / approved / rejected */
    status: string;
    /** 审核通过时回补的信用分（正数） */
    creditDelta: number;
    reviewNote: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    constructor(input?: DeepPartial<CampusRiderAppeal>);
}
/** 下单黑名单：user（customerId）/ phone。命中后在支付前置闸门拦截。 */
export declare class CampusBlacklist extends VendureEntity {
    [key: string]: any;
    channelId: ID;
    /** user / phone */
    type: string;
    customerId: number | null;
    phone: string | null;
    reason: string | null;
    createdBy: string | null;
    active: boolean;
    constructor(input?: DeepPartial<CampusBlacklist>);
}
