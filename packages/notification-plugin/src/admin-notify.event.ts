import { ID, RequestContext, VendureEvent } from '@vendure/core';

/**
 * 管理侧通知事件（站内信之外的外发钩子）。
 * 由 notification-plugin 在 admin 场景发布，业务插件（如 campus-delivery）订阅后决定是否推到外部群（飞书等）。
 * 只携带已渲染文案与最小定位信息，订阅方自行决定渠道与格式。
 */
export class AdminNotifyEvent extends VendureEvent {
    constructor(
        public readonly ctx: RequestContext,
        public readonly scene: string,
        public readonly title: string,
        public readonly content: string,
        public readonly orderId?: ID,
        public readonly orderCode?: string,
        public readonly shopId?: number,
        public readonly link?: string,
    ) {
        super();
    }
}
