import { ID, RequestContext, VendureEvent } from '@vendure/core';
/**
 * 管理侧通知事件（站内信之外的外发钩子）。
 * 由 notification-plugin 在 admin 场景发布，业务插件（如 campus-delivery）订阅后决定是否推到外部群（飞书等）。
 * 只携带已渲染文案与最小定位信息，订阅方自行决定渠道与格式。
 */
export declare class AdminNotifyEvent extends VendureEvent {
    readonly ctx: RequestContext;
    readonly scene: string;
    readonly title: string;
    readonly content: string;
    readonly orderId?: ID | undefined;
    readonly orderCode?: string | undefined;
    readonly shopId?: number | undefined;
    readonly link?: string | undefined;
    constructor(ctx: RequestContext, scene: string, title: string, content: string, orderId?: ID | undefined, orderCode?: string | undefined, shopId?: number | undefined, link?: string | undefined);
}
