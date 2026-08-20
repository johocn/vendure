import { LogisticsTrackingProvider } from './tracking-provider';
export interface LogisticsPluginOptions {
    defaultShippingStrategy?: 'priority' | 'nearest' | 'stock-first';
    trackingProvider?: LogisticsTrackingProvider;
    /** 自动交易完成：订单 Delivered 后 N 天未确认收货自动转 Completed（Channel.orderCompleteDays 可覆盖） */
    defaultCompleteDays?: number;
}
